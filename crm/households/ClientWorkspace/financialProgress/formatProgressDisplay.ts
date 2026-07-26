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
