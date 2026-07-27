import type {
  ActionPriority,
  CriterionEvidence,
  CriterionStatus,
  Recommendation,
} from '../../types'
import {
  CREDIT_HEALTH_CATEGORY_ID,
  CREDIT_HEALTH_CRITERION_LABELS,
  CREDIT_HEALTH_CRITERION_MAX_POINTS,
  CREDIT_REVIEW_CURRENT_MONTHS,
  CREDIT_UTILIZATION_BANDS,
  PAYMENT_HISTORY_RECENT_MONTHS,
  PROFILE_EXCESSIVE_INQUIRIES_12M,
  PROFILE_EXCESSIVE_NEW_ACCOUNTS_12M,
  PROFILE_MODERATE_AVERAGE_AGE_MONTHS,
  PROFILE_MODERATE_OLDEST_ACCOUNT_MONTHS,
  PROFILE_STABLE_MAX_INQUIRIES_12M,
  PROFILE_STABLE_MAX_NEW_ACCOUNTS_12M,
  PROFILE_STABLE_OLDEST_ACCOUNT_MONTHS,
  type CreditHealthCriterionId,
} from './constants'
import type { CreditHealthSignals } from './extractSignals'

export type CreditHealthCriterionOutcome = {
  id: CreditHealthCriterionId
  maxPoints: number
  points: number
  status: CriterionStatus
  explanation: string
}

function toEvidence(outcome: CreditHealthCriterionOutcome): CriterionEvidence {
  return {
    criterion: CREDIT_HEALTH_CRITERION_LABELS[outcome.id],
    earnedPoints: outcome.points,
    maxPoints: outcome.maxPoints,
    status: outcome.status,
    explanation: outcome.explanation,
  }
}

/**
 * Payment History (max 4).
 * Uses centralized recency (`PAYMENT_HISTORY_RECENT_MONTHS`) and clean-status reconciliation.
 * Educational — does not estimate scores or promise dispute outcomes.
 */
