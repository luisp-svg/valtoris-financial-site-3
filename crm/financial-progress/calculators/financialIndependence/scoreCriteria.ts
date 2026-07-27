import type {
  CriterionEvidence,
  CriterionStatus,
  Recommendation,
} from '../../types'
import {
  FINANCIAL_INDEPENDENCE_CATEGORY_ID,
  FINANCIAL_INDEPENDENCE_CRITERION_LABELS,
  FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS,
  FI_PLAN_REVIEW_CURRENT_MONTHS,
  FI_PROGRESS_MET_RATIO,
  FI_PROGRESS_PARTIAL_RATIO,
  type FinancialIndependenceCriterionId,
} from './constants'
import type { FinancialIndependenceSignals } from './extractSignals'

export type FinancialIndependenceCriterionOutcome = {
  id: FinancialIndependenceCriterionId
  maxPoints: number
  points: number
  status: CriterionStatus
  explanation: string
}

function toEvidence(outcome: FinancialIndependenceCriterionOutcome): CriterionEvidence {
  return {
    criterion: FINANCIAL_INDEPENDENCE_CRITERION_LABELS[outcome.id],
    earnedPoints: outcome.points,
    maxPoints: outcome.maxPoints,
    status: outcome.status,
    explanation: outcome.explanation,
  }
}

/**
 * Goal Definition (max 1).
 */
