import { describe, expect, it } from 'vitest'
import {
  ACTION_PRIORITIES,
  FINANCIAL_PROGRESS_CATEGORIES,
  FINANCIAL_PROGRESS_CATEGORY_IDS,
  FINANCIAL_PROGRESS_CATEGORY_MAX_POINTS,
  FINANCIAL_PROGRESS_CATEGORY_WEIGHTS,
  FINANCIAL_PROGRESS_GRADES,
  FINANCIAL_PROGRESS_METHODOLOGY_VERSION,
  FINANCIAL_PROGRESS_TOTAL_POINTS,
  weightFromMaxPoints,
} from './constants'

describe('financial progress category invariants', () => {
  it('keeps all category IDs unique', () => {
    const ids = FINANCIAL_PROGRESS_CATEGORY_IDS
    expect(new Set(ids).size).toBe(ids.length)
    expect(FINANCIAL_PROGRESS_CATEGORIES.map((category) => category.id)).toEqual([...ids])
  })

  it('totals category max points to exactly 100', () => {
    const total = FINANCIAL_PROGRESS_CATEGORIES.reduce(
      (sum, category) => sum + category.maxPoints,
      0,
    )
    expect(total).toBe(FINANCIAL_PROGRESS_TOTAL_POINTS)
    expect(total).toBe(100)
  })

  it('derives weights from maxPoints / 100 and totals 1.0', () => {
    for (const category of FINANCIAL_PROGRESS_CATEGORIES) {
      expect(category.weight).toBe(weightFromMaxPoints(category.maxPoints))
      expect(category.weight).toBe(category.maxPoints / FINANCIAL_PROGRESS_TOTAL_POINTS)
      expect(FINANCIAL_PROGRESS_CATEGORY_WEIGHTS[category.id]).toBe(category.weight)
      expect(FINANCIAL_PROGRESS_CATEGORY_MAX_POINTS[category.id]).toBe(category.maxPoints)
    }

    const weightSum = FINANCIAL_PROGRESS_CATEGORIES.reduce(
      (sum, category) => sum + category.weight,
      0,
    )
    expect(weightSum).toBeCloseTo(1, 8)
  })

  it('rejects zero or negative maximum points', () => {
    for (const category of FINANCIAL_PROGRESS_CATEGORIES) {
      expect(category.maxPoints).toBeGreaterThan(0)
    }
  })

  it('exposes the approved eight-category configuration', () => {
    expect(FINANCIAL_PROGRESS_CATEGORIES.map((category) => [category.id, category.maxPoints])).toEqual([
      ['cash_flow_budget', 15],
      ['emergency_fund', 10],
      ['debt_management', 20],
      ['protection_insurance', 15],
      ['retirement_readiness', 15],
      ['estate_legacy', 10],
      ['credit_health', 10],
      ['financial_independence', 5],
    ])
  })

  it('exports methodology version and stable grade/priority enums', () => {
    expect(FINANCIAL_PROGRESS_METHODOLOGY_VERSION).toBe('household-progress-v1')
    expect(FINANCIAL_PROGRESS_GRADES).toEqual(['A', 'B', 'C', 'D', 'F'])
    expect(ACTION_PRIORITIES).toEqual(['critical', 'high', 'medium', 'low'])
  })
})