export function scorePaymentHistory(
  signals: CreditHealthSignals,
): CreditHealthCriterionOutcome {
  const maxPoints = CREDIT_HEALTH_CRITERION_MAX_POINTS.payment_history
  const assessment = signals.paymentAssessment
  const detail = assessment.notes.join(' ')

  if (assessment.status === 'incomplete' || assessment.points == null) {
    return {
      id: 'payment_history',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Payment history could not be scored for the ${PAYMENT_HISTORY_RECENT_MONTHS}-month recent window. ${detail} Educational context only — not a bureau score or legal determination.`,
    }
  }

  const status = assessment.status
  const points = assessment.points
  return {
    id: 'payment_history',
    maxPoints,
    points,
    status,
    explanation: `Payment history scored ${points}/${maxPoints} using the ${PAYMENT_HISTORY_RECENT_MONTHS}-month recent window. ${detail} This reflects recorded payment history, not a FICO or VantageScore estimate.`,
  }
}

/**
 * Credit Utilization (max 3).
 * Uses utilization ratio only (or balance÷limit when both exist). Never balances alone.
 */
export function scoreCreditUtilization(
  signals: CreditHealthSignals,
): CreditHealthCriterionOutcome {
  const maxPoints = CREDIT_HEALTH_CRITERION_MAX_POINTS.credit_utilization

  if (signals.utilizationConflict) {
    return {
      id: 'credit_utilization',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: revolving utilization values conflict across sources, so utilization is not scored.',
    }
  }

  if (signals.hasBalancesWithoutLimits && signals.utilizationRatio == null) {
    return {
      id: 'credit_utilization',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: revolving balances are recorded without credit limits, and no utilization ratio is available. Limits are never inferred.',
    }
  }

  const utilization = signals.utilizationRatio
  if (utilization == null || !Number.isFinite(utilization)) {
    return {
      id: 'credit_utilization',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: credit utilization requires a recorded utilization ratio or both revolving balances and credit limits.',
    }
  }

  let points = 0
  for (const band of CREDIT_UTILIZATION_BANDS) {
    if (utilization < band.maxExclusive) {
      points = band.points
      break
    }
  }
  // 50%+ → 0 (falls through when utilization >= 0.5)

  const pct = Math.round(utilization * 1000) / 10
  const status: CriterionStatus =
    points >= maxPoints ? 'met' : points > 0 ? 'partial' : 'unmet'

  return {
    id: 'credit_utilization',
    maxPoints,
    points,
    status,
    explanation:
      points >= maxPoints
        ? `Revolving utilization is ${pct}%, below the 10% educational threshold (${points}/${maxPoints}). This is not a credit-score estimate.`
        : `Revolving utilization is ${pct}% (${points}/${maxPoints}). Lower utilization is generally associated with more borrowing flexibility; this does not estimate a bureau score.`,
  }
}

/**
 * Credit Profile Stability (max 2).
 * Age / new-credit / inquiry evidence only — does not recreate FICO.
 */
export function scoreCreditProfileStability(
  signals: CreditHealthSignals,
): CreditHealthCriterionOutcome {
  const maxPoints = CREDIT_HEALTH_CRITERION_MAX_POINTS.credit_profile_stability

  const oldest = signals.oldestAccountAgeMonths
  const average = signals.averageAccountAgeMonths
  const inquiries = signals.recentInquiries12m
  const newAccounts = signals.newAccounts12m

  const hasAnyEvidence =
    oldest != null || average != null || inquiries != null || newAccounts != null

  if (!hasAnyEvidence) {
    return {
      id: 'credit_profile_stability',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: no account-age, inquiry, or new-account evidence is recorded for profile stability.',
    }
  }

  const excessiveNewCredit =
    (inquiries != null && inquiries >= PROFILE_EXCESSIVE_INQUIRIES_12M) ||
    (newAccounts != null && newAccounts >= PROFILE_EXCESSIVE_NEW_ACCOUNTS_12M)

  const veryNew =
    oldest != null && oldest < PROFILE_MODERATE_OLDEST_ACCOUNT_MONTHS && average == null
      ? oldest < PROFILE_MODERATE_OLDEST_ACCOUNT_MONTHS
      : oldest != null
        ? oldest < PROFILE_MODERATE_OLDEST_ACCOUNT_MONTHS
        : average != null
          ? average < PROFILE_MODERATE_OLDEST_ACCOUNT_MONTHS
          : false

  if (excessiveNewCredit || (veryNew && oldest != null && oldest < 12)) {
    return {
      id: 'credit_profile_stability',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation:
        'Available data indicates a very new credit profile and/or elevated recent new-credit activity (0/2). Educational context only — not a bureau scoring model.',
    }
  }

  const stableAge =
    (oldest != null && oldest >= PROFILE_STABLE_OLDEST_ACCOUNT_MONTHS) ||
    (average != null && average >= PROFILE_MODERATE_AVERAGE_AGE_MONTHS &&
      oldest != null &&
      oldest >= PROFILE_STABLE_OLDEST_ACCOUNT_MONTHS)

  const stableInquiries =
    inquiries == null || inquiries <= PROFILE_STABLE_MAX_INQUIRIES_12M
  const stableNewAccounts =
    newAccounts == null || newAccounts <= PROFILE_STABLE_MAX_NEW_ACCOUNTS_12M

  if (
    oldest != null &&
    oldest >= PROFILE_STABLE_OLDEST_ACCOUNT_MONTHS &&
    stableInquiries &&
    stableNewAccounts
  ) {
    return {
      id: 'credit_profile_stability',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `Account-age and recent new-credit indicators suggest a relatively stable credit profile (oldest account about ${oldest} months) (2/2). This is not a FICO or VantageScore calculation.`,
    }
  }

  // Also allow average-age path to stable when oldest is unknown but average is mature
  // and inquiries/new accounts are not excessive.
  if (
    oldest == null &&
    average != null &&
    average >= PROFILE_MODERATE_AVERAGE_AGE_MONTHS &&
    stableInquiries &&
    stableNewAccounts &&
    !excessiveNewCredit
  ) {
    // Mature average alone → moderate (1), not full stable without oldest.
    return {
      id: 'credit_profile_stability',
      maxPoints,
      points: 1,
      status: 'partial',
      explanation: `Average account age is about ${average} months, suggesting a moderately established profile (1/2). Oldest-account age was not available for full stability credit.`,
    }
  }

  const moderate =
    (oldest != null && oldest >= PROFILE_MODERATE_OLDEST_ACCOUNT_MONTHS) ||
    (average != null && average >= PROFILE_MODERATE_AVERAGE_AGE_MONTHS) ||
    stableAge

  if (moderate && !excessiveNewCredit) {
    return {
      id: 'credit_profile_stability',
      maxPoints,
      points: 1,
      status: 'partial',
      explanation:
        'Available data suggests a moderately established credit profile (1/2). This is educational context only and does not recreate bureau scoring models.',
    }
  }

  if (excessiveNewCredit || veryNew) {
    return {
      id: 'credit_profile_stability',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation:
        'Available data suggests a thin/new profile or elevated recent credit activity (0/2). Educational review only.',
    }
  }

  // Partial evidence that cannot classify cleanly (e.g. inquiries alone without ages).
  if (inquiries != null || newAccounts != null) {
    if (
      (inquiries != null && inquiries > PROFILE_STABLE_MAX_INQUIRIES_12M) ||
      (newAccounts != null && newAccounts > PROFILE_STABLE_MAX_NEW_ACCOUNTS_12M)
    ) {
      return {
        id: 'credit_profile_stability',
        maxPoints,
        points: 0,
        status: 'unmet',
        explanation:
          'Recent inquiry or new-account activity appears elevated relative to educational stability thresholds (0/2).',
      }
    }
    return {
      id: 'credit_profile_stability',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: inquiry or new-account counts are present, but account-age evidence is missing for a stability determination.',
    }
  }

  return {
    id: 'credit_profile_stability',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data to classify credit profile stability from available account-age and new-credit fields.',
  }
}

/**
 * Credit Monitoring & Review (max 1).
 * Requires current monitoring or a review within CREDIT_REVIEW_CURRENT_MONTHS.
 * Paid monitoring is never required.
 */
export function scoreCreditMonitoringReview(
  signals: CreditHealthSignals,
): CreditHealthCriterionOutcome {
  const maxPoints = CREDIT_HEALTH_CRITERION_MAX_POINTS.credit_monitoring_review
  const detail = signals.monitoringNotes.join(' ')

  if (signals.monitoring === 'conflict') {
    return {
      id: 'credit_monitoring_review',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: credit-monitoring / review statuses conflict across sources. ${detail}`,
    }
  }

  if (signals.monitoring === 'unknown') {
    return {
      id: 'credit_monitoring_review',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: confirm when credit information was last reviewed or whether monitoring/alerts are currently enabled (${CREDIT_REVIEW_CURRENT_MONTHS}-month freshness window). Paid monitoring is not required. ${detail}`,
    }
  }

  if (signals.monitoring === 'outdated' || signals.monitoring === 'none') {
    return {
      id: 'credit_monitoring_review',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation:
        signals.monitoring === 'outdated'
          ? `The recorded credit review is older than ${CREDIT_REVIEW_CURRENT_MONTHS} months (0/1). ${detail}`
          : `Available data reports that active credit monitoring or a current review process is not in place (0/1). ${detail}`,
    }
  }

  return {
    id: 'credit_monitoring_review',
    maxPoints,
    points: maxPoints,
    status: 'met',
    explanation: `Current credit monitoring, alerts, and/or a review within ${CREDIT_REVIEW_CURRENT_MONTHS} months is documented (1/1). Paid monitoring is not required. ${detail}`,
  }
}

export function scoreAllCreditHealthCriteria(
  signals: CreditHealthSignals,
): CreditHealthCriterionOutcome[] {
  return [
    scorePaymentHistory(signals),
    scoreCreditUtilization(signals),
    scoreCreditProfileStability(signals),
    scoreCreditMonitoringReview(signals),
  ]
}

export function toCreditHealthEvidence(
  outcomes: readonly CreditHealthCriterionOutcome[],
): CriterionEvidence[] {
  return outcomes.map(toEvidence)
}

function recommendationForCriterion(
  outcome: CreditHealthCriterionOutcome,
  signals: CreditHealthSignals,
): Recommendation | null {
  if (outcome.status === 'not_applicable') return null
  if (outcome.status === 'met' && outcome.points >= outcome.maxPoints) return null

  if (outcome.id === 'credit_monitoring_review') {
    if (outcome.status === 'incomplete') {
      return {
        id: `${CREDIT_HEALTH_CATEGORY_ID}:credit.confirm_monitoring`,
        categoryId: CREDIT_HEALTH_CATEGORY_ID,
        title: 'Confirm credit review timing',
        body: 'Confirm when the household’s credit information was last reviewed.',
        priority: 'low',
        actionKey: 'credit.confirm_monitoring',
      }
    }
    if (signals.monitoring === 'outdated') {
      return {
        id: `${CREDIT_HEALTH_CATEGORY_ID}:credit.review_monitoring_settings`,
        categoryId: CREDIT_HEALTH_CATEGORY_ID,
        title: 'Update credit review and monitoring',
        body: 'Review the household’s credit reports and monitoring settings.',
        priority: 'low',
        actionKey: 'credit.review_monitoring_settings',
      }
    }
    return {
      id: `${CREDIT_HEALTH_CATEGORY_ID}:credit.establish_review_process`,
      categoryId: CREDIT_HEALTH_CATEGORY_ID,
      title: 'Establish regular credit review',
      body: 'Establish a regular process for reviewing credit reports and account alerts.',
      priority: 'low',
      actionKey: 'credit.establish_review_process',
    }
  }

  const specs: Record<
    Exclude<CreditHealthCriterionId, 'credit_monitoring_review'>,
    { title: string; body: string; priority: ActionPriority; actionKey: string }
  > = {
    payment_history: {
      title:
        outcome.status === 'incomplete'
          ? 'Confirm recent payment history'
          : 'Review recent payment history',
      body:
        outcome.status === 'incomplete'
          ? 'Record current payment status, recent late payments, and dates for any collections or charge-offs so recency can be evaluated.'
          : 'Review recent payment history and prioritize staying current on obligations. This is educational guidance, not a credit-repair promise.',
      priority: 'high',
      actionKey:
        outcome.status === 'incomplete'
          ? 'credit.confirm_payment_history'
          : 'credit.review_payment_history',
    },
    credit_utilization: {
      title:
        outcome.status === 'incomplete'
          ? 'Confirm revolving utilization'
          : 'Reduce revolving utilization',
      body:
        outcome.status === 'incomplete'
          ? 'Record revolving utilization, or both balances and credit limits, so utilization can be reviewed.'
          : 'Review revolving balances relative to credit limits and consider reducing utilization where appropriate. This does not estimate a credit score.',
      priority: 'medium',
      actionKey:
        outcome.status === 'incomplete'
          ? 'credit.confirm_utilization'
          : 'credit.reduce_utilization',
    },
    credit_profile_stability: {
      title:
        outcome.status === 'incomplete'
          ? 'Confirm credit profile age and new-credit activity'
          : 'Avoid unnecessary new credit',
      body:
        outcome.status === 'incomplete'
          ? 'Record oldest/average account age and recent inquiries or new accounts when available.'
          : 'Avoid unnecessary new credit applications while building a longer payment and account history. Educational guidance only.',
      priority: 'medium',
      actionKey:
        outcome.status === 'incomplete'
          ? 'credit.confirm_profile_stability'
          : 'credit.avoid_unnecessary_new_credit',
    },
  }

  const spec = specs[outcome.id]
  return {
    id: `${CREDIT_HEALTH_CATEGORY_ID}:${spec.actionKey}`,
    categoryId: CREDIT_HEALTH_CATEGORY_ID,
    title: spec.title,
    body: spec.body,
    priority: spec.priority,
    actionKey: spec.actionKey,
  }
}

export function buildCreditHealthRecommendations(
  outcomes: readonly CreditHealthCriterionOutcome[],
  signals: CreditHealthSignals,
): Recommendation[] {
  const recommendations: Recommendation[] = []
  const seenKeys = new Set<string>()
  for (const outcome of outcomes) {
    const recommendation = recommendationForCriterion(outcome, signals)
    if (!recommendation) continue
    if (seenKeys.has(recommendation.actionKey)) continue
    seenKeys.add(recommendation.actionKey)
    recommendations.push(recommendation)
  }
  return recommendations
}

/**
 * Scorable: met | partial | unmet
 * Non-scorable: incomplete | not_applicable
 */
export function summarizeCreditHealthScore(
  outcomes: readonly CreditHealthCriterionOutcome[],
): {
  score: number | null
  status: 'computed' | 'insufficient_data'
  summary: string
} {
  const hasScorableEvidence = outcomes.some(
    (outcome) =>
      outcome.status === 'met' ||
      outcome.status === 'partial' ||
      outcome.status === 'unmet',
  )

  if (outcomes.length === 0 || !hasScorableEvidence) {
    return {
      score: null,
      status: 'insufficient_data',
      summary:
        'Credit Health: insufficient data to score criteria. Record payment history, utilization, profile age/new-credit activity, and monitoring/review habits.',
    }
  }

  const earned = Math.min(
    10,
    outcomes.reduce((sum, outcome) => sum + outcome.points, 0),
  )
  const available = outcomes.reduce((sum, outcome) => sum + outcome.maxPoints, 0)
  const incomplete = outcomes.filter((outcome) => outcome.status === 'incomplete').length
  const partial = outcomes.filter((outcome) => outcome.status === 'partial').length

  const parts = [`Credit Health scored ${earned} of ${available} points.`]
  if (incomplete > 0) {
    parts.push(`${incomplete} criterion(ia) incomplete due to missing or conflicting data.`)
  }
  if (partial > 0) {
    parts.push(`${partial} criterion(ia) partial.`)
  }
  parts.push(
    'Educational assessment only — not a FICO or VantageScore estimate and not credit-repair advice.',
  )

  return {
    score: earned,
    status: 'computed',
    summary: parts.join(' '),
  }
}
