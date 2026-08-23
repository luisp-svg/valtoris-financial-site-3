/**
 * Phase B will populate score, grade, categories, flags, and booking CTA.
 * Phase A returns an unavailable model so the results shell cannot fabricate data.
 */

export type StudentLoanCategoryScore = {
  readonly id: string
  readonly labelKey: string
  readonly score: number
}

export type StudentLoanFlag = {
  readonly id: string
  readonly labelKey: string
}

export type StudentLoanReviewArea = {
  readonly id: string
  readonly labelKey: string
}

export type StudentLoanBookingCta = {
  readonly labelKey: string
  readonly href: string
}

export type StudentLoanResultsModel = {
  readonly available: boolean
  readonly score: number | null
  readonly grade: string | null
  readonly statusLabel: string | null
  readonly categoryScores: readonly StudentLoanCategoryScore[]
  readonly criticalFlags: readonly StudentLoanFlag[]
  readonly topReviewAreas: readonly StudentLoanReviewArea[]
  readonly primaryGoal: string | null
  readonly bookingCta: StudentLoanBookingCta | null
}

export const UNAVAILABLE_STUDENT_LOAN_RESULTS: StudentLoanResultsModel = {
  available: false,
  score: null,
  grade: null,
  statusLabel: null,
  categoryScores: [],
  criticalFlags: [],
  topReviewAreas: [],
  primaryGoal: null,
  bookingCta: null,
}

export function getStudentLoanResultsModel(): StudentLoanResultsModel {
  return UNAVAILABLE_STUDENT_LOAN_RESULTS
}
