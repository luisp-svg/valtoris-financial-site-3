import { FINANCIAL_PROGRESS_GRADE_THRESHOLDS } from '../constants'
import type { FinancialProgressGrade } from '../types'

/**
 * Clamps a Progress Score into the valid 0–100 range.
 * Non-finite values clamp to 0.
 */
export function clampProgressScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  if (score < 0) return 0
  if (score > 100) return 100
  return score
}

/**
 * Determines letter grade from an unrounded Progress Score.
 * Presentation rounding must not be applied before calling this.
 * Null / non-finite scores return null (no fabricated grade).
 */
export function gradeFromProgressScore(score: number | null | undefined): FinancialProgressGrade | null {
  if (score == null || !Number.isFinite(score)) return null

  const clamped = clampProgressScore(score)

  if (clamped >= FINANCIAL_PROGRESS_GRADE_THRESHOLDS.A) return 'A'
  if (clamped >= FINANCIAL_PROGRESS_GRADE_THRESHOLDS.B) return 'B'
  if (clamped >= FINANCIAL_PROGRESS_GRADE_THRESHOLDS.C) return 'C'
  if (clamped >= FINANCIAL_PROGRESS_GRADE_THRESHOLDS.D) return 'D'
  return 'F'
}

/**
 * Presentation-only rounding. Must never be used as input to gradeFromProgressScore
 * when determining the official grade for a Progress Score.
 */
export function roundScoreForDisplay(score: number): number {
  return Math.round(clampProgressScore(score))
}
