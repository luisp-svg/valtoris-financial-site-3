import {useEffect,useState} from 'react'
import {createSupabaseBrowserClient} from '../../lib/supabase/client'
import {emptyLifeSensitive,HEALTH_FIELDS,validLifeSensitive,type LifeSensitiveAnswers} from '../../modules/lifeIntakeSensitive/contract'
type Member={id:string;first_name:string;last_name:string}
type RecordStatus={exists:boolean;updated_at?:string;ssn_present?:boolean}
async function request(action:'status'|'reveal'|'save',intakeId:string,memberId:string,answers?:LifeSensitiveAnswers,expectedUpdatedAt?:string){
 const response=await fetch('/api/crm/life-intake-sensitive',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action,intakeId,memberId,...(action==='save'?{answers,expectedUpdatedAt:expectedUpdatedAt??null}:{})})})
 const data=await response.json()
 if(!response.ok||data.ok!==true||data.record?.intake_id!==intakeId||data.record.member_id!==memberId)throw new Error(typeof data.error==='string'?data.error:'Unable to confirm protected intake.')
 return data as {record:RecordStatus;answers?:LifeSensitiveAnswers}
}
export default function LifeSensitivePanel({householdId,intakeId,completed,onDirtyChange}:{householdId:string;intakeId:string|null;completed:boolean;onDirtyChange:(dirty:boolean)=>void}){
 const [members,setMembers]=useState<Member[]|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let cancelled=false;void(async()=>{const {data,error:err}=await createSupabaseBrowserClient().from('household_members').select('id,first_name,last_name').eq('household_id',householdId).is('deleted_at',null).order('first_name').order('id');if(!cancelled){if(err)setError('Unable to load household members. Reload the intake to try again.');else setMembers(data??[])}})();return()=>{cancelled=true}},[householdId])
 return <section className="crm-panel"><h2>Protected SSN and health information</h2><p>Choose the proposed insured explicitly. These details are separate from shared client information and ordinary intake answers. Completing the Life intake preserves this version.</p>
 {!intakeId?<p>Save the Life intake draft first to add SSN and health details.</p>:<>
 {error?<p role="alert">{error}</p>:null}
 {!members&&!error?<p>Loading household members…</p>:null}
 {!selected?<label className="crm-field">Proposed insured <select value="" onChange={e=>setSelected(e.target.value)}><option value="">Select a household member</option>{members?.map(m=><option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}</select></label>:<SensitiveEditor key={`${intakeId}:${selected}`} intakeId={intakeId} memberId={selected} name={members?.find(m=>m.id===selected)?`${members.find(m=>m.id===selected)!.first_name} ${members.find(m=>m.id===selected)!.last_name}`:'Selected insured'} completed={completed} onDirtyChange={onDirtyChange} onClose={()=>{setSelected('');onDirtyChange(false)}}/>}
 <p>If the insured is missing, add them as a household member before continuing. Carrier-specific questions and authorizations still use the selected carrier’s application.</p></>}
 </section>
}
function SensitiveEditor({intakeId,memberId,name,completed,onDirtyChange,onClose}:{intakeId:string;memberId:string;name:string;completed:boolean;onDirtyChange:(dirty:boolean)=>void;onClose:()=>void}){
 const [status,setStatus]=useState<RecordStatus|null>(null),[answers,setAnswers]=useState<LifeSensitiveAnswers|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[show,setShow]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{let cancelled=false;void request('status',intakeId,memberId).then(data=>{if(!cancelled)setStatus(data.record)}).catch(()=>{if(!cancelled)setError('Unable to load protected record status. Close and try again.')});return()=>{cancelled=true}},[intakeId,memberId])
 function change(a:LifeSensitiveAnswers){setAnswers(a);setDirty(true);onDirtyChange(true);setMessage('')}
 async function open(){setBusy(true);setError('');try{const data=await request('reveal',intakeId,memberId);if(data.record.exists&&!validLifeSensitive(data.answers))throw new Error('Unable to open protected details.');setStatus(data.record);setAnswers(data.answers??emptyLifeSensitive())}catch(e){setError(e instanceof Error?e.message:'Unable to open.')}finally{setBusy(false)}}
 async function save(){if(!answers||!validLifeSensitive(answers)){setError('Confirm the insured person and record the existing client-permission reference. Enter a valid nine-digit SSN or leave it blank.');return}setBusy(true);setError('');try{const data=await request('save',intakeId,memberId,answers,status?.updated_at);setStatus(data.record);setDirty(false);onDirtyChange(false);setAnswers(null);setShow(false);setMessage('Protected details saved and hidden.')}catch(e){setError(e instanceof Error?e.message:'Unable to save.')}finally{setBusy(false)}}
 return <div><h3>{name}</h3>{error?<p role="alert">{error}</p>:null}{message?<p role="status">{message}</p>:null}
 {status?<p>{status.exists?'Protected details on file.':'No protected details saved for this insured and intake.'} SSN: {status.ssn_present?'•••-••-••••':'Not collected'}</p>:!error?<p>Loading status…</p>:null}
 {!answers&&status?<button type="button" className="crm-secondary-btn" disabled={busy||(!status.exists&&completed)} onClick={()=>void open()}>{busy?'Opening…':status.exists?'Open protected details — access is recorded':'Add SSN and health details'}</button>:null}
 {answers?<fieldset disabled={completed||busy}><legend>Protected details for {name}</legend><label className="crm-field">Social Security number (nine digits; leave blank if not provided)<input type={show?'text':'password'} inputMode="numeric" autoComplete="off" maxLength={9} value={answers.ssn} onChange={e=>change({...answers,ssn:e.target.value})}/></label>
 {HEALTH_FIELDS.map(([key,label])=><label key={key} className="crm-field">{label}<textarea autoComplete="off" rows={2} maxLength={2000} value={answers.health[key]} onChange={e=>change({...answers,health:{...answers.health,[key]:e.target.value}})}/></label>)}
 <label className="crm-field">Existing client-permission reference, source, confirmation date, and unanswered items (required)<textarea autoComplete="off" rows={2} maxLength={1000} value={answers.collectionNote} onChange={e=>change({...answers,collectionNote:e.target.value})}/></label>
 <label><input type="checkbox" checked={answers.confirmedInsured} onChange={e=>change({...answers,confirmedInsured:e.target.checked})}/> I confirmed that {name} is the proposed insured and these answers relate to that person.</label>
 {!completed?<p><button type="button" className="crm-primary-btn" disabled={busy||!answers.confirmedInsured} onClick={()=>void save()}>{busy?'Saving…':'Save protected details'}</button></p>:<p>This completed intake is read-only.</p>}
 </fieldset>:null}
 {answers?<button type="button" disabled={busy} onClick={()=>setShow(v=>!v)}>{show?'Mask SSN':'Show SSN'}</button>:null}
 <p><button type="button" disabled={busy} onClick={()=>{if(!dirty||window.confirm('Discard unsaved protected details and close?'))onClose()}}>Close and hide details</button></p></div>
}
