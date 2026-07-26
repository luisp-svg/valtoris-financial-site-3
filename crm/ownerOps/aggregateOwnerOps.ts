/**
 * Full-set aggregation for CRM-9B owner ops (no 200-row sample).
 * Pure functions — feed complete paginated result sets.
 */

import { ROUTES } from '../../constants/routes'
import { isDueToday, isOverdue, localDateString } from '../dashboard/dates'
import { isOpenLikeStatus, isStaleOpportunity, STALE_THRESHOLD_DAYS } from '../dashboard/staleOpportunity'
import type {
  AgencySnapshot,
  LightAdvisor,
  LightHousehold,
  LightOpportunity,
  LightTask,
  OwnerAlert,
  StageHealthRow,
  WorkloadRow,
} from './types'

export { STALE_THRESHOLD_DAYS }

export function countOpenLike(opportunities: LightOpportunity[]): number {
  return opportunities.filter((row) => isOpenLikeStatus(row.status)).length
}

export function countWithoutNextAction(opportunities: LightOpportunity[]): number {
  return opportunities.filter((row) => {
    if (!isOpenLikeStatus(row.status)) return false
    const action = row.next_action?.trim()
    return !action || row.next_action_due_at == null || row.next_action_due_at === ''
  }).length
}

export function countStaleOpportunities(
  opportunities: LightOpportunity[],
  today = localDateString(),
): number {
  return opportunities.filter((row) =>
    isStaleOpportunity(
      {
        status: row.status,
        stage_entered_at: row.stage_entered_at,
        updated_at: row.updated_at,
        next_action_due_at: row.next_action_due_at,
      },
      { today },
    ),
  ).length
}

export function buildStageHealth(
  opportunities: LightOpportunity[],
  options?: { limit?: number },
): StageHealthRow[] {
  const limit = options?.limit ?? 24
  const map = new Map<string, StageHealthRow>()
  for (const opp of opportunities) {
    if (!isOpenLikeStatus(opp.status)) continue
    const existing = map.get(opp.stage_id)
    if (existing) {
      existing.count += 1
      continue
    }
    map.set(opp.stage_id, {
      stageId: opp.stage_id,
      stageName: opp.stage_name?.trim() || 'Unknown stage',
      pipelineName: opp.pipeline_name,
      count: 1,
    })
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.stageName.localeCompare(b.stageName))
    .slice(0, limit)
}

function opportunityNeedsAttention(opp: LightOpportunity, today: string): boolean {
  if (!isOpenLikeStatus(opp.status)) return false
  if (isOverdue(opp.next_action_due_at, today) || isDueToday(opp.next_action_due_at, today)) {
    return true
  }
  return isStaleOpportunity(
    {
      status: opp.status,
      stage_entered_at: opp.stage_entered_at,
      updated_at: opp.updated_at,
      next_action_due_at: opp.next_action_due_at,
    },
    { today },
  )
}

export function buildWorkloadRows(input: {
  advisors: LightAdvisor[]
  households: LightHousehold[]
  opportunities: LightOpportunity[]
  tasks: LightTask[]
  today?: string
}): WorkloadRow[] {
  const today = input.today ?? localDateString()
  const hhByAdvisor = new Map<string | null, number>()
  const openByAdvisor = new Map<string | null, number>()
  const dueTodayByAdvisor = new Map<string | null, number>()
  const overdueByAdvisor = new Map<string | null, number>()
  const attentionByAdvisor = new Map<string | null, number>()

  const bump = (map: Map<string | null, number>, key: string | null, n = 1) => {
    map.set(key, (map.get(key) ?? 0) + n)
  }

  const householdAdvisor = new Map<string, string | null>()
  for (const hh of input.households) {
    householdAdvisor.set(hh.id, hh.assigned_advisor_id)
    bump(hhByAdvisor, hh.assigned_advisor_id)
  }

  for (const opp of input.opportunities) {
    if (!isOpenLikeStatus(opp.status)) continue
    const advisorKey = opp.assigned_advisor_id
    bump(openByAdvisor, advisorKey)
    if (opportunityNeedsAttention(opp, today)) bump(attentionByAdvisor, advisorKey)
  }

  for (const task of input.tasks) {
    if (task.status !== 'open' && task.status !== 'in_progress') continue
    const advisorKey = householdAdvisor.get(task.household_id) ?? null
    if (isDueToday(task.due_date, today)) bump(dueTodayByAdvisor, advisorKey)
    if (isOverdue(task.due_date, today)) {
      bump(overdueByAdvisor, advisorKey)
      bump(attentionByAdvisor, advisorKey)
    } else if (isDueToday(task.due_date, today)) {
      bump(attentionByAdvisor, advisorKey)
    }
  }

  const rows: WorkloadRow[] = input.advisors
    .filter((advisor) => advisor.is_active)
    .map((advisor) => ({
      key: advisor.id,
      advisorId: advisor.id,
      displayName: advisor.display_name || 'Advisor',
      isUnassigned: false,
      households: hhByAdvisor.get(advisor.id) ?? 0,
      openOpportunities: openByAdvisor.get(advisor.id) ?? 0,
      tasksDueToday: dueTodayByAdvisor.get(advisor.id) ?? 0,
      overdueTasks: overdueByAdvisor.get(advisor.id) ?? 0,
      needsAttention: attentionByAdvisor.get(advisor.id) ?? 0,
    }))

  rows.sort(
    (a, b) =>
      b.needsAttention - a.needsAttention ||
      b.openOpportunities - a.openOpportunities ||
      a.displayName.localeCompare(b.displayName),
  )

  rows.push({
    key: 'unassigned',
    advisorId: null,
    displayName: 'Unassigned',
    isUnassigned: true,
    households: hhByAdvisor.get(null) ?? 0,
    openOpportunities: openByAdvisor.get(null) ?? 0,
    tasksDueToday: dueTodayByAdvisor.get(null) ?? 0,
    overdueTasks: overdueByAdvisor.get(null) ?? 0,
    needsAttention: attentionByAdvisor.get(null) ?? 0,
  })

  return rows
}

