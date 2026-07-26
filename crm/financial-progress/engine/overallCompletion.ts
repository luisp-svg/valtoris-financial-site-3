import {
  FINANCIAL_PROGRESS_CATEGORY_IDS,
  FINANCIAL_PROGRESS_TOTAL_POINTS,
} from '../constants'
import type { CategoryProgress, FinancialProgressScoreStatus } from '../types'

/**
 * Minimum-completion rule for publishing an overall Progress Score + grade.
 * All approved categories must be status `computed`. Placeholder and
 * insufficient_data categories do not count as completed.
 */
export const OVERALL_SCORE_REQUIRED_COMPLETED_CATEGORIES =
  FINANCIAL_PROGRESS_CATEGORY_IDS.length

export type OverallCompletionMetadata = {
  totalCategoryCount: number
  completedCategoryCount: number
  totalAvailablePoints: number
  completedAvailablePoints: number
  overallStatus: FinancialProgressScoreStatus
}

export function isCategoryCompleted(category: CategoryProgress): boolean {
  return category.status === 'computed'
}

export function buildOverallCompletionMetadata(
  categories: readonly CategoryProgress[],
): OverallCompletionMetadata {
  const totalCategoryCount = FINANCIAL_PROGRESS_CATEGORY_IDS.length
  const completed = categories.filter(isCategoryCompleted)
  const completedCategoryCount = completed.length
  const completedAvailablePoints = completed.reduce(
    (sum, category) => sum + category.maxPoints,
    0,
  )

  const allPlaceholder =
    categories.length > 0 && categories.every((category) => category.status === 'placeholder')

  let overallStatus: FinancialProgressScoreStatus
  if (categories.length === 0 || allPlaceholder) {
    overallStatus = 'placeholder'
  } else if (completedCategoryCount >= OVERALL_SCORE_REQUIRED_COMPLETED_CATEGORIES) {
    overallStatus = 'computed'
  } else if (completedCategoryCount === 0) {
    overallStatus = 'insufficient_data'
  } else {
    overallStatus = 'partial'
  }

  return {
    totalCategoryCount,
    completedCategoryCount,
    totalAvailablePoints: FINANCIAL_PROGRESS_TOTAL_POINTS,
    completedAvailablePoints,
    overallStatus,
  }
}

/** True only when every approved category is completed (`computed`). */
export function isOverallScorePublishable(categories: readonly CategoryProgress[]): boolean {
  const metadata = buildOverallCompletionMetadata(categories)
  return (
    metadata.completedCategoryCount >= OVERALL_SCORE_REQUIRED_COMPLETED_CATEGORIES &&
    metadata.overallStatus === 'computed'
  )
}
