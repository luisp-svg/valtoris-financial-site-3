/**
 * Read-only Commission workspace view models.
 * Reuses 034 expected rows, 035 list events, and existing dashboard math.
 * Pending dollars are attached separately from accepted 040 facts.
 * Does not store Eligible or Released.
 */
import {
  expectedCompensationPeriodDate,
  isOutstandingProductionStage,
  netActualCents,
  sumActiveEventType,
} from '../production/advisorCompensationView'
import { formatExpectedUnavailableOrReviewCopy } from '../production/compensationLabels'
import {
  deriveActualStatus,
  type WritingCommissionTotals,
} from '../production/compensationView'
import { calendarDateInPeriod, type DashboardReportingPeriod } from '../production/dashboardPeriod'
import type { PaidCommissionListEvent } from '../production/dashboardView'
import { formatProductionStageLabel } from '../production/labels'
import type {
  CompensationViewer,
  LiveExpectedCompensationRow,
  ProductionApplicationListItem,
  ProductionProductLine,
  ProductionStage,
} from '../production/types'
import {
  commissionClientLabel,
  commissionProductServiceLabel,
  commissionProviderLabel,
  commissionReferenceLabel,
} from './commissionPresentation'

export const COMMISSION_WORK_DERIVED_STATUSES = [
  'needs_review',
  'no_payments',
  'outstanding',
  'partially_paid',
  'paid',
  'overpaid',
  'net_zero',
  'expected_unavailable',
] as const

export type CommissionWorkDerivedStatus = (typeof COMMISSION_WORK_DERIVED_STATUSES)[number]

export type CommissionWorkKind = 'writing_advisor' | 'unattributed'

export type CommissionWorkStatusPresentation = {
  primary: CommissionWorkDerivedStatus
  chargedBack: boolean
  needsReview: boolean
}

export type CommissionWorkPendingSource = {
  rowId: string
  batchId: string
  amountCents: number
  advisorName: string
  client: string | null
  policyNumber: string | null
  company: string | null
  product: string | null
  statementIdentifier: string | null
  statementDate: string | null
  sourceFile: string | null
  transactionDate: string | null
  carrierId: string | null
  sourceRow: number | null
}

export type CommissionWorkItem = {
  id: string
  kind: CommissionWorkKind
  applicationId: string
  allocationId: string | null
  advisorId: string | null
  advisorName: string
  clientLabel: string
  referenceLabel: string
  providerLabel: string
  providerId: string
  productServiceLabel: string
  productLine: ProductionProductLine
  productionStage: ProductionStage
  productionStageLabel: string
  expectedCents: number | null
  outstandingCents: number
  remainingExpectedCents: number | null
  pendingCents: number
  paidCents: number
  chargebackCents: number
  netPaidCents: number
  adjustmentCents: number
  recoveryCents: number
  eventCount: number
  lastFinancialActivity: string | null
  expectedPeriodDate: string | null
  pendingPeriodDate: string | null
  pendingSource: CommissionWorkPendingSource | null
  /** UI-only accepted Pending row with no existing 034/035 queue item. Not a ledger record. */
  pendingOnlyStub: boolean
  derivedStatus: CommissionWorkStatusPresentation
  reviewReason: string | null
  expectedRow: LiveExpectedCompensationRow | null
}

export function isPendingOnlyCommissionStub(
  item: Pick<CommissionWorkItem, 'pendingOnlyStub'>,
): boolean {
  return item.pendingOnlyStub === true
}

export function commissionWorkItemId(
  applicationId: string,
  allocationId: string | null,
  advisorId: string | null,
): string {
  if (allocationId) return `${applicationId}:${allocationId}`
  if (advisorId) return `${applicationId}:advisor:${advisorId}`
  return `${applicationId}:unattributed`
}

function eventsForPair(
  events: readonly PaidCommissionListEvent[],
  applicationId: string,
  advisorId: string | null,
  allocationId: string | null,
): PaidCommissionListEvent[] {
  return events.filter((event) => {
    if (event.application_id !== applicationId) return false
    if (advisorId == null) return event.advisor_id == null
    if (event.advisor_id !== advisorId) return false
    if (allocationId && event.allocation_id && event.allocation_id !== allocationId) {
      return false
    }
    return true
  })
}

