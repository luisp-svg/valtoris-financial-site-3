import { getCurrentAllocations } from './daysInStage'
import { formatCents } from './productionApi'
import type {
  CompensationViewer,
  LiveExpectedCompensationRow,
  ProductionAllocation,
  ProductionStage,
} from './types'

export type DerivedExpectedStatus =
  | 'not_calculated'
  | 'expected'
  | 'review_required'
  | 'no_rate'

export type DerivedActualStatus =
  | 'no_payments'
  | 'partially_paid'
  | 'paid'
  | 'overpaid'
  | 'charged_back'
  | 'net_zero'
  | 'expected_unavailable'

export type ListExpectedPresentation = {
  status: DerivedExpectedStatus
  amountCents: number | null
  amountKind: 'case_total' | 'your_expected' | 'none'
  split: boolean
  review: boolean
}

export type WritingCommissionTotals = {
  expected_cents: number | null
  gross_paid_cents: number
  adjustment_cents: number
  chargeback_cents: number
  recovery_cents: number
  net_actual_cents: number
  remaining_expected_cents: number | null
  variance_cents: number | null
}

export type WritingCommissionEvent = {
  id: string
  event_type: string
  amount_cents: number
  transaction_date: string | null
  statement_identifier: string | null
  policy_reference: string | null
  source_file: string | null
  source_row: number | null
  reversed_event_id: string | null
  import_batch_identifier: string | null
  reason: string | null
  created_at: string
  idempotency_key?: string | null
  advisor_id?: string | null
  allocation_id?: string | null
  attribution_status?: string | null
  carrier_transaction_id?: string | null
  statement_date?: string | null
}

export type EventReversalPresentation =
  | { kind: 'active' }
  | { kind: 'reversed'; reversalId: string }
  | { kind: 'reversal'; originalId: string }

export function countCurrentWritingAdvisors(
  allocations: readonly ProductionAllocation[] | null | undefined,
): number {
  return getCurrentAllocations([...(allocations ?? [])]).filter(
    (row) => row.allocation_role === 'writing' && row.recipient_type === 'advisor',
  ).length
}

export function isWritingSplit(
  allocations: readonly ProductionAllocation[] | null | undefined,
): boolean {
  return countCurrentWritingAdvisors(allocations) > 1
}

function sumResolvedExpectedCents(rows: readonly LiveExpectedCompensationRow[]): number | null {
  let total = 0
  let hasResolved = false
  for (const row of rows) {
    if (row.calculation_status !== 'resolved') continue
    if (row.expected_compensation_cents == null) continue
    hasResolved = true
    total += row.expected_compensation_cents
  }
  return hasResolved ? total : null
}

export function deriveExpectedListPresentation(options: {
  viewer: CompensationViewer
  productionStage: ProductionStage | string
  liveRows: readonly LiveExpectedCompensationRow[]
  writingAdvisorCount: number
}): ListExpectedPresentation {
  const split = options.writingAdvisorCount > 1
  if (options.liveRows.length === 0) {
    return {
      status: 'not_calculated',
      amountCents: null,
      amountKind: 'none',
      split,
      review: false,
    }
  }

  const hasReview = options.liveRows.some((row) => row.calculation_status === 'review_required')
  const hasUnavailable = options.liveRows.some((row) => row.calculation_status === 'unavailable')
  const status: DerivedExpectedStatus = hasReview
    ? 'review_required'
    : hasUnavailable
      ? 'no_rate'
      : 'expected'

  const amountCents = sumResolvedExpectedCents(options.liveRows)
  const amountKind: ListExpectedPresentation['amountKind'] =
    amountCents == null ? 'none' : options.viewer === 'advisor' ? 'your_expected' : 'case_total'

  return {
    status,
    amountCents,
    amountKind,
    split,
    review: status === 'review_required' || status === 'no_rate',
  }
}

export function formatListExpectedAmount(
  presentation: Pick<ListExpectedPresentation, 'amountCents' | 'amountKind'>,
): string {
  if (presentation.amountKind === 'none' || presentation.amountCents == null) return '—'
  return formatCents(presentation.amountCents)
}

export function listExpectedAmountCaption(
  presentation: Pick<ListExpectedPresentation, 'amountKind'>,
): string | null {
  if (presentation.amountKind === 'your_expected') return 'Your expected'
  return null
}

export function deriveActualStatus(options: {
  totals: WritingCommissionTotals | null
  eventCount: number
}): { primary: DerivedActualStatus; chargedBack: boolean } {
  const totals = options.totals
  if (!totals || options.eventCount === 0) {
    return { primary: 'no_payments', chargedBack: false }
  }

  const chargedBack = totals.chargeback_cents !== 0
  if (totals.expected_cents == null) {
    return { primary: 'expected_unavailable', chargedBack }
  }

  if (totals.net_actual_cents === 0) {
    return { primary: 'net_zero', chargedBack }
  }
  if (totals.remaining_expected_cents === 0) {
    return { primary: 'paid', chargedBack }
  }
  if (totals.variance_cents != null && totals.variance_cents > 0) {
    return { primary: 'overpaid', chargedBack }
  }
  if (totals.net_actual_cents > 0 && totals.net_actual_cents < totals.expected_cents) {
    return { primary: 'partially_paid', chargedBack }
  }
  return { primary: 'partially_paid', chargedBack }
}

export function formatSignedCents(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return '—'
  const formatted = formatCents(Math.abs(cents))
  if (cents < 0) return `-${formatted}`
  if (cents > 0) return `+${formatted}`
  return formatted
}

export function presentEventReversal(
  event: Pick<WritingCommissionEvent, 'id' | 'event_type' | 'reversed_event_id'>,
  allEvents: readonly Pick<WritingCommissionEvent, 'id' | 'event_type' | 'reversed_event_id'>[],
): EventReversalPresentation {
  if (event.event_type === 'reversal' && event.reversed_event_id) {
    return { kind: 'reversal', originalId: event.reversed_event_id }
  }
  const reversal = allEvents.find(
    (candidate) =>
      candidate.event_type === 'reversal' && candidate.reversed_event_id === event.id,
  )
  if (reversal) return { kind: 'reversed', reversalId: reversal.id }
  return { kind: 'active' }
}

export function expectedEmptyMessage(options: {
  productionStage: ProductionStage | string
  liveRows: readonly LiveExpectedCompensationRow[]
  status: DerivedExpectedStatus
  writingReceivableExpected?: boolean
}): string | null {
  if (options.writingReceivableExpected === false) {
    return 'Valtoris does not currently expect writing compensation on this application.'
  }
  if (options.liveRows.length > 0 && options.status === 'expected') return null
  if (
    options.liveRows.length === 0 &&
    (options.productionStage === 'draft' || options.productionStage === 'pre_submitted')
  ) {
    return 'Expected compensation will be calculated after submission.'
  }
  if (options.status === 'no_rate' || options.liveRows.some((row) => row.calculation_status === 'unavailable')) {
    return 'No compensation rate is currently available for this product.'
  }
  if (options.status === 'review_required') {
    return 'Expected compensation needs review. Policy Production can continue.'
  }
  if (options.liveRows.length === 0) {
    return 'Expected compensation will be calculated after submission.'
  }
  return null
}

export function actualEmptyMessage(options: {
  eventCount: number
  expectedCents: number | null | undefined
}): string | null {
  if (options.eventCount === 0) return 'No actual commission has been recorded yet.'
  if (options.expectedCents == null) {
    return 'Cash has been recorded, but expected compensation is unavailable. Variance is not calculated.'
  }
  return null
}
