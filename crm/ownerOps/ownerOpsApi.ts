/**
 * CRM-9B owner operations queries.
 * Uses exact head counts where possible and paginated full-set fetches
 * for stage/workload/stale aggregation (no 200-row sample).
 * Authorization: authenticated browser client + RLS; UI owner-gated.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { localDateString } from '../dashboard/dates'
import { settleDashboardLoad } from '../dashboard/loadState'
import { agencyMonthBounds } from './agencyTimezone'
import {
  buildOwnerAlerts,
  buildStageHealth,
  buildWorkloadRows,
  countOpenLike,
  countOverdueTasks,
  countStaleOpportunities,
  countTasksDueToday,
  countTasksWithoutAssignee,
  countWithoutNextAction,
} from './aggregateOwnerOps'
import type {
  AgencySnapshot,
  LightAdvisor,
  LightHousehold,
  LightOpportunity,
  LightTask,
  OwnerActivityItem,
  OwnerOpsDashboardData,
} from './types'

const PAGE_SIZE = 1000
const ACTIVITY_LIMIT = 20

async function exactCount(
  supabase: SupabaseClient,
  table: string,
  apply: (query: ReturnType<SupabaseClient['from']>) => unknown,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from(table).select('id', { count: 'exact', head: true })
  query = apply(query)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  for (;;) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1)
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

export async function fetchActiveHouseholdCount(supabase: SupabaseClient): Promise<number> {
  return exactCount(supabase, 'households', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).is('deleted_at', null).is('merged_into_household_id', null),
  )
}

export async function fetchOpenOpportunityCount(supabase: SupabaseClient): Promise<number> {
  return exactCount(supabase, 'opportunities', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any).is('deleted_at', null).in('status', ['open', 'on_hold']),
  )
}

export async function fetchWonLostThisMonthCounts(
  supabase: SupabaseClient,
  options?: { now?: Date },
): Promise<{ won: number; lost: number; monthKey: string; timeZone: string }> {
  const bounds = agencyMonthBounds(options?.now)
  const [won, lost] = await Promise.all([
    exactCount(supabase, 'opportunities', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any)
        .is('deleted_at', null)
        .eq('status', 'won')
        .gte('closed_at', bounds.startIso)
        .lt('closed_at', bounds.endIso),
    ),
    exactCount(supabase, 'opportunities', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any)
        .is('deleted_at', null)
        .eq('status', 'lost')
        .gte('closed_at', bounds.startIso)
        .lt('closed_at', bounds.endIso),
    ),
  ])
  return { won, lost, monthKey: bounds.monthKey, timeZone: bounds.timeZone }
}

export async function fetchUnassignedHouseholdCount(supabase: SupabaseClient): Promise<number> {
  return exactCount(supabase, 'households', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any)
      .is('deleted_at', null)
      .is('merged_into_household_id', null)
      .is('assigned_advisor_id', null),
  )
}

export async function fetchUnassignedOpenOpportunityCount(
  supabase: SupabaseClient,
): Promise<number> {
  return exactCount(supabase, 'opportunities', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any)
      .is('deleted_at', null)
      .in('status', ['open', 'on_hold'])
      .is('assigned_advisor_id', null),
  )
}

/** Viewer-local calendar day (same rule as CRM-9A). */
export async function fetchTasksDueTodayCount(
  supabase: SupabaseClient,
  today: string,
): Promise<number> {
  return exactCount(supabase, 'tasks', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress'])
      .eq('due_date', today),
  )
}

export async function fetchOverdueTasksCount(
  supabase: SupabaseClient,
  today: string,
): Promise<number> {
  return exactCount(supabase, 'tasks', (q) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q as any)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress'])
      .lt('due_date', today)
      .not('due_date', 'is', null),
  )
}

export async function fetchAllLightHouseholds(
  supabase: SupabaseClient,
): Promise<LightHousehold[]> {
  return fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from('households')
      .select('id, assigned_advisor_id, display_name')
      .is('deleted_at', null)
      .is('merged_into_household_id', null)
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      assigned_advisor_id: (row.assigned_advisor_id as string | null) ?? null,
      display_name: String(row.display_name ?? 'Household'),
    }))
  })
}

