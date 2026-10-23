import {useEffect,useRef,useState,type FormEvent} from 'react'
import {MAX_AID_DATA_BYTES,STUDENT_LOAN_WORKFLOW_URL,type LoanUpload,type LoanReview} from '../../modules/studentLoanReview/contract'
import {loanRequest} from './api'
import './studentLoans.css'
type WorkspaceData={ok:true;householdName:string;uploads:LoanUpload[];reviews:LoanReview[];cases:{id:string;provider_name:string;production_status:string}[];aiConfigured:boolean}
const money=(value:number|null)=>value===null?'Not available':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value)
export default function StudentLoanWorkspace({householdId}:{householdId:string}) {
 const [data,setData]=useState<WorkspaceData|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0)
 const [file,setFile]=useState<File|null>(null),[caseId,setCaseId]=useState(''),[permission,setPermission]=useState(''),[confirmed,setConfirmed]=useState(false),[selected,setSelected]=useState('')
 const fileInput=useRef<HTMLInputElement>(null)
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setData(null)
  void loanRequest<WorkspaceData>({action:'read',householdId},controller.signal).then(result=>{setData(result);setSelected(current=>result.uploads.some(u=>u.id===current)?current:result.uploads[0]?.id??'')})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load loan data.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[householdId,attempt])
 const upload=data?.uploads.find(u=>u.id===selected),reviews=data?.reviews.filter(r=>r.upload_id===selected)??[],review=reviews[0]
 async function generate(uploadId:string) { await loanRequest({action:'generate',householdId,uploadId});setMessage('AI recommendations saved. No approval step is required.') }
 async function submit(event:FormEvent) {
  event.preventDefault();if(!file||busy)return
  if(!/\.txt$/i.test(file.name)||file.size===0||file.size>MAX_AID_DATA_BYTES){setError('Choose a My Aid Data .txt file up to 512 KB.');return}
  setBusy(true);setError('');setMessage('Saving the original file and preparing the loan summary…')
  try {
   const text=await file.text()
   const result=await loanRequest<{upload:LoanUpload;duplicate?:boolean;aiConfigured?:boolean}>({action:'upload',householdId,caseId:caseId||null,fileName:file.name,text,authorizationReference:permission,borrowerConfirmed:confirmed})
   setSelected(result.upload.id);setFile(null);if(fileInput.current)fileInput.current.value=''
   if(result.duplicate)setMessage('This exact file is already saved. Its existing reviews are shown below.')
   else if(result.aiConfigured){setMessage('File saved. Generating recommendations using current official guidance…');await generate(result.upload.id)}
   else setMessage('File and loan summary saved. Automatic issue flags are available; AI recommendations will be available after the AI connection is configured.')
  }catch(e){setError(e instanceof Error?e.message:'Upload could not be confirmed.');setMessage('')}
  finally {setBusy(false);setAttempt(n=>n+1)}
 }
 async function retry() {
  if(!upload||busy)return;setBusy(true);setError('');setMessage('Generating AI recommendations…')
  try{await generate(upload.id)}catch(e){setError(e instanceof Error?e.message:'AI review unavailable.');setMessage('')}
  finally{setBusy(false);setAttempt(n=>n+1)}
 }
 async function download() {
  if(!upload)return;setError('')
  try{
   const response=await fetch(STUDENT_LOAN_WORKFLOW_URL,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'download',householdId,uploadId:upload.id})})
   if(!response.ok)throw new Error('The original file could not be downloaded.')
   const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=upload.file_name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }catch(e){setError(e instanceof Error?e.message:'Download failed.')}
 }
 return <section className="student-loan-workspace" aria-label="Student loan data and recommendations">
  <div className="crm-panel"><h2>Student loan data & recommendations</h2><p>Upload the borrower’s StudentAid.gov “My Aid Data” text file. TAC keeps the original privately, organizes the loan facts, and automatically generates recommendations when AI is configured.</p>
   <p className="crm-muted">The borrower signs in and downloads the file themselves. Never collect an FSA password or verification code.</p>
   {data?.householdName&&<p><strong>Borrower household: {data.householdName}</strong></p>}
   {data&&!data.aiConfigured&&<p className="crm-banner">AI recommendations are not configured yet. Uploads, loan summaries, and automatic issue flags remain available.</p>}
   <form onSubmit={event=>void submit(event)}><fieldset disabled={busy||loading||!data}>
    <label>Student loan case <select value={caseId} onChange={e=>setCaseId(e.target.value)}><option value="">Household student loan file</option>{data?.cases.map(c=><option key={c.id} value={c.id}>{c.provider_name||'Student loan case'} · {c.production_status}</option>)}</select></label>
    <label>My Aid Data file (.txt, up to 512 KB)<input ref={fileInput} type="file" accept=".txt,text/plain" required onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
    <label>Borrower permission reference<input value={permission} maxLength={300} minLength={3} required onChange={e=>setPermission(e.target.value)} placeholder="Date and reference to recorded permission"/></label>
    <label className="student-loan-confirm"><input type="checkbox" checked={confirmed} required onChange={e=>setConfirmed(e.target.checked)}/>I confirmed this file belongs to the selected household and the borrower authorized storage and AI analysis of the extracted loan facts.</label>
    <p className="crm-muted">AI analysis sends selected loan facts and relevant income/household figures to OpenAI. Names, DOB, SSNs, contact details, passwords, and the original file are excluded.</p>
    <button className="crm-primary-btn" disabled={busy||!file||!confirmed}>{busy?'Processing…':'Upload & review'}</button>
   </fieldset></form>
  </div>
  {error&&<p className="crm-banner crm-banner-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {loading?<p role="status">Loading student loan data…</p>:data&&<>
   <div className="crm-panel"><h3>Saved files</h3>{data.uploads.length?<label>File version<select value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}>{data.uploads.map(u=><option key={u.id} value={u.id}>{u.file_name} · {new Date(u.created_at).toLocaleString()}{u.id===data.uploads[0].id?' · latest upload':''}</option>)}</select></label>:<p>No student loan files uploaded yet.</p>}
    <button className="crm-text-btn" disabled={busy} onClick={()=>setAttempt(n=>n+1)}>Refresh saved files</button>
   </div>
   {upload&&<>
    <div className="crm-panel"><h3>Loan summary</h3><p>Data downloaded: {upload.source_date||'Unknown'} · {upload.inventory.loans.length} loan records</p>
     <div className="student-loan-totals"><p>Reported principal<br/><strong>{money(upload.inventory.totalPrincipal)}</strong></p><p>Reported interest<br/><strong>{money(upload.inventory.totalInterest)}</strong></p></div>
     <h4>Automatic issue flags</h4><ul>{upload.inventory.warnings.map(w=><li key={w}>{w}</li>)}</ul>
     <div className="student-loan-table"><table><thead><tr><th>Loan</th><th>Type</th><th>Principal</th><th>Interest</th><th>Rate</th><th>Reported status</th><th>Plan</th><th>Evidence lines</th></tr></thead><tbody>{upload.inventory.loans.map(l=><tr key={l.number}><td>{l.number}</td><td>{l.type}</td><td>{money(l.principal)}</td><td>{money(l.interest)}</td><td>{l.interestRate===null?'Unknown':`${l.interestRate}%`}</td><td>{l.status}</td><td>{l.repaymentPlan}</td><td>{l.evidenceLines.join(', ')}</td></tr>)}</tbody></table></div>
     <button className="crm-secondary-btn" onClick={()=>void download()}>Download original file</button>
    </div>
    <div className="crm-panel"><h3>AI recommendations</h3><p className="crm-muted">AI-generated educational review paths. They may contain errors and do not establish eligibility or guaranteed savings. No repayment plan, application, or account changes are made.</p>
     {review?.status==='ready'&&review.output?<><p>{review.output.summary}</p><h4>Findings</h4>{review.output.findings.map((f,i)=><article key={i}><h5>{f.title}</h5><p>{f.detail}</p>{f.loanNumbers.length>0&&<p className="crm-muted">Loan records: {f.loanNumbers.join(', ')}</p>}</article>)}<h4>Recommended next steps</h4>{review.output.recommendations.map((r,i)=><article key={i}><h5>{r.title}</h5><p>{r.rationale}</p><p><strong>Next step:</strong> {r.nextStep}</p><p>Sources: {r.sourceIds.map(id=>{const source=review.sources.find(s=>s.id===id);return source?<a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title} </a>:null})}</p></article>)}<h4>Information to confirm</h4><ul>{review.output.missingInformation.map((s,i)=><li key={i}>{s}</li>)}</ul><p className="crm-muted">Generated {new Date(review.created_at).toLocaleString()} · {review.model}. Source file: {upload.file_name}.</p><ul>{review.sources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · Checked {new Date(s.checkedAt).toLocaleString()}</li>)}</ul></>:review?.status==='generating'?<p role="status">A review is running. Refresh to check progress. If it was interrupted, you can retry after five minutes.</p>:review?.status==='failed'?<p>AI generation was unavailable. The source file and summary are preserved.</p>:<p>No AI recommendations saved for this file.</p>}
     <button className="crm-primary-btn" disabled={busy||!data.aiConfigured} onClick={()=>void retry()}>{busy?'Generating…':review?.status==='ready'?'Generate updated recommendations':'Generate recommendations'}</button>
     {reviews.length>1&&<details><summary>Review history ({reviews.length-1} earlier runs)</summary>{reviews.slice(1).map(r=><article key={r.id}><p>{new Date(r.created_at).toLocaleString()} · {r.status}</p>{r.status==='ready'&&<pre className="student-loan-history">{r.final_text}</pre>}</article>)}</details>}
    </div>
   </>}
  </>}
 </section>
}