function effectiveMoneyEventCount(
  events: readonly PaidCommissionListEvent[],
  all: readonly PaidCommissionListEvent[],
): number {
  return events.filter((event) => {
    if (event.event_type === 'reversal') return false
    return !all.some(
      (candidate) =>
        candidate.event_type === 'reversal' && candidate.reversed_event_id === event.id,
    )
  }).length
}

function lastActivityDate(events: readonly PaidCommissionListEvent[]): string | null {
  let latest: string | null = null
  for (const event of events) {
    if (!event.transaction_date) continue
    if (latest == null || event.transaction_date > latest) latest = event.transaction_date
  }
  return latest
}

function pairTotals(
  expectedCents: number | null,
  pairEvents: readonly PaidCommissionListEvent[],
  allEvents: readonly PaidCommissionListEvent[],
): WritingCommissionTotals {
  const paid = sumActiveEventType(pairEvents, allEvents, 'paid')
  const chargeback = sumActiveEventType(pairEvents, allEvents, 'chargeback')
  let adjustment = 0
  let recovery = 0
  for (const event of pairEvents) {
    if (event.event_type === 'reversal') continue
    const reversed = allEvents.some(
      (candidate) =>
        candidate.event_type === 'reversal' && candidate.reversed_event_id === event.id,
    )
    if (reversed) continue
    if (event.event_type === 'adjustment') adjustment += event.amount_cents
    if (event.event_type === 'recovery') recovery += event.amount_cents
  }
  const net = netActualCents(pairEvents, allEvents)
  return {
    expected_cents: expectedCents,
    gross_paid_cents: paid,
    adjustment_cents: adjustment,
    chargeback_cents: chargeback,
    recovery_cents: recovery,
    net_actual_cents: net,
    remaining_expected_cents: expectedCents == null ? null : expectedCents - net,
    variance_cents: expectedCents == null ? null : net - expectedCents,
  }
}

function resolvedExpectedCents(row: LiveExpectedCompensationRow | null): number | null {
  if (!row || row.calculation_status !== 'resolved') return null
  return row.expected_compensation_cents
}

function outstandingForPair(
  stage: ProductionStage | string,
  expectedCents: number | null,
  netActual: number,
): number {
  if (!isOutstandingProductionStage(stage)) return 0
  if (expectedCents == null) return 0
  return Math.max(0, expectedCents - netActual)
}

export function deriveCommissionWorkStatus(options: {
  expectedRow: LiveExpectedCompensationRow | null
  totals: WritingCommissionTotals
  eventCount: number
  outstandingCents: number
}): CommissionWorkStatusPresentation {
  const { expectedRow, totals, eventCount, outstandingCents } = options
  const needsReview =
    expectedRow?.calculation_status === 'review_required' ||
    expectedRow?.calculation_status === 'unavailable'
  const actual = deriveActualStatus({ totals, eventCount })

  if (eventCount === 0 && expectedRow?.calculation_status === 'unavailable') {
    return { primary: 'expected_unavailable', chargedBack: false, needsReview: true }
  }
  if (eventCount === 0 && expectedRow?.calculation_status === 'review_required') {
    return { primary: 'needs_review', chargedBack: false, needsReview: true }
  }
  if (actual.primary === 'no_payments') {
    if (outstandingCents > 0) {
      return { primary: 'outstanding', chargedBack: false, needsReview }
    }
    return { primary: 'no_payments', chargedBack: false, needsReview }
  }
  if (actual.primary === 'expected_unavailable') {
    return {
      primary: 'expected_unavailable',
      chargedBack: actual.chargedBack,
      needsReview: true,
    }
  }
  if (
    actual.primary === 'partially_paid' ||
    actual.primary === 'paid' ||
    actual.primary === 'overpaid' ||
    actual.primary === 'net_zero'
  ) {
    return {
      primary: actual.primary,
      chargedBack: actual.chargedBack,
      needsReview,
    }
  }
  return {
    primary: 'no_payments',
    chargedBack: actual.chargedBack,
    needsReview,
  }
}

