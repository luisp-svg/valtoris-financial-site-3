import type {
  CategoryCalculator,
  CategoryProgress,
  HouseholdFinancialProgressInput,
} from '../types'

/**
 * Runs each calculator independently and returns Category Progress in calculator order.
 * Calculators must not depend on sibling results.
 */
export function composeCategoryScores(
  input: HouseholdFinancialProgressInput,
  calculators: readonly CategoryCalculator[],
): CategoryProgress[] {
  return calculators.map((calculator) => calculator.calculate(input))
}
