import type { ProductionApplicationListItem } from '../production/types'
export const EMPLOYER_STAGES = ['prospect','census','proposal','implementation','active','closed_lost','paused','disqualified'] as const
export const STAGE_TASKS: Record<string,string[]> = {
 prospect:['Review Report Card answers','Confirm preliminary partner relevance','Arrange approved discussion'],
 census:['Provide secure census instructions','Record receipt without copying employee data','Resolve missing information'],
 proposal:['Track partner analysis','Verify assumptions and fees','Record presentation and decision'],
 implementation:['Complete paperwork','Coordinate payroll','Track enrollment','Provide employee education','Confirm launch date'],
 active:['Review enrollment changes','Resolve service issues','Reconcile recurring revenue','Schedule next review'],
 closed_lost:['Record reason'], paused:['Record reason and revisit date'],disqualified:['Record reason'],
}
export type ActionReview={application_id:string;responsible_user_id:string|null;waiting_on:string|null;next_action:string|null;due_date:string|null;unresolved_update:boolean;last_verified_at:string|null;revision:number;updated_at:string}
export type QueueRequirement={id:string;application_id:string;requirement_code:string;custom_label:string|null;status:string;due_date:string|null;updated_at:string}
export type AttentionFilters={owner:string;carrier:string;product:string;waiting:string;overdue:boolean;unresolved:boolean;staleDays:number;stage:string;requirementsOnly:boolean}
export const emptyAttentionFilters=():AttentionFilters=>({owner:'',carrier:'',product:'',waiting:'',overdue:false,unresolved:false,staleDays:0,stage:'',requirementsOnly:false})
export function daysSince(value:string,today:string){const elapsed=(Date.parse(today+'T12:00:00Z')-Date.parse(value))/86400000;return Number.isFinite(elapsed)?Math.max(0,Math.floor(elapsed)):0}
export function attentionRows(apps:ProductionApplicationListItem[],requirements:QueueRequirement[],actions:ActionReview[],filters:AttentionFilters,today:string){
 return apps.flatMap(app=>{
  if(app.deleted_at)return []
  const action=actions.find(a=>a.application_id===app.id)
  const pending=requirements.filter(r=>r.application_id===app.id&&['open','scheduled'].includes(r.status))
  const owner=action?.responsible_user_id||''
  const due=[action?.due_date,app.next_follow_up_date,...pending.map(r=>r.due_date)].filter((v):v is string=>!!v).sort()[0]||null
  const overdue=!!due&&due<today||pending.some(r=>!!r.due_date&&r.due_date<today)
  const updated=[app.updated_at,...pending.map(r=>r.updated_at),...(action?[action.updated_at]:[])].sort().slice(-1)[0]||app.updated_at
  const stale=daysSince(updated,today)
  if(filters.owner&&owner!==filters.owner||filters.carrier&&app.carrier_id!==filters.carrier||filters.product&&app.product_id!==filters.product||filters.stage&&app.production_stage!==filters.stage||filters.waiting&&action?.waiting_on!==filters.waiting||filters.overdue&&!overdue||filters.unresolved&&!action?.unresolved_update||filters.staleDays>stale||filters.requirementsOnly&&!pending.length)return []
  const staleAttention=!['in_force','declined','withdrawn','incomplete','not_taken'].includes(app.production_stage)&&stale>=14
  if(!pending.length&&!action?.next_action&&!action?.unresolved_update&&!overdue&&!staleAttention)return []
  return [{app,action,pending,owner,due,overdue,updated,stale,next:action?.next_action||(pending.length?'Review outstanding requirements':due?'Review scheduled follow-up':'Verify case status and record next action')}]
 }).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||(a.due||'9999').localeCompare(b.due||'9999'))
}
export function validEmployeeCounts(total:number|null,eligible:number|null,enrolled:number|null){return [total,eligible,enrolled].every(v=>v===null||Number.isInteger(v)&&v>=0)&&(total===null||eligible===null||eligible<=total)&&(eligible===null||enrolled===null||enrolled<=eligible)&&(total===null||enrolled===null||enrolled<=total)}
export function revenueSummary(records:{expected_monthly_cents:number|null;received_monthly_cents:number|null}[]){return {expected:records.reduce((n,r)=>n+(r.expected_monthly_cents??0),0),received:records.reduce((n,r)=>n+(r.received_monthly_cents??0),0),unknownExpected:records.filter(r=>r.expected_monthly_cents===null).length,unknownReceived:records.filter(r=>r.received_monthly_cents===null).length}}
export function relatedCandidates(apps:ProductionApplicationListItem[]){const groups=new Map<string,ProductionApplicationListItem[]>();for(const app of apps){if(app.deleted_at)continue;const key=[app.household_id,app.carrier_id,app.product_id].join(':');groups.set(key,[...(groups.get(key)||[]),app])}return [...groups.values()].filter(g=>g.length>1)}
export type PartnerReviewImport={application_id:string;source_system:string;source_record_id:string;last_verified_at:string;partner_record_url?:string;related_application_id?:string;relationship?:string}
export function previewPartnerImport(text:string,apps:ProductionApplicationListItem[],existing:{application_id:string;source_system:string|null;source_record_id:string|null}[]){
 const input:unknown=JSON.parse(text)
 if(!Array.isArray(input)||input.length>500)throw new Error('Use a JSON array with at most 500 rows.')
 const seen=new Set<string>(),seenApps=new Set<string>()
 const keys=['application_id','source_system','source_record_id','last_verified_at','partner_record_url','related_application_id','relationship']
 return input.map((raw:unknown)=>{
  if(!raw||typeof raw!=='object'||Object.keys(raw).some(k=>!keys.includes(k)))throw new Error('Unexpected fields. Use the template; never include partner passwords or client documents.')
  const r=raw as PartnerReviewImport
  if(![r.application_id,r.source_system,r.source_record_id,r.last_verified_at].every(v=>typeof v==='string'&&v.trim().length>0)||!Number.isFinite(Date.parse(r.last_verified_at)))throw new Error('Every row needs an application ID, source system, source record ID and valid verification date.')
  const key=r.source_system.trim()+':'+r.source_record_id.trim()
  if(seen.has(key)||seenApps.has(r.application_id))throw new Error('Duplicate source identity or application in this file. Reconcile before importing.')
  seen.add(key);seenApps.add(r.application_id)
  const app=apps.find(a=>a.id===r.application_id&&!a.deleted_at)
  const identity=existing.find(e=>e.source_system===r.source_system&&e.source_record_id===r.source_record_id)
  const current=existing.find(e=>e.application_id===r.application_id)
  const related=r.related_application_id?apps.find(a=>a.id===r.related_application_id&&!a.deleted_at):null
  const issue=!app?'Application is not available.':identity&&identity.application_id!==r.application_id?'Source ID already belongs to another application.':current?.source_record_id&&(current.source_record_id!==r.source_record_id||current.source_system!==r.source_system)?'Existing source identity differs; reconcile manually.':r.related_application_id&&(!related||related.id===r.application_id)?'Related application is unavailable or identical.':!!r.related_application_id!==!!r.relationship?'Provide both relationship and related application.':r.relationship&&!['related','potential_duplicate','supersedes','superseded_by'].includes(r.relationship)?'Unsupported relationship.':r.partner_record_url&&!/^https:\/\/[^/@ ]+(\/|$)/.test(r.partner_record_url)?'Use an HTTPS partner link without credentials.':null
  return {row:r,issue,operation:current?'update':'create'}
 })
}
