import { describe, expect, it } from 'vitest'
import type { CategoryProgress, HouseholdFinancialProgressResult } from '../../../financial-progress'
import {
  categoryHasIncompleteCriteria,
  formatCategoryScoreDisplay,
  formatProgressScoreValue,
  isOverallProgressAvailable,
  isProgressPartial,
  isProgressPlaceholder,
  PARTIAL_PROGRESS_MESSAGE,
} from './formatProgressDisplay'

function makeCategory(overrides: Partial<CategoryProgress> = {}): CategoryProgress {
  return {
    categoryId: 'protection_insurance',
    score: null,
    maxPoints: 15,
    weight: 0.15,
    grade: null,
    status: 'insufficient_data',
    summary: 'test',
    ...overrides,
  }
}

function makeProgress(
  overrides: Partial<HouseholdFinancialProgressResult> = {},
): HouseholdFinancialProgressResult {
  return {
    householdId: 'hh-1',
    overall: {
      score: null,
      grade: null,
      status: 'partial',
      summary: 'partial',
    },
    categories: [],
    snapshot: {
      householdId: 'hh-1',
      computedAt: '2026-07-28T00:00:00.000Z',
      overall: {
        score: null,
        grade: null,
        status: 'partial',
        summary: 'partial',
      },
      categories: [],
      totalCategoryCount: 8,
      completedCategoryCount: 1,
      totalAvailablePoints: 100,
      completedAvailablePoints: 15,
      engineVersion: '1.0.0',
      methodologyVersion: '1.0.0',
    },
    recommendations: [],
    isPlaceholder: false,
    totalCategoryCount: 8,
    completedCategoryCount: 1,
    totalAvailablePoints: 100,
    completedAvailablePoints: 15,
    engineVersion: '1.0.0',
    methodologyVersion: '1.0.0',
    ...overrides,
  }
}

describe('formatProgressScoreValue', () => {
  it('never renders null as 0', () => {
    expect(formatProgressScoreValue(null)).toBe('—')
    expect(formatProgressScoreValue(undefined)).toBe('—')
    expect(formatProgressScoreValue(0)).toBe('0')
  })
})

describe('formatCategoryScoreDisplay', () => {
  it('shows unavailable labels for null scores', () => {
    expect(formatCategoryScoreDisplay(makeCategory({ score: null }))).toEqual({
      available: false,
      label: 'Insufficient data',
      incompleteNote: null,
    })
    expect(
      formatCategoryScoreDisplay(
        makeCategory({ score: null, status: 'placeholder' }),
      ),
    ).toEqual({
      available: false,
      label: 'Not Yet Calculated',
      incompleteNote: null,
    })
  })

  it('displays a true numeric zero from the engine', () => {
    expect(
      formatCategoryScoreDisplay(
        makeCategory({
          score: 0,
          status: 'computed',
          evidence: [
            {
              criterion: 'life',
              earnedPoints: 0,
              maxPoints: 8,
              status: 'unmet',
              explanation: 'no coverage',
            },
          ],
        }),
      ),
    ).toEqual({
      available: true,
      label: '0 / 15',
      incompleteNote: null,
    })
  })

  it('notes incomplete criteria without treating them as confirmed failures', () => {
    const display = formatCategoryScoreDisplay(
      makeCategory({
        score: 0,
        status: 'computed',
        evidence: [
          {
            criterion: 'life',
            earnedPoints: 0,
            maxPoints: 8,
            status: 'incomplete',
            explanation: 'missing data',
          },
          {
            criterion: 'disability',
            earnedPoints: 0,
            maxPoints: 2,
            status: 'unmet',
            explanation: 'none',
          },
        ],
      }),
    )
    expect(display.available).toBe(true)
    expect(display.label).toBe('0 / 15')
    expect(display.incompleteNote).toContain('not confirmed gaps')
    expect(categoryHasIncompleteCriteria(makeCategory({
      evidence: [
        {
          criterion: 'life',
          earnedPoints: 0,
          maxPoints: 8,
          status: 'incomplete',
          explanation: 'missing data',
        },
      ],
    }))).toBe(true)
  })
})

describe('progress state classification', () => {
  it('classifies placeholder separately from partial results', () => {
    const placeholder = makeProgress({
      isPlaceholder: true,
      overall: {
        score: null,
        grade: null,
        status: 'placeholder',
        summary: 'placeholder',
      },
      completedCategoryCount: 0,
    })
    expect(isProgressPlaceholder(placeholder)).toBe(true)
    expect(isProgressPartial(placeholder)).toBe(false)
    expect(isOverallProgressAvailable(placeholder)).toBe(false)
  })

  it('classifies partial overall without publishing score or grade', () => {
    const partial = makeProgress()
    expect(isProgressPlaceholder(partial)).toBe(false)
    expect(isProgressPartial(partial)).toBe(true)
    expect(isOverallProgressAvailable(partial)).toBe(false)
    expect(PARTIAL_PROGRESS_MESSAGE).toContain('overall Financial Progress Score')
  })

  it('publishes overall only when computed with a numeric score', () => {
    const computed = makeProgress({
      overall: {
        score: 72,
        grade: 'C',
        status: 'computed',
        summary: 'done',
      },
      completedCategoryCount: 8,
    })
    expect(isOverallProgressAvailable(computed)).toBe(true)
    expect(isProgressPartial(computed)).toBe(false)
  })
})
