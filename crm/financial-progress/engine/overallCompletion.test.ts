import { describe, expect, it } from 'vitest'
import { createPlaceholderCalculator } from '../calculators'
import {
  FINANCIAL_PROGRESS_CATEGORY_IDS,
  FINANCIAL_PROGRESS_TOTAL_POINTS,
  getCategoryDefinition,
} from '../constants'
import type { CategoryCalculator, CategoryProgress } from '../types'
import { buildOverallGrade } from './buildOverallGrade'
import { computeHouseholdFinancialProgress } from './computeHouseholdFinancialProgress'
import {
  OVERALL_SCORE_REQUIRED_COMPLETED_CATEGORIES,
  buildOverallCompletionMetadata,
  isOverallScorePublishable,
} from './overallCompletion'

function makeComputed(
  categoryId: CategoryProgress['categoryId'],
  score: number,
): CategoryCalculator {
  const definition = getCategoryDefinition(categoryId)
  return {
    categoryId,
    calculate: () => ({
      progress: {
        categoryId,
        score,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: 'computed',
        summary: `${categoryId} computed`,
      },
      recommendations: [],
    }),
  }
}

function makeHouseholdInput() {
  return {
    household: {
      id: 'hh-completion-1',
      display_name: 'Completion Household',
      status: 'client' as const,
      primary_email: null,
      primary_phone: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      assigned_advisor_id: null,
      relationship_stage_id: 'stage-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
      assigned_advisor: null,
      relationship_stage: null,
      members: [],
    },
    asOf: '2026-07-26T12:00:00.000Z',
  }
}

describe('overall completion rule', () => {
  it('requires all eight categories before publishing an overall score', () => {
    expect(OVERALL_SCORE_REQUIRED_COMPLETED_CATEGORIES).toBe(8)
    expect(OVERALL_SCORE_REQUIRED_COMPLETED_CATEGORIES).toBe(
      FINANCIAL_PROGRESS_CATEGORY_IDS.length,
    )
  })

  it('does not produce an overall score or grade from one computed category', () => {
    const calculators = FINANCIAL_PROGRESS_CATEGORY_IDS.map((categoryId) =>
      categoryId === 'protection_insurance'
        ? makeComputed('protection_insurance', 15)
        : createPlaceholderCalculator(categoryId),
    )

    const result = computeHouseholdFinancialProgress(makeHouseholdInput(), { calculators })

    expect(result.totalCategoryCount).toBe(8)
    expect(result.completedCategoryCount).toBe(1)
    expect(result.totalAvailablePoints).toBe(100)
    expect(result.completedAvailablePoints).toBe(15)
    expect(result.overall.score).toBeNull()
    expect(result.overall.grade).toBeNull()
    expect(result.overall.status).toBe('partial')
    expect(isOverallScorePublishable(result.categories)).toBe(false)
  })

  it('does not produce an overall score from mixed computed/placeholder categories', () => {
    const calculators = FINANCIAL_PROGRESS_CATEGORY_IDS.map((categoryId) =>
      categoryId === 'protection_insurance' || categoryId === 'debt_management'
        ? makeComputed(categoryId, categoryId === 'debt_management' ? 16 : 10)
        : createPlaceholderCalculator(categoryId),
    )

    const result = computeHouseholdFinancialProgress(makeHouseholdInput(), { calculators })
    const metadata = buildOverallCompletionMetadata(result.categories)

    expect(metadata.completedCategoryCount).toBe(2)
    expect(metadata.completedAvailablePoints).toBe(35)
    expect(result.overall.score).toBeNull()
    expect(result.overall.grade).toBeNull()
    expect(result.overall.status).toBe('partial')
    expect(result.overall.summary).toContain('2 of 8 categories calculated')
  })

  it('produces an overall score when all categories are computed', () => {
    const scores: Record<string, number> = {
      cash_flow_budget: 15,
      emergency_fund: 10,
      debt_management: 20,
      protection_insurance: 15,
      retirement_readiness: 15,
      estate_legacy: 10,
      credit_health: 10,
      financial_independence: 5,
    }

    const calculators = FINANCIAL_PROGRESS_CATEGORY_IDS.map((categoryId) =>
      makeComputed(categoryId, scores[categoryId]!),
    )

    const result = computeHouseholdFinancialProgress(makeHouseholdInput(), { calculators })

    expect(result.completedCategoryCount).toBe(8)
    expect(result.completedAvailablePoints).toBe(FINANCIAL_PROGRESS_TOTAL_POINTS)
    expect(result.overall.status).toBe('computed')
    expect(result.overall.score).toBe(100)
    expect(result.overall.grade).toBe('A')
  })

  it('treats insufficient_data categories as not completed', () => {
    const categories: CategoryProgress[] = FINANCIAL_PROGRESS_CATEGORY_IDS.map((categoryId) => {
      const definition = getCategoryDefinition(categoryId)
      if (categoryId === 'protection_insurance') {
        return {
          categoryId,
          score: null,
          maxPoints: definition.maxPoints,
          weight: definition.weight,
          grade: null,
          status: 'insufficient_data',
          summary: 'incomplete',
        }
      }
      return {
        categoryId,
        score: null,
        maxPoints: definition.maxPoints,
        weight: definition.weight,
        grade: null,
        status: 'placeholder',
        summary: 'placeholder',
      }
    })

    const metadata = buildOverallCompletionMetadata(categories)
    expect(metadata.completedCategoryCount).toBe(0)
    expect(metadata.completedAvailablePoints).toBe(0)
    expect(metadata.overallStatus).toBe('insufficient_data')
    expect(buildOverallGrade(categories).score).toBeNull()
    expect(buildOverallGrade(categories).grade).toBeNull()
  })

  it('does not normalize a partial Protection score into a 100-point overall', () => {
    const calculators = FINANCIAL_PROGRESS_CATEGORY_IDS.map((categoryId) =>
      categoryId === 'protection_insurance'
        ? makeComputed('protection_insurance', 15)
        : createPlaceholderCalculator(categoryId),
    )

    const result = computeHouseholdFinancialProgress(makeHouseholdInput(), { calculators })
    // Previously would have been (15/15)*100 = 100 — must remain null.
    expect(result.overall.score).toBeNull()
    expect(result.completedAvailablePoints).toBe(15)
    expect(result.totalAvailablePoints).toBe(100)
  })
})
