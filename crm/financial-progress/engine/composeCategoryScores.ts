import type {
  CategoryCalculation,
  CategoryCalculator,
  CategoryProgress,
  HouseholdFinancialProgressInput,
} from '../types'

/**
 * Runs each calculator independently and returns full calculations in calculator order.
 * Calculators must not depend on sibling results.
 */
export function composeCategoryCalculations(
  input: HouseholdFinancialProgressInput,
  calculators: readonly CategoryCalculator[],
): CategoryCalculation[] {
  return calculators.map((calculator) => calculator.calculate(input))
}

/**
 * Runs each calculator independently and returns Category Progress in calculator order.
 */
export function composeCategoryScores(
  input: HouseholdFinancialProgressInput,
  calculators: readonly CategoryCalculator[],
): CategoryProgress[] {
  return composeCategoryCalculations(input, calculators).map(
    (calculation) => calculation.progress,
  )
}
