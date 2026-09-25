import type {VercelRequest,VercelResponse} from '@vercel/node'
import {createSupabaseServerClient} from '../../lib/supabase/server.js'
import {createSupabaseAdminClient} from '../../lib/supabase/admin.js'
import {validLifeSensitive} from '../../modules/lifeIntakeSensitive/contract.js'
import {decryptLifeSensitive,encryptLifeSensitive} from '../../server/lifeIntakeSensitive/crypto.js'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function trustedSensitiveOrigin(origin:unknown):boolean{
 const allowed=new Set(['https://www.valtorisfinancial.com','https://valtorisfinancial.com'])
 if(process.env.VERCEL_URL)allowed.add(`https://${process.env.VERCEL_URL}`)
 if(process.env.NODE_ENV!=='production'){allowed.add('http://localhost:5173');allowed.add('http://127.0.0.1:5173')}
 return typeof origin==='string'&&allowed.has(origin)
}
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Pragma','no-cache');res.setHeader('Vary','Cookie, Origin');res.setHeader('X-Content-Type-Options','nosniff')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed'})}
 if(!trustedSensitiveOrigin(req.headers.origin)||!String(req.headers['content-type']??'').startsWith('application/json'))return res.status(403).json({ok:false,error:'Request not allowed'})
 try{
  const body=req.body as Record<string,unknown>
  if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body),'utf8')>40000||Object.keys(body).some(k=>!['action','intakeId','memberId','answers','expectedUpdatedAt'].includes(k))||!['status','reveal','save'].includes(String(body.action))||!uuid.test(String(body.intakeId))||!uuid.test(String(body.memberId)))return res.status(400).json({ok:false,error:'Invalid request'})
  const client=createSupabaseServerClient(req,res),{data:{user},error:authError}=await client.auth.getUser()
  if(authError||!user)return res.status(401).json({ok:false,error:'Sign in to continue'})
  const admin=createSupabaseAdminClient(),intakeId=String(body.intakeId),memberId=String(body.memberId)
  if(body.action==='save'){
   if(!validLifeSensitive(body.answers)||!(body.expectedUpdatedAt===null||typeof body.expectedUpdatedAt==='string'))return res.status(400).json({ok:false,error:'Check the protected fields, record the client-permission reference, and confirm the insured person. SSN must be nine digits or left blank.'})
   const encrypted=encryptLifeSensitive(body.answers,intakeId,memberId)
   const {data,error}=await admin.rpc('save_life_intake_sensitive',{p_actor:user.id,p_intake:intakeId,p_member:memberId,p_expected_updated_at:body.expectedUpdatedAt,p_ciphertext:encrypted,p_ssn_present:body.answers.ssn!==''})
   if(error)return res.status(error.message.includes('conflict')?409:403).json({ok:false,error:error.message.includes('conflict')?'Another advisor updated these details. Close and reopen before saving.':'This protected record cannot be changed.'})
   if(data?.intake_id!==intakeId||data.member_id!==memberId||typeof data.updated_at!=='string')throw new Error('Unconfirmed save')
   return res.status(200).json({ok:true,record:{exists:true,intake_id:intakeId,member_id:memberId,updated_at:data.updated_at,ssn_present:data.ssn_present}})
  }
  const {data,error}=await admin.rpc('read_life_intake_sensitive',{p_actor:user.id,p_intake:intakeId,p_member:memberId,p_reveal:body.action==='reveal'})
  if(error||data?.intake_id!==intakeId||data.member_id!==memberId)return res.status(404).json({ok:false,error:'Protected intake unavailable'})
  const {ciphertext,...record}=data
  if(body.action==='reveal'&&data.exists){if(data.key_version!=='v1'||typeof ciphertext!=='string')throw new Error('Unavailable version');return res.status(200).json({ok:true,record,answers:decryptLifeSensitive(ciphertext,intakeId,memberId)})}
  return res.status(200).json({ok:true,record})
 }catch{return res.status(503).json({ok:false,error:'Protected intake is temporarily unavailable. Your entries have not been confirmed saved.'})}
}
