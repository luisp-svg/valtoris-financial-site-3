import {
  computeDaysInStage,
  getWritingAdvisorIds,
  isFollowUpOverdue,
  isProductionTerminalStage,
  isStaleDaysInStage,
} from './daysInStage'
import type {
  ProductionApplicationListItem,
  ProductionQueueFilters,
} from './types'

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function includesNeedle(haystack: string | null | undefined, needle: string): boolean {
  if (!needle) return true
  if (!haystack) return false
  return haystack.toLowerCase().includes(needle)
}

/**
 * Default queue order:
 * 1. Active / non-terminal first
 * 2. next_follow_up_date ascending, null last
 * 3. updated_at descending
 */
export function sortProductionQueueItems(
  items: readonly ProductionApplicationListItem[],
): ProductionApplicationListItem[] {
  return items.slice().sort((a, b) => {
    const aTerminal = isProductionTerminalStage(a.production_stage) ? 1 : 0
    const bTerminal = isProductionTerminalStage(b.production_stage) ? 1 : 0
    if (aTerminal !== bTerminal) return aTerminal - bTerminal

    const aFollow = a.next_follow_up_date
    const bFollow = b.next_follow_up_date
    if (aFollow == null && bFollow != null) return 1
    if (aFollow != null && bFollow == null) return -1
    if (aFollow != null && bFollow != null && aFollow !== bFollow) {
      return aFollow.localeCompare(bFollow)
    }

    return b.updated_at.localeCompare(a.updated_at)
  })
}

export function filterProductionQueueItems(
  items: readonly ProductionApplicationListItem[],
  filters: ProductionQueueFilters,
  now: Date = new Date(),
): ProductionApplicationListItem[] {
  const needle = normalizeSearch(filters.search)

  return items.filter((item) => {
    if (!filters.includeDeleted && item.deleted_at != null) return false

    if (filters.stages !== 'all' && filters.stages.length > 0) {
      if (!filters.stages.includes(item.production_stage)) return false
    }

    if (filters.productLine !== 'all' && item.product_line !== filters.productLine) {
      return false
    }

    if (filters.carrierId !== 'all' && item.carrier_id !== filters.carrierId) {
      return false
    }

    if (filters.writingAdvisorId !== 'all') {
      const ids = getWritingAdvisorIds(item)
      if (!ids.includes(filters.writingAdvisorId)) return false
    }

    if (filters.writtenState !== 'all' && item.state !== filters.writtenState) {
      return false
    }

    if (hasActiveSubmissionDateRange(filters)) {
      const day = submissionDateDay(item.submission_date)
      if (!day) return false
      const from = normalizeDateBound(filters.submissionDateFrom)
      const to = normalizeDateBound(filters.submissionDateTo)
      if (from && day < from) return false
      if (to && day > to) return false
    }

    if (filters.followUpOverdueOnly && !isFollowUpOverdue(item.next_follow_up_date, now)) {
      return false
    }

    if (filters.staleOnly) {
      const { days } = computeDaysInStage({
        productionStage: item.production_stage,
        stageHistory: item.stage_history,
        updatedAt: item.updated_at,
        now,
      })
      if (!isStaleDaysInStage(days)) return false
    }

    if (!needle) return true

    const linkedPolicyNumber =
      item.linked_policies.find((p) => p.deleted_at == null)?.policy_number ??
      item.linked_policies[0]?.policy_number ??
      null

    return (
      includesNeedle(item.household?.display_name, needle) ||
      includesNeedle(item.application_number, needle) ||
      includesNeedle(item.policy_number, needle) ||
      includesNeedle(linkedPolicyNumber, needle) ||
      includesNeedle(item.carrier?.name, needle) ||
      includesNeedle(item.carrier?.code, needle) ||
      includesNeedle(item.product?.name, needle)
    )
  })
}

export function applyProductionQueueView(
  items: readonly ProductionApplicationListItem[],
  filters: ProductionQueueFilters,
  now: Date = new Date(),
): ProductionApplicationListItem[] {
  return sortProductionQueueItems(filterProductionQueueItems(items, filters, now))
}

export function defaultProductionQueueFilters(): ProductionQueueFilters {
  return {
    search: '',
    stages: 'all',
    productLine: 'all',
    carrierId: 'all',
    writingAdvisorId: 'all',
    writtenState: 'all',
    submissionDateFrom: '',
    submissionDateTo: '',
    followUpOverdueOnly: false,
    staleOnly: false,
    includeDeleted: false,
  }
}

export function hasActiveSubmissionDateRange(
  filters: Pick<ProductionQueueFilters, 'submissionDateFrom' | 'submissionDateTo'>,
): boolean {
  return Boolean(
    normalizeDateBound(filters.submissionDateFrom) || normalizeDateBound(filters.submissionDateTo),
  )
}

/** Unique written states from the loaded book, sorted. Empty values omitted. */
export function writtenStateFilterOptions(
  items: readonly Pick<ProductionApplicationListItem, 'state'>[],
): string[] {
  const states = new Set<string>()
  for (const item of items) {
    const state = item.state.trim()
    if (state) states.add(state)
  }
  return [...states].sort((a, b) => a.localeCompare(b))
}

function normalizeDateBound(value: string): string | null {
  const day = value.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

function submissionDateDay(value: string | null | undefined): string | null {
  if (!value) return null
  const day = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}
