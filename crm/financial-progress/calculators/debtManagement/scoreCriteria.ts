import type {
  ActionPriority,
  CriterionEvidence,
  CriterionStatus,
  Recommendation,
} from '../../types'
import {
  DEBT_CATEGORY_ID,
  DEBT_CRITERION_LABELS,
  DEBT_CRITERION_MAX_POINTS,
  DEBT_PAYOFF_PARTIAL_POINTS,
  DEBT_TO_INCOME_POSITION_BANDS,
  HIGH_INTEREST_APR_THRESHOLD,
  type DebtCriterionId,
} from './constants'
import {
  textIncludesRecognizedPayoffMethod,
  type DebtSignals,
} from './extractSignals'

export type DebtCriterionOutcome = {
  id: DebtCriterionId
  maxPoints: number
  points: number
  status: CriterionStatus
  explanation: string
}

function toEvidence(outcome: DebtCriterionOutcome): CriterionEvidence {
  return {
    criterion: DEBT_CRITERION_LABELS[outcome.id],
    earnedPoints: outcome.points,
    maxPoints: outcome.maxPoints,
    status: outcome.status,
    explanation: outcome.explanation,
  }
}

/**
 * Credit Card Utilization (max 5).
 * Uses recorded utilization ratio, or balance÷limit when both are recorded.
 * Bands: ≤10%→5 | ≤30%→4 | ≤50%→3 | ≤75%→2 | ≤100%→1 | >100%→0
 */
export function scoreCreditCardUtilization(signals: DebtSignals): DebtCriterionOutcome {
  const maxPoints = DEBT_CRITERION_MAX_POINTS.credit_card_utilization
  const utilization = signals.creditCardUtilization

  if (utilization == null || !Number.isFinite(utilization)) {
    return {
      id: 'credit_card_utilization',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: credit card utilization requires a recorded utilization ratio or both card balance and credit limit.',
    }
  }

  let points = 0
  if (utilization <= 0.1) points = 5
  else if (utilization <= 0.3) points = 4
  else if (utilization <= 0.5) points = 3
  else if (utilization <= 0.75) points = 2
  else if (utilization <= 1) points = 1
  else points = 0

  const pct = Math.round(utilization * 100)
  return {
    id: 'credit_card_utilization',
    maxPoints,
    points,
    status: points >= maxPoints ? 'met' : points > 0 ? 'partial' : 'unmet',
    explanation:
      points >= maxPoints
        ? `Utilization is ${pct}%, at or below the 10% strong-utilization threshold (${points}/${maxPoints}).`
        : `Utilization is ${pct}%. Lower utilization supports credit flexibility (${points}/${maxPoints}).`,
  }
}

/**
 * High-Interest Debt (max 5).
 * Requires interest-rate evidence: recorded APR and/or authoritative high-interest flag
 * (or explicit highInterestDebt balance including 0). Revolving card balance alone is
 * never treated as high-interest.
 *
 * APR rule uses HIGH_INTEREST_APR_THRESHOLD:
 * - APR < threshold → not high-interest (5)
 * - APR >= threshold → high-interest condition met (0)
 */
export function scoreHighInterestDebt(signals: DebtSignals): DebtCriterionOutcome {
  const maxPoints = DEBT_CRITERION_MAX_POINTS.high_interest_debt

  if (signals.hasHighInterestDebt === 'no') {
    return {
      id: 'high_interest_debt',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Authoritative flag indicates no high-interest debt is present (5/5).',
    }
  }

  if (signals.hasHighInterestDebt === 'yes') {
    return {
      id: 'high_interest_debt',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Authoritative flag indicates high-interest debt is present (0/5).',
    }
  }

  if (signals.highInterestDebt === 0) {
    return {
      id: 'high_interest_debt',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Recorded high-interest debt balance is $0 (5/5).',
    }
  }

  if (signals.highInterestDebt != null && signals.highInterestDebt > 0) {
    return {
      id: 'high_interest_debt',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: `Authoritative high-interest debt balance of $${Math.round(signals.highInterestDebt)} is recorded (0/5).`,
    }
  }

  if (signals.recordedApr != null && Number.isFinite(signals.recordedApr)) {
    const aprPct = Math.round(signals.recordedApr * 1000) / 10
    const thresholdPct = Math.round(HIGH_INTEREST_APR_THRESHOLD * 1000) / 10
    if (signals.recordedApr < HIGH_INTEREST_APR_THRESHOLD) {
      return {
        id: 'high_interest_debt',
        maxPoints,
        points: maxPoints,
        status: 'met',
        explanation: `Recorded APR ${aprPct}% is below the high-interest threshold of ${thresholdPct}% (5/5).`,
      }
    }
    return {
      id: 'high_interest_debt',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: `Recorded APR ${aprPct}% is at or above the high-interest threshold of ${thresholdPct}% (0/5).`,
    }
  }

  if (signals.creditCardDebt != null && signals.creditCardDebt > 0) {
    return {
      id: 'high_interest_debt',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Interest-rate data is missing: a revolving credit-card balance is recorded, but no APR or authoritative high-interest flag is available. Revolving balance alone is not scored as high-interest debt.',
    }
  }

  return {
    id: 'high_interest_debt',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: no recorded APR, high-interest flag, or authoritative high-interest balance is available.',
  }
}

