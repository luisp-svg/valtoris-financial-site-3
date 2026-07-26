import type {
  ActionPriority,
  CriterionEvidence,
  CriterionStatus,
  Recommendation,
} from '../../types'
import {
  EMERGENCY_FUND_CATEGORY_ID,
  EMERGENCY_FUND_CRITERION_LABELS,
  EMERGENCY_FUND_CRITERION_MAX_POINTS,
  EMERGENCY_FUND_MONTHS_BANDS,
  EMERGENCY_FUND_TARGET_MONTHS,
  type EmergencyFundCriterionId,
} from './constants'
import type { EmergencyFundSignals } from './extractSignals'

export type EmergencyFundCriterionOutcome = {
  id: EmergencyFundCriterionId
  maxPoints: number
  points: number
  status: CriterionStatus
  explanation: string
}

function toEvidence(outcome: EmergencyFundCriterionOutcome): CriterionEvidence {
  return {
    criterion: EMERGENCY_FUND_CRITERION_LABELS[outcome.id],
    earnedPoints: outcome.points,
    maxPoints: outcome.maxPoints,
    status: outcome.status,
    explanation: outcome.explanation,
  }
}

function pointsForMonths(months: number): {
  points: number
  status: CriterionStatus
} {
  if (months === 0) return { points: 0, status: 'unmet' }
  for (const band of EMERGENCY_FUND_MONTHS_BANDS) {
    if (months >= band.minMonthsInclusive) {
      return { points: band.points, status: band.status }
    }
  }
  return { points: 0, status: 'unmet' }
}

/**
 * Emergency Fund Months (max 5).
 * Uses recorded months or savings ÷ monthly essential expenses.
 * Never estimates savings/expenses. Zero monthly expenses → incomplete.
 */
export function scoreEmergencyFundMonths(
  signals: EmergencyFundSignals,
): EmergencyFundCriterionOutcome {
  const maxPoints = EMERGENCY_FUND_CRITERION_MAX_POINTS.emergency_fund_months
  const months = signals.emergencyFundMonths

  if (months == null || !Number.isFinite(months) || months < 0) {
    const zeroExpenses =
      signals.monthlyEssentialExpenses === 0 ||
      (signals.emergencySavings != null && signals.monthlyEssentialExpenses === 0)
    return {
      id: 'emergency_fund_months',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: zeroExpenses
        ? 'Insufficient data: monthly essential expenses are zero or invalid, so months of coverage cannot be calculated without fabricating expense estimates.'
        : 'Insufficient data: emergency fund months require a recorded months metric or both emergency savings and monthly essential expenses. Values are never estimated.',
    }
  }

  const { points, status } = pointsForMonths(months)
  const rounded = Math.round(months * 100) / 100
  const sourceNote =
    signals.monthsSource === 'calculated'
      ? `Calculated as emergency savings ÷ monthly essential expenses (${rounded} months).`
      : `Recorded emergency-fund months coverage is ${rounded}.`

  return {
    id: 'emergency_fund_months',
    maxPoints,
    points,
    status,
    explanation:
      months === 0
        ? `${sourceNote} Exactly 0 months of essential expenses are covered (0/${maxPoints}).`
        : `${sourceNote} Target is ${EMERGENCY_FUND_TARGET_MONTHS}+ months (${points}/${maxPoints}).`,
  }
}

/**
 * Dedicated Emergency Fund (max 2).
 * Requires explicit designation. Generic cash/savings balance alone does not count.
 */
export function scoreDedicatedEmergencyFund(
  signals: EmergencyFundSignals,
): EmergencyFundCriterionOutcome {
  const maxPoints = EMERGENCY_FUND_CRITERION_MAX_POINTS.dedicated_emergency_fund

  if (signals.dedicatedEmergencyFund === 'yes') {
    return {
      id: 'dedicated_emergency_fund',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Emergency reserves are explicitly designated for emergencies (2/2).',
    }
  }

  if (signals.dedicatedEmergencyFund === 'no') {
    return {
      id: 'dedicated_emergency_fund',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Assessment indicates emergency savings are not specifically designated (0/2).',
    }
  }

  if (signals.genericCashBalance != null && signals.genericCashBalance > 0) {
    return {
      id: 'dedicated_emergency_fund',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'A cash or savings balance is recorded, but that alone does not prove the funds are designated for emergencies (0/2).',
    }
  }

  return {
    id: 'dedicated_emergency_fund',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: no authoritative designation confirming a dedicated emergency fund.',
  }
}

