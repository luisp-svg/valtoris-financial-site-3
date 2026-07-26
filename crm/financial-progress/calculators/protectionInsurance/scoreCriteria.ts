import type {
  ActionPriority,
  CriterionEvidence,
  CriterionStatus,
  Recommendation,
} from '../../types'
import {
  LTC_PLANNING_APPLICABILITY_AGE,
  PROTECTION_CATEGORY_ID,
  PROTECTION_CRITERION_LABELS,
  PROTECTION_CRITERION_MAX_POINTS,
  type ProtectionCriterionId,
} from './constants'
import type { ProtectionSignals } from './extractSignals'

export type CriterionOutcome = {
  id: ProtectionCriterionId
  maxPoints: number
  /** Points awarded toward the criterion budget (includes neutral N/A credit). */
  points: number
  status: CriterionStatus
  /** Category-specific explanation preserved on shared CriterionEvidence.explanation. */
  explanation: string
}

export function toProtectionEvidence(
  outcomes: readonly CriterionOutcome[],
): CriterionEvidence[] {
  return outcomes.map((outcome) => ({
    criterion: PROTECTION_CRITERION_LABELS[outcome.id],
    earnedPoints: outcome.points,
    maxPoints: outcome.maxPoints,
    status: outcome.status,
    explanation: outcome.explanation,
  }))
}

/**
 * Life Insurance Adequacy (max 8).
 * Requires current coverage signal AND a recorded/previously calculated protection need.
 * Does not invent a second need methodology (Protection Gap Calculator inputs unavailable).
 * Points by coverageRatio = coverage / need:
 *   ≥1.00 → 8 | ≥0.75 → 6 | ≥0.50 → 4 | ≥0.25 → 2 | >0 → 1 | 0 → 0
 */
export function scoreLifeInsuranceAdequacy(signals: ProtectionSignals): CriterionOutcome {
  const maxPoints = PROTECTION_CRITERION_MAX_POINTS.life_insurance_adequacy

  if (!signals.hasLifeCoverageSignal || signals.recordedProtectionNeed == null) {
    return {
      id: 'life_insurance_adequacy',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: life insurance adequacy requires current coverage and a recorded protection-need analysis. Completing the Family Protection Analysis provides the authoritative need.',
    }
  }

  const coverage = signals.lifeCoverageAmount ?? 0
  const need = signals.recordedProtectionNeed
  const ratio = need > 0 ? coverage / need : 0

  let points = 0
  if (ratio >= 1) points = 8
  else if (ratio >= 0.75) points = 6
  else if (ratio >= 0.5) points = 4
  else if (ratio >= 0.25) points = 2
  else if (ratio > 0) points = 1
  else points = 0

  return {
    id: 'life_insurance_adequacy',
    maxPoints,
    points,
    status: points >= maxPoints ? 'met' : coverage > 0 ? 'met' : 'unmet',
    explanation: `Coverage ${Math.round(coverage)} vs recorded protection need ${Math.round(need)} (${Math.round(ratio * 100)}% of need).`,
  }
}

/**
 * Disability Coverage (max 2).
 */
export function scoreDisabilityCoverage(signals: ProtectionSignals): CriterionOutcome {
  const maxPoints = PROTECTION_CRITERION_MAX_POINTS.disability_coverage

  if (signals.hasDisabilityPolicy || signals.disabilityAnswer === 'yes') {
    return {
      id: 'disability_coverage',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: signals.hasDisabilityPolicy
        ? 'Active disability policy on file.'
        : 'Disability protection reported on assessment.',
    }
  }

  if (signals.disabilityAnswer === 'no') {
    return {
      id: 'disability_coverage',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Assessment indicates no disability protection.',
    }
  }

  return {
    id: 'disability_coverage',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation: 'Insufficient data: no disability policy or assessment answer available.',
  }
}

/**
 * Critical Illness Coverage (max 1).
 */
export function scoreCriticalIllnessCoverage(signals: ProtectionSignals): CriterionOutcome {
  const maxPoints = PROTECTION_CRITERION_MAX_POINTS.critical_illness_coverage

  if (signals.hasCriticalIllnessPolicy) {
    return {
      id: 'critical_illness_coverage',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Active critical illness policy on file.',
    }
  }

  if (!signals.policiesProvided) {
    return {
      id: 'critical_illness_coverage',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: 'Insufficient data: policy inventory unavailable.',
    }
  }

  return {
    id: 'critical_illness_coverage',
    maxPoints,
    points: 0,
    status: 'unmet',
    explanation: 'No critical illness policy found in active policies.',
  }
}

export type LtcApplicability =
  | { applicable: true; reason: string }
  | { applicable: false; reason: string }
  | { applicable: 'unknown'; reason: string }

/**
 * LTC is applicable when any relevant adult age is >= LTC_PLANNING_APPLICABILITY_AGE.
 * Missing ages → unknown (scored as incomplete unless coverage/plan evidence exists).
 */
