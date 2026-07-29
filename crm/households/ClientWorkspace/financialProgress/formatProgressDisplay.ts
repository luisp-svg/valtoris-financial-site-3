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

/** No meaningful household Financial Progress information is available yet. */
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

/**
 * One or more categories were evaluated, but the overall Progress Score and grade
 * are withheld until all eight categories are computed.
 */
export function isProgressPartial(
  progress: HouseholdFinancialProgressResult,
): boolean {
  if (isProgressPlaceholder(progress)) return false
  return (
    progress.overall.status === 'partial' ||
    progress.overall.status === 'insufficient_data' ||
    !isOverallProgressAvailable(progress)
  )
}

export function formatCategoriesCalculatedCaption(
  progress: HouseholdFinancialProgressResult,
): string {
  return `${progress.completedCategoryCount} of ${progress.totalCategoryCount} categories calculated`
}

/** Advisor-facing copy when overall score/grade are withheld for partial results. */
export const PARTIAL_PROGRESS_MESSAGE =
  'Additional household information is needed before an overall Financial Progress Score can be published.'

export const PLACEHOLDER_PROGRESS_MESSAGE =
  'Household assessment details are not available yet for Financial Progress.'

/**
 * True when engine evidence includes incomplete criteria.
 * Incomplete criteria must not be presented as confirmed failures.
 */
export function categoryHasIncompleteCriteria(category: CategoryProgress): boolean {
  return category.evidence?.some((item) => item.status === 'incomplete') ?? false
}

/**
 * Category score display:
 * - null → unavailable (never "0")
 * - numeric including 0 → "score / maxPoints" only when the engine provided the number
 */
export function formatCategoryScoreDisplay(category: CategoryProgress): {
  available: boolean
  label: string
  incompleteNote: string | null
} {
  if (category.score == null || !Number.isFinite(category.score)) {
    return {
      available: false,
      label:
        category.status === 'insufficient_data'
          ? 'Insufficient data'
          : 'Not Yet Calculated',
      incompleteNote: null,
    }
  }

  return {
    available: true,
    label: `${formatProgressScoreValue(category.score)} / ${category.maxPoints}`,
    incompleteNote: categoryHasIncompleteCriteria(category)
      ? 'Some criteria lack information and are not confirmed gaps.'
      : null,
  }
}