/**
 * Liquidity of Emergency Assets (max 2).
 * Liquid = checking/savings/HYSA/money market/cash equivalents.
 * Retirement, home equity, vehicles, restricted, long-term investments do not count.
 */
export function scoreLiquidityOfEmergencyAssets(
  signals: EmergencyFundSignals,
): EmergencyFundCriterionOutcome {
  const maxPoints = EMERGENCY_FUND_CRITERION_MAX_POINTS.liquidity_of_emergency_assets

  if (signals.liquidity === 'liquid') {
    return {
      id: 'liquidity_of_emergency_assets',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation:
        'Emergency reserves are confirmed in readily liquid accounts (checking, savings, HYSA, money market, or cash equivalents) (2/2).',
    }
  }

  if (signals.liquidity === 'mixed') {
    return {
      id: 'liquidity_of_emergency_assets',
      maxPoints,
      points: 1,
      status: 'partial',
      explanation:
        'Emergency reserves have mixed liquidity; some assets may not be readily accessible (1/2).',
    }
  }

  if (signals.liquidity === 'illiquid') {
    return {
      id: 'liquidity_of_emergency_assets',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation:
        'Emergency reserves are primarily or entirely illiquid (for example retirement, home equity, vehicles, or restricted accounts) (0/2).',
    }
  }

  return {
    id: 'liquidity_of_emergency_assets',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: no reliable liquidity classification for emergency reserves. Dollar amounts alone do not establish liquidity.',
  }
}

/**
 * Automatic Savings Habit (max 1).
 * Requires authoritative automation evidence. Generic savings tasks do not count.
 */
export function scoreAutomaticSavingsHabit(
  signals: EmergencyFundSignals,
): EmergencyFundCriterionOutcome {
  const maxPoints = EMERGENCY_FUND_CRITERION_MAX_POINTS.automatic_savings_habit

  if (signals.automaticEmergencySavings === 'yes') {
    return {
      id: 'automatic_savings_habit',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Automatic emergency savings contributions are active (1/1).',
    }
  }

  if (signals.automaticEmergencySavings === 'no') {
    return {
      id: 'automatic_savings_habit',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Automatic emergency savings contributions are explicitly not active (0/1).',
    }
  }

  if (signals.hasGenericSavingsTask) {
    return {
      id: 'automatic_savings_habit',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'A generic savings task is present, but that is not proof of recurring automatic emergency savings (0/1).',
    }
  }

  return {
    id: 'automatic_savings_habit',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: no authoritative indication that emergency savings contributions are automated.',
  }
}

export function scoreAllEmergencyFundCriteria(
  signals: EmergencyFundSignals,
): EmergencyFundCriterionOutcome[] {
  return [
    scoreEmergencyFundMonths(signals),
    scoreDedicatedEmergencyFund(signals),
    scoreLiquidityOfEmergencyAssets(signals),
    scoreAutomaticSavingsHabit(signals),
  ]
}

export function toEmergencyFundEvidence(
  outcomes: readonly EmergencyFundCriterionOutcome[],
): CriterionEvidence[] {
  return outcomes.map(toEvidence)
}

