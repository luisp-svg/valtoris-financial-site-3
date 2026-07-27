import type {
  ActionPriority,
  FinancialProgressCategoryDefinition,
  FinancialProgressCategoryId,
  FinancialProgressGrade,
} from './types'

/** Bump when engine packaging / API shape changes. */
export const FINANCIAL_PROGRESS_ENGINE_VERSION = '1.0.0'

/**
 * Identifies the approved Household Financial Progress scoring methodology.
 * Persist with Score Snapshots so historical results remain interpretable.
 */
export const FINANCIAL_PROGRESS_METHODOLOGY_VERSION = 'household-progress-v1'

/** Total Progress Score scale for the methodology. */
export const FINANCIAL_PROGRESS_TOTAL_POINTS = 100

/**
 * Approved category max-points budgets (source of truth).
 * Weights are always derived as maxPoints / FINANCIAL_PROGRESS_TOTAL_POINTS.
 */
const CATEGORY_MAX_POINTS = {
  cash_flow_budget: 15,
  emergency_fund: 10,
  debt_management: 20,
  protection_insurance: 15,
  retirement_readiness: 15,
  estate_legacy: 10,
  credit_health: 10,
  financial_independence: 5,
} as const satisfies Record<FinancialProgressCategoryId, number>

const CATEGORY_LABELS = {
  cash_flow_budget: 'Cash Flow & Budget',
  emergency_fund: 'Emergency Fund',
  debt_management: 'Debt Management',
  protection_insurance: 'Protection & Insurance',
  retirement_readiness: 'Retirement Readiness',
  estate_legacy: 'Estate & Legacy',
  credit_health: 'Credit Health',
  financial_independence: 'Financial Independence',
} as const satisfies Record<FinancialProgressCategoryId, string>

/** Canonical category order for composition and presentation consumers. */
export const FINANCIAL_PROGRESS_CATEGORY_IDS: readonly FinancialProgressCategoryId[] = [
  'cash_flow_budget',
  'emergency_fund',
  'debt_management',
  'protection_insurance',
  'retirement_readiness',
  'estate_legacy',
  'credit_health',
  'financial_independence',
] as const

export function weightFromMaxPoints(maxPoints: number): number {
  return maxPoints / FINANCIAL_PROGRESS_TOTAL_POINTS
}

export const FINANCIAL_PROGRESS_CATEGORIES: readonly FinancialProgressCategoryDefinition[] =
  FINANCIAL_PROGRESS_CATEGORY_IDS.map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    maxPoints: CATEGORY_MAX_POINTS[id],
    weight: weightFromMaxPoints(CATEGORY_MAX_POINTS[id]),
  }))

export const FINANCIAL_PROGRESS_CATEGORY_LABELS: Record<FinancialProgressCategoryId, string> =
  Object.fromEntries(
    FINANCIAL_PROGRESS_CATEGORIES.map((category) => [category.id, category.label]),
  ) as Record<FinancialProgressCategoryId, string>

export const FINANCIAL_PROGRESS_CATEGORY_MAX_POINTS: Record<FinancialProgressCategoryId, number> =
  Object.fromEntries(
    FINANCIAL_PROGRESS_CATEGORIES.map((category) => [category.id, category.maxPoints]),
  ) as Record<FinancialProgressCategoryId, number>

/** Derived weights only — do not hardcode separately from maxPoints. */
export const FINANCIAL_PROGRESS_CATEGORY_WEIGHTS: Record<FinancialProgressCategoryId, number> =
  Object.fromEntries(
    FINANCIAL_PROGRESS_CATEGORIES.map((category) => [category.id, category.weight]),
  ) as Record<FinancialProgressCategoryId, number>

export function getCategoryDefinition(
  categoryId: FinancialProgressCategoryId,
): FinancialProgressCategoryDefinition {
  const definition = FINANCIAL_PROGRESS_CATEGORIES.find((category) => category.id === categoryId)
  if (!definition) {
    throw new Error(`Unknown financial progress category: ${categoryId}`)
  }
  return definition
}

/**
 * Approved Progress Score grade thresholds (unrounded score after clamp).
 * A: 90–100, B: 80–<90, C: 70–<80, D: 60–<70, F: <60
 */
export const FINANCIAL_PROGRESS_GRADE_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
} as const

export const FINANCIAL_PROGRESS_GRADES: readonly FinancialProgressGrade[] = [
  'A',
  'B',
  'C',
  'D',
  'F',
] as const

export const ACTION_PRIORITIES: readonly ActionPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
] as const

export const PLACEHOLDER_CATEGORY_SUMMARY =
  'Category Progress scoring is not implemented yet. Placeholder result only.'

export const PLACEHOLDER_OVERALL_SUMMARY =
  'Household Financial Progress scoring is not implemented yet. Placeholder result only.'
