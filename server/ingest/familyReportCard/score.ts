import { scoreFamilyAssessment } from '../../../components/assessment/scoring/scoreFamilyAssessment.js'
import type { DemoAssessmentAnswers } from '../../../components/assessment/types.js'
import { FAMILY_REPORT_CARD_SCORING_VERSION } from './types.js'

export type FamilyReportCardCategorySummary = {
  id: string
  title: string
  score: number
  grade: string
}

export type FamilyReportCardPrioritySummary = {
  level: string
  title: string
  why: string
  timeline: string
}

/**
 * Canonical server-recalculated score. Never trusts a client-reported score —
 * this is always derived from `scoreFamilyAssessment`, the same pure engine
 * used by the public calculator UI, so results stay comparable.
 */
export type FamilyReportCardServerScore = {
  overallScore: number
  overallGrade: string
  currentLevel: string
  protectionGapAmount: number
  protectionGapFormatted: string
  categories: FamilyReportCardCategorySummary[]
  priorities: FamilyReportCardPrioritySummary[]
  scoringVersion: number
}

export function recalculateFamilyReportCardScore(
  answers: DemoAssessmentAnswers,
): FamilyReportCardServerScore {
  const result = scoreFamilyAssessment(answers)

  return {
    overallScore: result.overallScore,
    overallGrade: result.overallGrade,
    currentLevel: result.currentLevel,
    protectionGapAmount: result.protectionGapAmount,
    protectionGapFormatted: result.protectionGapFormatted,
    categories: result.categories.map((category) => ({
      id: category.id,
      title: category.title,
      score: category.score,
      grade: category.grade,
    })),
    priorities: result.priorities.map((priority) => ({
      level: priority.level,
      title: priority.title,
      why: priority.why,
      timeline: priority.timeline,
    })),
    scoringVersion: FAMILY_REPORT_CARD_SCORING_VERSION,
  }
}

export type ScoreComparison = {
  clientReportedScore: number | null
  serverCalculatedScore: number
  scoreMismatch: boolean
  clientReportedGrade: string | null
  serverCalculatedGrade: string
}

const SCORE_MISMATCH_THRESHOLD = 1

/**
 * Compares an (untrusted) client-reported score/grade against the server's
 * canonical recalculation. The client value is recorded for observability
 * only — it is never authoritative and never persisted as the source of truth.
 */
export function compareClientScore(input: {
  clientReportedScore?: number | null
  clientReportedGrade?: string | null
  server: { overallScore: number; overallGrade: string }
}): ScoreComparison {
  const clientReportedScore =
    typeof input.clientReportedScore === 'number' && Number.isFinite(input.clientReportedScore)
      ? input.clientReportedScore
      : null
  const clientReportedGrade =
    typeof input.clientReportedGrade === 'string' && input.clientReportedGrade.trim()
      ? input.clientReportedGrade.trim()
      : null

  const scoreDiffers =
    clientReportedScore !== null &&
    Math.abs(clientReportedScore - input.server.overallScore) >= SCORE_MISMATCH_THRESHOLD
  const gradeDiffers = clientReportedGrade !== null && clientReportedGrade !== input.server.overallGrade

  return {
    clientReportedScore,
    serverCalculatedScore: input.server.overallScore,
    scoreMismatch: scoreDiffers || gradeDiffers,
    clientReportedGrade,
    serverCalculatedGrade: input.server.overallGrade,
  }
}
