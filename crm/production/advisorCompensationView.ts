/**
 * Advisor Compensation dashboard — derived from live 034 expected rows and
 * batched 035 events. No new event types, no mutations, no upline.
 *
 * Expected period date: COALESCE(submission_date, issue_date) — same lookup
 * order as Migration 034. Never created_at / calculated_at.
 *
 * Paid / Chargebacks / Net Paid period date: 035 transaction_date.
 * NULL transaction_date is included in Lifetime and excluded from YTD/month.
 *
 * Outstanding reduction uses all-time active 035 net actual on the same
 * writing advisor + application (035 remaining_expected semantics), then
 * floors at 0. Terminal/intake stages contribute 0 Outstanding.
 */
import { presentEventReversal } from './compensationView'
import {
  calendarDateInPeriod,
  type DashboardReportingPeriod,
} from './dashboardPeriod'
import type { PaidCommissionListEvent } from './dashboardView'
import type {
  LiveExpectedCompensationRow,
  ProductionApplicationListItem,
  ProductionStage,
} from './types'

export const OUTSTANDING_PRODUCTION_STAGES = [
  'submitted',
  'paramed',
  'in_underwriting',
  'approved',
  'sent_to_draft',
  'premium_drafted',
  'issued',
  'in_force',
  'postponed',
] as const satisfies readonly ProductionStage[]

const OUTSTANDING_STAGE_SET = new Set<string>(OUTSTANDING_PRODUCTION_STAGES)

export const FAILED_PRODUCTION_STAGES = [
  'declined',
  'withdrawn',
  'incomplete',
  'not_taken',
] as const satisfies readonly ProductionStage[]

export const INTAKE_PRODUCTION_STAGES = ['draft', 'pre_submitted'] as const satisfies readonly ProductionStage[]

export type AdvisorCompensationRow = {
  advisorId: string | null
  advisorName: string
  expectedCents: number
  outstandingCents: number
  paidCents: number
  chargebackCents: number
  netPaidCents: number
  reviewCount: number
}

export type AdvisorCompensationDashboardModel = {
  period: DashboardReportingPeriod
  rows: AdvisorCompensationRow[]
  totals: Omit<AdvisorCompensationRow, 'advisorId' | 'advisorName' | 'reviewCount'> & {
    reviewCount: number
  }
}

export function isOutstandingProductionStage(stage: string): boolean {
  return OUTSTANDING_STAGE_SET.has(stage)
}

/** 034 lookup date: submission_date, else issue_date. Never created_at. */
export function expectedCompensationPeriodDate(
  item: Pick<ProductionApplicationListItem, 'submission_date' | 'issue_date'>,
): string | null {
  return item.submission_date ?? item.issue_date ?? null
}

function resolvedExpectedCents(rows: readonly LiveExpectedCompensationRow[]): number {
  let total = 0
  for (const row of rows) {
    if (row.calculation_status !== 'resolved') continue
    if (row.expected_compensation_cents == null) continue
    total += row.expected_compensation_cents
  }
  return total
}

function reviewCount(rows: readonly LiveExpectedCompensationRow[]): number {
  return rows.filter(
    (row) =>
      row.calculation_status === 'review_required' || row.calculation_status === 'unavailable',
  ).length
}

function isActiveLedgerEvent(
  event: PaidCommissionListEvent,
  all: readonly PaidCommissionListEvent[],
): boolean {
  if (event.event_type === 'reversal') return false
  return presentEventReversal(event, all).kind === 'active'
}

/**
 * 035 net_actual: sum of active paid + adjustment + chargeback + recovery.
 * Reversal rows and reversed events are excluded.
 */
export function netActualCents(
  events: readonly PaidCommissionListEvent[],
  allEvents: readonly PaidCommissionListEvent[],
): number {
  let total = 0
  for (const event of events) {
    if (!isActiveLedgerEvent(event, allEvents)) continue
    if (
      event.event_type === 'paid' ||
      event.event_type === 'adjustment' ||
      event.event_type === 'chargeback' ||
      event.event_type === 'recovery'
    ) {
      total += event.amount_cents
    }
  }
  return total
}

export function sumActiveEventType(
  events: readonly PaidCommissionListEvent[],
  allEvents: readonly PaidCommissionListEvent[],
  eventType: 'paid' | 'chargeback',
): number {
  let total = 0
  for (const event of events) {
    if (event.event_type !== eventType) continue
    if (!isActiveLedgerEvent(event, allEvents)) continue
    total += event.amount_cents
  }
  return total
}

