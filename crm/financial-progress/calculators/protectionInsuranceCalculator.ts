import { getCategoryDefinition } from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { PROTECTION_CATEGORY_ID } from './protectionInsurance/constants'
import { extractProtectionSignals } from './protectionInsurance/extractSignals'
import {
  buildProtectionRecommendations,
  scoreAllProtectionCriteria,
  summarizeProtectionScore,
  toProtectionEvidence,
} from './protectionInsurance/scoreCriteria'

/**
 * Protection & Insurance category calculator (max 15 points).
 *
 * Criterion budgets (deterministic):
 * - Life Insurance Adequacy ............. 8
 * - Disability Coverage ................. 2
 * - Critical Illness Coverage ........... 1
 * - Long-Term Care Planning ............. 2
 * - Beneficiary Review .................. 2
 *
 * Protection need: uses a recorded/previously calculated need only.
 * The Family Protection Gap Calculator cannot be safely reused without its
 * full calculator inputs; a second income×5 methodology is not used.
 *
 * LTC: not_applicable below LTC_PLANNING_APPLICABILITY_AGE with neutral credit.
 */
export const protectionInsuranceCalculator: CategoryCalculator = {
  categoryId: PROTECTION_CATEGORY_ID,
  calculate(input: HouseholdFinancialProgressInput): CategoryCalculation {
    const definition = getCategoryDefinition(PROTECTION_CATEGORY_ID)
    const signals = extractProtectionSignals(input)
    const outcomes = scoreAllProtectionCriteria(signals)
    const summarized = summarizeProtectionScore(outcomes)

    return {
      progress: {
        categoryId: PROTECTION_CATEGORY_ID,
        score: summarized.score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: summarized.status,
        summary: summarized.summary,
        evidence: toProtectionEvidence(outcomes),
      },
      recommendations: buildProtectionRecommendations(outcomes),
    }
  },
}
