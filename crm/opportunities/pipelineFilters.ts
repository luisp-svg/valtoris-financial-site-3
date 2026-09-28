import type { OpportunityListItem } from './types'

export type PipelineFilters = { stageId: string; serviceId: string; advisorId: string }
export const EMPTY_PIPELINE_FILTERS: PipelineFilters = { stageId: '', serviceId: '', advisorId: '' }

export function filterPipelineScope(items: readonly OpportunityListItem[], filters: PipelineFilters) {
  return items.filter(item =>
    (!filters.stageId || item.stage_id === filters.stageId) &&
    (!filters.serviceId || item.service_vertical_id === filters.serviceId) &&
    (!filters.advisorId || (filters.advisorId === 'unassigned'
      ? item.assigned_advisor_id === null : item.assigned_advisor_id === filters.advisorId)),
  )
}

/** Options come only from authorized rows; stage IDs remain pipeline-specific. */
export function pipelineFilterOptions(items: readonly OpportunityListItem[]) {
  const stages = new Map<string, string>(), services = new Map<string, string>(), advisors = new Map<string, string>()
  for (const item of items) {
    stages.set(item.stage_id, `${item.pipeline?.name ?? 'Pipeline'} — ${item.stage?.name ?? 'Stage unavailable'}`)
    services.set(item.service_vertical_id, item.service_vertical?.name ?? 'Service unavailable')
    advisors.set(item.assigned_advisor_id ?? 'unassigned', item.assigned_advisor?.display_name ?? 'Unassigned')
  }
  const sorted = (map: Map<string, string>) => Array.from(map, ([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return { stages: sorted(stages), services: sorted(services), advisors: sorted(advisors) }
}

export function pipelineStageSummary(items: readonly OpportunityListItem[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const item of items) {
    const row = counts.get(item.stage_id) ?? { id: item.stage_id, name: `${item.pipeline?.name ?? 'Pipeline'} — ${item.stage?.name ?? 'Stage unavailable'}`, count: 0 }
    row.count++
    counts.set(row.id, row)
  }
  return [...counts.values()].sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}
