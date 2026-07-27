import { getCategoryDefinition } from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { FINANCIAL_INDEPENDENCE_CATEGORY_ID } from './financialIndependence/constants'
import { extractFinancialIndependenceSignals } from './financialIndependence/extractSignals'
import {
  buildFinancialIndependenceRecommendations,
  scoreAllFinancialIndependenceCriteria,
  summarizeFinancialIndependenceScore,
  toFinancialIndependenceEvidence,
} from './financialIndependence/scoreCriteria'

/**
 * Financial Independence category calculator (max 5 points).
 *
 * Criterion budgets:
 * - Goal Definition ........................ 1
 * - Target ................................. 1
 * - Progress Toward Target ................. 2
 * - Funding Strategy & Progress Tracking ... 1
 *
 * Educational / planning-oriented only — not a duplicate retirement calculator,
 * projection engine, or guaranteed-outcome analysis.
 */
export const financialIndependenceCalculator: CategoryCalculator = {
  categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
  calculate(input: HouseholdFinancialProgressInput): CategoryCalculation {
    const definition = getCategoryDefinition(FINANCIAL_INDEPENDENCE_CATEGORY_ID)
    const signals = extractFinancialIndependenceSignals(input)
    const outcomes = scoreAllFinancialIndependenceCriteria(signals)
    const summarized = summarizeFinancialIndependenceScore(outcomes)

    return {
      progress: {
        categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
        score: summarized.score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: summarized.status,
        summary: summarized.summary,
        evidence: toFinancialIndependenceEvidence(outcomes),
      },
      recommendations: buildFinancialIndependenceRecommendations(outcomes, signals),
    }
  },
}