export function resolveLtcApplicability(signals: ProtectionSignals): LtcApplicability {
  const ages = signals.relevantAdultAges
  if (ages.length === 0) {
    return {
      applicable: 'unknown',
      reason: `Insufficient data: no relevant adult ages available to evaluate the LTC planning age (${LTC_PLANNING_APPLICABILITY_AGE}).`,
    }
  }

  const maxAge = Math.max(...ages)
  if (maxAge >= LTC_PLANNING_APPLICABILITY_AGE) {
    return {
      applicable: true,
      reason: `Applicable: oldest relevant adult is age ${maxAge} (planning age ${LTC_PLANNING_APPLICABILITY_AGE}).`,
    }
  }

  return {
    applicable: false,
    reason: `Not applicable: oldest relevant adult is age ${maxAge}, below the LTC planning age of ${LTC_PLANNING_APPLICABILITY_AGE}.`,
  }
}

/**
 * Long-Term Care Planning (max 2).
 *
 * Denominator treatment for not_applicable:
 * Awards full criterion points as neutral credit (not evidence of LTC coverage/planning)
 * so the household is not penalized and the category remains on the 15-point scale.
 * Evidence explicitly states not-applicable due to planning age.
 */
export function scoreLongTermCarePlanning(signals: ProtectionSignals): CriterionOutcome {
  const maxPoints = PROTECTION_CRITERION_MAX_POINTS.long_term_care_planning

  if (signals.hasLongTermCarePolicy) {
    return {
      id: 'long_term_care_planning',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Active long-term care policy on file.',
    }
  }

  const plan = signals.longTermCarePlan?.toLowerCase() ?? null
  if (plan === 'has-coverage' || plan === 'self-fund') {
    return {
      id: 'long_term_care_planning',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `Retirement assessment long-term care plan: ${plan}.`,
    }
  }

  if (plan === 'family-support') {
    return {
      id: 'long_term_care_planning',
      maxPoints,
      points: 1,
      status: 'met',
      explanation: 'Long-term care plan relies on family support.',
    }
  }

  if (plan === 'no-plan' || plan === 'unsure') {
    return {
      id: 'long_term_care_planning',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: `Long-term care plan reported as "${plan}".`,
    }
  }

  const applicability = resolveLtcApplicability(signals)
  if (applicability.applicable === false) {
    return {
      id: 'long_term_care_planning',
      maxPoints,
      points: maxPoints,
      status: 'not_applicable',
      explanation: `${applicability.reason} Neutral credit applied; not evidence of LTC coverage.`,
    }
  }

  if (applicability.applicable === 'unknown') {
    return {
      id: 'long_term_care_planning',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: applicability.reason,
    }
  }

  // Applicable by age, but no plan/coverage data.
  return {
    id: 'long_term_care_planning',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation: `${applicability.reason} No LTC policy or planning answer on file.`,
  }
}

/**
 * Beneficiary Review (max 2).
 * Presence of beneficiary names alone is not a completed review.
 * - explicit review yes → 2 (confirmed review)
 * - explicit review no → 0
 * - all life policies have beneficiaries, review unconfirmed → 1 (recorded beneficiaries only)
 * - any life policy missing beneficiary → 0
 * - no reliable data → incomplete
 */
export function scoreBeneficiaryReview(signals: ProtectionSignals): CriterionOutcome {
  const maxPoints = PROTECTION_CRITERION_MAX_POINTS.beneficiary_review

  if (signals.beneficiariesReviewed === 'yes') {
    return {
      id: 'beneficiary_review',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Confirmed review: assessment reports beneficiaries have been reviewed.',
    }
  }

  if (signals.beneficiariesReviewed === 'no') {
    return {
      id: 'beneficiary_review',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Assessment indicates beneficiaries have not been reviewed.',
    }
  }

  if (signals.lifePolicyCount > 0) {
    if (signals.lifePoliciesMissingBeneficiary > 0) {
      return {
        id: 'beneficiary_review',
        maxPoints,
        points: 0,
        status: 'unmet',
        explanation: `Missing beneficiaries: ${signals.lifePoliciesMissingBeneficiary} of ${signals.lifePolicyCount} life policy(ies) lack beneficiary information.`,
      }
    }
    return {
      id: 'beneficiary_review',
      maxPoints,
      points: 1,
      status: 'met',
      explanation:
        'Recorded beneficiaries only: all life policies have a named beneficiary, but a beneficiary review is not confirmed.',
    }
  }

  return {
    id: 'beneficiary_review',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation: 'Insufficient data: no beneficiary-review answer or life-policy beneficiary records.',
  }
}

export function scoreAllProtectionCriteria(signals: ProtectionSignals): CriterionOutcome[] {
  return [
    scoreLifeInsuranceAdequacy(signals),
    scoreDisabilityCoverage(signals),
    scoreCriticalIllnessCoverage(signals),
    scoreLongTermCarePlanning(signals),
    scoreBeneficiaryReview(signals),
  ]
}