function pointsForDebtToIncomeRatio(ratio: number): number {
  for (const band of DEBT_TO_INCOME_POSITION_BANDS) {
    if (ratio <= band.maxRatioInclusive) return band.points
  }
  return 0
}

/**
 * Debt-to-Income Position (max 5).
 *
 * Metric: total recorded debt ÷ annual household income.
 * Not monthly DTI. Not consumer-only (liability classifications unavailable).
 *
 * Invalid when income missing, ≤0, non-finite, or debt missing/non-finite/negative.
 * Zero debt with valid income → 5. Qualitative debtBurden used only when numeric
 * inputs are unavailable.
 */
export function scoreDebtToIncomePosition(signals: DebtSignals): DebtCriterionOutcome {
  const maxPoints = DEBT_CRITERION_MAX_POINTS.debt_to_income_position
  const income = signals.householdIncome
  const debt = signals.totalDebt

  if (debt != null && (!Number.isFinite(debt) || debt < 0)) {
    return {
      id: 'debt_to_income_position',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: recorded debt is non-finite or negative and cannot produce a Debt-to-Income Position score.',
    }
  }

  if (income != null && (!Number.isFinite(income) || income <= 0)) {
    return {
      id: 'debt_to_income_position',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: annual household income must be a finite value greater than zero to compute Debt-to-Income Position (not monthly DTI).',
    }
  }

  if (debt != null && income != null) {
    const ratio = debt / income
    if (!Number.isFinite(ratio)) {
      return {
        id: 'debt_to_income_position',
        maxPoints,
        points: 0,
        status: 'incomplete',
        explanation: 'Insufficient data: debt-to-income ratio is non-finite.',
      }
    }
    const points = pointsForDebtToIncomeRatio(ratio)
    return {
      id: 'debt_to_income_position',
      maxPoints,
      points,
      status: points >= maxPoints ? 'met' : points > 0 ? 'partial' : 'unmet',
      explanation: `Debt-to-Income Position uses total recorded debt $${Math.round(debt)} ÷ annual household income $${Math.round(income)} (${Math.round(ratio * 100)}%). This is not monthly DTI and is not limited to consumer liabilities (${points}/${maxPoints}).`,
    }
  }

  if (debt === 0) {
    return {
      id: 'debt_to_income_position',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Recorded total debt is $0 (5/5).',
    }
  }

  const burden = signals.debtBurden?.toLowerCase() ?? null
  if (burden === 'none') {
    return {
      id: 'debt_to_income_position',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: 'Retirement assessment reports no meaningful debt burden (5/5).',
    }
  }
  if (burden === 'low') {
    return {
      id: 'debt_to_income_position',
      maxPoints,
      points: 4,
      status: 'partial',
      explanation: 'Retirement assessment reports a low debt burden (4/5). Numeric debt/income not available.',
    }
  }
  if (burden === 'moderate') {
    return {
      id: 'debt_to_income_position',
      maxPoints,
      points: 2,
      status: 'partial',
      explanation:
        'Retirement assessment reports a moderate debt burden (2/5). Numeric debt/income not available.',
    }
  }
  if (burden === 'high') {
    return {
      id: 'debt_to_income_position',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Retirement assessment reports a high debt burden (0/5).',
    }
  }

  return {
    id: 'debt_to_income_position',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: Debt-to-Income Position requires total recorded debt and annual household income (or a recorded debt-burden answer). Missing income or missing debt yields no score.',
  }
}

/** @deprecated Use scoreDebtToIncomePosition — alias kept for transitional imports. */
export const scoreConsumerDebtRatio = scoreDebtToIncomePosition

