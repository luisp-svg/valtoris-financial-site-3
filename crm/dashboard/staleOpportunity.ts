/**
 * CRM-9A stale opportunity product rule (not a DB field).
 *
 * Open or on_hold only.
 * Stale if stage age (stage_entered_at, else updated_at) is at least
 * STALE_THRESHOLD_DAYS local calendar days (>= 14) AND
 * (next_action_due_at is null OR next_action_due_at < today).
 * Timely next action = due today or in the future (not overdue).
 * Won/lost excluded. Reopened opps reset stage_entered_at via RPC.
 * Note: updated_at fallback means ordinary edits can reset apparent age when
 * stage_entered_at is null — prefer stage_entered_at in product data.
 */

import { calendarDaysSince, localDateString } from './dates'
import type { DashboardOpportunityItem } from './types'

export const STALE_THRESHOLD_DAYS = 14

const OPEN_LIKE = new Set(['open', 'on_hold'])

export function isOpenLikeStatus(status: string): boolean {
  return OPEN_LIKE.has(status)
}

export function opportunityAgeDays(
  opportunity: Pick<DashboardOpportunityItem, 'stage_entered_at' | 'updated_at'>,
  today = localDateString(),
): number | null {
  const anchor = opportunity.stage_entered_at ?? opportunity.updated_at
  return calendarDaysSince(anchor, today)
}

export function isStaleOpportunity(
  opportunity: Pick<
    DashboardOpportunityItem,
    'status' | 'stage_entered_at' | 'updated_at' | 'next_action_due_at'
  >,
  options?: { today?: string; thresholdDays?: number },
): boolean {
  if (!isOpenLikeStatus(opportunity.status)) return false

  const today = options?.today ?? localDateString()
  const threshold = options?.thresholdDays ?? STALE_THRESHOLD_DAYS
  const age = opportunityAgeDays(opportunity, today)
  if (age === null || age < threshold) return false

  const due = opportunity.next_action_due_at
  if (due == null || due === '') return true
  return due < today
}

export function filterStaleOpportunities(
  opportunities: DashboardOpportunityItem[],
  options?: { today?: string; thresholdDays?: number },
): DashboardOpportunityItem[] {
  return opportunities.filter((row) => isStaleOpportunity(row, options))
}
