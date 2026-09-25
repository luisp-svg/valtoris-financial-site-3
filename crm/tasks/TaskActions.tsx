import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import type { CrmTask } from './types'

export function supportsTaskActions(task: Pick<CrmTask,'source_type'|'workflow_type'>) {
  const sources = ['manual','public_family_ingest','duplicate_resolution','system','digital_identity_ingest']
  return sources.includes(task.source_type ?? '') && (task.workflow_type ? ['review_initial_diagnostic','review_digital_identity_lead'].includes(task.workflow_type) : task.source_type === 'manual')
}
export default function TaskActions({task,onChanged,initiallyOpen=false}:{task:CrmTask;onChanged:()=>Promise<void>;initiallyOpen?:boolean}) {
  const [action,setAction]=useState<'complete'|'reschedule'|null>(null)
  const [date,setDate]=useState(task.due_date ?? ''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  const eligible=supportsTaskActions(task) && ['open','in_progress'].includes(task.status)
  async function save() {
    if(!action||!task.updated_at)return
    setBusy(true);setError('');setMessage('')
    try {
    const {data,error:failure}=await createSupabaseBrowserClient().rpc('act_on_crm_task',{p_task_id:task.id,p_expected_updated_at:task.updated_at,p_action:action,p_due_date:action==='reschedule'?date:null,p_reason:action==='reschedule'?reason:null})
    if(failure||data?.id!==task.id) {
      setError(failure?.message.includes('TASK:conflict')?'This task changed. Refresh the list before trying again.':'Unable to change this task. Check your access and refresh the list.');setBusy(false);return
    }
    setAction(null);setMessage(action==='complete'?'Task completed.':'Task rescheduled.')
    try {await onChanged()} catch {setError('The change was saved, but the list could not refresh. Reload to see the current state.')} finally {setBusy(false)}
    } catch {setError('Unable to confirm the result. Refresh the list before retrying.');setBusy(false)}
  }
  return <details open={initiallyOpen || undefined} className="crm-task-actions"><summary>Open task</summary>
    <p><Link to={`/crm/households/${task.household_id}`}>Open client record</Link></p>
    {task.completed_at?<p>Completed {new Date(task.completed_at).toLocaleString()}</p>:null}
    {!supportsTaskActions(task)?<p>This task must be resolved through its originating workflow. <Link to="/crm/intake">Open Incoming Leads</Link></p>:null}
    {eligible?<><p>Completing a task records the work as done. It does not change consent, report grades, or sales stages.</p><button className="crm-secondary-btn" disabled={busy} onClick={()=>setAction('complete')}>Complete task</button>{' '}<button className="crm-secondary-btn" disabled={busy} onClick={()=>setAction('reschedule')}>Reschedule</button></>:null}
    {action?<div role="group" aria-label={action==='complete'?'Confirm task completion':'Reschedule task'}>
      {action==='complete'?<p>Confirm this work is finished. The completion will be recorded in the client timeline.</p>:<><label className="crm-field">New due date<input type="date" min="1900-01-01" max="2100-12-31" value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label><label className="crm-field">Reason<textarea maxLength={500} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label><p>Use a short work-related reason; do not include sensitive client details.</p></>}
      <button className="crm-primary-btn" disabled={busy||!task.updated_at||(action==='reschedule'&&(!date||!reason.trim()))} onClick={()=>void save()}>{busy?'Saving…':action==='complete'?'Confirm completion':'Save new date'}</button>{' '}<button disabled={busy} onClick={()=>setAction(null)}>Cancel</button>
    </div>:null}
    {error?<p role="alert">{error}</p>:null}{message?<p role="status">{message}</p>:null}
  </details>
}
