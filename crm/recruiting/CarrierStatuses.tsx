import type { CarrierReview, Option } from './types'

export const contractingStatusLabel = (review: CarrierReview) => review.contract_status === 'revoked' ? 'Revoked'
  : (review.contract_progress ? {submitted:'Submitted',pending:'Pending',approved:'Approved',code_issued:'Code Issued'}[review.contract_progress] : undefined) ?? (review.contract_status === 'verified' ? 'Approved' : 'Pending')

export default function CarrierStatuses({catalog, reviews, canManage, busy, onAdd, onEdit}: {
 catalog:Option[]; reviews:CarrierReview[]; canManage:boolean; busy:boolean;
 onAdd:(carrierId?:string)=>void; onEdit:(review:CarrierReview)=>void;
}) {
 const carriers = [...catalog, ...[...new Set(reviews.map(review=>review.carrier_id))].filter(id=>!catalog.some(carrier=>carrier.id===id)).map(id=>({id,name:'Previously recorded carrier'}))]
 return <section className="crm-panel" aria-label="Carriers and statuses">
  <div className="crm-panel-head"><h2>Carriers and statuses</h2>{canManage && <button type="button" className="crm-secondary-btn" disabled={busy} onClick={()=>onAdd()}>Add carrier status</button>}</div>
  {!carriers.length && <p>No carriers available.</p>}
  <ul className="carrier-status-list">{carriers.map(carrier=>{
   const scopes = reviews.filter(review=>review.carrier_id===carrier.id)
   return <li key={carrier.id}><h3>{carrier.name}</h3>{!scopes.length ? <><p>Status: Not started</p>{canManage && <button type="button" className="crm-text-btn" disabled={busy} onClick={()=>onAdd(carrier.id)}>Add status for {carrier.name}</button>}</> : scopes.map(review=><div key={review.id}><p>{review.state} · {review.authority_scope} · <strong>{contractingStatusLabel(review)}</strong>{review.writing_code ? ` · Code: ${review.writing_code}` : ''}</p><p>Appointment: {review.appointment_status}</p>{canManage && <button type="button" className="crm-text-btn" disabled={busy} onClick={()=>onEdit(review)}>Update status for {carrier.name}</button>}</div>)}</li>
  })}</ul>
 </section>
}
