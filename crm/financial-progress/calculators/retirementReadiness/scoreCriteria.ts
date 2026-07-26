import type {
  ActionPriority,
  CriterionEvidence,
  CriterionStatus,
  Recommendation,
} from '../../types'
import {
  RETIREMENT_CONTRIBUTION_ACTIVITY_CONFIRMED_POINTS,
  RETIREMENT_CONTRIBUTION_RATE_BANDS,
  RETIREMENT_PROGRESS_RATIO_BANDS,
  RETIREMENT_READINESS_CATEGORY_ID,
  RETIREMENT_READINESS_CRITERION_LABELS,
  RETIREMENT_READINESS_CRITERION_MAX_POINTS,
  RETIREMENT_SOURCE_CONFLICT_TOLERANCE,
  type RetirementReadinessCriterionId,
} from './constants'
import type { RetirementReadinessSignals } from './extractSignals'

export type RetirementReadinessCriterionOutcome = {
  id: RetirementReadinessCriterionId
  maxPoints: number
  points: number
  status: CriterionStatus
  explanation: string
}

function toEvidence(outcome: RetirementReadinessCriterionOutcome): CriterionEvidence {
  return {
    criterion: RETIREMENT_READINESS_CRITERION_LABELS[outcome.id],
    earnedPoints: outcome.points,
    maxPoints: outcome.maxPoints,
    status: outcome.status,
    explanation: outcome.explanation,
  }
}

