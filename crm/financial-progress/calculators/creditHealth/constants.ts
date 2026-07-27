/**
 * Credit Health criterion budgets (sum = 10).
 *
 * 1. Payment History .................... 4
 * 2. Credit Utilization ................. 3
 * 3. Credit Profile Stability ........... 2
 * 4. Credit Monitoring & Review ......... 1
 *
 * Educational only — does not estimate FICO/VantageScore or promise score outcomes.
 */
export const CREDIT_HEALTH_CRITERION_MAX_POINTS = {
  payment_history: 4,
  credit_utilization: 3,
  credit_profile_stability: 2,
  credit_monitoring_review: 1,
} as const

export type CreditHealthCriterionId = keyof typeof CREDIT_HEALTH_CRITERION_MAX_POINTS

export const CREDIT_HEALTH_CRITERION_LABELS: Record<CreditHealthCriterionId, string> = {
  payment_history: 'Payment History',
  credit_utilization: 'Credit Utilization',
  credit_profile_stability: 'Credit Profile Stability',
  credit_monitoring_review: 'Credit Monitoring & Review',
}

export const CREDIT_HEALTH_CATEGORY_ID = 'credit_health' as const

/**
 * Utilization point bands (ratio 0–1+).
 * <10% → 3 | 10–29% → 2 | 30–49% → 1 | 50%+ → 0
 */
export const CREDIT_UTILIZATION_BANDS = [
  { maxExclusive: 0.1, points: 3 },
  { maxExclusive: 0.3, points: 2 },
  { maxExclusive: 0.5, points: 1 },
] as const

/** Absolute ratio difference above which two utilization readings conflict. */
export const CREDIT_UTILIZATION_CONFLICT_TOLERANCE = 0.02

/**
 * Derogatory payment-history events dated within this many months of `input.asOf`
 * are treated as recent (inclusive boundary). Older dated events are historical.
 */
export const PAYMENT_HISTORY_RECENT_MONTHS = 24

/**
 * Credit review / monitoring freshness window relative to `input.asOf`.
 * Dated reviews within this many months (inclusive) count as current.
 */
export const CREDIT_REVIEW_CURRENT_MONTHS = 12

/**
 * Recent late-payment count → payment-history points when recency is established.
 * 0 → 4 | 1 → 3 | 2–3 → 2 | 4+ → 1
 */
export const PAYMENT_HISTORY_RECENT_LATE_COUNT_BANDS = [
  { maxInclusive: 0, points: 4 },
  { maxInclusive: 1, points: 3 },
  { maxInclusive: 3, points: 2 },
] as const

/**
 * Profile stability thresholds (months / counts).
 * Stable: oldest account ≥ 84 months, recent inquiries ≤ 2, new accounts (12m) ≤ 1 → 2
 * Moderate: oldest ≥ 24 months (and not excessive new credit) → 1
 * Thin/new or excessive new credit → 0
 */
export const PROFILE_STABLE_OLDEST_ACCOUNT_MONTHS = 84
export const PROFILE_MODERATE_OLDEST_ACCOUNT_MONTHS = 24
export const PROFILE_EXCESSIVE_INQUIRIES_12M = 5
export const PROFILE_STABLE_MAX_INQUIRIES_12M = 2
export const PROFILE_STABLE_MAX_NEW_ACCOUNTS_12M = 1
export const PROFILE_EXCESSIVE_NEW_ACCOUNTS_12M = 3
export const PROFILE_MODERATE_AVERAGE_AGE_MONTHS = 36

/**
 * Authoritative date-field aliases accepted for payment-history recency.
 * Documented intentionally — no speculative aliases beyond these.
 */
export const PAYMENT_HISTORY_DATE_ALIASES = {
  lastLatePaymentDate: ['lastLatePaymentDate', 'last_late_payment_date'],
  mostRecentDelinquencyDate: [
    'mostRecentDelinquencyDate',
    'most_recent_delinquency_date',
  ],
  collectionReportedDate: ['collectionReportedDate', 'collection_reported_date'],
  collectionUpdatedDate: ['collectionUpdatedDate', 'collection_updated_date'],
  chargeOffDate: ['chargeOffDate', 'charge_off_date'],
  derogatoryEventDate: ['derogatoryEventDate', 'derogatory_event_date'],
  paymentHistoryReportingAsOf: [
    'paymentHistoryReportingAsOf',
    'payment_history_reporting_as_of',
    'paymentHistoryPeriodEnd',
    'payment_history_period_end',
  ],
} as const

/**
 * Authoritative review-date aliases for monitoring freshness.
 */
export const CREDIT_REVIEW_DATE_ALIASES = [
  'annualCreditReviewDate',
  'annual_credit_review_date',
  'advisorCreditReviewDate',
  'advisor_credit_review_date',
  'creditReviewDate',
  'credit_review_date',
  'lastCreditReviewDate',
  'last_credit_review_date',
] as const