export function buildOwnerAlerts(input: {
  snapshot: Pick<
    AgencySnapshot,
    | 'staleOpportunities'
    | 'opportunitiesWithoutNextAction'
    | 'overdueTasks'
    | 'unassignedHouseholds'
    | 'unassignedOpportunities'
  >
  tasksWithoutAssignee: number
}): OwnerAlert[] {
  const alerts: OwnerAlert[] = []

  if (input.snapshot.overdueTasks > 0) {
    alerts.push({
      id: 'overdue_task',
      kind: 'overdue_task',
      severity: 'high',
      title: 'Overdue tasks',
      detail: `${input.snapshot.overdueTasks} open task${input.snapshot.overdueTasks === 1 ? '' : 's'} past due`,
      count: input.snapshot.overdueTasks,
      href: ROUTES.crmTasks,
    })
  }

  if (input.snapshot.staleOpportunities > 0) {
    alerts.push({
      id: 'stale_opportunity',
      kind: 'stale_opportunity',
      severity: 'high',
      title: 'Stale opportunities',
      detail: `${input.snapshot.staleOpportunities} open opportunit${input.snapshot.staleOpportunities === 1 ? 'y' : 'ies'} inactive ≥ ${STALE_THRESHOLD_DAYS} days without a timely next action`,
      count: input.snapshot.staleOpportunities,
      href: `${ROUTES.crmPipeline}?statusGroup=open`,
    })
  }

  if (input.snapshot.opportunitiesWithoutNextAction > 0) {
    alerts.push({
      id: 'no_next_action',
      kind: 'no_next_action',
      severity: 'medium',
      title: 'Opportunities without next action',
      detail: `${input.snapshot.opportunitiesWithoutNextAction} open opportunit${input.snapshot.opportunitiesWithoutNextAction === 1 ? 'y lacks' : 'ies lack'} a next action or due date`,
      count: input.snapshot.opportunitiesWithoutNextAction,
      href: `${ROUTES.crmPipeline}?statusGroup=open`,
    })
  }

  if (input.tasksWithoutAssignee > 0) {
    alerts.push({
      id: 'task_without_assignee',
      kind: 'task_without_assignee',
      severity: 'medium',
      title: 'Tasks without an assignee',
      detail: `${input.tasksWithoutAssignee} open task${input.tasksWithoutAssignee === 1 ? '' : 's'} with no assigned user`,
      count: input.tasksWithoutAssignee,
      href: ROUTES.crmTasks,
    })
  }

  if (input.snapshot.unassignedHouseholds > 0) {
    alerts.push({
      id: 'household_without_advisor',
      kind: 'household_without_advisor',
      severity: 'medium',
      title: 'Households without an advisor',
      detail: `${input.snapshot.unassignedHouseholds} household${input.snapshot.unassignedHouseholds === 1 ? '' : 's'} unassigned`,
      count: input.snapshot.unassignedHouseholds,
      href: ROUTES.crmHouseholds,
    })
  }

  if (input.snapshot.unassignedOpportunities > 0) {
    alerts.push({
      id: 'opportunity_without_advisor',
      kind: 'opportunity_without_advisor',
      severity: 'low',
      title: 'Opportunities without an advisor',
      detail: `${input.snapshot.unassignedOpportunities} open opportunit${input.snapshot.unassignedOpportunities === 1 ? 'y is' : 'ies are'} unassigned`,
      count: input.snapshot.unassignedOpportunities,
      href: `${ROUTES.crmPipeline}?statusGroup=open`,
    })
  }

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count)
}

export function countTasksWithoutAssignee(tasks: LightTask[]): number {
  return tasks.filter(
    (task) =>
      (task.status === 'open' || task.status === 'in_progress') &&
      (task.assigned_user_id == null || task.assigned_user_id === ''),
  ).length
}

export function countTasksDueToday(tasks: LightTask[], today = localDateString()): number {
  return tasks.filter(
    (task) =>
      (task.status === 'open' || task.status === 'in_progress') && isDueToday(task.due_date, today),
  ).length
}

export function countOverdueTasks(tasks: LightTask[], today = localDateString()): number {
  return tasks.filter(
    (task) =>
      (task.status === 'open' || task.status === 'in_progress') && isOverdue(task.due_date, today),
  ).length
}
