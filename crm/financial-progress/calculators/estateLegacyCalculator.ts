import { getCategoryDefinition } from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  HouseholdFinancialProgressInput,
} from '../types'
import { ESTATE_LEGACY_CATEGORY_ID } from './estateLegacy/constants'
import { extractEstateLegacySignals } from './estateLegacy/extractSignals'
import {
  buildEstateLegacyRecommendations,
  scoreAllEstateLegacyCriteria,
  summarizeEstateLegacyScore,
  toEstateLegacyEvidence,
} from './estateLegacy/scoreCriteria'

/**
 * Estate & Legacy category calculator (max 10 points).
 *
 * Criterion budgets:
 * - Core Estate Documents ...................... 4
 * - Beneficiary & Ownership Review ............. 2
 * - Guardianship Planning ...................... 2
 * - Estate Organization & Legacy Instructions .. 2
 *
 * Educational/administrative only — does not determine legal validity.
 * Guardianship not_applicable contributes 0 and does not unlock computed status alone.
 */
export const estateLegacyCalculator: CategoryCalculator = {
  categoryId: ESTATE_LEGACY_CATEGORY_ID,
  calculate(input: HouseholdFinancialProgressInput): CategoryCalculation {
    const definition = getCategoryDefinition(ESTATE_LEGACY_CATEGORY_ID)
    const signals = extractEstateLegacySignals(input)
    const outcomes = scoreAllEstateLegacyCriteria(signals)
    const summarized = summarizeEstateLegacyScore(outcomes)

    return {
      progress: {
        categoryId: ESTATE_LEGACY_CATEGORY_ID,
        score: summarized.score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: summarized.status,
        summary: summarized.summary,
        evidence: toEstateLegacyEvidence(outcomes),
      },
      recommendations: buildEstateLegacyRecommendations(outcomes, signals),
    }
  },
}
