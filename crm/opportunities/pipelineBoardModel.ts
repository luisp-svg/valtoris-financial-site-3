import type { OpportunityListItem, OpportunityStageOption } from './types'
export function pipelineBoardGroups(items: readonly OpportunityListItem[], stages: readonly OpportunityStageOption[]) {
  const groups = new Map<string, { id: string; name: string; columns: Array<{ id: string; name: string; order: number; items: OpportunityListItem[] }>; closedItems: OpportunityListItem[] }>()
  const studentLoanConsultation = new Map<string, OpportunityStageOption>()
  for (const stage of stages) {
    if (stage.code === 'consultation' && stages.some(candidate => candidate.pipeline_id === stage.pipeline_id && candidate.code === 'student_loan_processing')) {
      studentLoanConsultation.set(stage.pipeline_id, stage)
    }
  }
  const stageById = new Map(stages.map(stage => [stage.id, stage]))
  for (const item of items) {
    const consultation = studentLoanConsultation.get(item.pipeline_id)
    const currentStage = stageById.get(item.stage_id) ?? item.stage
    const columnId = consultation && currentStage?.code === 'identified' ? consultation.id : item.stage_id
    let group = groups.get(item.pipeline_id)
    if (!group) {
      group = { id: item.pipeline_id, name: item.pipeline?.name ?? 'Sales pipeline', closedItems: [], columns: stages.filter(stage => stage.pipeline_id === item.pipeline_id && (!consultation || (stage.code !== 'identified' && !stage.is_lost))).map(stage => ({ id: stage.id, name: stage.name, order: stage.sort_order, items: [] })) }
      groups.set(group.id, group)
    }
    if (consultation && currentStage?.is_lost) {
      group.closedItems.push(item)
      continue
    }
    let column = group.columns.find(column => column.id === columnId)
    if (!column) { column = { id: columnId, name: currentStage?.name ?? 'Stage unavailable', order: currentStage?.sort_order ?? Number.MAX_SAFE_INTEGER, items: [] }; group.columns.push(column) }
    column.items.push(item)
  }
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).map(group=>({...group,columns:group.columns.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))}))
}
export function activeHouseholdOpportunityCounts(items: readonly OpportunityListItem[]) {
  const counts = new Map<string, number>()
  for (const item of items) if (item.status === 'open' || item.status === 'on_hold') counts.set(item.household_id,(counts.get(item.household_id)??0)+1)
  return counts
}
