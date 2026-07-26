import { PLACEHOLDER_OVERALL_SUMMARY } from '../constants'
import type { CategoryProgress, ProgressScore } from '../types'
import { clampProgressScore, gradeFromProgressScore } from './gradeFromProgressScore'

/**
 * Aggregates Category Progress into an overall Progress Score + grade.
 * Placeholder sprint: returns null score/grade while categories are unscored placeholders.
 */
export function buildOverallGrade(categories: readonly CategoryProgress[]): ProgressScore {
  const allPlaceholder =
    categories.length > 0 && categories.every((category) => category.status === 'placeholder')

  if (allPlaceholder || categories.length === 0) {
    return {
      grade: null,
      score: null,
      status: 'placeholder',
      summary: PLACEHOLDER_OVERALL_SUMMARY,
    }
  }

  const scored = categories.filter(
    (category) => category.score != null && Number.isFinite(category.score),
  )

  if (scored.length === 0) {
    return {
      grade: null,
      score: null,
      status: 'insufficient_data',
      summary: 'No Category Progress available to compute a Progress Score.',
    }
  }

  // Points earned / total available among scored categories, scaled to 0–100.
  const earned = scored.reduce((sum, category) => sum + (category.score as number), 0)
  const available = scored.reduce((sum, category) => sum + category.maxPoints, 0)
  const raw = available > 0 ? (earned / available) * 100 : 0
  const score = clampProgressScore(raw)

  return {
    score,
    grade: gradeFromProgressScore(score),
    status: 'computed',
    summary: 'Progress Score derived from available Category Progress.',
  }
}
