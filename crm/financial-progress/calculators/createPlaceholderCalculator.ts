import {
  FINANCIAL_PROGRESS_CATEGORY_LABELS,
  getCategoryDefinition,
  PLACEHOLDER_CATEGORY_SUMMARY,
} from '../constants'
import type {
  CategoryCalculation,
  CategoryCalculator,
  FinancialProgressCategoryId,
  HouseholdFinancialProgressInput,
} from '../types'

/**
 * Factory for independent placeholder category calculators.
 * Real Category Progress scoring will replace `calculate` per category later.
 */
export function createPlaceholderCalculator(
  categoryId: FinancialProgressCategoryId,
): CategoryCalculator {
  const definition = getCategoryDefinition(categoryId)

  return {
    categoryId,
    calculate(_input: HouseholdFinancialProgressInput): CategoryCalculation {
      return {
        progress: {
          categoryId,
          score: null,
          maxPoints: definition.maxPoints,
          weight: definition.weight,
          grade: null,
          status: 'placeholder',
          summary: `${FINANCIAL_PROGRESS_CATEGORY_LABELS[categoryId]}: ${PLACEHOLDER_CATEGORY_SUMMARY}`,
        },
        recommendations: [],
      }
    },
  }
}
