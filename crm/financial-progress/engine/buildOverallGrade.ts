import { PLACEHOLDER_OVERALL_SUMMARY } from '../constants'
import type { CategoryProgress, ProgressScore } from '../types'
import { clampProgressScore, gradeFromProgressScore } from './gradeFromProgressScore'
import {
  buildOverallCompletionMetadata,
  isOverallScorePublishable,
} from './overallCompletion'

/**
 * Aggregates Category Progress into an overall Progress Score + grade.
 *
 * Publishes score/grade only when the minimum-completion rule is met
 * (all eight categories status `computed`). Partial calculation must not
 * normalize a subset (e.g. Protection's 15 points) into a 0–100 overall.
 */
export function buildOverallGrade(categories: readonly CategoryProgress[]): ProgressScore {
  const completion = buildOverallCompletionMetadata(categories)

  if (completion.overallStatus === 'placeholder') {
    return {
      grade: null,
      score: null,
      status: 'placeholder',
      summary: PLACEHOLDER_OVERALL_SUMMARY,
    }
  }

  if (!isOverallScorePublishable(categories)) {
    const status = completion.overallStatus
    return {
      grade: null,
      score: null,
      status,
      summary:
        status === 'partial'
          ? `Overall Progress not yet available. ${completion.completedCategoryCount} of ${completion.totalCategoryCount} categories calculated.`
          : 'No Category Progress available to compute a Progress Score.',
    }
  }

  // All categories completed — sum earned points on the 100-point methodology scale.
  const earned = categories.reduce((sum, category) => sum + (category.score ?? 0), 0)
  const score = clampProgressScore(earned)

  return {
    score,
    grade: gradeFromProgressScore(score),
    status: 'computed',
    summary: 'Progress Score derived from all eight Category Progress results.',
  }
}
