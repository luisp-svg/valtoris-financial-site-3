/**
 * Phase 1 sales pipeline visibility — filters, attention, and card copy
 * over existing opportunities. No schema, no Case filter/lifecycle, no new
 * routes. Application Started / Case Active is a derived informational badge only.
 */

import { formatDateLabel, isDueToday, isOverdue, localDateString } from '../dashboard/dates'
import { isStaleOpportunity } from '../dashboard/staleOpportunity'
import { formatCaseCreatedStageLabel } from './convertOpportunityView'
import {
  getOpportunityHouseholdLabel,
  getOpportunityOwnerLabel,
  getOpportunityStageLabel,
  getOpportunityVerticalLabel,
  opportunityMatchesSearch,
} from './opportunitiesApi'
import type { OpportunityListItem, OpportunityStatus } from './types'

export const PIPELINE_VIEWS = ['active', 'mine', 'attention', 'won', 'lost'] as const
export type PipelineView = (typeof PIPELINE_VIEWS)[number]

const PIPELINE_VIEW_SET = new Set<string>(PIPELINE_VIEWS)

export type OpportunityAttentionFlags = {
  overdueNextAction: boolean
  nextActionDueToday: boolean
  stale: boolean
}

export type PipelineViewOptions = {
  view: PipelineView
  search?: string
  assignedAdvisorId?: string | null
  today?: string
}

const ATTENTION_RANK = {
  overdue: 0,
  due_today: 1,
  stale: 2,
} as const

export function isPipelineView(value: string | null | undefined): value is PipelineView {
  return typeof value === 'string' && PIPELINE_VIEW_SET.has(value)
}

export function pipelineViewLabel(view: PipelineView): string {
  switch (view) {
    case 'active':
      return 'Active'
    case 'mine':
      return 'My Opportunities'
    case 'attention':
      return 'Needs Attention'
    case 'won':
      return 'Won'
    case 'lost':
      return 'Lost'
  }
}

/**
 * Dashboard deep-links stay valid:
 * statusGroup=open → Active, status=won|lost → Won/Lost.
 * view=mine|attention|active|won|lost is the Phase 1 chip param.
 */
export function pipelineViewFromSearchParams(params: URLSearchParams): PipelineView {
  const view = params.get('view')
  if (isPipelineView(view)) return view
  const status = params.get('status')
  if (status === 'won' || status === 'lost') return status
  const group = params.get('statusGroup')
  if (group === 'open') return 'active'
  return 'active'
}

export function writePipelineViewSearchParams(
  params: URLSearchParams,
  view: PipelineView,
): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete('status')
  next.delete('statusGroup')
  next.delete('view')
  if (view === 'active') {
    next.set('statusGroup', 'open')
  } else if (view === 'won' || view === 'lost') {
    next.set('status', view)
  } else {
    next.set('view', view)
  }
  return next
}

export function isActivePipelineStatus(status: OpportunityStatus): boolean {
  return status === 'open' || status === 'on_hold'
}

export function opportunityAttentionFlags(
  item: Pick<
    OpportunityListItem,
    'status' | 'stage_entered_at' | 'updated_at' | 'next_action_due_at'
  >,
  today = localDateString(),
): OpportunityAttentionFlags {
  if (!isActivePipelineStatus(item.status)) {
    return { overdueNextAction: false, nextActionDueToday: false, stale: false }
  }
  return {
    overdueNextAction: isOverdue(item.next_action_due_at, today),
    nextActionDueToday: isDueToday(item.next_action_due_at, today),
    stale: isStaleOpportunity(item, { today }),
  }
}

export function formatOpportunityAttentionLabels(flags: OpportunityAttentionFlags): string[] {
  const labels: string[] = []
  if (flags.overdueNextAction) labels.push('Overdue next action')
  else if (flags.nextActionDueToday) labels.push('Due today')
  if (flags.stale && !flags.overdueNextAction) labels.push('Stale')
  return labels
}

export function opportunityNeedsAttention(
  item: Pick<
    OpportunityListItem,
    'status' | 'stage_entered_at' | 'updated_at' | 'next_action_due_at'
  >,
  today = localDateString(),
): boolean {
  const flags = opportunityAttentionFlags(item, today)
  return flags.overdueNextAction || flags.nextActionDueToday || flags.stale
}

export function getOpportunityPrimaryProductLabel(item: {
  service_vertical: OpportunityListItem['service_vertical']
}): string {
  return getOpportunityVerticalLabel(item)
}

export function formatOpportunityNextActionDueLabel(
  dueAt: string | null | undefined,
): string {
  if (!dueAt) return 'No date'
  return formatDateLabel(dueAt)
}

function matchesPipelineView(
  item: OpportunityListItem,
  options: PipelineViewOptions,
): boolean {
  const today = options.today ?? localDateString()
  switch (options.view) {
    case 'active':
      return isActivePipelineStatus(item.status)
    case 'mine':
      if (!options.assignedAdvisorId) return false
      return (
        isActivePipelineStatus(item.status) &&
        item.assigned_advisor_id === options.assignedAdvisorId
      )
    case 'attention':
      return opportunityNeedsAttention(item, today)
    case 'won':
      return item.status === 'won'
    case 'lost':
      return item.status === 'lost'
  }
}

