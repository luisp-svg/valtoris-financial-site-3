import { getCategoryDefinition } from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { CASH_FLOW_BUDGET_CATEGORY_ID } from './cashFlowBudget/constants'
import { extractCashFlowBudgetSignals } from './cashFlowBudget/extractSignals'
import {
  buildCashFlowBudgetRecommendations,
  scoreAllCashFlowBudgetCriteria,
  summarizeCashFlowBudgetScore,
  toCashFlowBudgetEvidence,
} from './cashFlowBudget/scoreCriteria'

/**
 * Cash Flow & Budget category calculator (max 15 points).
 *
 * Criterion budgets:
 * - Monthly Cash Flow Position ........ 6
 * - Budgeting System .................. 3
 * - Savings Rate ...................... 4
 * - Expense Tracking Consistency ...... 2
 *
 * Uses existing household assessment answers and derived metrics only.
 * Income and expenses are never estimated. Incomplete criteria contribute 0.
 */
export const cashFlowBudgetCalculator: CategoryCalculator = {
  categoryId: CASH_FLOW_BUDGET_CATEGORY_ID,
  calculate(input: HouseholdFinancialProgressInput): CategoryCalculation {
    const definition = getCategoryDefinition(CASH_FLOW_BUDGET_CATEGORY_ID)
    const signals = extractCashFlowBudgetSignals(input)
    const outcomes = scoreAllCashFlowBudgetCriteria(signals)
    const summarized = summarizeCashFlowBudgetScore(outcomes)

    return {
      progress: {
        categoryId: CASH_FLOW_BUDGET_CATEGORY_ID,
        score: summarized.score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: summarized.status,
        summary: summarized.summary,
        evidence: toCashFlowBudgetEvidence(outcomes),
      },
      recommendations: buildCashFlowBudgetRecommendations(outcomes),
    }
  },
}
