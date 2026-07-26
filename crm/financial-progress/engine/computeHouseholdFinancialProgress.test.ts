import { describe, expect, it } from 'vitest'
import type { CrmHouseholdDetail } from '../../households/types'
import {
  DEFAULT_CATEGORY_CALCULATORS,
  createPlaceholderCalculator,
} from '../calculators'
import {
  FINANCIAL_PROGRESS_CATEGORIES,
  FINANCIAL_PROGRESS_CATEGORY_IDS,
  FINANCIAL_PROGRESS_CATEGORY_MAX_POINTS,
  FINANCIAL_PROGRESS_ENGINE_VERSION,
  FINANCIAL_PROGRESS_METHODOLOGY_VERSION,
  getCategoryDefinition,
} from '../constants'
import type {
  CategoryCalculator,
  CategoryProgress,
  HouseholdFinancialProgressInput,
} from '../types'
import { buildOverallGrade } from './buildOverallGrade'
import { composeCategoryScores } from './composeCategoryScores'
import { computeHouseholdFinancialProgress } from './computeHouseholdFinancialProgress'

function makeHousehold(overrides: Partial<CrmHouseholdDetail> = {}): CrmHouseholdDetail {
  return {
    id: 'hh-progress-1',
    display_name: 'Progress Household',
    status: 'client',
    primary_email: 'client@example.com',
    primary_phone: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    assigned_advisor_id: null,
    relationship_stage_id: 'stage-1',
    created_at: '2026-01-15T12:00:00.000Z',
    updated_at: '2026-07-01T12:00:00.000Z',
    assigned_advisor: null,
    relationship_stage: null,
    members: [],
    ...overrides,
  }
}

function makeInput(
  overrides: Partial<HouseholdFinancialProgressInput> = {},
): HouseholdFinancialProgressInput {
  return {
    household: makeHousehold(),
    asOf: '2026-07-25T15:00:00.000Z',
    ...overrides,
  }
}

describe('computeHouseholdFinancialProgress', () => {
  it('returns a structured placeholder Household Financial Progress result', () => {
    const result = computeHouseholdFinancialProgress(makeInput())

    expect(result.householdId).toBe('hh-progress-1')
    expect(result.engineVersion).toBe(FINANCIAL_PROGRESS_ENGINE_VERSION)
    expect(result.methodologyVersion).toBe(FINANCIAL_PROGRESS_METHODOLOGY_VERSION)
    expect(result.methodologyVersion).toBe('household-progress-v1')
    expect(result.isPlaceholder).toBe(true)
    expect(result.overall).toEqual({
      grade: null,
      score: null,
      status: 'placeholder',
      summary: expect.stringContaining('not implemented yet'),
    })
    expect(result.recommendations).toEqual([])
    expect(result.snapshot.methodologyVersion).toBe(FINANCIAL_PROGRESS_METHODOLOGY_VERSION)
    expect(result.snapshot.engineVersion).toBe(FINANCIAL_PROGRESS_ENGINE_VERSION)
    expect(result.snapshot.computedAt).toBe('2026-07-25T15:00:00.000Z')
  })

  it('composes Category Progress for all eight approved categories with maxPoints', () => {
    const result = computeHouseholdFinancialProgress(makeInput())
    const categoryIds = result.categories.map((category) => category.categoryId)

    expect(categoryIds).toEqual([...FINANCIAL_PROGRESS_CATEGORY_IDS])
    expect(result.categories).toHaveLength(8)

    for (const category of result.categories) {
      const definition = getCategoryDefinition(category.categoryId)
      expect(category.status).toBe('placeholder')
      expect(category.score).toBeNull()
      expect(category.grade).toBeNull()
      expect(category.maxPoints).toBe(definition.maxPoints)
      expect(category.maxPoints).toBe(FINANCIAL_PROGRESS_CATEGORY_MAX_POINTS[category.categoryId])
      expect(category.weight).toBe(definition.weight)
      expect(category.weight).toBe(category.maxPoints / 100)
    }
  })

  it('allows custom composable calculators while requiring full category coverage', () => {
    const custom: CategoryCalculator = {
      categoryId: 'debt_management',
      calculate: (): CategoryProgress => {
        const definition = getCategoryDefinition('debt_management')
        return {
          categoryId: 'debt_management',
          score: 16,
          maxPoints: definition.maxPoints,
          weight: definition.weight,
          grade: null,
          status: 'computed',
          summary: 'Custom debt Category Progress',
        }
      },
    }

    const calculators = FINANCIAL_PROGRESS_CATEGORY_IDS.map((categoryId) =>
      categoryId === 'debt_management' ? custom : createPlaceholderCalculator(categoryId),
    )

    const result = computeHouseholdFinancialProgress(makeInput(), { calculators })
    const debt = result.categories.find((category) => category.categoryId === 'debt_management')

    expect(debt?.status).toBe('computed')
    expect(debt?.score).toBe(16)
    expect(debt?.maxPoints).toBe(20)
    expect(result.isPlaceholder).toBe(false)
    expect(result.overall.status).toBe('computed')
    expect(result.overall.score).toBe(80)
    expect(result.overall.grade).toBe('B')
  })

  it('rejects input without a household id', () => {
    expect(() =>
      computeHouseholdFinancialProgress({
        household: makeHousehold({ id: '' }),
      }),
    ).toThrow(/valid id/)
  })

  it('rejects calculator sets that omit a required category', () => {
    expect(() =>
      computeHouseholdFinancialProgress(makeInput(), {
        calculators: [createPlaceholderCalculator('cash_flow_budget')],
      }),
    ).toThrow(/missing calculator for category/)
  })
})

describe('composeCategoryScores', () => {
  it('invokes calculators independently without shared mutable state', () => {
    const calls: string[] = []
    const calculators: CategoryCalculator[] = FINANCIAL_PROGRESS_CATEGORY_IDS.map(
      (categoryId) => ({
        categoryId,
        calculate: () => {
          calls.push(categoryId)
          const definition = getCategoryDefinition(categoryId)
          return {
            categoryId,
            score: null,
            maxPoints: definition.maxPoints,
            weight: definition.weight,
            grade: null,
            status: 'placeholder' as const,
            summary: categoryId,
          }
        },
      }),
    )

    const scores = composeCategoryScores(makeInput(), calculators)
    expect(calls).toEqual([...FINANCIAL_PROGRESS_CATEGORY_IDS])
    expect(scores.map((score) => score.categoryId)).toEqual([...FINANCIAL_PROGRESS_CATEGORY_IDS])
  })
})

describe('buildOverallGrade', () => {
  it('returns placeholder Progress Score when all categories are placeholders', () => {
    const categories = composeCategoryScores(makeInput(), DEFAULT_CATEGORY_CALCULATORS)
    expect(buildOverallGrade(categories).status).toBe('placeholder')
    expect(buildOverallGrade(categories).grade).toBeNull()
  })
})

describe('DEFAULT_CATEGORY_CALCULATORS', () => {
  it('registers exactly one calculator per approved category', () => {
    const ids = DEFAULT_CATEGORY_CALCULATORS.map((calculator) => calculator.categoryId)
    expect(ids).toEqual([...FINANCIAL_PROGRESS_CATEGORY_IDS])
    expect(new Set(ids).size).toBe(ids.length)
    expect(FINANCIAL_PROGRESS_CATEGORIES).toHaveLength(8)
  })
})
