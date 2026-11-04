import type { OpportunityListItem, OpportunityStageOption } from './types'
export function pipelineBoardGroups(items: readonly OpportunityListItem[], stages: readonly OpportunityStageOption[]) {
  const groups = new Map<string, { id: string; name: string; columns: Array<{ id: string; name: string; order: number; items: OpportunityListItem[] }> }>()
  for (const item of items) {
    let group = groups.get(item.pipeline_id)
    if (!group) {
      group = { id: item.pipeline_id, name: item.pipeline?.name ?? 'Sales pipeline', columns: stages.filter(stage => stage.pipeline_id === item.pipeline_id).map(stage => ({ id: stage.id, name: stage.name, order: stage.sort_order, items: [] })) }
      groups.set(group.id, group)
    }
    let column = group.columns.find(column => column.id === item.stage_id)
    if (!column) { column = { id: item.stage_id, name: item.stage?.name ?? 'Stage unavailable', order: item.stage?.sort_order ?? Number.MAX_SAFE_INTEGER, items: [] }; group.columns.push(column) }
    column.items.push(item)
  }
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(group=>({...group,columns:group.columns.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))}))
}
export function activeHouseholdOpportunityCounts(items: readonly OpportunityListItem[]) {
  const counts = new Map<string, number>()
  for (const item of items) if (item.status === 'open' || item.status === 'on_hold') counts.set(item.household_id,(counts.get(item.household_id)??0)+1)
  return counts
}
