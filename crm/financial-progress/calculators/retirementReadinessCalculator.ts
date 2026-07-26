import { getCategoryDefinition } from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { RETIREMENT_READINESS_CATEGORY_ID } from './retirementReadiness/constants'
import { extractRetirementReadinessSignals } from './retirementReadiness/extractSignals'
import {
  buildRetirementReadinessRecommendations,
  scoreAllRetirementReadinessCriteria,
  summarizeRetirementReadinessScore,
  toRetirementReadinessEvidence,
} from './retirementReadiness/scoreCriteria'

/**
 * Retirement Readiness category calculator (max 15 points).
 *
 * Criterion budgets:
 * - Retirement Contribution Activity .... 4
 * - Employer Match Utilization .......... 3
 * - Retirement Savings Progress ......... 5
 * - Retirement Plan & Goal Definition ... 3
 *
 * Uses existing household / retirement assessment answers and derived metrics only.
 * Targets, ages, and returns are never invented. Incomplete criteria contribute 0.
 * Employer-match not_applicable contributes 0 without redistributing points.
 */
export const retirementReadinessCalculator: CategoryCalculator = {
  categoryId: RETIREMENT_READINESS_CATEGORY_ID,
  calculate(input: HouseholdFinancialProgressInput): CategoryCalculation {
    const definition = getCategoryDefinition(RETIREMENT_READINESS_CATEGORY_ID)
    const signals = extractRetirementReadinessSignals(input)
    const outcomes = scoreAllRetirementReadinessCriteria(signals)
    const summarized = summarizeRetirementReadinessScore(outcomes)

    return {
      progress: {
        categoryId: RETIREMENT_READINESS_CATEGORY_ID,
        score: summarized.score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: summarized.status,
        summary: summarized.summary,
        evidence: toRetirementReadinessEvidence(outcomes),
      },
      recommendations: buildRetirementReadinessRecommendations(outcomes, signals),
    }
  },
}
