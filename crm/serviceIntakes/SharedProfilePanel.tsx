import { useEffect,useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { emptySharedFacts,loadSharedProfile,saveSharedProfile,SHARED_FIELDS,type SharedFacts,type SharedProfile } from './sharedProfile'
export default function SharedProfilePanel({householdId,memberId,onUse}:{householdId:string;memberId:string;onUse?:(facts:SharedFacts)=>void}){
 const [profile,setProfile]=useState<SharedProfile|null>(null),[facts,setFacts]=useState<SharedFacts|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState(''),[revision,setRevision]=useState(0)
 useEffect(()=>{let cancelled=false;setFacts(null);setError('');setConfirmed(false);void(async()=>{
  try{const client=createSupabaseBrowserClient();const [saved,member]=await Promise.all([loadSharedProfile(client,householdId,memberId),client.from('household_members').select('first_name,last_name,email,phone').eq('id',memberId).eq('household_id',householdId).is('deleted_at',null).single()]);if(member.error)throw member.error;if(!cancelled){setProfile(saved);setFacts(saved?.facts??{...emptySharedFacts(),firstName:member.data.first_name,lastName:member.data.last_name,email:member.data.email??'',phone:member.data.phone??''})}}
  catch{if(!cancelled)setError('Unable to load shared client information.')}
 })();return()=>{cancelled=true}},[householdId,memberId,revision])
 async function save(){if(!facts||!confirmed)return;setBusy(true);setError('');setMessage('');try{const saved=await saveSharedProfile(createSupabaseBrowserClient(),householdId,memberId,facts,profile);setProfile(saved);setFacts(saved.facts);setConfirmed(false);setMessage('Shared information saved. Other service intakes can use these confirmed details.')}catch(e){setError(e instanceof Error?e.message:'Unable to save.')}finally{setBusy(false)}}
 return <details className="crm-panel"><summary>Shared client information</summary><p>Information for this person is available across services. Saving here does not overwrite contact records or previously saved intakes.</p>
 {error?<p role="alert">{error} <button disabled={busy} onClick={()=>{if(!facts||window.confirm('Reload and discard unsaved shared-information changes?'))setRevision(x=>x+1)}}>Reload</button></p>:null}
 {message?<p role="status">{message}</p>:null}
 {!facts&&!error?<p>Loading…</p>:null}
 {facts?<><div className="crm-service-intake-grid">{SHARED_FIELDS.map(([key,label,type])=><label className="crm-field" key={key}>{label}<input type={type} maxLength={300} disabled={busy} value={facts[key]} onChange={e=>{setFacts({...facts,[key]:e.target.value});setConfirmed(false);setMessage('')}}/></label>)}</div>
 <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> I confirmed these details for this person with the client.</label><p><button className="crm-primary-btn" disabled={busy||!confirmed} onClick={()=>void save()}>{busy?'Saving…':'Save shared information'}</button></p>
 {profile&&onUse?<button className="crm-secondary-btn" disabled={busy} onClick={()=>onUse(profile.facts)}>Use saved name and contact details in this intake</button>:null}
 {profile?<p>Last confirmed {new Date(profile.confirmed_at).toLocaleString()}. Saved details apply only when you choose to use them.</p>:null}</>:null}</details>
}