function formatPct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`
}

function pointsForContributionRate(rate: number): { points: number; status: CriterionStatus } {
  if (rate < 0) return { points: 0, status: 'incomplete' }
  if (rate === 0) return { points: 0, status: 'unmet' }
  for (const band of RETIREMENT_CONTRIBUTION_RATE_BANDS) {
    if (rate >= band.minRateInclusive) {
      return { points: band.points, status: band.status }
    }
  }
  return { points: 0, status: 'unmet' }
}

function pointsForProgressRatio(ratio: number): { points: number; status: CriterionStatus } {
  if (ratio < 0) return { points: 0, status: 'incomplete' }
  if (ratio === 0) return { points: 0, status: 'unmet' }
  for (const band of RETIREMENT_PROGRESS_RATIO_BANDS) {
    if (ratio >= band.minRatioInclusive) {
      return { points: band.points, status: band.status }
    }
  }
  return { points: 0, status: 'unmet' }
}

/**
 * Retirement Contribution Activity (max 4).
 */
export function scoreRetirementContributionActivity(
  signals: RetirementReadinessSignals,
): RetirementReadinessCriterionOutcome {
  const maxPoints = RETIREMENT_READINESS_CRITERION_MAX_POINTS.retirement_contribution_activity
  const tolerancePct = Math.round(RETIREMENT_SOURCE_CONFLICT_TOLERANCE * 100)

  if (signals.contributionRateConflict || signals.contributionAmountConflict) {
    return {
      id: 'retirement_contribution_activity',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: contribution rate and/or monthly vs annual contribution amounts conflict beyond a ${tolerancePct}% relative tolerance, so contribution activity is not scored.`,
    }
  }

  if (signals.incomeSourceConflict && signals.contributionRate == null) {
    return {
      id: 'retirement_contribution_activity',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: monthly and annual earned income conflict beyond a ${tolerancePct}% relative tolerance, so a contribution rate cannot be calculated.`,
    }
  }

  if (signals.contributionDataInvalid) {
    return {
      id: 'retirement_contribution_activity',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: contribution rate is invalid (negative contribution, non-finite values, zero/negative income, ambiguous percentage, or rate above 100%). Values are not silently clamped.',
    }
  }

  if (signals.contributionRate != null && Number.isFinite(signals.contributionRate)) {
    const { points, status } = pointsForContributionRate(signals.contributionRate)
    const scopeNote =
      signals.contributionRateScope === 'household_total'
        ? ' Uses total household retirement contribution rate.'
        : signals.contributionRateSource === 'calculated_rate'
          ? ' Calculated as verified retirement contributions ÷ earned income.'
          : ' Uses recorded employee/household retirement contribution rate.'
    const sourceNote =
      signals.contributionRateSource === 'direct_rate'
        ? 'Scored from recorded contribution rate.'
        : 'Scored from contribution amount divided by earned income.'
    return {
      id: 'retirement_contribution_activity',
      maxPoints,
      points,
      status,
      explanation: `${sourceNote}${scopeNote} Rate is ${formatPct(signals.contributionRate)} (${points}/${maxPoints}).`,
    }
  }

  if (signals.explicitNotSaving) {
    return {
      id: 'retirement_contribution_activity',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Assessment explicitly indicates the household is not currently saving for retirement (0/4).',
    }
  }

  if (signals.contributionActivityConfirmed) {
    return {
      id: 'retirement_contribution_activity',
      maxPoints,
      points: RETIREMENT_CONTRIBUTION_ACTIVITY_CONFIRMED_POINTS,
      status: 'partial',
      explanation: `Recurring retirement saving is confirmed, but a verified contribution rate could not be calculated (${RETIREMENT_CONTRIBUTION_ACTIVITY_CONFIRMED_POINTS}/${maxPoints}).`,
    }
  }

  return {
    id: 'retirement_contribution_activity',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: record current retirement contributions to evaluate savings activity.',
  }
}

/**
 * Employer Match Utilization (max 3).
 * not_applicable contributes 0 points (no redistribution).
 */
export function scoreEmployerMatchUtilization(
  signals: RetirementReadinessSignals,
): RetirementReadinessCriterionOutcome {
  const maxPoints = RETIREMENT_READINESS_CRITERION_MAX_POINTS.employer_match_utilization

  if (signals.matchConflict) {
    return {
      id: 'employer_match_utilization',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: employer-match fields conflict (for example, status versus employee contribution vs match threshold), so match utilization is not scored.',
    }
  }

  if (signals.matchApplicability === 'not_applicable') {
    const aggregation =
      signals.matchAggregation === 'members'
        ? ' Aggregated across household members with retirement-plan evidence; members without evidence were not fabricated.'
        : ''
    return {
      id: 'employer_match_utilization',
      maxPoints,
      points: 0,
      status: 'not_applicable',
      explanation: `No employer match opportunity applies (no match offered, self-employed, or not employed). Criterion contributes 0 of ${maxPoints} points without redistribution.${aggregation}`,
    }
  }

  if (signals.matchApplicability === 'unknown' || signals.matchCapture == null) {
    return {
      id: 'employer_match_utilization',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: confirm employer retirement plan and matching contribution details. Unknown match availability is not treated as not applicable.',
    }
  }

  const aggregationNote =
    signals.matchAggregation === 'members'
      ? ' Household aggregation: full credit requires all known applicable member opportunities to be fully captured.'
      : ''

  if (signals.matchCapture === 'full') {
    return {
      id: 'employer_match_utilization',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `Full available employer match is captured (3/3).${aggregationNote}`,
    }
  }

  if (signals.matchCapture === 'partial') {
    return {
      id: 'employer_match_utilization',
      maxPoints,
      points: 2,
      status: 'partial',
      explanation: `Some but not all available employer match is captured (2/3).${aggregationNote}`,
    }
  }

  return {
    id: 'employer_match_utilization',
    maxPoints,
    points: 0,
    status: 'unmet',
    explanation: `An employer match is available but no contribution toward the match is recorded (0/3).${aggregationNote}`,
  }
}

/**
 * Retirement Savings Progress (max 5).
 * Assets without a documented target do not earn progress points.
 */
export function scoreRetirementSavingsProgress(
  signals: RetirementReadinessSignals,
): RetirementReadinessCriterionOutcome {
  const maxPoints = RETIREMENT_READINESS_CRITERION_MAX_POINTS.retirement_savings_progress
  const tolerancePct = Math.round(RETIREMENT_SOURCE_CONFLICT_TOLERANCE * 100)

  if (signals.progressDerivedConflict) {
    return {
      id: 'retirement_savings_progress',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: recorded funding ratio (${
        signals.derivedProgressRatio != null ? formatPct(signals.derivedProgressRatio) : 'n/a'
      }) materially conflicts with the raw calculation (${
        signals.rawProgressRatio != null ? formatPct(signals.rawProgressRatio) : 'n/a'
      }) beyond a ${tolerancePct}% relative tolerance.`,
    }
  }

  if (signals.progressAssetConflict) {
    return {
      id: 'retirement_savings_progress',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: total retirement assets conflict with summed account balances beyond a ${tolerancePct}% relative tolerance.`,
    }
  }

  if (signals.progressDataInvalid) {
    return {
      id: 'retirement_savings_progress',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: retirement progress inputs are invalid (negative assets, invalid target, or unusable derived ratio).',
    }
  }

  if (signals.progressRatio != null && Number.isFinite(signals.progressRatio)) {
    const { points, status } = pointsForProgressRatio(signals.progressRatio)
    const sourceNote =
      signals.progressRatioSource === 'direct_funding_ratio'
        ? signals.rawProgressRatio != null
          ? 'Scored from recorded funding ratio (consistent with raw calculation).'
          : 'Scored from recorded funding ratio (raw inputs insufficient for cross-check).'
        : signals.progressRatioSource === 'assets_over_target'
          ? 'Scored from current retirement assets ÷ documented retirement asset target.'
          : 'Scored from documented projected retirement income ÷ documented retirement income goal.'
    return {
      id: 'retirement_savings_progress',
      maxPoints,
      points,
      status,
      explanation: `${sourceNote} Ratio is ${formatPct(signals.progressRatio)} (${points}/${maxPoints}).`,
    }
  }

  if (signals.hasRetirementAssetsWithoutTarget) {
    return {
      id: 'retirement_savings_progress',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Retirement assets are recorded, but a documented retirement target was not available, so progress cannot be scored from balances alone (0/5).',
    }
  }

  if (signals.retirementAssetTarget != null && signals.currentRetirementAssets == null) {
    return {
      id: 'retirement_savings_progress',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'A retirement target is documented, but current retirement assets are missing or invalid (0/5).',
    }
  }

  return {
    id: 'retirement_savings_progress',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: complete a retirement readiness analysis using current assets and documented retirement goals.',
  }
}

/**
 * Retirement Plan & Goal Definition (max 3).
 * One point each for age, income/spending goal, and documented strategy.
 */
export function scoreRetirementPlanGoalDefinition(
  signals: RetirementReadinessSignals,
): RetirementReadinessCriterionOutcome {
  const maxPoints = RETIREMENT_READINESS_CRITERION_MAX_POINTS.retirement_plan_goal_definition

  if (signals.retirementAgeInvalid || signals.incomeGoalInvalid) {
    return {
      id: 'retirement_plan_goal_definition',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: signals.retirementAgeInvalid
        ? 'Insufficient data: target retirement age is present but not plausible (or below current age). No default age is assumed.'
        : 'Insufficient data: retirement income/spending goal is zero, negative, or invalid. Current income is not substituted.',
    }
  }

  if (signals.explicitNoPlanningElements) {
    return {
      id: 'retirement_plan_goal_definition',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Assessment explicitly indicates no documented retirement planning elements (0/3).',
    }
  }

  if (signals.planElementsUnknown) {
    return {
      id: 'retirement_plan_goal_definition',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: target retirement age, retirement income goal, and retirement strategy are all unknown.',
    }
  }

  let points = 0
  const parts: string[] = []
  if (signals.hasTargetRetirementAge) {
    points += 1
    parts.push(`target age ${signals.targetRetirementAge}`)
  }
  if (signals.hasRetirementIncomeGoal) {
    points += 1
    parts.push('income/spending goal')
  }
  if (signals.hasRetirementStrategy) {
    points += 1
    parts.push('documented strategy')
  }

  if (points === 0) {
    const somewhatNote = signals.somewhatClearPlanClarity
      ? ' Plan clarity is only somewhat clear, which alone does not establish a documented strategy.'
      : ''
    return {
      id: 'retirement_plan_goal_definition',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: no validated retirement age, income goal, or explicit strategy is documented. Account ownership alone is not a strategy.${somewhatNote}`,
    }
  }

  const status: CriterionStatus = points >= maxPoints ? 'met' : 'partial'
  const somewhatNote =
    signals.somewhatClearPlanClarity && !signals.hasRetirementStrategy
      ? ' Somewhat-clear plan direction is noted but does not earn the strategy point without an explicit documented plan.'
      : ''
  return {
    id: 'retirement_plan_goal_definition',
    maxPoints,
    points,
    status,
    explanation: `Documented planning elements: ${parts.join(', ')} (${points}/${maxPoints}).${somewhatNote}`,
  }
}

