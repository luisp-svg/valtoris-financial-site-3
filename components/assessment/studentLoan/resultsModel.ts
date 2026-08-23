import { CALENDLY_REPORT_CARD_URL } from '../../../constants/urls'
import { isStudentLoanDiagnosticComplete } from './completeness'
import {
  scoreStudentLoanAssessment,
  type StudentLoanCategoryPoints,
  type StudentLoanCriticalFlag,
  type StudentLoanGradeLetter,
  type StudentLoanReviewArea,
} from './scoreStudentLoanAssessment'
import type {
  StudentLoanAssessmentAnswers,
  StudentLoanDiagnosticAnswers,
} from './types'

/**
 * Browser-local results handoff only.
 * firstName is the only contact field kept — the results page greets the borrower.
 * lastName, email, phone, consent, and honeypot must not be stored.
 */
export type StudentLoanResultsSession = {
  readonly diagnostic: StudentLoanDiagnosticAnswers
  readonly firstName: string
}

export function buildStudentLoanResultsSession(
  answers: StudentLoanAssessmentAnswers,
): StudentLoanResultsSession {
  return {
    diagnostic: { ...answers.diagnostic },
    firstName: answers.contact.firstName.trim(),
  }
}

export type StudentLoanCategoryScore = StudentLoanCategoryPoints

export type StudentLoanFlag = StudentLoanCriticalFlag

export type { StudentLoanReviewArea }

export type StudentLoanBookingCta = {
  readonly labelKey: string
  readonly href: string
}

export type StudentLoanResultsModel = {
  readonly available: boolean
  readonly overallScore: number | null
  readonly score: number | null
  readonly grade: StudentLoanGradeLetter | null
  readonly statusLabelKey: string | null
  readonly statusLabel: string | null
  readonly categoryScores: readonly StudentLoanCategoryScore[]
  readonly criticalFlags: readonly StudentLoanFlag[]
  readonly topReviewAreas: readonly StudentLoanReviewArea[]
  readonly primaryGoal: string | null
  readonly urgency: string | null
  readonly informationalBalance: string | null
  readonly servicerDisplay: string | null
  readonly recommendedNextStep: StudentLoanBookingCta | null
  readonly bookingCta: StudentLoanBookingCta | null
}

const REVIEW_CTA: StudentLoanBookingCta = {
  labelKey: 'reviewWithValtoris',
  href: CALENDLY_REPORT_CARD_URL,
}

export function studentLoanTopReviewAreasHeadingKey(
  count: number,
): 'noReviewAreas' | 'topAreas1' | 'topAreas2' | 'topAreas3' {
  if (count <= 0) return 'noReviewAreas'
  if (count === 1) return 'topAreas1'
  if (count === 2) return 'topAreas2'
  return 'topAreas3'
}

export const UNAVAILABLE_STUDENT_LOAN_RESULTS: StudentLoanResultsModel = {
  available: false,
  overallScore: null,
  score: null,
  grade: null,
  statusLabelKey: null,
  statusLabel: null,
  categoryScores: [],
  criticalFlags: [],
  topReviewAreas: [],
  primaryGoal: null,
  urgency: null,
  informationalBalance: null,
  servicerDisplay: null,
  recommendedNextStep: null,
  bookingCta: null,
}

function servicerDisplayOf(diagnostic: StudentLoanDiagnosticAnswers): string | null {
  if (diagnostic.servicer_mode !== 'named') return null
  const name = diagnostic.servicer_name.trim()
  return name || null
}

export function getStudentLoanResultsModel(
  session?: Pick<StudentLoanResultsSession, 'diagnostic'> | StudentLoanAssessmentAnswers | null,
): StudentLoanResultsModel {
  const diagnostic = session && 'diagnostic' in session ? session.diagnostic : null
  if (!diagnostic || !isStudentLoanDiagnosticComplete(diagnostic)) {
    return UNAVAILABLE_STUDENT_LOAN_RESULTS
  }

  const scored = scoreStudentLoanAssessment(diagnostic)
  return {
    available: true,
    overallScore: scored.overallScore,
    score: scored.overallScore,
    grade: scored.grade,
    statusLabelKey: scored.statusLabelKey,
    statusLabel: null,
    categoryScores: scored.categories,
    criticalFlags: scored.flags,
    topReviewAreas: scored.reviewAreas,
    primaryGoal: diagnostic.primary_goal,
    urgency: diagnostic.urgency,
    informationalBalance: diagnostic.total_balance,
    servicerDisplay: servicerDisplayOf(diagnostic),
    recommendedNextStep: REVIEW_CTA,
    bookingCta: REVIEW_CTA,
  }
}