function advisorNameFrom(
  advisorId: string | null,
  items: readonly ProductionApplicationListItem[],
): string {
  if (!advisorId) return 'Unattributed'
  for (const item of items) {
    const expected = item.expected_compensations.find((row) => row.advisor_id === advisorId)
    if (expected?.advisor_display_name?.trim()) return expected.advisor_display_name.trim()
    const allocation = item.allocations.find(
      (row) => row.advisor_id === advisorId && row.effective_to == null,
    )
    if (allocation?.advisor?.display_name?.trim()) return allocation.advisor.display_name.trim()
  }
  return 'Advisor'
}

function emptyRow(advisorId: string | null, advisorName: string): AdvisorCompensationRow {
  return {
    advisorId,
    advisorName,
    expectedCents: 0,
    outstandingCents: 0,
    paidCents: 0,
    chargebackCents: 0,
    netPaidCents: 0,
    reviewCount: 0,
  }
}

export function buildAdvisorCompensationDashboard(options: {
  items: readonly ProductionApplicationListItem[]
  events: readonly PaidCommissionListEvent[]
  period?: DashboardReportingPeriod
  today: string
}): AdvisorCompensationDashboardModel {
  const period = options.period ?? 'this_month'
  const today = options.today
  const visibleIds = new Set(options.items.map((item) => item.id))
  const scopedEvents = options.events.filter((event) => visibleIds.has(event.application_id))

  const advisorIds = new Set<string | null>()
  for (const item of options.items) {
    for (const row of item.expected_compensations) advisorIds.add(row.advisor_id)
  }
  for (const event of scopedEvents) advisorIds.add(event.advisor_id)

  const rows: AdvisorCompensationRow[] = []

  for (const advisorId of advisorIds) {
    const row = emptyRow(advisorId, advisorNameFrom(advisorId, options.items))

    for (const item of options.items) {
      const expectedRows = item.expected_compensations.filter((live) => live.advisor_id === advisorId)
      const inExpectedPeriod = calendarDateInPeriod(
        expectedCompensationPeriodDate(item),
        period,
        today,
      )
      if (inExpectedPeriod) {
        row.expectedCents += resolvedExpectedCents(expectedRows)
        row.reviewCount += reviewCount(expectedRows)
        if (isOutstandingProductionStage(item.production_stage)) {
          const allTimeForPair = scopedEvents.filter(
            (event) => event.application_id === item.id && event.advisor_id === advisorId,
          )
          const remaining =
            resolvedExpectedCents(expectedRows) - netActualCents(allTimeForPair, scopedEvents)
          row.outstandingCents += Math.max(0, remaining)
        }
      }
    }

    const periodEvents = scopedEvents.filter((event) => {
      if (event.advisor_id !== advisorId) return false
      return calendarDateInPeriod(event.transaction_date, period, today)
    })
    row.paidCents += sumActiveEventType(periodEvents, scopedEvents, 'paid')
    row.chargebackCents += sumActiveEventType(periodEvents, scopedEvents, 'chargeback')
    row.netPaidCents += netActualCents(periodEvents, scopedEvents)

    const hasSignal =
      row.expectedCents !== 0 ||
      row.outstandingCents !== 0 ||
      row.paidCents !== 0 ||
      row.chargebackCents !== 0 ||
      row.netPaidCents !== 0 ||
      row.reviewCount > 0
    if (hasSignal) rows.push(row)
  }

  rows.sort((a, b) => {
    if (a.advisorId == null) return 1
    if (b.advisorId == null) return -1
    return a.advisorName.localeCompare(b.advisorName)
  })

  const totals = rows.reduce(
    (acc, row) => {
      acc.expectedCents += row.expectedCents
      acc.outstandingCents += row.outstandingCents
      acc.paidCents += row.paidCents
      acc.chargebackCents += row.chargebackCents
      acc.netPaidCents += row.netPaidCents
      acc.reviewCount += row.reviewCount
      return acc
    },
    {
      expectedCents: 0,
      outstandingCents: 0,
      paidCents: 0,
      chargebackCents: 0,
      netPaidCents: 0,
      reviewCount: 0,
    },
  )

  return { period, rows, totals }
}