export function scoreAllRetirementReadinessCriteria(
  signals: RetirementReadinessSignals,
): RetirementReadinessCriterionOutcome[] {
  return [
    scoreRetirementContributionActivity(signals),
    scoreEmployerMatchUtilization(signals),
    scoreRetirementSavingsProgress(signals),
    scoreRetirementPlanGoalDefinition(signals),
  ]
}

export function toRetirementReadinessEvidence(
  outcomes: readonly RetirementReadinessCriterionOutcome[],
): CriterionEvidence[] {
  return outcomes.map(toEvidence)
}

function recommendationForCriterion(
  outcome: RetirementReadinessCriterionOutcome,
  signals: RetirementReadinessSignals,
): Recommendation | null {
  if (outcome.status === 'not_applicable') return null
  if (outcome.status === 'met' && outcome.points >= outcome.maxPoints) return null

  if (outcome.id === 'retirement_plan_goal_definition') {
    const missing: string[] = []
    if (!signals.hasTargetRetirementAge) missing.push('age')
    if (!signals.hasRetirementIncomeGoal) missing.push('income')
    if (!signals.hasRetirementStrategy) missing.push('strategy')

    let title = 'Document retirement planning elements'
    let body =
      'Document the household’s target retirement age, desired retirement income or spending target, and a written retirement strategy.'
    let actionKey = 'retirement.document_plan_elements'

    if (missing.length === 1 && missing[0] === 'age') {
      title = 'Document the target retirement age'
      body = 'Document the household’s target retirement age.'
      actionKey = 'retirement.document_target_age'
    } else if (missing.length === 1 && missing[0] === 'income') {
      title = 'Define the retirement income goal'
      body = 'Define the household’s desired retirement income or spending target.'
      actionKey = 'retirement.define_income_goal'
    } else if (missing.length === 1 && missing[0] === 'strategy') {
      title = 'Complete a retirement strategy'
      body = signals.somewhatClearPlanClarity
        ? 'Clarify direction into a documented retirement savings and income strategy; somewhat-clear intent alone is not enough.'
        : 'Complete a documented retirement savings and income strategy.'
      actionKey = 'retirement.complete_strategy'
    } else if (outcome.status === 'incomplete') {
      title = 'Document retirement goals and strategy'
      body =
        'Document the household’s target retirement age, income goal, and retirement strategy so planning progress can be evaluated.'
      actionKey = 'retirement.document_plan_elements'
    }

    return {
      id: `${RETIREMENT_READINESS_CATEGORY_ID}:${actionKey}`,
      categoryId: RETIREMENT_READINESS_CATEGORY_ID,
      title,
      body,
      priority: 'medium',
      actionKey,
    }
  }

  const specs: Record<
    Exclude<RetirementReadinessCriterionId, 'retirement_plan_goal_definition'>,
    { title: string; body: string; priority: ActionPriority; actionKey: string }
  > = {
    retirement_contribution_activity: {
      title:
        outcome.status === 'incomplete'
          ? 'Record retirement contributions'
          : outcome.status === 'unmet'
            ? 'Begin retirement savings contributions'
            : 'Review retirement contribution level',
      body:
        outcome.status === 'incomplete'
          ? 'Record current retirement contributions to evaluate savings activity.'
          : outcome.status === 'unmet'
            ? 'Begin a consistent retirement savings contribution.'
            : 'Review whether retirement contributions can be increased over time.',
      priority: outcome.status === 'incomplete' ? 'medium' : 'high',
      actionKey:
        outcome.status === 'incomplete'
          ? 'retirement.record_contributions'
          : outcome.status === 'unmet'
            ? 'retirement.begin_contributions'
            : 'retirement.increase_contributions',
    },
    employer_match_utilization: {
      title:
        outcome.status === 'incomplete'
          ? 'Confirm employer match details'
          : outcome.status === 'unmet'
            ? 'Capture the available employer match'
            : 'Review employer match utilization',
      body:
        outcome.status === 'incomplete'
          ? 'Confirm employer retirement plan and matching contribution details.'
          : outcome.status === 'unmet'
            ? 'Consider contributing enough to capture the available employer match.'
            : 'Review contributions needed to capture the full available employer match.',
      priority: 'high',
      actionKey:
        outcome.status === 'incomplete'
          ? 'retirement.confirm_match_details'
          : outcome.status === 'unmet'
            ? 'retirement.capture_employer_match'
            : 'retirement.increase_to_full_match',
    },
    retirement_savings_progress: {
      title:
        outcome.status === 'incomplete'
          ? signals.hasRetirementAssetsWithoutTarget
            ? 'Document a retirement target'
            : 'Complete a retirement readiness analysis'
          : outcome.status === 'unmet'
            ? 'Begin building retirement assets'
            : 'Review the retirement savings gap',
      body:
        outcome.status === 'incomplete'
          ? signals.hasRetirementAssetsWithoutTarget
            ? 'Document a retirement income or asset target to evaluate progress.'
            : 'Complete a retirement readiness analysis using current assets and retirement goals.'
          : outcome.status === 'unmet'
            ? 'Begin building retirement assets toward the documented retirement goal.'
            : 'Review the gap between current retirement savings and the documented retirement target.',
      priority: 'medium',
      actionKey:
        outcome.status === 'incomplete'
          ? signals.hasRetirementAssetsWithoutTarget
            ? 'retirement.document_target'
            : 'retirement.complete_readiness_analysis'
          : outcome.status === 'unmet'
            ? 'retirement.begin_building_assets'
            : 'retirement.review_savings_gap',
    },
  }

  const spec = specs[outcome.id]
  return {
    id: `${RETIREMENT_READINESS_CATEGORY_ID}:${spec.actionKey}`,
    categoryId: RETIREMENT_READINESS_CATEGORY_ID,
    title: spec.title,
    body: spec.body,
    priority: spec.priority,
    actionKey: spec.actionKey,
  }
}

