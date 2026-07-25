/**
 * CRM-9A dashboard queries — RLS-scoped via authenticated browser client.
 * Prefer head counts + limited selects; never invent financial fields.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { localDateString } from './dates'
import { settleDashboardLoad } from './loadState'
import { countOpportunityStatuses, buildStageSnapshot } from './stageSnapshot'
import type {
  CrmDashboardData,
  DashboardActivityItem,
  DashboardHouseholdItem,
  DashboardOpportunityItem,
  DashboardTaskItem,
  OpportunityStatusCounts,
  StageSnapshotRow,
} from './types'

export const DASHBOARD_OPEN_OPP_LIMIT = 200
export const DASHBOARD_TASK_LIMIT = 50
export const DASHBOARD_ACTIVITY_LIMIT = 15
export const DASHBOARD_RECENT_HOUSEHOLD_LIMIT = 5

const TASK_SELECT = `
  id,
  title,
  due_date,
  priority,
  status,
  household_id,
  opportunity_id,
  household:households!tasks_household_id_fkey ( id, display_name )
`

const OPEN_OPP_SELECT = `
  id,
  title,
  status,
  household_id,
  stage_id,
  next_action,
  next_action_due_at,
  stage_entered_at,
  updated_at,
  created_at,
  household:households!household_id ( id, display_name ),
  stage:pipeline_stages!stage_id ( id, name ),
  pipeline:pipelines!pipeline_id ( id, name )
`

const ACTIVITY_SELECT = `
  id,
  household_id,
  opportunity_id,
  activity_type,
  title,
  body,
  occurred_at,
  actor_user_id,
  household:households!household_id ( id, display_name ),
  actor:profiles!activities_actor_user_id_fkey ( id, full_name )
`

const RECENT_HOUSEHOLD_SELECT = `
  id,
  display_name,
  created_at,
  status
`

function asSingle<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null
  return (value as T) ?? null
}

function normalizeTask(row: Record<string, unknown>): DashboardTaskItem {
  const household = asSingle<{ id: string; display_name: string }>(row.household)
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    due_date: (row.due_date as string | null) ?? null,
    priority: String(row.priority ?? 'medium'),
    status: String(row.status ?? 'open'),
    household_id: String(row.household_id),
    household_name: household?.display_name ?? null,
    opportunity_id: (row.opportunity_id as string | null) ?? null,
  }
}

function normalizeOpenOpportunity(row: Record<string, unknown>): DashboardOpportunityItem {
  const household = asSingle<{ id: string; display_name: string }>(row.household)
  const stage = asSingle<{ id: string; name: string }>(row.stage)
  const pipeline = asSingle<{ id: string; name: string }>(row.pipeline)
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    status: String(row.status ?? 'open'),
    household_id: String(row.household_id),
    household_name: household?.display_name ?? null,
    stage_id: String(row.stage_id),
    stage_name: stage?.name ?? null,
    pipeline_name: pipeline?.name ?? null,
    next_action: (row.next_action as string | null) ?? null,
    next_action_due_at: (row.next_action_due_at as string | null) ?? null,
    stage_entered_at: (row.stage_entered_at as string | null) ?? null,
    updated_at: String(row.updated_at ?? ''),
    created_at: String(row.created_at ?? ''),
  }
}

function normalizeActivity(row: Record<string, unknown>): DashboardActivityItem {
  const household = asSingle<{ id: string; display_name: string }>(row.household)
  const actor = asSingle<{ id: string; full_name: string | null }>(row.actor)
  return {
    id: String(row.id),
    household_id: String(row.household_id),
    opportunity_id: (row.opportunity_id as string | null) ?? null,
    activity_type: String(row.activity_type ?? 'other'),
    title: String(row.title ?? ''),
    body: (row.body as string | null) ?? null,
    occurred_at: String(row.occurred_at ?? ''),
    actor_display_name: actor?.full_name ?? null,
    household_name: household?.display_name ?? null,
  }
}

async function countByStatus(
  supabase: SupabaseClient,
  status: 'open' | 'won' | 'lost' | 'on_hold',
): Promise<number> {
  let query = supabase
    .from('opportunities')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  if (status === 'open') {
    query = query.in('status', ['open', 'on_hold'])
  } else {
    query = query.eq('status', status)
  }

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function fetchOpportunityStatusCounts(
  supabase: SupabaseClient,
): Promise<OpportunityStatusCounts> {
  const [open, won, lost] = await Promise.all([
    countByStatus(supabase, 'open'),
    countByStatus(supabase, 'won'),
    countByStatus(supabase, 'lost'),
  ])
  return { open, won, lost }
}

export async function fetchOpenOpportunitiesForDashboard(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<DashboardOpportunityItem[]> {
  const limit = options?.limit ?? DASHBOARD_OPEN_OPP_LIMIT
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPEN_OPP_SELECT)
    .is('deleted_at', null)
    .in('status', ['open', 'on_hold'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeOpenOpportunity)
}

export async function fetchTasksDueOn(
  supabase: SupabaseClient,
  dueOn: string,
  options?: { limit?: number },
): Promise<DashboardTaskItem[]> {
  const limit = options?.limit ?? DASHBOARD_TASK_LIMIT
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress'])
    .eq('due_date', dueOn)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeTask)
}

export async function fetchOverdueTasks(
  supabase: SupabaseClient,
  beforeDate: string,
  options?: { limit?: number },
): Promise<DashboardTaskItem[]> {
  const limit = options?.limit ?? DASHBOARD_TASK_LIMIT
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress'])
    .lt('due_date', beforeDate)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeTask)
}

export async function fetchRecentDashboardActivities(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<DashboardActivityItem[]> {
  const limit = options?.limit ?? DASHBOARD_ACTIVITY_LIMIT
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeActivity)
}

export async function fetchRecentlyAddedHouseholds(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<DashboardHouseholdItem[]> {
  const limit = options?.limit ?? DASHBOARD_RECENT_HOUSEHOLD_LIMIT
  const { data, error } = await supabase
    .from('households')
    .select(RECENT_HOUSEHOLD_SELECT)
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    display_name: String(row.display_name ?? 'Household'),
    created_at: String(row.created_at ?? ''),
    status: String(row.status ?? ''),
  }))
}

export function stageSnapshotFromOpenOpportunities(
  opportunities: DashboardOpportunityItem[],
): StageSnapshotRow[] {
  return buildStageSnapshot(opportunities)
}

/** Parallel dashboard load — sections fail independently. */
export async function fetchCrmDashboard(
  supabase: SupabaseClient,
  options?: { today?: string },
): Promise<CrmDashboardData> {
  const today = options?.today ?? localDateString()

  const [
    statusCounts,
    openOpportunities,
    tasksDueToday,
    overdueTasks,
    recentActivities,
    recentHouseholds,
  ] = await Promise.all([
    settleDashboardLoad(
      fetchOpportunityStatusCounts(supabase),
      { open: 0, won: 0, lost: 0 } satisfies OpportunityStatusCounts,
      'status_counts',
    ),
    settleDashboardLoad(
      fetchOpenOpportunitiesForDashboard(supabase),
      [] as DashboardOpportunityItem[],
      'open_opportunities',
    ),
    settleDashboardLoad(
      fetchTasksDueOn(supabase, today),
      [] as DashboardTaskItem[],
      'tasks_due_today',
    ),
    settleDashboardLoad(
      fetchOverdueTasks(supabase, today),
      [] as DashboardTaskItem[],
      'overdue_tasks',
    ),
    settleDashboardLoad(
      fetchRecentDashboardActivities(supabase),
      [] as DashboardActivityItem[],
      'recent_activities',
    ),
    settleDashboardLoad(
      fetchRecentlyAddedHouseholds(supabase),
      [] as DashboardHouseholdItem[],
      'recent_households',
    ),
  ])

  const stageSnapshot = openOpportunities.ok
    ? {
        ok: true as const,
        value: stageSnapshotFromOpenOpportunities(openOpportunities.value),
      }
    : {
        ok: false as const,
        value: [] as StageSnapshotRow[],
        error: openOpportunities.error,
      }

  return {
    statusCounts,
    stageSnapshot,
    tasksDueToday,
    overdueTasks,
    openOpportunities,
    recentActivities,
    recentHouseholds,
  }
}

/** Fallback counts from a fetched open+closed sample when head counts fail — unused by default. */
export function deriveStatusCountsFromRows(
  rows: Array<{ status: string }>,
): OpportunityStatusCounts {
  return countOpportunityStatuses(rows)
}
