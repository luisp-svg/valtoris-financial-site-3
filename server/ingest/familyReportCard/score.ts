import { scoreBusinessAssessment } from '../../../components/assessment/scoring/scoreBusinessAssessment.js'
import { scoreFamilyAssessment } from '../../../components/assessment/scoring/scoreFamilyAssessment.js'
import { scoreRetirementAssessment } from '../../../components/assessment/scoring/scoreRetirementAssessment.js'
import { creditCopy } from '../../../components/assessment/credit/copy.js'
import { scoreCreditAssessment } from '../../../components/assessment/credit/scoreCreditAssessment.js'
import type { CreditAssessmentAnswers } from '../../../components/assessment/credit/types.js'
import { studentLoanCopy } from '../../../components/assessment/studentLoan/copy.js'
import { scoreStudentLoanAssessment } from '../../../components/assessment/studentLoan/scoreStudentLoanAssessment.js'
import type { StudentLoanAssessmentAnswers } from '../../../components/assessment/studentLoan/types.js'
import type { BusinessAssessmentAnswers } from '../../../components/assessment/business/types.js'
import type { RetirementAssessmentAnswers } from '../../../components/assessment/retirement/types.js'
import type { DemoAssessmentAnswers } from '../../../components/assessment/types.js'
import {
  calculateSelectedNeed,
  formatCurrency,
  parseAmount,
} from '../../../components/calculator/calculations.js'
import type { CalculatorAnswers } from '../../../components/calculator/types.js'
import {
  BUSINESS_REPORT_CARD_SCORING_VERSION,
  FAMILY_REPORT_CARD_SCORING_VERSION,
  PROTECTION_GAP_RESULT_VERSION,
  RETIREMENT_REPORT_CARD_SCORING_VERSION,
  CREDIT_REPORT_CARD_SCORING_VERSION,
  STUDENT_LOAN_REPORT_CARD_SCORING_VERSION,
} from './types.js'

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

export type GradedReportCardServerScore = FamilyReportCardServerScore & {
  extraDerived?: Record<string, unknown>
}

export function recalculateBusinessReportCardScore(
  answers: BusinessAssessmentAnswers,
): GradedReportCardServerScore {
  const result = scoreBusinessAssessment(answers)
  return {
    overallScore: result.overallScore,
    overallGrade: result.overallGrade,
    currentLevel: result.currentLevel,
    protectionGapAmount: 0,
    protectionGapFormatted: result.protectionRating,
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
    scoringVersion: BUSINESS_REPORT_CARD_SCORING_VERSION,
    extraDerived: {
      growthReadiness: result.growthReadiness,
      protectionRating: result.protectionRating,
    },
  }
}

export function recalculateRetirementReportCardScore(
  answers: RetirementAssessmentAnswers,
): GradedReportCardServerScore {
  const result = scoreRetirementAssessment(answers)
  return {
    overallScore: result.overallScore,
    overallGrade: result.overallGrade,
    currentLevel: result.currentLevel,
    protectionGapAmount: result.metrics.annualIncomeGap,
    protectionGapFormatted: formatCurrency(result.metrics.annualIncomeGap),
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
    scoringVersion: RETIREMENT_REPORT_CARD_SCORING_VERSION,
    extraDerived: {
      metrics: {
        annualIncomeGap: result.metrics.annualIncomeGap,
        targetAnnualRetirementSpending: result.metrics.targetAnnualRetirementSpending,
        totalProjectedMonthlyIncome: result.metrics.totalProjectedMonthlyIncome,
        nestEggGap: result.metrics.nestEggGap,
        currentAge: result.metrics.currentAge,
        retirementAge: result.metrics.retirementAge,
        isAlreadyRetired: result.metrics.isAlreadyRetired,
      },
      strengths: result.strengths,
      opportunities: result.opportunities,
    },
  }
}

export type ProtectionGapServerResult = {
  overallScore: null
  overallGrade: null
  currentLevel: null
  scoringVersion: number
  totalNeed: number
  currentProtection: number
  netProtectionGap: number
  protectionGapFormatted: string
  components: {
    income: number
    housing: number
    debt: number
    education: number
    finalExpenses: number
    legacyFunds: number
  }
  priorities: FamilyReportCardPrioritySummary[]
}

