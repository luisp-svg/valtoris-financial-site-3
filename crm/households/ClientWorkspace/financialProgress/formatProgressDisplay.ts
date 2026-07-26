import type {
  CategoryProgress,
  FinancialProgressScoreStatus,
  HouseholdFinancialProgressResult,
} from '../../../financial-progress'
import { FINANCIAL_PROGRESS_CATEGORY_LABELS } from '../../../financial-progress'
import { formatWorkspaceDateTime } from '../format'

export function getCategoryDisplayName(category: CategoryProgress): string {
  return FINANCIAL_PROGRESS_CATEGORY_LABELS[category.categoryId]
}

export function formatCategoryStatus(status: FinancialProgressScoreStatus): string {
  switch (status) {
    case 'placeholder':
      return 'Not Yet Calculated'
    case 'insufficient_data':
      return 'Insufficient data'
    case 'partial':
      return 'Partial'
    case 'computed':
      return 'Calculated'
    default:
      return 'Not Yet Calculated'
  }
}

export function formatProgressScoreValue(
  score: number | null | undefined,
): string {
  if (score == null || !Number.isFinite(score)) return '—'
  return String(score)
}

export function formatLastCalculated(
  progress: HouseholdFinancialProgressResult,
): string {
  return formatWorkspaceDateTime(progress.snapshot.computedAt)
}

export function isProgressPlaceholder(
  progress: HouseholdFinancialProgressResult,
): boolean {
  return progress.isPlaceholder || progress.overall.status === 'placeholder'
}

/** Overall score/grade are withheld until all categories are computed. */
export function isOverallProgressAvailable(
  progress: HouseholdFinancialProgressResult,
): boolean {
  return progress.overall.status === 'computed' && progress.overall.score != null
}

export function formatCategoriesCalculatedCaption(
  progress: HouseholdFinancialProgressResult,
): string {
  return `${progress.completedCategoryCount} of ${progress.totalCategoryCount} categories calculated`
}
