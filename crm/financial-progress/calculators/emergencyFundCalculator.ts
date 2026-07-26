import { getCategoryDefinition } from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { EMERGENCY_FUND_CATEGORY_ID } from './emergencyFund/constants'
import { extractEmergencyFundSignals } from './emergencyFund/extractSignals'
import {
  buildEmergencyFundRecommendations,
  scoreAllEmergencyFundCriteria,
  summarizeEmergencyFundScore,
  toEmergencyFundEvidence,
} from './emergencyFund/scoreCriteria'

/**
 * Emergency Fund category calculator (max 10 points).
 *
 * Criterion budgets:
 * - Emergency Fund Months ............. 5
 * - Dedicated Emergency Fund .......... 2
 * - Liquidity of Emergency Assets ..... 2
 * - Automatic Savings Habit ........... 1
 *
 * Uses existing household assessment answers and derived metrics only.
 * Savings and expenses are never estimated. Incomplete criteria contribute 0.
 */
export const emergencyFundCalculator: CategoryCalculator = {
  categoryId: EMERGENCY_FUND_CATEGORY_ID,
  calculate(input: HouseholdFinancialProgressInput): CategoryCalculation {
    const definition = getCategoryDefinition(EMERGENCY_FUND_CATEGORY_ID)
    const signals = extractEmergencyFundSignals(input)
    const outcomes = scoreAllEmergencyFundCriteria(signals)
    const summarized = summarizeEmergencyFundScore(outcomes)

    return {
      progress: {
        categoryId: EMERGENCY_FUND_CATEGORY_ID,
        score: summarized.score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: summarized.status,
        summary: summarized.summary,
        evidence: toEmergencyFundEvidence(outcomes),
      },
      recommendations: buildEmergencyFundRecommendations(outcomes),
    }
  },
}
