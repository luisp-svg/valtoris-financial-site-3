/**
 * Emergency Fund criterion budgets (sum = 10).
 *
 * 1. Emergency Fund Months ............. 5
 * 2. Dedicated Emergency Fund .......... 2
 * 3. Liquidity of Emergency Assets ..... 2
 * 4. Automatic Savings Habit ........... 1
 */
export const EMERGENCY_FUND_CRITERION_MAX_POINTS = {
  emergency_fund_months: 5,
  dedicated_emergency_fund: 2,
  liquidity_of_emergency_assets: 2,
  automatic_savings_habit: 1,
} as const

export type EmergencyFundCriterionId = keyof typeof EMERGENCY_FUND_CRITERION_MAX_POINTS

export const EMERGENCY_FUND_CRITERION_LABELS: Record<EmergencyFundCriterionId, string> = {
  emergency_fund_months: 'Emergency Fund Months',
  dedicated_emergency_fund: 'Dedicated Emergency Fund',
  liquidity_of_emergency_assets: 'Liquidity of Emergency Assets',
  automatic_savings_habit: 'Automatic Savings Habit',
}

export const EMERGENCY_FUND_CATEGORY_ID = 'emergency_fund' as const

/**
 * Months-of-coverage scoring bands (inclusive lower bounds where noted).
 * Target documented in methodology: 6+ months of essential expenses.
 */
export const EMERGENCY_FUND_MONTHS_BANDS = [
  { minMonthsInclusive: 6, points: 5, status: 'met' as const, label: '6+ months' },
  { minMonthsInclusive: 3, points: 4, status: 'partial' as const, label: '3 to <6 months' },
  { minMonthsInclusive: 1, points: 2, status: 'partial' as const, label: '1 to <3 months' },
  { minMonthsInclusive: Number.MIN_VALUE, points: 1, status: 'partial' as const, label: '>0 to <1 month' },
] as const

/** Documented target months for recommendations. */
export const EMERGENCY_FUND_TARGET_MONTHS = 6
