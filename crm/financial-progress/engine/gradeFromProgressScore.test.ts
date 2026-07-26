import { describe, expect, it } from 'vitest'
import {
  clampProgressScore,
  gradeFromProgressScore,
  roundScoreForDisplay,
} from './gradeFromProgressScore'

describe('clampProgressScore', () => {
  it('clamps to the valid 0–100 range', () => {
    expect(clampProgressScore(0)).toBe(0)
    expect(clampProgressScore(100)).toBe(100)
    expect(clampProgressScore(-1)).toBe(0)
    expect(clampProgressScore(-50)).toBe(0)
    expect(clampProgressScore(100.1)).toBe(100)
    expect(clampProgressScore(150)).toBe(100)
    expect(clampProgressScore(Number.NaN)).toBe(0)
    expect(clampProgressScore(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('gradeFromProgressScore', () => {
  it('uses approved thresholds on the unrounded clamped score', () => {
    expect(gradeFromProgressScore(100)).toBe('A')
    expect(gradeFromProgressScore(90)).toBe('A')
    expect(gradeFromProgressScore(89.999)).toBe('B')
    expect(gradeFromProgressScore(80)).toBe('B')
    expect(gradeFromProgressScore(79.999)).toBe('C')
    expect(gradeFromProgressScore(70)).toBe('C')
    expect(gradeFromProgressScore(69.999)).toBe('D')
    expect(gradeFromProgressScore(60)).toBe('D')
    expect(gradeFromProgressScore(59.999)).toBe('F')
    expect(gradeFromProgressScore(0)).toBe('F')
  })

  it('clamps out-of-range inputs before grading', () => {
    expect(gradeFromProgressScore(-1)).toBe('F')
    expect(gradeFromProgressScore(150)).toBe('A')
  })

  it('does not fabricate a grade for null/placeholder scores', () => {
    expect(gradeFromProgressScore(null)).toBeNull()
    expect(gradeFromProgressScore(undefined)).toBeNull()
    expect(gradeFromProgressScore(Number.NaN)).toBeNull()
  })

  it('does not let presentation rounding change the grade', () => {
    const unrounded = 89.5
    expect(gradeFromProgressScore(unrounded)).toBe('B')
    expect(roundScoreForDisplay(unrounded)).toBe(90)
    // Display may round to 90, but the Progress Score grade remains B.
    expect(gradeFromProgressScore(unrounded)).toBe('B')
    expect(gradeFromProgressScore(roundScoreForDisplay(unrounded))).toBe('A')
  })
})