function recommendationForCriterion(
  outcome: EmergencyFundCriterionOutcome,
): Recommendation | null {
  if (outcome.status === 'not_applicable') return null
  if (outcome.status === 'met' && outcome.points >= outcome.maxPoints) return null

  const specs: Record<
    EmergencyFundCriterionId,
    { title: string; body: string; priority: ActionPriority; actionKey: string }
  > = {
    emergency_fund_months: {
      title:
        outcome.status === 'incomplete'
          ? 'Complete an emergency reserve analysis'
          : 'Build emergency reserves toward the documented target',
      body:
        outcome.status === 'incomplete'
          ? 'Complete an emergency reserve analysis by recording emergency savings and monthly essential expenses (or months of coverage).'
          : `Build emergency reserves toward the documented target of ${EMERGENCY_FUND_TARGET_MONTHS} or more months of essential expenses.`,
      priority: outcome.status === 'incomplete' ? 'medium' : 'high',
      actionKey:
        outcome.status === 'incomplete'
          ? 'emergency.complete_reserve_analysis'
          : 'emergency.build_toward_target',
    },
    dedicated_emergency_fund: {
      title:
        outcome.status === 'unmet'
          ? 'Designate a separate emergency reserve'
          : 'Confirm whether emergency savings are specifically designated',
      body:
        outcome.status === 'unmet'
          ? 'Designate a separate emergency reserve so funds intended for emergencies are clearly identified.'
          : 'Confirm whether emergency savings are specifically designated rather than assuming a general cash balance is reserved for emergencies.',
      priority: 'medium',
      actionKey:
        outcome.status === 'unmet'
          ? 'emergency.designate_separate_reserve'
          : 'emergency.confirm_designation',
    },
    liquidity_of_emergency_assets: {
      title:
        outcome.status === 'incomplete'
          ? 'Confirm where emergency reserves are held'
          : outcome.status === 'unmet'
            ? 'Separate emergency reserves from long-term or restricted assets'
            : 'Keep emergency reserves in readily accessible accounts',
      body:
        outcome.status === 'incomplete'
          ? 'Confirm where emergency reserves are held and whether those accounts are readily accessible.'
          : outcome.status === 'unmet'
            ? 'Separate emergency reserves from long-term or restricted assets such as retirement accounts, home equity, or vehicles.'
            : 'Keep emergency reserves in readily accessible accounts such as savings, high-yield savings, or money market funds.',
      priority: 'medium',
      actionKey:
        outcome.status === 'incomplete'
          ? 'emergency.confirm_liquidity'
          : outcome.status === 'unmet'
            ? 'emergency.separate_from_restricted_assets'
            : 'emergency.keep_reserves_liquid',
    },
    automatic_savings_habit: {
      title:
        outcome.status === 'unmet'
          ? 'Establish an automatic recurring transfer to emergency savings'
          : 'Confirm whether emergency savings contributions are automated',
      body:
        outcome.status === 'unmet'
          ? 'Establish an automatic recurring transfer to emergency savings to build reserves consistently.'
          : 'Confirm whether emergency savings contributions are automated; a generic savings task is not sufficient evidence.',
      priority: 'medium',
      actionKey:
        outcome.status === 'unmet'
          ? 'emergency.establish_automatic_transfer'
          : 'emergency.confirm_automation',
    },
  }

  const spec = specs[outcome.id]
  return {
    id: `${EMERGENCY_FUND_CATEGORY_ID}:${spec.actionKey}`,
    categoryId: EMERGENCY_FUND_CATEGORY_ID,
    title: spec.title,
    body: spec.body,
    priority: spec.priority,
    actionKey: spec.actionKey,
  }
}

export function buildEmergencyFundRecommendations(
  outcomes: readonly EmergencyFundCriterionOutcome[],
): Recommendation[] {
  const recommendations: Recommendation[] = []
  const seenKeys = new Set<string>()
  for (const outcome of outcomes) {
    const recommendation = recommendationForCriterion(outcome)
    if (!recommendation) continue
    if (seenKeys.has(recommendation.actionKey)) continue
    seenKeys.add(recommendation.actionKey)
    recommendations.push(recommendation)
  }
  return recommendations
}

export function summarizeEmergencyFundScore(
  outcomes: readonly EmergencyFundCriterionOutcome[],
): {
  score: number | null
  status: 'computed' | 'insufficient_data'
  summary: string
} {
  const allIncomplete =
    outcomes.length > 0 && outcomes.every((outcome) => outcome.status === 'incomplete')

  if (outcomes.length === 0 || allIncomplete) {
    return {
      score: null,
      status: 'insufficient_data',
      summary:
        'Emergency Fund: insufficient data to score criteria. Record months of coverage, designation, liquidity, and automation details.',
    }
  }

  const earned = outcomes.reduce((sum, outcome) => sum + outcome.points, 0)
  const available = outcomes.reduce((sum, outcome) => sum + outcome.maxPoints, 0)
  const incomplete = outcomes.filter((outcome) => outcome.status === 'incomplete').length
  const partial = outcomes.filter((outcome) => outcome.status === 'partial').length
  const belowFull = outcomes.filter(
    (outcome) =>
      outcome.status !== 'incomplete' &&
      outcome.status !== 'not_applicable' &&
      outcome.points < outcome.maxPoints,
  ).length

  const parts = [`Emergency Fund scored ${earned} of ${available} points.`]
  if (incomplete > 0) {
    parts.push(`${incomplete} criterion(ia) incomplete due to missing data.`)
  }
  if (partial > 0) {
    parts.push(`${partial} criterion(ia) partial.`)
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
