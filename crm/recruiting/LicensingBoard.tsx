import { useEffect, useRef, useState } from 'react'
import {Link} from 'react-router-dom'
import StageBoard from '../boards/StageBoard'
import {createSupabaseBrowserClient} from '../../lib/supabase/client'
import {recruitCommand,recruitingError} from './api'
import {RECRUIT_STAGES,stageLabel,licenseTypeLabel,type Recruit,type RecruitStage} from './types'
import {licensingStagePayload} from './licensingStageMove'
export default function LicensingBoard({records,canManage,onChanged}:{records:Recruit[];canManage:boolean;onChanged:()=>void}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState<{record:Recruit;stage:RecruitStage}|null>(null)
 const moving=useRef(false),dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{if(pending&&!dialog.current?.open)dialog.current?.showModal()},[pending])
 async function save(record:Recruit,stage:RecruitStage){
  if(moving.current||!canManage||record.is_archived||record.stage===stage)return
  moving.current=true;setBusy(true);setMessage('')
  try{
   await recruitCommand(createSupabaseBrowserClient(),record,'edit',licensingStagePayload(record,stage),`Workflow moved from ${stageLabel(record.stage)} to ${stageLabel(stage)} using Licensing & Appointments.`)
   setPending(null);onChanged()
  }catch(error){setMessage(recruitingError(error))}
  finally{moving.current=false;setBusy(false)}
 }
 function requestMove(id:string,stage:string){
  const record=records.find(r=>r.id===id)
  if(!record||!RECRUIT_STAGES.includes(stage as RecruitStage)||!canManage)return
  const next=stage as RecruitStage
  if(['ready_to_write','active_agent','withdrawn'].includes(next)){setPending({record,stage:next});setMessage('');return}
  return save(record,next)
 }
 return <section aria-label="Licensing workflow board"><p className="crm-muted">Drag an agent’s handle between stages, or use Move to. Licensed stages require complete licensing details. Ready to Write requires a carrier writing code; Active Agent requires a recorded first policy submission. Carrier compliance readiness is reviewed separately.</p>{message&&!pending&&<p role="alert" className="crm-banner crm-banner-error">{message}</p>}
  <StageBoard label="Agent licensing stages" columns={RECRUIT_STAGES.map(s=>({id:s,label:stageLabel(s)}))} disabled={!canManage||busy||!!pending} onMove={requestMove} items={records.map(record=>({id:record.id,stage:record.stage,label:record.full_name,content:<article className="license-board-card"><h4><Link to={`/crm/recruiting/${record.id}`}>{record.full_name}</Link></h4><p>{record.license_types?.map(licenseTypeLabel).join(' · ')||'License type not recorded'}</p><p>{record.email}</p><p><strong>Next action:</strong> {record.next_action||'Not set'}</p><p><strong>Due:</strong> {record.next_action_due_on||'Not set'}</p><Link to={`/crm/recruiting/${record.id}`}>Manage agent</Link></article>}))}/>
  {pending&&<dialog ref={dialog} className="crm-panel tac-stage-confirm" aria-labelledby="licensing-move-title" onCancel={event=>{if(busy)event.preventDefault();else setPending(null)}}>{message&&<p role="alert" className="crm-banner crm-banner-error">{message}</p>}<h2 id="licensing-move-title">Move {pending.record.full_name} to {stageLabel(pending.stage)}?</h2><p>{pending.stage==='withdrawn'?'This changes the tracked workflow stage; prior records and history remain.':'This changes the tracked workflow stage. Ready to Write requires a recorded carrier code. Active Agent also requires the first policy submission reference and date.'}</p><button type="button" className="crm-secondary-btn" disabled={busy} onClick={()=>{setPending(null);setMessage('')}}>Cancel</button>{' '}<button type="button" className="crm-primary-btn" disabled={busy} onClick={()=>void save(pending.record,pending.stage)}>{busy?'Saving…':'Confirm stage change'}</button></dialog>}
 </section>
}
