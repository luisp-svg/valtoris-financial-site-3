import { DEFAULT_CATEGORY_CALCULATORS } from '../calculators'
import {
  FINANCIAL_PROGRESS_CATEGORY_IDS,
  FINANCIAL_PROGRESS_ENGINE_VERSION,
  FINANCIAL_PROGRESS_METHODOLOGY_VERSION,
} from '../constants'
import type {
  CategoryCalculator,
  HouseholdFinancialProgressInput,
  HouseholdFinancialProgressResult,
  ScoreSnapshot,
} from '../types'
import { buildOverallGrade } from './buildOverallGrade'
import { buildRecommendations } from './buildRecommendations'
import { composeCategoryCalculations } from './composeCategoryScores'
import { buildOverallCompletionMetadata } from './overallCompletion'

export type ComputeHouseholdFinancialProgressOptions = {
  /** Override default calculators (tests / selective category sets). */
  calculators?: readonly CategoryCalculator[]
}

function assertHouseholdInput(input: HouseholdFinancialProgressInput): void {
  if (!input?.household?.id) {
    throw new Error(
      'computeHouseholdFinancialProgress requires input.household with a valid id',
    )
  }
}

function assertCalculatorCoverage(calculators: readonly CategoryCalculator[]): void {
  const ids = new Set(calculators.map((calculator) => calculator.categoryId))
  for (const categoryId of FINANCIAL_PROGRESS_CATEGORY_IDS) {
    if (!ids.has(categoryId)) {
      throw new Error(
        `computeHouseholdFinancialProgress missing calculator for category: ${categoryId}`,
      )
    }
  }
}

/**
 * Single service entry point for the Household Financial Progress Engine.
 * Accepts household-sourced input and returns a structured progress result.
 * Pure / UI-free — calculators are independent and composable.
 */
export function computeHouseholdFinancialProgress(
  input: HouseholdFinancialProgressInput,
  options: ComputeHouseholdFinancialProgressOptions = {},
): HouseholdFinancialProgressResult {
  assertHouseholdInput(input)

  const calculators = options.calculators ?? DEFAULT_CATEGORY_CALCULATORS
  assertCalculatorCoverage(calculators)

  const calculations = composeCategoryCalculations(input, calculators)
  const categories = calculations.map((calculation) => calculation.progress)
  const overall = buildOverallGrade(categories)
  const recommendations = buildRecommendations(calculations)
  const completion = buildOverallCompletionMetadata(categories)
  const computedAt = input.asOf ?? new Date().toISOString()

  const snapshot: ScoreSnapshot = {
    householdId: input.household.id,
    computedAt,
    overall,
    categories,
    totalCategoryCount: completion.totalCategoryCount,
    completedCategoryCount: completion.completedCategoryCount,
    totalAvailablePoints: completion.totalAvailablePoints,
    completedAvailablePoints: completion.completedAvailablePoints,
    engineVersion: FINANCIAL_PROGRESS_ENGINE_VERSION,
    methodologyVersion: FINANCIAL_PROGRESS_METHODOLOGY_VERSION,
  }

  const isPlaceholder =
    overall.status === 'placeholder' &&
    categories.every((category) => category.status === 'placeholder')

  return {
    householdId: input.household.id,
    overall,
    categories,
    snapshot,
    recommendations,
    isPlaceholder,
    totalCategoryCount: completion.totalCategoryCount,
    completedCategoryCount: completion.completedCategoryCount,
    totalAvailablePoints: completion.totalAvailablePoints,
    completedAvailablePoints: completion.completedAvailablePoints,
    engineVersion: FINANCIAL_PROGRESS_ENGINE_VERSION,
    methodologyVersion: FINANCIAL_PROGRESS_METHODOLOGY_VERSION,
  }
}
