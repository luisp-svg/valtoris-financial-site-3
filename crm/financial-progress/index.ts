/**
 * Household Financial Progress Engine — public API.
 * UI must not be imported here; consumers call `computeHouseholdFinancialProgress`.
 */

export {
  ACTION_PRIORITIES,
  FINANCIAL_PROGRESS_CATEGORIES,
  FINANCIAL_PROGRESS_CATEGORY_IDS,
  FINANCIAL_PROGRESS_CATEGORY_LABELS,
  FINANCIAL_PROGRESS_CATEGORY_MAX_POINTS,
  FINANCIAL_PROGRESS_CATEGORY_WEIGHTS,
  FINANCIAL_PROGRESS_ENGINE_VERSION,
  FINANCIAL_PROGRESS_GRADE_THRESHOLDS,
  FINANCIAL_PROGRESS_GRADES,
  FINANCIAL_PROGRESS_METHODOLOGY_VERSION,
  FINANCIAL_PROGRESS_TOTAL_POINTS,
  PLACEHOLDER_CATEGORY_SUMMARY,
  PLACEHOLDER_OVERALL_SUMMARY,
  getCategoryDefinition,
  weightFromMaxPoints,
} from './constants'

export {
  DEFAULT_CATEGORY_CALCULATORS,
  cashFlowBudgetCalculator,
  createPlaceholderCalculator,
  creditHealthCalculator,
  debtManagementCalculator,
  emergencyFundCalculator,
  estateLegacyCalculator,
  financialIndependenceCalculator,
  protectionInsuranceCalculator,
  retirementReadinessCalculator,
} from './calculators'

export {
  buildOverallGrade,
  buildRecommendations,
  clampProgressScore,
  composeCategoryScores,
  computeHouseholdFinancialProgress,
  gradeFromProgressScore,
  roundScoreForDisplay,
  type ComputeHouseholdFinancialProgressOptions,
} from './engine'

export type {
  ActionPriority,
  CategoryCalculator,
  CategoryProgress,
  FinancialProgressCategoryDefinition,
  FinancialProgressCategoryId,
  FinancialProgressGrade,
  FinancialProgressScoreStatus,
  HouseholdFinancialProgressInput,
  HouseholdFinancialProgressResult,
  ProgressScore,
  Recommendation,
  ScoreSnapshot,
} from './types'
