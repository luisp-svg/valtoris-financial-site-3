import { CALENDLY_REPORT_CARD_URL } from '../../../constants/urls'
import { isCreditDiagnosticComplete } from './completeness'
import {
  scoreCreditAssessment,
  type CreditCategoryPoints,
  type CreditCriticalFlag,
  type CreditGradeLetter,
  type CreditReviewArea,
} from './scoreCreditAssessment'
import type { CreditAssessmentAnswers, CreditDiagnosticAnswers } from './types'

/**
 * Browser-local results handoff only.
 * firstName is the only contact field kept — the results page greets the person.
 * lastName, email, phone, consent, and honeypot must not be stored.
 */
export type CreditResultsSession = {
  readonly diagnostic: CreditDiagnosticAnswers
  readonly firstName: string
}

export function buildCreditResultsSession(answers: CreditAssessmentAnswers): CreditResultsSession {
  return {
    diagnostic: { ...answers.diagnostic },
    firstName: answers.contact.firstName.trim(),
  }
}

export type CreditCategoryScore = CreditCategoryPoints

export type CreditFlag = CreditCriticalFlag

export type { CreditReviewArea }

export type CreditBookingCta = {
  readonly labelKey: string
  readonly href: string
}

export type CreditResultsModel = {
  readonly available: boolean
  readonly overallScore: number | null
  readonly score: number | null
  readonly grade: CreditGradeLetter | null
  readonly statusLabelKey: string | null
  readonly categoryScores: readonly CreditCategoryScore[]
  readonly criticalFlags: readonly CreditFlag[]
  readonly topReviewAreas: readonly CreditReviewArea[]
  readonly primaryGoal: string | null
  readonly recommendedNextStep: CreditBookingCta | null
  readonly bookingCta: CreditBookingCta | null
}

const REVIEW_CTA: CreditBookingCta = {
  labelKey: 'reviewWithValtoris',
  href: CALENDLY_REPORT_CARD_URL,
}

export function creditTopReviewAreasHeadingKey(
  count: number,
): 'noReviewAreas' | 'topAreas1' | 'topAreas2' | 'topAreas3' {
  if (count <= 0) return 'noReviewAreas'
  if (count === 1) return 'topAreas1'
  if (count === 2) return 'topAreas2'
  return 'topAreas3'
}

export const UNAVAILABLE_CREDIT_RESULTS: CreditResultsModel = {
  available: false,
  overallScore: null,
  score: null,
  grade: null,
  statusLabelKey: null,
  categoryScores: [],
  criticalFlags: [],
  topReviewAreas: [],
  primaryGoal: null,
  recommendedNextStep: null,
  bookingCta: null,
}

export function getCreditResultsModel(
  session?: Pick<CreditResultsSession, 'diagnostic'> | CreditAssessmentAnswers | null,
): CreditResultsModel {
  const diagnostic = session && 'diagnostic' in session ? session.diagnostic : null
  if (!diagnostic || !isCreditDiagnosticComplete(diagnostic)) {
    return UNAVAILABLE_CREDIT_RESULTS
  }

  const scored = scoreCreditAssessment(diagnostic)
  return {
    available: true,
    overallScore: scored.overallScore,
    score: scored.overallScore,
    grade: scored.grade,
    statusLabelKey: scored.statusLabelKey,
    categoryScores: scored.categories,
    criticalFlags: scored.flags,
    topReviewAreas: scored.reviewAreas,
    primaryGoal: diagnostic.credit_goal,
    recommendedNextStep: REVIEW_CTA,
    bookingCta: REVIEW_CTA,
  }
}
