import type { CategoryCalculation, Recommendation } from '../types'

/**
 * Collects recommendations produced by category calculators.
 * Order follows calculator composition order; empty when all placeholders.
 */
export function buildRecommendations(
  calculations: readonly CategoryCalculation[],
): Recommendation[] {
  return calculations.flatMap((calculation) => calculation.recommendations)
}