export function filterPipelineOpportunities(
  items: readonly OpportunityListItem[],
  options: PipelineViewOptions,
): OpportunityListItem[] {
  return items.filter((item) => {
    if (!matchesPipelineView(item, options)) return false
    if (!opportunityMatchesSearch(item, options.search ?? '')) return false
    return true
  })
}

export function countPipelineViews(
  items: readonly OpportunityListItem[],
  assignedAdvisorId: string | null,
  today = localDateString(),
): Record<PipelineView, number> {
  const counts: Record<PipelineView, number> = {
    active: 0,
    mine: 0,
    attention: 0,
    won: 0,
    lost: 0,
  }
  for (const item of items) {
    for (const view of PIPELINE_VIEWS) {
      if (matchesPipelineView(item, { view, assignedAdvisorId, today })) {
        counts[view] += 1
      }
    }
  }
  return counts
}

function attentionSortRank(item: OpportunityListItem, today: string): number {
  const flags = opportunityAttentionFlags(item, today)
  if (flags.overdueNextAction) return ATTENTION_RANK.overdue
  if (flags.nextActionDueToday) return ATTENTION_RANK.due_today
  return ATTENTION_RANK.stale
}

function compareDueThenUpdated(a: OpportunityListItem, b: OpportunityListItem): number {
  const aDue = a.next_action_due_at
  const bDue = b.next_action_due_at
  if (aDue == null && bDue != null) return 1
  if (aDue != null && bDue == null) return -1
  if (aDue != null && bDue != null && aDue !== bDue) return aDue.localeCompare(bDue)
  const byUpdated = b.updated_at.localeCompare(a.updated_at)
  if (byUpdated !== 0) return byUpdated
  return b.id.localeCompare(a.id)
}

export function sortPipelineOpportunities(
  items: readonly OpportunityListItem[],
  view: PipelineView,
  today = localDateString(),
): OpportunityListItem[] {
  const copy = items.slice()
  if (view === 'attention') {
    return copy.sort((a, b) => {
      const rankDiff = attentionSortRank(a, today) - attentionSortRank(b, today)
      if (rankDiff !== 0) return rankDiff
      return compareDueThenUpdated(a, b)
    })
  }
  if (view === 'won' || view === 'lost') {
    return copy.sort((a, b) => {
      const aClosed = a.closed_at ?? a.updated_at
      const bClosed = b.closed_at ?? b.updated_at
      const byClosed = bClosed.localeCompare(aClosed)
      if (byClosed !== 0) return byClosed
      return b.id.localeCompare(a.id)
    })
  }
  return copy.sort(compareDueThenUpdated)
}

export function applyPipelineView(
  items: readonly OpportunityListItem[],
  options: PipelineViewOptions,
): OpportunityListItem[] {
  return sortPipelineOpportunities(
    filterPipelineOpportunities(items, options),
    options.view,
    options.today,
  )
}

export function pipelineEmptyCopy(view: PipelineView): { title: string; body: string } {
  switch (view) {
    case 'active':
      return {
        title: 'No active opportunities',
        body: 'No open or on-hold opportunities are visible for your account. Create one to track who you are selling to.',
      }
    case 'mine':
      return {
        title: 'No opportunities assigned to you',
        body: 'My Opportunities shows deals assigned to your advisor profile. Agency opportunities you can access still appear on Active.',
      }
    case 'attention':
      return {
        title: 'Nothing needs attention',
        body: 'No overdue next actions or stale opportunities in your current pipeline.',
      }
    case 'won':
      return {
        title: 'No won opportunities',
        body: 'Won opportunities appear here after they are closed through the existing stage workflow.',
      }
    case 'lost':
      return {
        title: 'No lost opportunities',
        body: 'Lost opportunities appear here after they are closed through the existing stage workflow.',
      }
  }
}

export function pipelineCardCopy(
  item: OpportunityListItem,
  today = localDateString(),
): {
  householdName: string
  primaryProduct: string
  stage: string
  advisor: string
  nextAction: string
  nextActionDue: string
  attention: string[]
  caseCreated: boolean
  caseStageLabel: string | null
} {
  const live = item.linkedApplication
  return {
    householdName: getOpportunityHouseholdLabel(item),
    primaryProduct: getOpportunityPrimaryProductLabel(item),
    stage: getOpportunityStageLabel(item),
    advisor: getOpportunityOwnerLabel(item),
    nextAction: item.next_action?.trim() || 'No next action',
    nextActionDue: formatOpportunityNextActionDueLabel(item.next_action_due_at),
    attention: formatOpportunityAttentionLabels(opportunityAttentionFlags(item, today)),
    caseCreated: Boolean(live?.id),
    caseStageLabel: live ? formatCaseCreatedStageLabel(live.production_stage) : null,
  }
}
