import { getCategoryDefinition } from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { CREDIT_HEALTH_CATEGORY_ID } from './creditHealth/constants'
import { extractCreditHealthSignals } from './creditHealth/extractSignals'
import {
  buildCreditHealthRecommendations,
  scoreAllCreditHealthCriteria,
  summarizeCreditHealthScore,
  toCreditHealthEvidence,
} from './creditHealth/scoreCriteria'

/**
 * Credit Health category calculator (max 10 points).
 *
 * Criterion budgets:
 * - Payment History .................... 4
 * - Credit Utilization ................. 3
 * - Credit Profile Stability ........... 2
 * - Credit Monitoring & Review ......... 1
 *
 * Educational only — does not estimate FICO/VantageScore, promise dispute
 * outcomes, or provide credit-repair guarantees.
 */
export const creditHealthCalculator: CategoryCalculator = {
  categoryId: CREDIT_HEALTH_CATEGORY_ID,
  calculate(input: HouseholdFinancialProgressInput): CategoryCalculation {
    const definition = getCategoryDefinition(CREDIT_HEALTH_CATEGORY_ID)
    const signals = extractCreditHealthSignals(input)
    const outcomes = scoreAllCreditHealthCriteria(signals)
    const summarized = summarizeCreditHealthScore(outcomes)

    return {
      progress: {
        categoryId: CREDIT_HEALTH_CATEGORY_ID,
        score: summarized.score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: summarized.status,
        summary: summarized.summary,
        evidence: toCreditHealthEvidence(outcomes),
      },
      recommendations: buildCreditHealthRecommendations(outcomes, signals),
    }
  },
}
