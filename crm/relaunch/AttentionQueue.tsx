import { useCrmAuth } from '../auth/CrmAuthContext'
import { fetchAssigneeOptions } from '../tasks/tasksApi'
import type { AssigneeOption } from '../tasks/types'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { crmProductionPath } from '../../constants/routes'
import type { ProductionApplicationListItem } from '../production/types'
import { attentionRows, emptyAttentionFilters, type ActionReview, type QueueRequirement } from './model'
import { fetchReviewRows } from './api'
export default function AttentionQueue({items,today}:{items:ProductionApplicationListItem[];today:string}){
 const {role,profile}=useCrmAuth()
 const [people,setPeople]=useState<AssigneeOption[]>([])
 useEffect(()=>{let active=true;fetchAssigneeOptions(createSupabaseBrowserClient(),role==='owner'?'owner':'advisor',profile?.id||'').then(rows=>{if(active)setPeople(rows)}).catch(()=>{});return()=>{active=false}},[role,profile?.id])
 const [requirements,setRequirements]=useState<QueueRequirement[]>([]),[actions,setActions]=useState<ActionReview[]>([]),[error,setError]=useState(''),[filters,setFilters]=useState(emptyAttentionFilters)
 useEffect(()=>{let active=true;Promise.allSettled([createSupabaseBrowserClient().from('policy_application_requirements').select('id,application_id,requirement_code,custom_label,status,due_date,updated_at').is('deleted_at',null).in('status',['open','scheduled']).limit(5000),fetchReviewRows<ActionReview>('tac_application_actions')]).then(([req,act])=>{if(!active)return;if(req.status==='fulfilled'&&!req.value.error)setRequirements(req.value.data||[]);else setError('Requirements could not be loaded. Open the application to verify.');if(act.status==='fulfilled')setActions(act.value);else setError('Action ownership and waiting filters await the local TAC migration. Existing requirements remain available.')});return()=>{active=false}},[])
 const rows=attentionRows(items,requirements,actions,filters,today)
 const options=(field:'carrier'|'product')=>[...new Map(items.map(a=>[a[field+'_id' as 'carrier_id'|'product_id'],a[field]?.name||'Unknown'])).entries()]
 return <section className="crm-card tac-attention"><h2>Needs Attention — next actions</h2><p>Client → application → requirement → responsible person → due date → last update → next action. Message counts do not determine case urgency.</p>{error&&<p role="status">{error}</p>}<div className="tac-filters">
 <label>Responsible person<select value={filters.owner} onChange={e=>setFilters({...filters,owner:e.target.value})}><option value="">Everyone I can access</option>{[...new Set(actions.map(a=>a.responsible_user_id).filter(Boolean))].map(id=><option key={id} value={id!}>{people.find(p=>p.id===id)?.full_name||'Assigned team member'}</option>)}</select></label>
 {(['carrier','product'] as const).map(field=><label key={field}>{field==='carrier'?'Carrier':'Product'}<select value={filters[field]} onChange={e=>setFilters({...filters,[field]:e.target.value})}><option value="">All</option>{options(field).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>)}
 <label>Waiting on<select value={filters.waiting} onChange={e=>setFilters({...filters,waiting:e.target.value})}><option value="">All</option>{['client','carrier','internal'].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Application stage<select value={filters.stage} onChange={e=>setFilters({...filters,stage:e.target.value})}><option value="">All</option>{[...new Set(items.map(a=>a.production_stage))].map(v=><option key={v}>{v}</option>)}</select></label>
 <label>Days without update<input type="number" min="0" value={filters.staleDays} onChange={e=>setFilters({...filters,staleDays:Math.max(0,Number(e.target.value))})}/></label>
 {([['overdue','Overdue'],['unresolved','Unresolved update'],['requirementsOnly','Outstanding requirements']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.checked})}/>{label}</label>)}
 </div><p>{rows.length} cases in the currently loaded records.</p>{rows.map(({app,action,pending,due,updated,next,overdue})=><article className="tac-row" key={app.id}><h3><Link to={crmProductionPath(app.id)}>{app.household?.display_name||'Client'} · {app.application_number||app.id}</Link></h3><p>{app.carrier?.name} · {app.product?.name} · {app.production_stage}</p><p><strong>Requirement:</strong> {pending.map(r=>r.custom_label||r.requirement_code.replace(/_/g,' ')).join(', ')||'None recorded'}</p><p><strong>Responsible:</strong> {people.find(p=>p.id===action?.responsible_user_id)?.full_name||(action?.responsible_user_id?'Assigned team member':'Not assigned')} · <strong>Due:</strong> {due||'Not scheduled'} {overdue?'— overdue':''} · <strong>Last update:</strong> {updated.slice(0,10)}</p><p><strong>Next:</strong> {next}</p><Link to={`/crm/production/${app.id}?tab=requirements`}>Open case and resolve requirements</Link> · <Link to={`/crm/tac-review/${app.id}`}>Record next action</Link></article>)}{!rows.length&&<p>No matching case actions in the loaded records.</p>}</section>
}