function hasCompletePayoffStrategy(signals: DebtSignals): boolean {
  if (textIncludesRecognizedPayoffMethod(signals.payoffMethod)) return true
  if (textIncludesRecognizedPayoffMethod(signals.payoffStrategyLabel)) return true
  if (
    signals.payoffOrder != null &&
    signals.targetPayment != null &&
    signals.targetPayment > 0
  ) {
    return true
  }
  if (signals.debtRelatedTaskTitles.some((title) => textIncludesRecognizedPayoffMethod(title))) {
    return true
  }
  return false
}

function hasPartialPayoffIntent(signals: DebtSignals): boolean {
  if (signals.payoffStrategyAnswer === 'yes') return true
  if (signals.debtRelatedTaskTitles.length > 0) return true
  if (
    signals.payoffStrategyLabel != null &&
    yesNoLike(signals.payoffStrategyLabel) === 'yes'
  ) {
    return true
  }
  return false
}

function yesNoLike(value: string): 'yes' | 'no' | null {
  const normalized = value.toLowerCase()
  if (normalized === 'yes' || normalized === 'documented' || normalized === 'in-place') {
    return 'yes'
  }
  if (normalized === 'no' || normalized === 'none' || normalized === 'not-documented') {
    return 'no'
  }
  return null
}

/**
 * Debt Payoff Strategy (max 5).
 * - complete method + plan evidence → 5 met
 * - debt-related task / intent without complete strategy → 2 partial
 * - debt exists, no plan → 0 unmet
 * - confirmed no debt → not_applicable neutral 5
 * - otherwise incomplete
 */
export function scoreDebtPayoffStrategy(signals: DebtSignals): DebtCriterionOutcome {
  const maxPoints = DEBT_CRITERION_MAX_POINTS.debt_payoff_strategy

  const noDebtConfirmed =
    signals.totalDebt === 0 || signals.debtBurden?.toLowerCase() === 'none'

  if (hasCompletePayoffStrategy(signals)) {
    return {
      id: 'debt_payoff_strategy',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation:
        'Documented payoff method and actionable plan evidence found (avalanche/snowball/consolidation/refinancing/negotiated repayment/payoff order + target payment) (5/5).',
    }
  }

  if (signals.payoffStrategyAnswer === 'no') {
    return {
      id: 'debt_payoff_strategy',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Assessment indicates no debt payoff strategy is in place (0/5).',
    }
  }

  if (noDebtConfirmed) {
    return {
      id: 'debt_payoff_strategy',
      maxPoints,
      points: maxPoints,
      status: 'not_applicable',
      explanation:
        'Not applicable: no meaningful recorded debt is present, so a payoff strategy is not required. Neutral credit applied (5/5); not evidence of an active strategy.',
    }
  }

  if (hasPartialPayoffIntent(signals)) {
    return {
      id: 'debt_payoff_strategy',
      maxPoints,
      points: DEBT_PAYOFF_PARTIAL_POINTS,
      status: 'partial',
      explanation: `Debt-related task or documented intent exists without a complete payoff method/plan (${DEBT_PAYOFF_PARTIAL_POINTS}/${maxPoints}).`,
    }
  }

  const debtKnownPresent =
    (signals.totalDebt != null && signals.totalDebt > 0) ||
    (signals.creditCardDebt != null && signals.creditCardDebt > 0) ||
    (signals.highInterestDebt != null && signals.highInterestDebt > 0) ||
    signals.debtBurden === 'low' ||
    signals.debtBurden === 'moderate' ||
    signals.debtBurden === 'high' ||
    signals.hasHighInterestDebt === 'yes'

  if (debtKnownPresent) {
    return {
      id: 'debt_payoff_strategy',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Debt is present on file, but no payoff strategy or debt-related plan is documented (0/5).',
    }
  }

  return {
    id: 'debt_payoff_strategy',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: no payoff-strategy evidence and debt presence cannot be confirmed.',
  }
}

export function scoreAllDebtCriteria(signals: DebtSignals): DebtCriterionOutcome[] {
  return [
    scoreCreditCardUtilization(signals),
    scoreHighInterestDebt(signals),
    scoreDebtToIncomePosition(signals),
    scoreDebtPayoffStrategy(signals),
  ]
}

export function toDebtEvidence(
  outcomes: readonly DebtCriterionOutcome[],
): CriterionEvidence[] {
  return outcomes.map(toEvidence)
}

