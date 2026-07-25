import type { DashboardOpportunityItem, OpportunityStatusCounts, StageSnapshotRow } from './types'
import { isOpenLikeStatus } from './staleOpportunity'

export function countOpportunityStatuses(
  opportunities: Array<{ status: string }>,
): OpportunityStatusCounts {
  const counts: OpportunityStatusCounts = { open: 0, won: 0, lost: 0 }
  for (const row of opportunities) {
    if (row.status === 'won') counts.won += 1
    else if (row.status === 'lost') counts.lost += 1
    else if (isOpenLikeStatus(row.status)) counts.open += 1
  }
  return counts
}

/** Group open/on_hold opportunities by stage for the pipeline snapshot. */
export function buildStageSnapshot(
  opportunities: DashboardOpportunityItem[],
  options?: { limit?: number },
): StageSnapshotRow[] {
  const limit = options?.limit ?? 12
  const map = new Map<string, StageSnapshotRow>()

  for (const opp of opportunities) {
    if (!isOpenLikeStatus(opp.status)) continue
    const stageId = opp.stage_id || 'unknown'
    const existing = map.get(stageId)
    if (existing) {
      existing.count += 1
      continue
    }
    map.set(stageId, {
      stageId,
      stageName: opp.stage_name?.trim() || 'Unknown stage',
      pipelineName: opp.pipeline_name,
      count: 1,
    })
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.stageName.localeCompare(b.stageName))
    .slice(0, limit)
}
