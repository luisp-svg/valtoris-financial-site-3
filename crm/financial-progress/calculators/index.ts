import type { CategoryCalculator } from '../types'
import { cashFlowBudgetCalculator } from './cashFlowBudgetCalculator'
import { creditHealthCalculator } from './creditHealthCalculator'
import { debtManagementCalculator } from './debtManagementCalculator'
import { emergencyFundCalculator } from './emergencyFundCalculator'
import { estateLegacyCalculator } from './estateLegacyCalculator'
import { financialIndependenceCalculator } from './financialIndependenceCalculator'
import { protectionInsuranceCalculator } from './protectionInsuranceCalculator'
import { retirementReadinessCalculator } from './retirementReadinessCalculator'

/**
 * Default calculator set used by the engine.
 * Order matches `FINANCIAL_PROGRESS_CATEGORY_IDS`.
 */
export const DEFAULT_CATEGORY_CALCULATORS: readonly CategoryCalculator[] = [
  cashFlowBudgetCalculator,
  emergencyFundCalculator,
  debtManagementCalculator,
  protectionInsuranceCalculator,
  retirementReadinessCalculator,
  estateLegacyCalculator,
  creditHealthCalculator,
  financialIndependenceCalculator,
]

export { cashFlowBudgetCalculator } from './cashFlowBudgetCalculator'
export { createPlaceholderCalculator } from './createPlaceholderCalculator'
export { creditHealthCalculator } from './creditHealthCalculator'
export { debtManagementCalculator } from './debtManagementCalculator'
export { emergencyFundCalculator } from './emergencyFundCalculator'
export { estateLegacyCalculator } from './estateLegacyCalculator'
export { financialIndependenceCalculator } from './financialIndependenceCalculator'
export { protectionInsuranceCalculator } from './protectionInsuranceCalculator'
export { retirementReadinessCalculator } from './retirementReadinessCalculator'