export function scoreFiGoalDefinition(
  signals: FinancialIndependenceSignals,
): FinancialIndependenceCriterionOutcome {
  const maxPoints = FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS.fi_goal_definition
  const detail = signals.goalNotes.join(' ')

  if (signals.goal === 'conflict') {
    return {
      id: 'fi_goal_definition',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: conflicting FI goal statuses. ${detail}`,
    }
  }
  if (signals.goal === 'defined') {
    return {
      id: 'fi_goal_definition',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `A documented financial-independence objective is recorded (1/1). ${detail} Based on available household data; consider reviewing assumptions with a qualified financial professional.`,
    }
  }
  if (signals.goal === 'none') {
    return {
      id: 'fi_goal_definition',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: `Available data explicitly reports no defined financial-independence goal (0/1). ${detail}`,
    }
  }
  if (signals.goal === 'vague') {
    return {
      id: 'fi_goal_definition',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `A vague desire is recorded without a clearly defined FI outcome (0/1). ${detail}`,
    }
  }
  return {
    id: 'fi_goal_definition',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation: `Insufficient data: no documented financial-independence goal is recorded. ${detail}`,
  }
}

/**
 * FI Target (max 1).
 */
export function scoreFiTarget(
  signals: FinancialIndependenceSignals,
): FinancialIndependenceCriterionOutcome {
  const maxPoints = FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS.fi_target
  const detail = [...signals.target.notes, ...signals.target.assumptions].join(' ')

  if (signals.target.status === 'none') {
    return {
      id: 'fi_target',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: `Available data explicitly reports that no measurable FI target has been established (0/1). ${detail}`,
    }
  }
  if (signals.target.status === 'conflict') {
    return {
      id: 'fi_target',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: recorded financial-independence targets conflict. ${detail}`,
    }
  }
  if (
    signals.target.status === 'invalid' ||
    signals.target.status === 'incomplete' ||
    signals.target.amount == null
  ) {
    return {
      id: 'fi_target',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data to confirm a measurable financial-independence target. ${detail}`,
    }
  }

  const derivationNote =
    signals.target.source === 'derived'
      ? ' The recorded target was derived using the household’s explicitly provided annual income objective and withdrawal-rate assumption.'
      : ''
  return {
    id: 'fi_target',
    maxPoints,
    points: maxPoints,
    status: 'met',
    explanation: `A recorded financial-independence target of approximately ${Math.round(
      signals.target.amount,
    ).toLocaleString('en-US')} is documented (${signals.target.source}) (1/1).${derivationNote} ${detail} This is a recorded target, not a certified or guaranteed outcome. The withdrawal-rate assumption is not described as safe, recommended, or sustainable.`,
  }
}

/**
 * Progress Toward Target (max 2). Age-neutral; not a prediction.
 */
export function scoreFiProgressTowardTarget(
  signals: FinancialIndependenceSignals,
): FinancialIndependenceCriterionOutcome {
  const maxPoints = FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS.fi_progress_toward_target
  const targetOk =
    signals.target.status === 'present' &&
    signals.target.amount != null &&
    signals.target.amount > 0
  const assetsOk =
    (signals.assets.status === 'present' || signals.assets.status === 'zero') &&
    signals.assets.amount != null &&
    signals.assets.amount >= 0

  if (signals.target.status === 'conflict' || signals.assets.status === 'conflict') {
    return {
      id: 'fi_progress_toward_target',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: target and/or eligible-asset values conflict, so progress cannot be scored.',
    }
  }

  if (signals.assets.status === 'invalid') {
    return {
      id: 'fi_progress_toward_target',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: eligible FI assets are invalid. ${signals.assets.notes.join(' ')}`,
    }
  }

  if (!targetOk || !assetsOk) {
    return {
      id: 'fi_progress_toward_target',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: confirm the recorded FI target and eligible assets used to measure progress. ${[
        ...signals.target.notes,
        ...signals.assets.notes,
      ].join(' ')}`,
    }
  }

  const ratio = signals.assets.amount! / signals.target.amount!
  const pctDisplay = Math.round(ratio * 1000) / 10
  const homeNote = signals.assets.includesDesignatedHomeEquity
    ? ' Designated home-equity inclusion is disclosed in the asset evidence.'
    : ''

  if (ratio >= FI_PROGRESS_MET_RATIO) {
    return {
      id: 'fi_progress_toward_target',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `Recorded eligible assets equal approximately ${pctDisplay}% of the household’s documented target (2/2).${homeNote} Current recorded progress only — not a prediction of future investment results.`,
    }
  }

  if (ratio >= FI_PROGRESS_PARTIAL_RATIO) {
    return {
      id: 'fi_progress_toward_target',
      maxPoints,
      points: 1,
      status: 'partial',
      explanation: `Recorded eligible assets equal approximately ${pctDisplay}% of the household’s documented target (1/2).${homeNote} Current recorded progress only — not an age-based judgment of being ahead or behind.`,
    }
  }

  return {
    id: 'fi_progress_toward_target',
    maxPoints,
    points: 0,
    status: 'unmet',
    explanation: `Recorded eligible assets equal approximately ${pctDisplay}% of the household’s documented target (0/2).${homeNote} Current recorded progress only — not a prediction of whether the household will reach the target.`,
  }
}

/**
 * Funding Strategy & Progress Tracking (max 1).
 */
export function scoreFiFundingStrategyTracking(
  signals: FinancialIndependenceSignals,
): FinancialIndependenceCriterionOutcome {
  const maxPoints = FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS.fi_funding_strategy_tracking
  const detail = signals.strategyNotes.join(' ')

  if (signals.strategy === 'conflict') {
    return {
      id: 'fi_funding_strategy_tracking',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: FI strategy statuses conflict. ${detail}`,
    }
  }
  if (signals.strategy === 'active') {
    return {
      id: 'fi_funding_strategy_tracking',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `A documented FI funding strategy and/or current progress-tracking process is recorded (1/1). ${detail}`,
    }
  }
  if (signals.strategy === 'none') {
    return {
      id: 'fi_funding_strategy_tracking',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: `Available data explicitly reports no FI funding strategy or tracking process (0/1). ${detail}`,
    }
  }
  if (signals.strategy === 'outdated') {
    return {
      id: 'fi_funding_strategy_tracking',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: `The recorded FI strategy review is older than ${FI_PLAN_REVIEW_CURRENT_MONTHS} months (0/1). ${detail}`,
    }
  }
  if (signals.strategy === 'untied_retirement_only') {
    return {
      id: 'fi_funding_strategy_tracking',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `A generic retirement plan is not automatically treated as an FI funding strategy. ${detail}`,
    }
  }
  return {
    id: 'fi_funding_strategy_tracking',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation: `Insufficient data: confirm how the household plans to fund and track the financial-independence target. ${detail}`,
  }
}

export function scoreAllFinancialIndependenceCriteria(
  signals: FinancialIndependenceSignals,
): FinancialIndependenceCriterionOutcome[] {
  return [
    scoreFiGoalDefinition(signals),
    scoreFiTarget(signals),
    scoreFiProgressTowardTarget(signals),
    scoreFiFundingStrategyTracking(signals),
  ]
}

export function toFinancialIndependenceEvidence(
  outcomes: readonly FinancialIndependenceCriterionOutcome[],
): CriterionEvidence[] {
  return outcomes.map(toEvidence)
}

