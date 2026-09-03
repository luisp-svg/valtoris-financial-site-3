import { isHomeBuyerDiagnosticComplete } from './completeness'
import {
  scoreHomeBuyerAssessment,
  type HomeBuyerCategoryPoints,
  type HomeBuyerHardRiskFlag,
  type HomeBuyerInsight,
} from './scoreHomeBuyerAssessment'
import type { HomeBuyerAssessmentAnswers, HomeBuyerDiagnosticAnswers } from './types'

/**
 * Browser-local results handoff only.
 * firstName is the only contact field kept — the results page greets the person.
 * lastName, email, phone, consent, and honeypot must not be stored.
 */
export type HomeBuyerResultsSession = {
  readonly diagnostic: HomeBuyerDiagnosticAnswers
  readonly firstName: string
}

export function buildHomeBuyerResultsSession(
  answers: HomeBuyerAssessmentAnswers,
): HomeBuyerResultsSession {
  return {
    diagnostic: { ...answers.diagnostic },
    firstName: answers.contact.firstName.trim(),
  }
}

export type HomeBuyerCategoryScore = HomeBuyerCategoryPoints
export type HomeBuyerFlag = HomeBuyerHardRiskFlag

export type HomeBuyerResultsModel = {
  readonly available: boolean
  readonly overallScore: number | null
  readonly score: number | null
  readonly grade: string | null
  readonly statusLabelKey: string | null
  readonly categoryScores: readonly HomeBuyerCategoryScore[]
  readonly strengths: readonly HomeBuyerInsight[]
  readonly barriers: readonly HomeBuyerInsight[]
  readonly prioritizedNextActions: readonly HomeBuyerInsight[]
  readonly hardRiskFlags: readonly HomeBuyerFlag[]
  readonly scoringVersion: number | null
}

export const UNAVAILABLE_HOME_BUYER_RESULTS: HomeBuyerResultsModel = {
  available: false,
  overallScore: null,
  score: null,
  grade: null,
  statusLabelKey: null,
  categoryScores: [],
  strengths: [],
  barriers: [],
  prioritizedNextActions: [],
  hardRiskFlags: [],
  scoringVersion: null,
}

export function getHomeBuyerResultsModel(
  session?: Pick<HomeBuyerResultsSession, 'diagnostic'> | HomeBuyerAssessmentAnswers | null,
): HomeBuyerResultsModel {
  const diagnostic = session && 'diagnostic' in session ? session.diagnostic : null
  if (!diagnostic || !isHomeBuyerDiagnosticComplete(diagnostic)) {
    return UNAVAILABLE_HOME_BUYER_RESULTS
  }

  const scored = scoreHomeBuyerAssessment(diagnostic)
  return {
    available: true,
    overallScore: scored.overallScore,
    score: scored.overallScore,
    grade: scored.grade,
    statusLabelKey: scored.statusLabelKey,
    categoryScores: scored.categories,
    strengths: scored.strengths,
    barriers: scored.barriers,
    prioritizedNextActions: scored.nextActions,
    hardRiskFlags: scored.flags,
    scoringVersion: scored.scoringVersion,
  }
}
