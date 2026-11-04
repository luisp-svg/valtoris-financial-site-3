import {useCallback,useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import { fetchAppointmentsPage, type Appointment } from '../../crm/appointments/appointmentsApi'
import {createSupabaseBrowserClient} from '../../lib/supabase/client'
import '../../crm/relaunch/relaunch.css'
export default function CrmAppointmentsPage(){
 const [rows,setRows]=useState<Appointment[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('upcoming'),[page,setPage]=useState(1),[total,setTotal]=useState(0)
 const requestVersion=useRef(0)
 const cancelLoad=useCallback(()=>{requestVersion.current++},[])
 const load=useCallback(async()=>{
  const version=++requestVersion.current
  setBusy(true);setError('')
  try{
   const result=await fetchAppointmentsPage(createSupabaseBrowserClient(),page,filter==='upcoming')
   if(version!==requestVersion.current)return
   const lastPage=Math.max(1,Math.ceil(result.total/50))
   if(page>lastPage){setPage(lastPage);return}
   setRows(result.rows);setTotal(result.total)
  }catch{if(version!==requestVersion.current)return;setRows([]);setTotal(0);setError('Appointments could not be loaded. Try refreshing appointments.')}
  finally{if(version===requestVersion.current)setBusy(false)}
 },[page,filter])
 useEffect(()=>{void load();return cancelLoad},[load,cancelLoad])
 const visible=rows
 return <div className="crm-page tac-workspace"><h1>Appointments</h1><p>Consultation reservations are saved in TAC before AgentCRM confirmation. A pending reservation is not a confirmed provider booking.</p><div className="tac-filters"><label>Show<select value={filter} onChange={event=>{setFilter(event.target.value);setPage(1)}}><option value="upcoming">Upcoming</option><option value="all">All appointments</option></select></label><button type="button" disabled={busy} onClick={()=>void load()}>Refresh appointments</button></div>{error&&<p role="alert">{error}</p>}{busy?<p role="status">Loading appointments…</p>:!error&&<nav aria-label="Appointment pages"><p>{total?`${(page-1)*50+1}–${Math.min(page*50,total)} of ${total} appointments`:'No appointments match this view.'}</p><button type="button" style={{minHeight:44}} disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button> <button type="button" style={{minHeight:44}} disabled={page*50>=total} onClick={()=>setPage(page+1)}>Next</button></nav>}{!busy&&!error&&visible.map(row=><article className="tac-row" key={row.id}><h2>{row.title}</h2><p><Link to={`/crm/households/${row.household_id}`}>{row.households?.display_name||'Client workspace'}</Link></p><p>{new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short'}).format(new Date(row.starts_at))}</p><p><strong>Appointment:</strong> {row.status} · <strong>AgentCRM:</strong> {row.agentcrm_sync_status||'Not linked'}</p>{row.agentcrm_sync_status==='pending'||row.agentcrm_sync_status==='held'?<p>Check the existing reservation before creating another appointment. An uncertain provider response may require review.</p>:null}{row.external_agentcrm_event_id&&<p>Provider event: {row.external_agentcrm_event_id}</p>}{row.notes&&<p>{row.notes}</p>}</article>)}</div>
}
