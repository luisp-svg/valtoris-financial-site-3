import { getCategoryDefinition } from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { DEBT_CATEGORY_ID } from './debtManagement/constants'
import { extractDebtSignals } from './debtManagement/extractSignals'
import {
  buildDebtRecommendations,
  scoreAllDebtCriteria,
  summarizeDebtScore,
  toDebtEvidence,
} from './debtManagement/scoreCriteria'

/**
 * Debt Management category calculator (max 20 points).
 *
 * Four transparent criteria (5 points each):
 * 1. Credit Card Utilization
 * 2. High-Interest Debt (requires APR or authoritative interest flag)
 * 3. Debt-to-Income Position (total recorded debt ÷ annual income)
 * 4. Debt Payoff Strategy
 *
 * Uses existing household assessment answers, derived metrics, and open tasks only.
 * Missing criterion inputs yield incomplete status + educational recommendations —
 * values are never fabricated.
 */
export const debtManagementCalculator: CategoryCalculator = {
  categoryId: DEBT_CATEGORY_ID,
  calculate(input: HouseholdFinancialProgressInput): CategoryCalculation {
    const definition = getCategoryDefinition(DEBT_CATEGORY_ID)
    const signals = extractDebtSignals(input)
    const outcomes = scoreAllDebtCriteria(signals)
    const summarized = summarizeDebtScore(outcomes)
    const evidence = toDebtEvidence(outcomes)

    return {
      progress: {
        categoryId: DEBT_CATEGORY_ID,
        score: summarized.score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: summarized.status,
        summary: summarized.summary,
        evidence,
      },
      recommendations: buildDebtRecommendations(outcomes),
    }
  },
}