export function recalculateProtectionGapResult(
  answers: CalculatorAnswers,
): ProtectionGapServerResult {
  const breakdown = calculateSelectedNeed(answers)
  const currentProtection = parseAmount(answers.coverage.currentLifeInsurance)
  const netProtectionGap = breakdown.netNeed
  const priorities: FamilyReportCardPrioritySummary[] = []
  if (netProtectionGap > 0) {
    priorities.push({
      level: 'high',
      title: `Close the ${formatCurrency(netProtectionGap)} Protection Gap`,
      why: 'Estimated household protection need exceeds current life insurance.',
      timeline: 'Review with an advisor',
    })
  }
  if (currentProtection <= 0) {
    priorities.push({
      level: 'high',
      title: 'No current life insurance recorded',
      why: 'The calculator did not find existing coverage to offset the estimated need.',
      timeline: 'Review with an advisor',
    })
  }

  return {
    overallScore: null,
    overallGrade: null,
    currentLevel: null,
    scoringVersion: PROTECTION_GAP_RESULT_VERSION,
    totalNeed: breakdown.total,
    currentProtection,
    netProtectionGap,
    protectionGapFormatted: formatCurrency(netProtectionGap),
    components: {
      income: breakdown.income,
      housing: breakdown.housing,
      debt: breakdown.debt,
      education: breakdown.education,
      finalExpenses: breakdown.finalExpenses,
      legacyFunds: breakdown.legacyFunds,
    },
    priorities,
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

function studentLoanEnglish(key: string): string {
  return studentLoanCopy.en?.results[key] ?? key
}

export type StudentLoanReportCardServerScore = {
  overallScore: number
  overallGrade: string
  scoringVersion: number
  statusLabelKey: string
  statusLabel: string
  categories: Array<{ id: string; title: string; score: number; max: number }>
  flags: Array<{ id: string; severity: string; label: string; categoryId: string }>
  reviewAreas: Array<{
    id: string
    title: string
    why: string
    severity: string
    categoryId: string
  }>
  priorities: FamilyReportCardPrioritySummary[]
  primaryGoal: string
  urgency: string
}

/**
 * Server-authoritative Student Loan score. Reuses the Phase B pure scorer.
 * Client-reported scores are never used here.
 */
export function recalculateStudentLoanReportCardScore(
  answers: StudentLoanAssessmentAnswers,
): StudentLoanReportCardServerScore {
  const result = scoreStudentLoanAssessment(answers.diagnostic)
  const categories = result.categories.map((category) => ({
    id: category.id,
    title: studentLoanEnglish(category.labelKey),
    score: category.score,
    max: category.max,
  }))
  const flags = result.flags.map((flag) => ({
    id: flag.id,
    severity: flag.severity,
    label: studentLoanEnglish(flag.labelKey),
    categoryId: flag.categoryId,
  }))
  const reviewAreas = result.reviewAreas.map((area) => ({
    id: area.id,
    title: studentLoanEnglish(area.titleKey),
    why: studentLoanEnglish(area.explanationKey),
    severity: area.severity,
    categoryId: area.categoryId,
  }))

  return {
    overallScore: result.overallScore,
    overallGrade: result.grade,
    scoringVersion: STUDENT_LOAN_REPORT_CARD_SCORING_VERSION,
    statusLabelKey: result.statusLabelKey,
    statusLabel: studentLoanEnglish(result.statusLabelKey),
    categories,
    flags,
    reviewAreas,
    priorities: reviewAreas.map((area) => ({
      level: area.severity,
      title: area.title,
      why: area.why,
      timeline: 'Advisor review',
    })),
    primaryGoal: answers.diagnostic.primary_goal,
    urgency: answers.diagnostic.urgency,
  }
}

function creditEnglish(key: string): string {
  return creditCopy.en?.results[key] ?? key
}

export type CreditReportCardServerScore = {
  overallScore: number
  overallGrade: string
  scoringVersion: number
  statusLabelKey: string
  statusLabel: string
  categories: Array<{ id: string; title: string; score: number; max: number }>
  flags: Array<{ id: string; severity: string; label: string; categoryId: string }>
  reviewAreas: Array<{
    id: string
    title: string
    why: string
    severity: string
    categoryId: string
  }>
  priorities: FamilyReportCardPrioritySummary[]
  primaryGoal: string
  urgency: string
}

/**
 * Server-authoritative Credit score. Reuses the Phase B pure scorer.
 * Client-reported scores are never used here.
 */
export function recalculateCreditReportCardScore(
  answers: CreditAssessmentAnswers,
): CreditReportCardServerScore {
  const result = scoreCreditAssessment(answers.diagnostic)
  const categories = result.categories.map((category) => ({
    id: category.id,
    title: creditEnglish(category.labelKey),
    score: category.score,
    max: category.max,
  }))
  const flags = result.flags.map((flag) => ({
    id: flag.id,
    severity: flag.severity,
    label: creditEnglish(flag.labelKey),
    categoryId: flag.categoryId,
  }))
  const reviewAreas = result.reviewAreas.map((area) => ({
    id: area.id,
    title: creditEnglish(area.titleKey),
    why: creditEnglish(area.explanationKey),
    severity: area.severity,
    categoryId: area.categoryId,
  }))

  return {
    overallScore: result.overallScore,
    overallGrade: result.grade,
    scoringVersion: CREDIT_REPORT_CARD_SCORING_VERSION,
    statusLabelKey: result.statusLabelKey,
    statusLabel: creditEnglish(result.statusLabelKey),
    categories,
    flags,
    reviewAreas,
    priorities: reviewAreas.map((area) => ({
      level: area.severity,
      title: area.title,
      why: area.why,
      timeline: 'Advisor review',
    })),
    primaryGoal: answers.diagnostic.credit_goal,
    urgency: answers.diagnostic.urgency,
  }
}
