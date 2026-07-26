/**
 * Cash Flow & Budget criterion budgets (sum = 15).
 *
 * 1. Monthly Cash Flow Position ........ 6
 * 2. Budgeting System .................. 3
 * 3. Savings Rate ...................... 4
 * 4. Expense Tracking Consistency ...... 2
 */
export const CASH_FLOW_BUDGET_CRITERION_MAX_POINTS = {
  monthly_cash_flow_position: 6,
  budgeting_system: 3,
  savings_rate: 4,
  expense_tracking_consistency: 2,
} as const

export type CashFlowBudgetCriterionId = keyof typeof CASH_FLOW_BUDGET_CRITERION_MAX_POINTS

export const CASH_FLOW_BUDGET_CRITERION_LABELS: Record<CashFlowBudgetCriterionId, string> = {
  monthly_cash_flow_position: 'Monthly Cash Flow Position',
  budgeting_system: 'Budgeting System',
  savings_rate: 'Savings Rate',
  expense_tracking_consistency: 'Expense Tracking Consistency',
}

export const CASH_FLOW_BUDGET_CATEGORY_ID = 'cash_flow_budget' as const

/**
 * Relative tolerance for comparing monthly vs annual equivalents and
 * derived metrics vs raw calculations.
 * Example: |a − b| / max(|a|, |b|, ε) ≤ 0.10 → consistent.
 */
export const CASH_FLOW_SOURCE_CONFLICT_TOLERANCE = 0.1

/**
 * Cash-flow margin scoring bands (margin = net / income).
 * Evaluated from highest threshold first.
 */
export const CASH_FLOW_MARGIN_BANDS = [
  { minMarginInclusive: 0.2, points: 6, status: 'met' as const, label: '≥20%' },
  { minMarginInclusive: 0.1, points: 5, status: 'partial' as const, label: '10% to <20%' },
  { minMarginInclusive: Number.MIN_VALUE, points: 3, status: 'partial' as const, label: '>0% to <10%' },
] as const

/** Break-even (exactly 0% margin) score when margin is calculable. */
export const CASH_FLOW_BREAK_EVEN_POINTS = 1

/**
 * Fallback when only a documented monthly net cash-flow amount/sign is known
 * (no income denominator for a percentage margin).
 */
export const CASH_FLOW_NET_FALLBACK_POINTS = {
  positive: 3,
  breakEven: 1,
  negative: 0,
} as const

/**
 * Savings-rate scoring bands for verified total household savings rate only.
 * Evaluated from highest threshold first.
 */
export const SAVINGS_RATE_BANDS = [
  { minRateInclusive: 0.2, points: 4, status: 'met' as const, label: '≥20%' },
  { minRateInclusive: 0.15, points: 3, status: 'partial' as const, label: '15% to <20%' },
  { minRateInclusive: 0.1, points: 2, status: 'partial' as const, label: '10% to <15%' },
  { minRateInclusive: Number.MIN_VALUE, points: 1, status: 'partial' as const, label: '>0% to <10%' },
] as const

/**
 * Partial credit when retirement-only saving is confirmed but total household
 * savings rate cannot be verified. Never awards total-rate band points.
 */
export const RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS = 1

/**
 * Family-assessment retirementContribution bands that confirm some retirement
 * saving (not a total household savings rate).
 */
export const RETIREMENT_ONLY_SAVING_BANDS = [
  'under-3',
  '3-5',
  '6-10',
  '11-15',
  'over-15',
] as const

/** Band indicating no retirement saving (still not a verified total household 0%). */
export const RETIREMENT_NOT_SAVING_BAND = 'not-saving' as const

/** Recognized documented budgeting methods (aliases normalized in extraction). */
export const RECOGNIZED_BUDGET_METHODS = [
  'zero-based',
  'zero based',
  'percentage-based',
  'percentage based',
  '50/30/20',
  '50-30-20',
  'envelope',
  'envelope system',
  'written monthly spending plan',
  'written spending plan',
  'monthly spending plan',
  'written budget',
] as const

/**
 * Expense-tracking frequency aliases.
 * Values are lowercased / hyphen-normalized before lookup.
 */
export const EXPENSE_TRACKING_FREQUENCY = {
  met: [
    'weekly',
    'biweekly',
    'bi-weekly',
    'bi weekly',
    'every week',
    'monthly',
    'every month',
    'each month',
    'at least monthly',
  ],
  partial: [
    'quarterly',
    'occasionally',
    'occasional',
    'irregularly',
    'irregular',
    'annually',
    'yearly',
    'sometimes',
    'less than monthly',
  ],
  unmet: ['never', 'no', 'none', 'not tracked', 'not-tracked', 'do not track'],
} as const
