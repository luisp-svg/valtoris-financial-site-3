import type {VercelRequest,VercelResponse} from '@vercel/node'
import {createHash,randomUUID} from 'node:crypto'
import {createSupabaseServerClient} from '../../lib/supabase/server.js'
import {createSupabaseAdminClient} from '../../lib/supabase/admin.js'
import {MAX_AID_DATA_BYTES,recommendationText,type LoanUpload} from '../../modules/studentLoanReview/contract.js'
import {parseAidData} from './parseAidData.js'
import {fetchOfficialGuidance} from './guidance.js'
import {generateLoanReview,safeIntakeContext} from './generateReview.js'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uploadColumns='id,household_id,case_id,file_name,sha256,byte_size,source_date,created_at,inventory'
const reviewColumns='id,upload_id,status,revision,final_text,output,sources,model,created_at,failure_code'
export function trustedLoanOrigin(origin:unknown):boolean {
 const allowed=new Set(['https://www.valtorisfinancial.com','https://valtorisfinancial.com'])
 if(process.env.VERCEL_URL)allowed.add(`https://${process.env.VERCEL_URL}`)
 if(process.env.NODE_ENV!=='production'){allowed.add('http://localhost:5173');allowed.add('http://127.0.0.1:5173')}
 return typeof origin==='string'&&allowed.has(origin)
}
function failureCode(error:unknown):string {
 const message=error instanceof Error?error.message:''
 if(message==='ai_not_configured')return 'ai_not_configured'
 if(message.includes('guidance')||message.includes('Guidance'))return 'official_guidance_unavailable'
 return 'ai_unavailable'
}
export function loanFailureMessage(code:string):string {
 if(code==='ai_not_configured')return 'The file and loan summary are saved. AI recommendations are not configured yet.'
 if(code==='official_guidance_unavailable')return 'The file is saved. Current official guidance could not be retrieved; retry the AI review later.'
 return 'The file is saved. AI recommendations could not be generated; retry later.'
}
export async function studentLoanHandler(req:VercelRequest,res:VercelResponse) {
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Pragma','no-cache');res.setHeader('Vary','Cookie, Origin');res.setHeader('X-Content-Type-Options','nosniff')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed'})}
 if(!trustedLoanOrigin(req.headers.origin)||!String(req.headers['content-type']??'').startsWith('application/json'))return res.status(403).json({ok:false,error:'Request not allowed'})
 try {
  const body=req.body as Record<string,unknown>
  if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body),'utf8')>MAX_AID_DATA_BYTES*2||!['workspace','read','upload','generate','download'].includes(String(body.action))||Object.keys(body).some(k=>!['action','householdId','caseId','uploadId','fileName','text','authorizationReference','borrowerConfirmed'].includes(k)))return res.status(400).json({ok:false,error:'Invalid request'})
  const client=createSupabaseServerClient(req,res),{data:{user},error:authError}=await client.auth.getUser()
  if(authError||!user)return res.status(401).json({ok:false,error:'Sign in to continue'})
  const {data:profile,error:profileError}=await client.from('profiles').select('id,role,is_active,deleted_at').eq('id',user.id).single()
  if(profileError||!profile?.is_active||profile.deleted_at||!['owner','advisor'].includes(profile.role))return res.status(403).json({ok:false,error:'Active advisor access required'})
  if(body.action==='workspace') {
   const {data,error}=await client.rpc('student_loan_workspace')
   if(error)throw error
   return res.status(200).json({ok:true,households:data??[],aiConfigured:Boolean(process.env.OPENAI_API_KEY)})
  }
  const householdId=String(body.householdId??'')
  if(!uuid.test(householdId))return res.status(400).json({ok:false,error:'Choose a household'})
  const {data:allowed,error:accessError}=await client.rpc('student_loan_can_access',{p_household:householdId})
  if(accessError||allowed!==true)return res.status(404).json({ok:false,error:'Student loan workspace unavailable'})
  const admin=createSupabaseAdminClient()
  if(body.action==='read') {
   const [uploads,reviews,household,cases]=await Promise.all([
    client.from('student_loan_uploads').select(uploadColumns).eq('household_id',householdId).order('created_at',{ascending:false}).limit(100),
    client.from('student_loan_reviews').select(reviewColumns).eq('household_id',householdId).order('created_at',{ascending:false}).limit(100),
    admin.from('households').select('display_name').eq('id',householdId).single(),
    admin.from('service_production_records').select('id,provider_name,production_status').eq('household_id',householdId).eq('service_line','student_loans').is('deleted_at',null).limit(50),
   ])
   if(uploads.error||reviews.error||household.error||cases.error)throw new Error('Read failed')
   return res.status(200).json({ok:true,uploads:uploads.data,reviews:reviews.data,householdName:household.data.display_name,cases:cases.data,aiConfigured:Boolean(process.env.OPENAI_API_KEY)})
  }
  if(body.action==='upload') {
   if(typeof body.text!=='string'||typeof body.fileName!=='string'||!/\.txt$/i.test(body.fileName)||body.borrowerConfirmed!==true||typeof body.authorizationReference!=='string'||body.authorizationReference.trim().length<3||body.authorizationReference.length>300)return res.status(400).json({ok:false,error:'Choose a My Aid Data .txt file and confirm the borrower and permission reference.'})
   let inventory
   try { inventory=parseAidData(body.text) } catch(e) { return res.status(400).json({ok:false,error:e instanceof Error?e.message:'Invalid aid data file'}) }
   const caseId=body.caseId?String(body.caseId):null
   if(caseId) {
    if(!uuid.test(caseId))return res.status(400).json({ok:false,error:'Choose a valid student loan case'})
    const {data:caseRow,error}=await admin.from('service_production_records').select('id').eq('id',caseId).eq('household_id',householdId).eq('service_line','student_loans').is('deleted_at',null).maybeSingle()
    if(error||!caseRow)return res.status(400).json({ok:false,error:'That case does not belong to this student loan workspace'})
   }
   const hash=createHash('sha256').update(body.text).digest('hex')
   const {data:existing,error:existingError}=await admin.from('student_loan_uploads').select(`${uploadColumns},upload_complete`).eq('household_id',householdId).eq('sha256',hash).maybeSingle()
   if(existingError)throw existingError
   if(existing?.upload_complete)return res.status(200).json({ok:true,upload:existing,duplicate:true,message:'This exact file is already saved. Existing reviews are available below.'})
   if(existing)return res.status(409).json({ok:false,error:'An upload of this file is incomplete. Refresh and contact your administrator if it remains unavailable.'})
   const id=randomUUID(),storagePath=`${householdId}/${id}/aid-data.txt`
   const row={id,household_id:householdId,case_id:caseId,uploaded_by:user.id,file_name:body.fileName.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,120),storage_path:storagePath,sha256:hash,byte_size:Buffer.byteLength(body.text,'utf8'),source_date:inventory.sourceDate,authorization_reference:body.authorizationReference.trim(),inventory}
   const {error:insertError}=await admin.from('student_loan_uploads').insert(row)
   if(insertError)return res.status(insertError.code==='23505'?409:503).json({ok:false,error:'This upload could not be confirmed. Refresh before retrying.'})
   const {error:storageError}=await admin.storage.from('student-loan-data').upload(storagePath,Buffer.from(body.text,'utf8'),{contentType:'text/plain',upsert:false})
   if(storageError){await admin.from('student_loan_uploads').delete().eq('id',id).eq('upload_complete',false);throw new Error('Upload failed')}
   const {data:saved,error:finishError}=await admin.rpc('student_loan_finish_upload',{p_actor:user.id,p_upload:id})
   if(finishError||!saved?.upload_complete)return res.status(503).json({ok:false,error:'The file transfer completed but saving could not be confirmed. Refresh before retrying.'})
   // Separate durable upload from generation; even a provider outage never loses the evidence file.
   return res.status(200).json({ok:true,upload:saved,aiConfigured:Boolean(process.env.OPENAI_API_KEY)})
  }
  if(!uuid.test(String(body.uploadId??'')))return res.status(400).json({ok:false,error:'Choose a saved upload'})
  const {data:upload,error:uploadError}=await client.from('student_loan_uploads').select(`${uploadColumns},storage_path`).eq('id',String(body.uploadId)).eq('household_id',householdId).maybeSingle()
  if(uploadError||!upload)return res.status(404).json({ok:false,error:'Saved loan data unavailable'})
  if(body.action==='download') {
   const {data,error}=await admin.storage.from('student-loan-data').download(upload.storage_path)
   if(error||!data)throw new Error('Download failed')
   const {error:auditError}=await admin.from('student_loan_review_audit').insert({household_id:householdId,upload_id:upload.id,actor_id:user.id,action:'original_downloaded'})
   if(auditError)throw new Error('Download audit failed')
   res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="aid-data.txt"')
   return res.status(200).send(Buffer.from(await data.arrayBuffer()))
  }
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({ok:false,code:'ai_not_configured',error:loanFailureMessage('ai_not_configured')})
  const {data:intake,error:intakeError}=await admin.from('assessments').select('id,updated_at,answers').eq('household_id',householdId).eq('assessment_type','student_loan_intake').is('deleted_at',null).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(intakeError)throw new Error('Intake unavailable')
  const {data:review,error:beginError}=await admin.rpc('student_loan_begin_review',{p_actor:user.id,p_upload:upload.id,p_intake:intake?.id??null,p_intake_updated_at:intake?.updated_at??null})
  if(beginError||!review)return res.status(409).json({ok:false,error:beginError?.message?.includes('daily_limit')?'This household has reached today’s review limit. Try again tomorrow.':'A review is already running or the intake changed. Refresh before retrying.'})
  try {
   const sources=await fetchOfficialGuidance()
   const generated=await generateLoanReview((upload as LoanUpload).inventory,safeIntakeContext(intake?.answers),sources)
   const {data:saved,error}=await admin.rpc('student_loan_finish_review',{p_actor:user.id,p_review:review.id,p_output:generated.output,p_sources:sources,p_model:generated.model,p_text:recommendationText(generated.output).slice(0,16000)})
   if(error||saved?.status!=='ready')throw new Error('Review save failed')
   return res.status(200).json({ok:true,review:saved})
  }catch(error) {
   const code=failureCode(error)
   await admin.from('student_loan_reviews').update({status:'failed',failure_code:code,updated_at:new Date().toISOString(),revision:2}).eq('id',review.id).eq('status','generating')
   return res.status(503).json({ok:false,code,error:loanFailureMessage(code)})
  }
 } catch { return res.status(503).json({ok:false,error:'Student loan tools are temporarily unavailable. Refresh before retrying; existing saved files are preserved.'}) }
}
