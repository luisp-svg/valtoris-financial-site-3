/**
 * CRM-9A dashboard domain types.
 * Row-scoped via existing RLS — no owner analytics bypass.
 */

export type DashboardLoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; value: T; error: string }

export type OpportunityStatusCounts = {
  open: number
  won: number
  lost: number
}

export type StageSnapshotRow = {
  stageId: string
  stageName: string
  pipelineName: string | null
  count: number
}

export type DashboardTaskItem = {
  id: string
  title: string
  due_date: string | null
  priority: string
  status: string
  household_id: string
  household_name: string | null
  opportunity_id: string | null
}

export type DashboardOpportunityItem = {
  id: string
  title: string
  status: string
  household_id: string
  household_name: string | null
  stage_id: string
  stage_name: string | null
  pipeline_name: string | null
  next_action: string | null
  next_action_due_at: string | null
  stage_entered_at: string | null
  updated_at: string
  created_at: string
}

export type DashboardActivityItem = {
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

export type DashboardHouseholdItem = {
  id: string
  display_name: string
  created_at: string
  status: string
}

export type AttentionKind =
  | 'overdue_task'
  | 'overdue_next_action'
  | 'task_due_today'
  | 'next_action_due_today'
  | 'stale_opportunity'

export type AttentionItem = {
  id: string
  kind: AttentionKind
  title: string
  subtitle: string
  href: string
  sortKey: string
  entityId: string
}

export type CrmDashboardData = {
  statusCounts: DashboardLoadResult<OpportunityStatusCounts>
  stageSnapshot: DashboardLoadResult<StageSnapshotRow[]>
  tasksDueToday: DashboardLoadResult<DashboardTaskItem[]>
  overdueTasks: DashboardLoadResult<DashboardTaskItem[]>
  openOpportunities: DashboardLoadResult<DashboardOpportunityItem[]>
  recentActivities: DashboardLoadResult<DashboardActivityItem[]>
  recentHouseholds: DashboardLoadResult<DashboardHouseholdItem[]>
}

export type DashboardSectionKey = keyof CrmDashboardData