function advisorNameFor(
  row: LiveExpectedCompensationRow | null,
  item: ProductionApplicationListItem,
  advisorId: string | null,
): string {
  if (advisorId == null) return 'Unattributed'
  if (row?.advisor_display_name?.trim()) return row.advisor_display_name.trim()
  const allocation = item.allocations.find(
    (candidate) => candidate.advisor_id === advisorId && candidate.effective_to == null,
  )
  if (allocation?.advisor?.display_name?.trim()) return allocation.advisor.display_name.trim()
  return 'Advisor'
}

function reviewCopy(row: LiveExpectedCompensationRow | null): string | null {
  if (!row) return null
  if (row.calculation_status === 'resolved') return null
  return formatExpectedUnavailableOrReviewCopy(row.calculation_status, row.review_reason)
}

function toWorkItem(options: {
  item: ProductionApplicationListItem
  expectedRow: LiveExpectedCompensationRow | null
  advisorId: string | null
  allocationId: string | null
  kind: CommissionWorkKind
  pairEvents: readonly PaidCommissionListEvent[]
  allEvents: readonly PaidCommissionListEvent[]
}): CommissionWorkItem {
  const expectedCents = resolvedExpectedCents(options.expectedRow)
  const totals = pairTotals(expectedCents, options.pairEvents, options.allEvents)
  const outstandingCents = outstandingForPair(
    options.item.production_stage,
    expectedCents,
    totals.net_actual_cents,
  )
  const effectiveEvents = effectiveMoneyEventCount(options.pairEvents, options.allEvents)
  return {
    id: commissionWorkItemId(options.item.id, options.allocationId, options.advisorId),
    kind: options.kind,
    applicationId: options.item.id,
    allocationId: options.allocationId,
    advisorId: options.advisorId,
    advisorName: advisorNameFor(options.expectedRow, options.item, options.advisorId),
    clientLabel: commissionClientLabel(options.item),
    referenceLabel: commissionReferenceLabel(options.item),
    providerLabel: commissionProviderLabel(options.item),
    providerId: options.item.carrier_id,
    productServiceLabel: commissionProductServiceLabel(options.item),
    productLine: options.item.product_line,
    productionStage: options.item.production_stage,
    productionStageLabel: formatProductionStageLabel(options.item.production_stage),
    expectedCents,
    outstandingCents,
    remainingExpectedCents: totals.remaining_expected_cents,
    pendingCents: 0,
    paidCents: totals.gross_paid_cents,
    chargebackCents: totals.chargeback_cents,
    netPaidCents: totals.net_actual_cents,
    adjustmentCents: totals.adjustment_cents,
    recoveryCents: totals.recovery_cents,
    eventCount: options.pairEvents.length,
    lastFinancialActivity: lastActivityDate(options.pairEvents),
    expectedPeriodDate: expectedCompensationPeriodDate(options.item),
    pendingPeriodDate: null,
    pendingSource: null,
    pendingOnlyStub: false,
    derivedStatus: deriveCommissionWorkStatus({
      expectedRow: options.expectedRow,
      totals,
      eventCount: effectiveEvents,
      outstandingCents,
    }),
    reviewReason: reviewCopy(options.expectedRow),
    expectedRow: options.expectedRow,
  }
}

/**
 * One work item per writing allocation / advisor (plus owner-only unattributed
 * cash). Built only from RLS-visible expected rows and 035 events.
 */