export function buildRetirementReadinessRecommendations(
  outcomes: readonly RetirementReadinessCriterionOutcome[],
  signals: RetirementReadinessSignals,
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
 * Category computation requires at least one scorable criterion.
 *
 * Scorable: met | partial | unmet
 * Non-scorable: incomplete | not_applicable
 *
 * not_applicable contributes 0 points, does not redistribute points, and alone
 * (with only incomplete peers) does not unlock computed status.
 */
export function summarizeRetirementReadinessScore(
  outcomes: readonly RetirementReadinessCriterionOutcome[],
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
        'Retirement Readiness: insufficient data to score criteria. Record contributions, employer match details, retirement assets/targets, and planning goals.',
    }
  }

  const earned = Math.min(
    15,
    outcomes.reduce((sum, outcome) => sum + outcome.points, 0),
  )
  const available = outcomes.reduce((sum, outcome) => sum + outcome.maxPoints, 0)
  const incomplete = outcomes.filter((outcome) => outcome.status === 'incomplete').length
  const notApplicable = outcomes.filter((outcome) => outcome.status === 'not_applicable').length
  const partial = outcomes.filter((outcome) => outcome.status === 'partial').length

  const parts = [`Retirement Readiness scored ${earned} of ${available} points.`]
  if (notApplicable > 0) {
    parts.push(
      `${notApplicable} criterion(ia) not applicable (0 points; points are not redistributed).`,
    )
  }
  if (incomplete > 0) {
    parts.push(`${incomplete} criterion(ia) incomplete due to missing data.`)
  }
  if (partial > 0) {
    parts.push(`${partial} criterion(ia) partial.`)
  }

  return {
    score: earned,
    status: 'computed',
    summary: parts.join(' '),
  }
}
