import type {
  ExpectedCalculationStatus,
  ExpectedReviewReason,
  WritingContractLevel,
} from './types'

const REVIEW_REASON_COPY: Record<ExpectedReviewReason, string> = {
  missing_writing_contract_level:
    'The writing advisor rank was not recorded on this allocation.',
  missing_lookup_date:
    'Expected compensation needs a submission or issue date before it can be calculated.',
  missing_compensation_base:
    'Expected compensation needs a submitted premium or annuity deposit.',
  premium_mode_not_annualizable:
    'The submitted premium mode cannot be automatically annualized.',
  no_rate_card: 'No compensation rate is available for this product.',
  no_rate_card_for_lookup_date:
    'No compensation rate applies to the policy’s lookup date.',
  age_sensitive_rate_card: 'The compensation rate requires age review.',
}

const EXPECTED_STATUS_LABELS = {
  not_calculated: 'Not calculated',
  expected: 'Expected',
  review_required: 'Review required',
  no_rate: 'No rate',
} as const

const ACTUAL_STATUS_LABELS = {
  no_payments: 'No payments',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overpaid: 'Overpaid',
  charged_back: 'Charged back',
  net_zero: 'Net zero',
  expected_unavailable: 'Expected unavailable',
} as const

const EVENT_TYPE_LABELS = {
  paid: 'Paid',
  adjustment: 'Adjustment',
  chargeback: 'Chargeback',
  recovery: 'Recovery',
  reversal: 'Reversal',
} as const

export function formatExpectedReviewReason(reason: string | null | undefined): string {
  if (!reason) return 'Expected compensation needs review. Policy Production can continue.'
  return (
    REVIEW_REASON_COPY[reason as ExpectedReviewReason] ??
    'Expected compensation needs review. Policy Production can continue.'
  )
}

export function formatExpectedUnavailableOrReviewCopy(
  status: ExpectedCalculationStatus | string,
  reason: string | null | undefined,
): string | null {
  if (status === 'resolved') return null
  if (reason && REVIEW_REASON_COPY[reason as ExpectedReviewReason]) {
    return REVIEW_REASON_COPY[reason as ExpectedReviewReason]
  }
  if (status === 'unavailable') {
    return 'No compensation rate is currently available for this product.'
  }
  return formatExpectedReviewReason(reason)
}

export function formatExpectedStatusLabel(
  status: keyof typeof EXPECTED_STATUS_LABELS | string,
): string {
  return EXPECTED_STATUS_LABELS[status as keyof typeof EXPECTED_STATUS_LABELS] ?? status
}

export function formatActualStatusLabel(
  status: keyof typeof ACTUAL_STATUS_LABELS | string,
): string {
  return ACTUAL_STATUS_LABELS[status as keyof typeof ACTUAL_STATUS_LABELS] ?? status
}

export function formatCommissionEventTypeLabel(eventType: string | null | undefined): string {
  if (!eventType) return '—'
  return EVENT_TYPE_LABELS[eventType as keyof typeof EVENT_TYPE_LABELS] ?? eventType
}

export function formatWritingContractLevel(level: WritingContractLevel | string | null | undefined): string {
  if (!level) return '—'
  return level
}

/** Display-only percent from a 0–2 writing_rate. Not used for money math. */
export function formatWritingRatePercent(rate: string | number | null | undefined): string {
  if (rate == null || rate === '') return '—'
  const numeric = typeof rate === 'number' ? rate : Number(rate)
  if (!Number.isFinite(numeric)) return '—'
  const scaled = numeric * 100
  const text = scaled.toFixed(4).replace(/\.?0+$/, '')
  return `${text}%`
}

/** Display-only allocation percent from integer commission_bps (10000 = 100%). */
export function formatCommissionBpsPercent(bps: number | null | undefined): string {
  if (bps == null || !Number.isFinite(bps)) return '—'
  const whole = Math.trunc(bps / 100)
  const frac = Math.abs(bps % 100)
  if (frac === 0) return `${whole}%`
  return `${whole}.${String(frac).padStart(2, '0')}%`
}
