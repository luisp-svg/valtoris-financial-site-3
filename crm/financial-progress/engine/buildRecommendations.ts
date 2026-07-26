import type { CategoryProgress, Recommendation } from '../types'

/**
 * Derives recommendations from Category Progress.
 * Placeholder sprint returns an empty list — no fabricated actions.
 */
export function buildRecommendations(
  _categories: readonly CategoryProgress[],
): Recommendation[] {
  return []
}
