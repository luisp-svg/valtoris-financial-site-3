import type { CreditAssessmentAnswers, CreditDiagnosticAnswers } from './types'

/**
 * Browser-local results handoff only.
 * firstName is the only contact field kept — lastName, email, phone, consent,
 * and honeypot must not be stored.
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

export type CreditResultsModel = {
  readonly available: boolean
  readonly overallScore: number | null
  readonly score: number | null
  readonly grade: string | null
  readonly statusLabelKey: string | null
  readonly categoryScores: readonly unknown[]
  readonly criticalFlags: readonly unknown[]
  readonly topReviewAreas: readonly unknown[]
  readonly primaryGoal: string | null
  readonly recommendedNextStep: null
  readonly bookingCta: null
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

/**
 * Phase A has no Credit scorer. Always return the unavailable placeholder.
 * Reserved slots stay null/empty so later Phase B can fill them.
 */
export function getCreditResultsModel(_session?: CreditResultsSession | null): CreditResultsModel {
  return UNAVAILABLE_CREDIT_RESULTS
}