export async function fetchAllOpenLightOpportunities(
  supabase: SupabaseClient,
): Promise<LightOpportunity[]> {
  return fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from('opportunities')
      .select(
        `
        id,
        title,
        status,
        household_id,
        stage_id,
        assigned_advisor_id,
        next_action,
        next_action_due_at,
        stage_entered_at,
        updated_at,
        stage:pipeline_stages!stage_id ( id, name ),
        pipeline:pipelines!pipeline_id ( id, name )
      `,
      )
      .is('deleted_at', null)
      .in('status', ['open', 'on_hold'])
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw error
    return (data ?? []).map((row) => {
      const stage = Array.isArray(row.stage) ? row.stage[0] : row.stage
      const pipeline = Array.isArray(row.pipeline) ? row.pipeline[0] : row.pipeline
      return {
        id: String(row.id),
        title: String(row.title ?? ''),
        status: String(row.status ?? 'open'),
        household_id: String(row.household_id),
        stage_id: String(row.stage_id),
        assigned_advisor_id: (row.assigned_advisor_id as string | null) ?? null,
        next_action: (row.next_action as string | null) ?? null,
        next_action_due_at: (row.next_action_due_at as string | null) ?? null,
        stage_entered_at: (row.stage_entered_at as string | null) ?? null,
        updated_at: String(row.updated_at ?? ''),
        stage_name:
          stage && typeof stage === 'object' && 'name' in stage
            ? String((stage as { name: string }).name)
            : null,
        pipeline_name:
          pipeline && typeof pipeline === 'object' && 'name' in pipeline
            ? String((pipeline as { name: string }).name)
            : null,
      }
    })
  })
}

export async function fetchAllOpenLightTasks(supabase: SupabaseClient): Promise<LightTask[]> {
  return fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, due_date, status, household_id, assigned_user_id, opportunity_id')
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress'])
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      due_date: (row.due_date as string | null) ?? null,
      status: String(row.status ?? 'open'),
      household_id: String(row.household_id),
      assigned_user_id: (row.assigned_user_id as string | null) ?? null,
      opportunity_id: (row.opportunity_id as string | null) ?? null,
    }))
  })
}

export async function fetchActiveAdvisors(supabase: SupabaseClient): Promise<LightAdvisor[]> {
  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('id, display_name, is_active')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('display_name', { ascending: true })
    .limit(500)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    display_name: String(row.display_name ?? 'Advisor'),
    is_active: Boolean(row.is_active),
  }))
}

export async function fetchOwnerRecentActivity(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<OwnerActivityItem[]> {
  const limit = options?.limit ?? ACTIVITY_LIMIT
  const { data, error } = await supabase
    .from('activities')
    .select(
      `
      id,
      household_id,
      opportunity_id,
      activity_type,
      title,
      body,
      occurred_at,
      household:households!household_id ( id, display_name ),
      actor:profiles!activities_actor_user_id_fkey ( id, full_name )
    `,
    )
    .is('deleted_at', null)
    .in('activity_type', ['stage_changed', 'assignment_changed', 'recommendation_converted'])
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => {
    const household = Array.isArray(row.household) ? row.household[0] : row.household
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor
    return {
      id: String(row.id),
      household_id: String(row.household_id),
      opportunity_id: (row.opportunity_id as string | null) ?? null,
      activity_type: String(row.activity_type ?? 'other'),
      title: String(row.title ?? ''),
      body: (row.body as string | null) ?? null,
      occurred_at: String(row.occurred_at ?? ''),
      actor_display_name:
        actor && typeof actor === 'object' && 'full_name' in actor
          ? ((actor as { full_name: string | null }).full_name ?? null)
          : null,
      household_name:
        household && typeof household === 'object' && 'display_name' in household
          ? String((household as { display_name: string }).display_name)
          : null,
    }
  })
}

/**
 * Loads owner operations data.
 * Snapshot mixes exact head counts (month closed, households) with full-set
 * derived counts (stale, tasks) so stage/workload never use a 200-row sample.
 */
