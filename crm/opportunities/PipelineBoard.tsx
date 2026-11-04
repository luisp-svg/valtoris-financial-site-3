import { useMemo } from 'react'
import OpportunityPipelineCard from './OpportunityPipelineCard'
import { activeHouseholdOpportunityCounts, pipelineBoardGroups } from './pipelineBoardModel'
import type { OpportunityListItem, OpportunityStageOption } from './types'
import './pipelineBoard.css'
export default function PipelineBoard({ items, allItems, stages }: { items: readonly OpportunityListItem[]; allItems: readonly OpportunityListItem[]; stages: readonly OpportunityStageOption[] }) {
  const groups = useMemo(()=>pipelineBoardGroups(items,stages),[items,stages])
  const counts = useMemo(()=>activeHouseholdOpportunityCounts(allItems),[allItems])
  return <div aria-label="Pipeline board"><p className="crm-muted">Each card is a separate opportunity. Open a card to update its sales stage or next action. A household can have several opportunities moving independently.</p>
    {groups.map(group=><section key={group.id} aria-label={group.name}><h2>{group.name}</h2><div className="crm-sales-board">{group.columns.map(column=><section className="crm-sales-board-column" key={column.id} aria-label={`${group.name}: ${column.name}`}><h3>{column.name} <span className="crm-production-board-count">{column.items.length}</span></h3>
      {column.items.length===0?<p className="crm-muted">No opportunities in this view.</p>:column.items.map(item=><div key={item.id}><OpportunityPipelineCard opportunity={item}/>{(counts.get(item.household_id)??0)>1&&<p className="crm-sales-board-parallel">{counts.get(item.household_id)} active opportunities for this household</p>}</div>)}
    </section>)}</div></section>)}
  </div>
}