function recommendationForCriterion(
  outcome: FinancialIndependenceCriterionOutcome,
  signals: FinancialIndependenceSignals,
): Recommendation | null {
  if (outcome.status === 'not_applicable') return null
  if (outcome.status === 'met' && outcome.points >= outcome.maxPoints) return null

  if (outcome.id === 'fi_goal_definition') {
    const vague = signals.goal === 'vague'
    return {
      id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:${
        vague ? 'fi.clarify_goal' : 'fi.define_fi_goal'
      }`,
      categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
      title: vague ? 'Clarify the FI objective' : 'Define the FI goal',
      body: vague
        ? 'Clarify the household’s desired lifestyle, timeline, or income objective.'
        : 'Define what financial independence would look like for the household.',
      priority: 'medium',
      actionKey: vague ? 'fi.clarify_goal' : 'fi.define_fi_goal',
    }
  }

  if (outcome.id === 'fi_target') {
    if (signals.target.status === 'conflict') {
      return {
        id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.reconcile_fi_target`,
        categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
        title: 'Reconcile FI targets',
        body: 'Reconcile the household’s recorded financial-independence targets.',
        priority: 'medium',
        actionKey: 'fi.reconcile_fi_target',
      }
    }
    if (
      signals.target.notes.some((note) => /without an explicit withdrawal rate|assumptions/i.test(note))
    ) {
      return {
        id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.document_target_assumptions`,
        categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
        title: 'Document FI target assumptions',
        body: 'Document the assumptions used to calculate the household’s financial-independence target.',
        priority: 'medium',
        actionKey: 'fi.document_target_assumptions',
      }
    }
    return {
      id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.establish_fi_target`,
      categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
      title: 'Establish an FI target',
      body: 'Establish a measurable financial-independence target.',
      priority: 'medium',
      actionKey: 'fi.establish_fi_target',
    }
  }

  if (outcome.id === 'fi_progress_toward_target') {
    if (outcome.status === 'incomplete') {
      return {
        id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.confirm_fi_assets`,
        categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
        title: 'Confirm FI progress inputs',
        body: 'Confirm the target and eligible assets used to measure financial-independence progress.',
        priority: 'medium',
        actionKey: 'fi.confirm_fi_assets',
      }
    }
    if (outcome.points === 0) {
      return {
        id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.improve_fi_progress_plan`,
        categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
        title: 'Review FI contribution milestones',
        body: 'Review the contribution strategy and milestones supporting the household’s financial-independence target.',
        priority: 'medium',
        actionKey: 'fi.improve_fi_progress_plan',
      }
    }
    return {
      id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.continue_tracking_progress`,
      categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
      title: 'Continue tracking FI progress',
      body: 'Continue tracking progress toward the documented financial-independence target.',
      priority: 'low',
      actionKey: 'fi.continue_tracking_progress',
    }
  }

  // strategy
  if (signals.strategy === 'outdated') {
    return {
      id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.review_fi_strategy`,
      categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
      title: 'Review the FI strategy',
      body: 'Review the financial-independence strategy and update progress milestones.',
      priority: 'medium',
      actionKey: 'fi.review_fi_strategy',
    }
  }
  if (outcome.status === 'incomplete') {
    return {
      id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.confirm_fi_strategy`,
      categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
      title: 'Confirm FI funding approach',
      body: 'Confirm how the household plans to fund and track the financial-independence target.',
      priority: 'medium',
      actionKey: 'fi.confirm_fi_strategy',
    }
  }
  return {
    id: `${FINANCIAL_INDEPENDENCE_CATEGORY_ID}:fi.document_fi_strategy`,
    categoryId: FINANCIAL_INDEPENDENCE_CATEGORY_ID,
    title: 'Document an FI strategy',
    body: 'Document a strategy for funding and reviewing the financial-independence goal.',
    priority: 'medium',
    actionKey: 'fi.document_fi_strategy',
  }
}

export function buildFinancialIndependenceRecommendations(
  outcomes: readonly FinancialIndependenceCriterionOutcome[],
  signals: FinancialIndependenceSignals,
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

export function summarizeFinancialIndependenceScore(
  outcomes: readonly FinancialIndependenceCriterionOutcome[],
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
        'Financial Independence: insufficient data to score criteria. Record the FI goal, measurable target, eligible assets, and funding/review strategy.',
    }
  }

  const earned = Math.min(
    5,
    outcomes.reduce((sum, outcome) => sum + outcome.points, 0),
  )
  const available = outcomes.reduce((sum, outcome) => sum + outcome.maxPoints, 0)
  const incomplete = outcomes.filter((outcome) => outcome.status === 'incomplete').length
  const partial = outcomes.filter((outcome) => outcome.status === 'partial').length

  const parts = [`Financial Independence scored ${earned} of ${available} points.`]
  if (incomplete > 0) {
    parts.push(`${incomplete} criterion(ia) incomplete due to missing or conflicting data.`)
  }
  if (partial > 0) {
    parts.push(`${partial} criterion(ia) partial.`)
  }
  parts.push(
    'Educational planning assessment only — not a guaranteed independence outcome or investment projection.',
  )

  return {
    score: earned,
    status: 'computed',
    summary: parts.join(' '),
  }
}
