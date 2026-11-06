import { useMemo, useRef, useState } from 'react'
import OpportunityPipelineCard from './OpportunityPipelineCard'
import OpportunityLifecycleDialog from './OpportunityLifecycleDialog'
import StageBoard from '../boards/StageBoard'
import {createSupabaseBrowserClient} from '../../lib/supabase/client'
import {fetchOpportunityById,moveOpportunityStage,isOpportunityStageReloadFailure} from './opportunitiesApi'
import {stageRequiresLifecycleConfirmation} from './opportunityValidation'
import { activeHouseholdOpportunityCounts, pipelineBoardGroups } from './pipelineBoardModel'
import type { OpportunityDetail,OpportunityListItem, OpportunityStageOption } from './types'
import './pipelineBoard.css'
export default function PipelineBoard({items,allItems,stages,onChanged}: {items:readonly OpportunityListItem[];allItems:readonly OpportunityListItem[];stages:readonly OpportunityStageOption[];onChanged?:()=>void}){
 const groups=useMemo(()=>pipelineBoardGroups(items,stages),[items,stages]),counts=useMemo(()=>activeHouseholdOpportunityCounts(allItems),[allItems])
 const [pending,setPending]=useState<{opportunity:OpportunityDetail;stage:string}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const moving=useRef(false)
 async function requestMove(id:string,stageId:string){
  if(moving.current||pending)return
  const item=items.find(i=>i.id===id),destination=stages.find(s=>s.id===stageId)
  if(!item||!destination||destination.pipeline_id!==item.pipeline_id||item.stage_id===stageId)return
  moving.current=true;setBusy(true);setMessage('')
  try{
   const db=createSupabaseBrowserClient(),current=await fetchOpportunityById(db,id)
   if(!current)throw new Error('Record unavailable')
   if(current.stage_id!==item.stage_id||current.pipeline_id!==item.pipeline_id){setMessage('This opportunity changed. The board has been refreshed; check its stage before moving it.');onChanged?.();return}
   if(stageRequiresLifecycleConfirmation(destination)||current.status==='won'||current.status==='lost'){setPending({opportunity:current,stage:stageId});return}
   await moveOpportunityStage(db,id,stageId,[...stages],item.pipeline_id,{currentStageId:current.stage_id})
   setMessage(`Moved ${item.household?.display_name??item.title} to ${destination.name}.`);onChanged?.()
  }catch(error){setMessage(isOpportunityStageReloadFailure(error)?'Stage saved. Refreshing the board to confirm the latest record.':'The stage could not be changed. Refresh the board and try again, or open the opportunity.');if(isOpportunityStageReloadFailure(error))onChanged?.()}
  finally{moving.current=false;setBusy(false)}
 }
 return <div aria-label="Pipeline board"><p className="crm-muted">Drag the handle to move an opportunity, or use Move to. Each opportunity moves independently; closing or reopening asks for confirmation.</p>{message&&<p role="status" className="tac-board-move-status">{message}</p>}
  {groups.map(group=><section key={group.id} aria-label={group.name}><h2>{group.name}</h2><StageBoard label={`${group.name} stages`} columns={group.columns.map(c=>({id:c.id,label:c.name,disabled:!stages.some(s=>s.id===c.id)}))} disabled={busy||!!pending} onMove={requestMove} items={group.columns.flatMap(column=>column.items.map(item=>({id:item.id,stage:column.id,label:item.household?.display_name??item.title,content:<><OpportunityPipelineCard opportunity={item}/>{(counts.get(item.household_id)??0)>1&&<p className="crm-sales-board-parallel">{counts.get(item.household_id)} active opportunities for this household</p>}</>})))}/>
   {group.closedItems.length > 0 && <details><summary>Closed / Lost ({group.closedItems.length})</summary>
    {group.closedItems.map(item => <OpportunityPipelineCard key={item.id} opportunity={item}/>)}
   </details>}
  </section>)}
  {pending&&<OpportunityLifecycleDialog key={pending.opportunity.id+pending.stage} mode="move" opportunity={pending.opportunity} initialStageId={pending.stage} onCancel={()=>setPending(null)} onMoved={()=>{setPending(null);setMessage('Stage saved.');onChanged?.()}} onMovedReloadFailed={()=>{setPending(null);setMessage('Stage saved. Refreshing the board.');onChanged?.()}}/>}
 </div>
}
