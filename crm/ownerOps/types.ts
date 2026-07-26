/**
 * CRM-9B Owner Agency Operations types.
 * Aggregates are RLS-scoped; UI is owner-gated. No owner analytics bypass.
 */

import type { DashboardLoadResult } from '../dashboard/types'

export type OwnerOpsLoadResult<T> = DashboardLoadResult<T>

export type AgencySnapshot = {
  activeHouseholds: number
  openOpportunities: number
  wonThisMonth: number
  lostThisMonth: number
  tasksDueToday: number
  overdueTasks: number
  unassignedHouseholds: number
  unassignedOpportunities: number
  staleOpportunities: number
  opportunitiesWithoutNextAction: number
  monthKey: string
  monthTimeZone: string
}

export type StageHealthRow = {
  stageId: string
  stageName: string
  pipelineName: string | null
  count: number
}

export type WorkloadRow = {
  key: string
  advisorId: string | null
  displayName: string
  isUnassigned: boolean
  households: number
  openOpportunities: number
  tasksDueToday: number
  overdueTasks: number
  needsAttention: number
}

export type OwnerAlertSeverity = 'high' | 'medium' | 'low'

export type OwnerAlertKind =
  | 'stale_opportunity'
  | 'no_next_action'
  | 'overdue_task'
  | 'task_without_assignee'
  | 'household_without_advisor'
  | 'opportunity_without_advisor'

export type OwnerAlert = {
  id: string
  kind: OwnerAlertKind
  severity: OwnerAlertSeverity
  title: string
  detail: string
  count: number
  href: string
}

export type OwnerActivityItem = {
  id: string
  household_id: string
  opportunity_id: string | null
  activity_type: string
  title: string
  body: string | null
  occurred_at: string
  actor_display_name: string | null
  household_name: string | null
}

export type OwnerOpsDashboardData = {
  snapshot: OwnerOpsLoadResult<AgencySnapshot>
  stageHealth: OwnerOpsLoadResult<StageHealthRow[]>
  workload: OwnerOpsLoadResult<WorkloadRow[]>
  alerts: OwnerOpsLoadResult<OwnerAlert[]>
  recentActivity: OwnerOpsLoadResult<OwnerActivityItem[]>
}

/** Lightweight rows used for full-set client aggregation after paginated fetch. */
export type LightHousehold = {
  id: string
  assigned_advisor_id: string | null
  display_name: string
}

export type LightOpportunity = {
  id: string
  title: string
  status: string
  household_id: string
  stage_id: string
  assigned_advisor_id: string | null
  next_action: string | null
  next_action_due_at: string | null
  stage_entered_at: string | null
  updated_at: string
  stage_name: string | null
  pipeline_name: string | null
}

export type LightTask = {
  id: string
  title: string
  due_date: string | null
  status: string
  household_id: string
  assigned_user_id: string | null
  opportunity_id: string | null
}

export type LightAdvisor = {
  id: string
  display_name: string
  is_active: boolean
}