function recommendationForCriterion(outcome: CriterionOutcome): Recommendation | null {
  if (outcome.status === 'not_applicable') return null
  if (outcome.status === 'met' && outcome.points >= outcome.maxPoints) return null

  const specs: Record<
    ProtectionCriterionId,
    { title: string; body: string; priority: ActionPriority; actionKey: string }
  > = {
    life_insurance_adequacy: {
      title: 'Complete protection-needs analysis',
      body:
        outcome.status === 'incomplete'
          ? 'Complete the Family Protection Analysis so life insurance adequacy can be evaluated against an authoritative protection need.'
          : 'Review whether current life insurance coverage aligns with the recorded protection need.',
      priority: outcome.status === 'incomplete' ? 'medium' : 'high',
      actionKey:
        outcome.status === 'incomplete'
          ? 'protection.complete_protection_needs_analysis'
          : 'protection.review_life_insurance',
    },
    disability_coverage: {
      title: 'Discuss disability income protection',
      body:
        outcome.status === 'incomplete'
          ? 'Document whether disability income protection is in place for primary earners.'
          : 'Discuss disability income protection to help replace earned income during an extended illness or injury.',
      priority: 'high',
      actionKey: 'protection.discuss_disability',
    },
    critical_illness_coverage: {
      title: 'Review critical illness coverage',
      body:
        outcome.status === 'incomplete'
          ? 'Confirm whether critical illness coverage exists in the household policy inventory.'
          : 'Review whether critical illness coverage is appropriate for the household risk profile.',
      priority: 'medium',
      actionKey: 'protection.review_critical_illness',
    },
    long_term_care_planning: {
      title: 'Discuss long-term care planning',
      body:
        outcome.status === 'incomplete'
          ? 'Capture adult ages and a long-term care planning approach so this criterion can be scored.'
          : 'Discuss long-term care planning options and how care costs would be funded.',
      priority: 'medium',
      actionKey: 'protection.discuss_long_term_care',
    },
    beneficiary_review: {
      title: 'Complete beneficiary review',
      body:
        outcome.status === 'incomplete'
          ? 'Record a beneficiary review for life and related policies.'
          : outcome.explanation.includes('Recorded beneficiaries only')
            ? 'Confirm a beneficiary review even though designations are already recorded on life policies.'
            : 'Complete a beneficiary review to confirm designations are current and intentional.',
      priority: 'high',
      actionKey: 'protection.complete_beneficiary_review',
    },
  }

  const spec = specs[outcome.id]
  return {
    id: `${PROTECTION_CATEGORY_ID}:${spec.actionKey}`,
    categoryId: PROTECTION_CATEGORY_ID,
    title: spec.title,
    body: spec.body,
    priority: spec.priority,
    actionKey: spec.actionKey,
  }
}

export function buildProtectionRecommendations(
  outcomes: readonly CriterionOutcome[],
): Recommendation[] {
  const recommendations: Recommendation[] = []
  for (const outcome of outcomes) {
    const recommendation = recommendationForCriterion(outcome)
    if (recommendation) recommendations.push(recommendation)
  }
  return recommendations
}

/**
 * Category score = sum of criterion points (including neutral N/A credit).
 * Insufficient when every non-N/A criterion is incomplete.
 */
export function summarizeProtectionScore(outcomes: readonly CriterionOutcome[]): {
  score: number | null
  status: 'computed' | 'insufficient_data'
  summary: string
} {
  const scoreable = outcomes.filter((outcome) => outcome.status !== 'not_applicable')
  const allScoreableIncomplete =
    scoreable.length > 0 && scoreable.every((outcome) => outcome.status === 'incomplete')

  if (allScoreableIncomplete || outcomes.length === 0) {
    return {
      score: null,
      status: 'insufficient_data',
      summary:
        'Protection & Insurance: insufficient data to score criteria. Gather coverage and planning details.',
    }
  }

  const earned = outcomes.reduce((sum, outcome) => sum + outcome.points, 0)
  const available = outcomes.reduce((sum, outcome) => sum + outcome.maxPoints, 0)
  const incomplete = outcomes.filter((outcome) => outcome.status === 'incomplete').length
  const notApplicable = outcomes.filter((outcome) => outcome.status === 'not_applicable').length
  const belowFull = outcomes.filter(
    (outcome) =>
      outcome.status !== 'not_applicable' &&
      outcome.status !== 'incomplete' &&
      outcome.points < outcome.maxPoints,
  ).length

  const parts = [`Protection & Insurance scored ${earned} of ${available} points.`]
  if (notApplicable > 0) {
    parts.push(`${notApplicable} criterion(ia) not applicable (neutral credit, not evidence of coverage).`)
  }
  if (incomplete > 0) {
    parts.push(`${incomplete} criterion(ia) incomplete due to missing data.`)
  }
  if (belowFull > 0) {
    parts.push(`${belowFull} criterion(ia) below full credit.`)
  }

  return {
    score: earned,
    status: 'computed',
    summary: parts.join(' '),
  }
}

/** @deprecated Use summarizeProtectionScore — kept name for calculator import clarity. */
export function buildProtectionSummary(outcomes: readonly CriterionOutcome[]): string {
  return summarizeProtectionScore(outcomes).summary
}
