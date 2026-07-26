/**
 * Debt Management criterion budgets (sum = 20).
 * Four transparent criteria worth 5 points each.
 *
 * Note: reliable consumer-vs-mortgage liability classifications are not available
 * in current household inputs, so the third criterion is Debt-to-Income Position
 * (total recorded debt ÷ annual household income) — not monthly DTI and not
 * labeled as consumer-only debt.
 */
export const DEBT_CRITERION_MAX_POINTS = {
  credit_card_utilization: 5,
  high_interest_debt: 5,
  debt_to_income_position: 5,
  debt_payoff_strategy: 5,
} as const

export type DebtCriterionId = keyof typeof DEBT_CRITERION_MAX_POINTS

export const DEBT_CRITERION_LABELS: Record<DebtCriterionId, string> = {
  credit_card_utilization: 'Credit Card Utilization',
  high_interest_debt: 'High-Interest Debt',
  debt_to_income_position: 'Debt-to-Income Position',
  debt_payoff_strategy: 'Debt Payoff Strategy',
}

export const DEBT_CATEGORY_ID = 'debt_management' as const

/**
 * APR at or above this annual rate is treated as high-interest.
 * Expressed as a decimal (0.20 = 20% APR).
 */
export const HIGH_INTEREST_APR_THRESHOLD = 0.2

/**
 * Debt-to-Income Position bands (total recorded debt ÷ annual household income).
 * Not monthly payment DTI. Not consumer-only unless classifications exist later.
 */
export const DEBT_TO_INCOME_POSITION_BANDS = [
  { maxRatioInclusive: 0, points: 5, label: 'no recorded debt' },
  { maxRatioInclusive: 0.25, points: 5, label: '≤25%' },
  { maxRatioInclusive: 0.5, points: 4, label: '≤50%' },
  { maxRatioInclusive: 1, points: 3, label: '≤100%' },
  { maxRatioInclusive: 2, points: 1, label: '≤200%' },
  { maxRatioInclusive: Number.POSITIVE_INFINITY, points: 0, label: '>200%' },
] as const

/** Recognized complete payoff-method keywords (case-insensitive substring match). */
export const RECOGNIZED_PAYOFF_METHODS = [
  'avalanche',
  'snowball',
  'consolidation',
  'refinancing',
  'refinance',
  'negotiated repayment',
  'negotiated',
  'payoff order',
  'payment plan',
  'target payment',
] as const

/** Partial credit for debt-related intent without a complete strategy. */
export const DEBT_PAYOFF_PARTIAL_POINTS = 2