export async function fetchOwnerOpsDashboard(
  supabase: SupabaseClient,
  options?: { today?: string; now?: Date },
): Promise<OwnerOpsDashboardData> {
  const today = options?.today ?? localDateString()
  const now = options?.now ?? new Date()

  const monthFallback = agencyMonthBounds(now)

  const [
    activeHouseholdsResult,
    openCountResult,
    monthResult,
    unassignedHhResult,
    unassignedOppResult,
    tasksDueResult,
    overdueTasksResult,
    householdsResult,
    opportunitiesResult,
    tasksResult,
    advisorsResult,
    activityResult,
  ] = await Promise.all([
    settleDashboardLoad(fetchActiveHouseholdCount(supabase), 0, 'active_households'),
    settleDashboardLoad(fetchOpenOpportunityCount(supabase), 0, 'open_opportunities'),
    settleDashboardLoad(
      fetchWonLostThisMonthCounts(supabase, { now }),
      {
        won: 0,
        lost: 0,
        monthKey: monthFallback.monthKey,
        timeZone: monthFallback.timeZone,
      },
      'won_lost_month',
    ),
    settleDashboardLoad(fetchUnassignedHouseholdCount(supabase), 0, 'unassigned_households'),
    settleDashboardLoad(
      fetchUnassignedOpenOpportunityCount(supabase),
      0,
      'unassigned_opportunities',
    ),
    settleDashboardLoad(fetchTasksDueTodayCount(supabase, today), 0, 'tasks_due_today'),
    settleDashboardLoad(fetchOverdueTasksCount(supabase, today), 0, 'overdue_tasks'),
    settleDashboardLoad(fetchAllLightHouseholds(supabase), [] as LightHousehold[], 'households'),
    settleDashboardLoad(
      fetchAllOpenLightOpportunities(supabase),
      [] as LightOpportunity[],
      'open_opportunities_full',
    ),
    settleDashboardLoad(fetchAllOpenLightTasks(supabase), [] as LightTask[], 'open_tasks_full'),
    settleDashboardLoad(fetchActiveAdvisors(supabase), [] as LightAdvisor[], 'advisors'),
    settleDashboardLoad(
      fetchOwnerRecentActivity(supabase),
      [] as OwnerActivityItem[],
      'recent_activity',
    ),
  ])

  const fullSetOk =
    householdsResult.ok && opportunitiesResult.ok && tasksResult.ok && advisorsResult.ok

  const tasksDueToday = tasksDueResult.ok
    ? tasksDueResult.value
    : fullSetOk
      ? countTasksDueToday(tasksResult.value, today)
      : 0
  const overdueTasks = overdueTasksResult.ok
    ? overdueTasksResult.value
    : fullSetOk
      ? countOverdueTasks(tasksResult.value, today)
      : 0
  const staleOpportunities = opportunitiesResult.ok
    ? countStaleOpportunities(opportunitiesResult.value, today)
    : 0
  const opportunitiesWithoutNextAction = opportunitiesResult.ok
    ? countWithoutNextAction(opportunitiesResult.value)
    : 0

  // Prefer exact open count; fall back to full-set length if head count failed but rows loaded.
  const openOpportunities = openCountResult.ok
    ? openCountResult.value
    : opportunitiesResult.ok
      ? countOpenLike(opportunitiesResult.value)
      : 0

  const snapshotValue: AgencySnapshot = {
    activeHouseholds: activeHouseholdsResult.ok ? activeHouseholdsResult.value : 0,
    openOpportunities,
    wonThisMonth: monthResult.ok ? monthResult.value.won : 0,
    lostThisMonth: monthResult.ok ? monthResult.value.lost : 0,
    tasksDueToday,
    overdueTasks,
    unassignedHouseholds: unassignedHhResult.ok ? unassignedHhResult.value : 0,
    unassignedOpportunities: unassignedOppResult.ok ? unassignedOppResult.value : 0,
    staleOpportunities,
    opportunitiesWithoutNextAction,
    monthKey: monthResult.value.monthKey,
    monthTimeZone: monthResult.value.timeZone,
  }

  const snapshotOk =
    activeHouseholdsResult.ok &&
    (openCountResult.ok || opportunitiesResult.ok) &&
    monthResult.ok &&
    unassignedHhResult.ok &&
    unassignedOppResult.ok &&
    (tasksDueResult.ok || tasksResult.ok) &&
    (overdueTasksResult.ok || tasksResult.ok) &&
    opportunitiesResult.ok

  const snapshot = snapshotOk
    ? { ok: true as const, value: snapshotValue }
    : {
        ok: false as const,
        value: snapshotValue,
        error:
          activeHouseholdsResult.ok === false
            ? activeHouseholdsResult.error
            : monthResult.ok === false
              ? monthResult.error
              : opportunitiesResult.ok === false
                ? opportunitiesResult.error
                : 'Unable to load agency snapshot.',
      }

  const stageHealth = opportunitiesResult.ok
    ? { ok: true as const, value: buildStageHealth(opportunitiesResult.value) }
    : {
        ok: false as const,
        value: [] as ReturnType<typeof buildStageHealth>,
        error:
          opportunitiesResult.ok === false
            ? opportunitiesResult.error
            : 'Unable to load pipeline health.',
      }

  const workloadError =
    advisorsResult.ok === false
      ? advisorsResult.error
      : householdsResult.ok === false
        ? householdsResult.error
        : opportunitiesResult.ok === false
          ? opportunitiesResult.error
          : tasksResult.ok === false
            ? tasksResult.error
            : 'Unable to load advisor workload.'

  const workload = fullSetOk
    ? {
        ok: true as const,
        value: buildWorkloadRows({
          advisors: advisorsResult.value,
          households: householdsResult.value,
          opportunities: opportunitiesResult.value,
          tasks: tasksResult.value,
          today,
        }),
      }
    : {
        ok: false as const,
        value: [],
        error: workloadError,
      }

  const tasksWithoutAssignee = fullSetOk ? countTasksWithoutAssignee(tasksResult.value) : 0
  const alerts = fullSetOk
    ? {
        ok: true as const,
        value: buildOwnerAlerts({
          snapshot: snapshotValue,
          tasksWithoutAssignee,
        }),
      }
    : {
        ok: false as const,
        value: [],
        error: 'Unable to load operational alerts.',
      }

  return {
    snapshot,
    stageHealth,
    workload,
    alerts,
    recentActivity: activityResult,
  }
}