export function buildCommissionWorkItems(options: {
  items: readonly ProductionApplicationListItem[]
  events: readonly PaidCommissionListEvent[]
}): CommissionWorkItem[] {
  const workItems: CommissionWorkItem[] = []
  const covered = new Set<string>()
  const visibleIds = new Set(options.items.map((item) => item.id))
  const scopedEvents = options.events.filter((event) => visibleIds.has(event.application_id))

  for (const item of options.items) {
    for (const expectedRow of item.expected_compensations) {
      const key = `${item.id}:${expectedRow.advisor_id}`
      covered.add(key)
      const pairEvents = eventsForPair(
        scopedEvents,
        item.id,
        expectedRow.advisor_id,
        expectedRow.allocation_id,
      )
      workItems.push(
        toWorkItem({
          item,
          expectedRow,
          advisorId: expectedRow.advisor_id,
          allocationId: expectedRow.allocation_id,
          kind: 'writing_advisor',
          pairEvents,
          allEvents: scopedEvents,
        }),
      )
    }

    const leftoverByAdvisor = new Map<string | null, PaidCommissionListEvent[]>()
    for (const event of scopedEvents) {
      if (event.application_id !== item.id) continue
      const key = event.advisor_id == null ? `${item.id}:unattributed` : `${item.id}:${event.advisor_id}`
      if (event.advisor_id != null && covered.has(`${item.id}:${event.advisor_id}`)) continue
      if (event.advisor_id == null && covered.has(key)) continue
      const list = leftoverByAdvisor.get(event.advisor_id) ?? []
      list.push(event)
      leftoverByAdvisor.set(event.advisor_id, list)
    }

    for (const [advisorId, pairEvents] of leftoverByAdvisor) {
      if (advisorId == null) {
        covered.add(`${item.id}:unattributed`)
        workItems.push(
          toWorkItem({
            item,
            expectedRow: null,
            advisorId: null,
            allocationId: null,
            kind: 'unattributed',
            pairEvents,
            allEvents: scopedEvents,
          }),
        )
        continue
      }
      const allocation =
        pairEvents.find((event) => event.allocation_id)?.allocation_id ??
        item.allocations.find(
          (row) =>
            row.advisor_id === advisorId &&
            row.allocation_role === 'writing' &&
            row.recipient_type === 'advisor',
        )?.id ??
        null
      workItems.push(
        toWorkItem({
          item,
          expectedRow: null,
          advisorId,
          allocationId: allocation,
          kind: 'writing_advisor',
          pairEvents,
          allEvents: scopedEvents,
        }),
      )
    }
  }

  workItems.sort((a, b) => {
    const client = a.clientLabel.localeCompare(b.clientLabel)
    if (client !== 0) return client
    const advisor = a.advisorName.localeCompare(b.advisorName)
    if (advisor !== 0) return advisor
    return a.id.localeCompare(b.id)
  })
  return workItems
}

export function workItemInReportingPeriod(
  item: CommissionWorkItem,
  period: DashboardReportingPeriod,
  today: string,
): boolean {
  if (calendarDateInPeriod(item.expectedPeriodDate, period, today)) return true
  if (item.lastFinancialActivity && calendarDateInPeriod(item.lastFinancialActivity, period, today)) {
    return true
  }
  if (item.pendingPeriodDate && calendarDateInPeriod(item.pendingPeriodDate, period, today)) {
    return true
  }
  if (period === 'lifetime') return true
  return false
}

export type UnattributedCommissionSummary = {
  applicationCount: number
  netCents: number
  eventCount: number
}

export function summarizeUnattributedCommission(options: {
  items: readonly CommissionWorkItem[]
  viewer: CompensationViewer
}): UnattributedCommissionSummary | null {
  if (options.viewer !== 'owner') return null
  const rows = options.items.filter((item) => item.kind === 'unattributed')
  if (rows.length === 0) return null
  return {
    applicationCount: new Set(rows.map((row) => row.applicationId)).size,
    netCents: rows.reduce((sum, row) => sum + row.netPaidCents, 0),
    eventCount: rows.reduce((sum, row) => sum + row.eventCount, 0),
  }
}

export function formatCommissionWorkStatusLabel(status: CommissionWorkDerivedStatus): string {
  switch (status) {
    case 'needs_review':
      return 'Needs Review'
    case 'no_payments':
      return 'No Payments'
    case 'outstanding':
      return 'Outstanding'
    case 'partially_paid':
      return 'Partially Paid'
    case 'paid':
      return 'Paid'
    case 'overpaid':
      return 'Overpaid'
    case 'net_zero':
      return 'Net Zero'
    case 'expected_unavailable':
      return 'Expected Unavailable'
    default:
      return status
  }
}