function recommendationForCriterion(outcome: DebtCriterionOutcome): Recommendation | null {
  if (outcome.status === 'not_applicable') return null
  if (outcome.status === 'met' && outcome.points >= outcome.maxPoints) return null

  const specs: Record<
    DebtCriterionId,
    { title: string; body: string; priority: ActionPriority; actionKey: string }
  > = {
    credit_card_utilization: {
      title: 'Review credit card utilization',
      body:
        outcome.status === 'incomplete'
          ? 'Record credit card balances and limits (or utilization) so this criterion can be scored.'
          : 'Review revolving balances relative to credit limits and consider paying down utilization where appropriate.',
      priority: outcome.status === 'incomplete' ? 'medium' : 'high',
      actionKey: 'debt.review_credit_card_utilization',
    },
    high_interest_debt: {
      title: 'Record or review debt APR',
      body:
        outcome.status === 'incomplete'
          ? 'Record the APR (or an authoritative high-interest flag) for revolving or other debts. A balance alone is not enough to score high-interest debt.'
          : 'Review high-interest balances and prioritize payoff while preserving essential cash reserves.',
      priority: 'high',
      actionKey: 'debt.review_apr',
    },
    debt_to_income_position: {
      title: 'Review debt relative to annual income',
      body:
        outcome.status === 'incomplete'
          ? 'Record total debt and annual household income so Debt-to-Income Position can be evaluated (not monthly DTI).'
          : 'Review total recorded debt relative to annual household income and identify opportunities to reduce leverage.',
      priority: 'high',
      actionKey: 'debt.review_debt_to_income_position',
    },
    debt_payoff_strategy: {
      title: 'Document a complete debt payoff strategy',
      body:
        outcome.status === 'incomplete'
          ? 'Capture a payoff method (avalanche, snowball, consolidation, refinancing, or negotiated repayment) plus an actionable plan.'
          : outcome.status === 'partial'
            ? 'Upgrade the current debt-related intent into a complete strategy with method and target payment or payoff order.'
            : 'Document a clear payoff method and payment plan for outstanding debts.',
      priority: 'high',
      actionKey: 'debt.document_payoff_strategy',
    },
  }

  const spec = specs[outcome.id]
  return {
    id: `${DEBT_CATEGORY_ID}:${spec.actionKey}`,
    categoryId: DEBT_CATEGORY_ID,
    title: spec.title,
    body: spec.body,
    priority: spec.priority,
    actionKey: spec.actionKey,
  }
}

export function buildDebtRecommendations(
  outcomes: readonly DebtCriterionOutcome[],
): Recommendation[] {
  const recommendations: Recommendation[] = []
  for (const outcome of outcomes) {
    const recommendation = recommendationForCriterion(outcome)
    if (recommendation) recommendations.push(recommendation)
  }
  return recommendations
}

export function summarizeDebtScore(outcomes: readonly DebtCriterionOutcome[]): {
  score: number | null
  status: 'computed' | 'insufficient_data'
  summary: string
} {
  const scoreable = outcomes.filter((outcome) => outcome.status !== 'not_applicable')
  const allScoreableIncomplete =
    scoreable.length > 0 && scoreable.every((outcome) => outcome.status === 'incomplete')

  if (outcomes.length === 0 || allScoreableIncomplete) {
    return {
      score: null,
      status: 'insufficient_data',
      summary:
        'Debt Management: insufficient data to score criteria. Gather utilization, APR/interest flags, debt, income, and payoff-strategy details.',
    }
  }

  const earned = outcomes.reduce((sum, outcome) => sum + outcome.points, 0)
  const available = outcomes.reduce((sum, outcome) => sum + outcome.maxPoints, 0)
  const incomplete = outcomes.filter((outcome) => outcome.status === 'incomplete').length
  const notApplicable = outcomes.filter((outcome) => outcome.status === 'not_applicable').length
  const partial = outcomes.filter((outcome) => outcome.status === 'partial').length
  const belowFull = outcomes.filter(
    (outcome) =>
      outcome.status !== 'not_applicable' &&
      outcome.status !== 'incomplete' &&
      outcome.points < outcome.maxPoints,
  ).length

  const parts = [`Debt Management scored ${earned} of ${available} points.`]
  if (notApplicable > 0) {
    parts.push(`${notApplicable} criterion(ia) not applicable (neutral credit).`)
  }
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
