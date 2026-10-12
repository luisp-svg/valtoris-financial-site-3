import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { useCrmAuth } from '../auth/CrmAuthContext'
import { fetchAssigneeOptions } from '../tasks/tasksApi'
import type { AssigneeOption } from '../tasks/types'
import type { ProductionApplicationDetail } from './types'
type Tracking = { enabled: boolean; assigned_user_id: string; revision: number; task_id: string | null; sync_error: string | null }
export default function ProductionTaskTracking({application}:{application:ProductionApplicationDetail}) {
  const {role,profile}=useCrmAuth()
  const [tracking,setTracking]=useState<Tracking|null>(null),[options,setOptions]=useState<AssigneeOption[]>([])
  const [assignee,setAssignee]=useState(''),[enabled,setEnabled]=useState(true),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const load=useCallback(async()=>{
    if(!profile || !role)return
    setLoading(true);setError('')
    try {
      const db=createSupabaseBrowserClient()
      const result=await db.from('production_task_tracking').select('*').eq('application_id',application.id).maybeSingle()
      if(result.error)throw result.error
      const row=result.data as Tracking|null
      setTracking(row);setEnabled(row?.enabled??true);setAssignee(row?.assigned_user_id??profile.id)
      if(role==='owner') {
        const people=await fetchAssigneeOptions(db,role,profile.id)
        const household=await db.from('households').select('assigned_advisor_id').eq('id',application.household_id).single()
        if(household.error)throw household.error
        let advisorUserId: string|null=null
        if(household.data.assigned_advisor_id){
          const advisor=await db.from('advisor_profiles').select('user_id').eq('id',household.data.assigned_advisor_id).maybeSingle()
          if(advisor.error)throw advisor.error
          advisorUserId=advisor.data?.user_id??null
        }
        setOptions(people.filter(p=>p.role==='owner'||p.id===advisorUserId))
      }
    } catch {setError('Unable to load task tracking. Refresh to check access and setup.')}
    finally {setLoading(false)}
  },[application.id,application.household_id,profile,role])
  useEffect(()=>{void load()},[load,application.next_follow_up_date,application.production_stage])
  async function save(){
    if(busy)return
    setBusy(true);setError('');setNotice('')
    try {
      const {data,error:failure}=await createSupabaseBrowserClient().rpc('configure_production_task_tracking',{
        p_application_id:application.id,p_assigned_user_id:assignee,p_enabled:enabled,p_expected_revision:tracking?.revision??0,
      })
      if(failure)throw failure
      const row=data as Tracking
      setTracking(row);setEnabled(row.enabled);setAssignee(row.assigned_user_id)
      setNotice(row.enabled?'Tracking saved. Tasks follow the case’s follow-up date.':'Tracking paused. Existing tasks remain available until completed.')
    }catch(e){setError(e && typeof e==='object' && 'message' in e && String(e.message).includes('FOLLOWUP:conflict')?'Tracking changed. Refresh before saving again.':'Unable to save tracking. Refresh and choose an active owner or the assigned household advisor.')}
    finally{setBusy(false)}
  }
  if(application.deleted_at)return null
  return <section className="crm-panel" aria-labelledby="production-tracking-heading">
    <h2 id="production-tracking-heading">Follow-up task tracking</h2>
    <p>Create one assigned task for this case’s follow-up date. Case changes update unfinished work. A new date after completion creates the next task. Closed cases or a cleared date cancel unfinished tracked work.</p>
    {loading?<p>Loading task tracking…</p>:<>
      {role==='owner'?<><label className="crm-field">Follow-up assignee<select value={assignee} disabled={busy||!!error} onChange={e=>setAssignee(e.target.value)}>
        {assignee&&!options.some(o=>o.id===assignee)?<option value={assignee}>Current assignee (check access)</option>:null}
        {options.map(o=><option key={o.id} value={o.id}>{o.full_name||o.email}</option>)}
      </select></label><label><input type="checkbox" checked={enabled} disabled={busy||!!error} onChange={e=>setEnabled(e.target.checked)}/> Automatically track case follow-ups</label><p>Only owners and the assigned household advisor can receive this work.</p><button className="crm-primary-btn" disabled={busy||!!error||!assignee} onClick={()=>void save()}>{busy?'Saving…':'Save task tracking'}</button></>:<p>{tracking?.enabled?'Automatic task tracking is enabled.':'Automatic task tracking is not enabled. Ask an owner to configure it.'}</p>}
      {!application.next_follow_up_date&&<p>Set a follow-up date on the case to generate a task.</p>}
      {tracking?.task_id&&<p><Link to={`/crm/tasks?task=${tracking.task_id}`}>Open tracked task</Link></p>}
      {tracking?.sync_error&&<p role="alert">{tracking.sync_error}</p>}
    </>}
    {error&&<p role="alert">{error} <button disabled={busy} onClick={()=>void load()}>Refresh tracking</button></p>}
    {notice&&<p role="status">{notice}</p>}
  </section>
}
