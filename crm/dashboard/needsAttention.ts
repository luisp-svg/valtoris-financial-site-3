/**
 * Builds an explainable Needs Attention queue.
 * Sort: overdue tasks → overdue next actions → due today tasks → due today next actions → stale.
 * Same household may appear multiple times for different entities.
 */

import { crmHouseholdPath, crmOpportunityPath, ROUTES } from '../../constants/routes'
import { formatDateLabel, isDueToday, isOverdue, localDateString } from './dates'
import { filterStaleOpportunities, STALE_THRESHOLD_DAYS } from './staleOpportunity'
import type {
  AttentionItem,
  AttentionKind,
  DashboardOpportunityItem,
  DashboardTaskItem,
} from './types'

const KIND_ORDER: Record<AttentionKind, number> = {
  overdue_task: 0,
  overdue_next_action: 1,
  task_due_today: 2,
  next_action_due_today: 3,
  stale_opportunity: 4,
}

export function attentionKindLabel(kind: AttentionKind): string {
  switch (kind) {
    case 'overdue_task':
      return 'Overdue task'
    case 'overdue_next_action':
      return 'Overdue next action'
    case 'task_due_today':
      return 'Task due today'
    case 'next_action_due_today':
      return 'Next action due today'
    case 'stale_opportunity':
      return 'Stale opportunity'
  }
}

function taskHref(task: DashboardTaskItem): string {
  return task.household_id ? crmHouseholdPath(task.household_id) : ROUTES.crmTasks
}

export function buildNeedsAttentionItems(input: {
  overdueTasks: DashboardTaskItem[]
  tasksDueToday: DashboardTaskItem[]
  openOpportunities: DashboardOpportunityItem[]
  today?: string
  staleThresholdDays?: number
  limit?: number
}): AttentionItem[] {
  const today = input.today ?? localDateString()
  const threshold = input.staleThresholdDays ?? STALE_THRESHOLD_DAYS
  const limit = input.limit ?? 20
  const items: AttentionItem[] = []
  const seen = new Set<string>()

  function push(item: AttentionItem) {
    const key = `${item.kind}:${item.entityId}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(item)
  }

  for (const task of input.overdueTasks) {
    if (!isOverdue(task.due_date, today)) continue
    push({
      id: `overdue_task:${task.id}`,
      kind: 'overdue_task',
      title: task.title,
      subtitle: `${task.household_name ?? 'Household'} · Due ${formatDateLabel(task.due_date)}`,
      href: taskHref(task),
      sortKey: task.due_date ?? '',
      entityId: task.id,
    })
  }

  for (const opp of input.openOpportunities) {
    if (!isOverdue(opp.next_action_due_at, today)) continue
    push({
      id: `overdue_next_action:${opp.id}`,
      kind: 'overdue_next_action',
      title: opp.next_action?.trim() || opp.title,
      subtitle: `${opp.household_name ?? 'Household'} · ${opp.title} · Due ${formatDateLabel(opp.next_action_due_at)}`,
      href: crmOpportunityPath(opp.id),
      sortKey: opp.next_action_due_at ?? '',
      entityId: opp.id,
    })
  }

  for (const task of input.tasksDueToday) {
    if (!isDueToday(task.due_date, today)) continue
    push({
      id: `task_due_today:${task.id}`,
      kind: 'task_due_today',
      title: task.title,
      subtitle: `${task.household_name ?? 'Household'} · Due today`,
      href: taskHref(task),
      sortKey: task.due_date ?? '',
      entityId: task.id,
    })
  }

  for (const opp of input.openOpportunities) {
    if (!isDueToday(opp.next_action_due_at, today)) continue
    push({
      id: `next_action_due_today:${opp.id}`,
      kind: 'next_action_due_today',
      title: opp.next_action?.trim() || opp.title,
      subtitle: `${opp.household_name ?? 'Household'} · ${opp.title} · Due today`,
      href: crmOpportunityPath(opp.id),
      sortKey: opp.next_action_due_at ?? '',
      entityId: opp.id,
    })
  }

  // Prefer concrete next-action due items over the stale bucket for the same opportunity.
  const nextActionAttentionIds = new Set(
    items
      .filter((item) => item.kind === 'overdue_next_action' || item.kind === 'next_action_due_today')
      .map((item) => item.entityId),
  )

  const stale = filterStaleOpportunities(input.openOpportunities, {
    today,
    thresholdDays: threshold,
  })
  for (const opp of stale) {
    if (nextActionAttentionIds.has(opp.id)) continue
    push({
      id: `stale_opportunity:${opp.id}`,
      kind: 'stale_opportunity',
      title: opp.title,
      subtitle: `${opp.household_name ?? 'Household'} · No timely follow-up · ${opp.stage_name ?? 'Stage'}`,
      href: crmOpportunityPath(opp.id),
      sortKey: opp.stage_entered_at ?? opp.updated_at,
      entityId: opp.id,
    })
  }

  items.sort((a, b) => {
    const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (kindDiff !== 0) return kindDiff
    return a.sortKey.localeCompare(b.sortKey)
  })

  return items.slice(0, limit)
}
