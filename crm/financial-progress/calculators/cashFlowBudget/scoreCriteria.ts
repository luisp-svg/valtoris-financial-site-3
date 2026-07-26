import type {
  ActionPriority,
  CriterionEvidence,
  CriterionStatus,
  Recommendation,
} from '../../types'
import {
  CASH_FLOW_BREAK_EVEN_POINTS,
  CASH_FLOW_BUDGET_CATEGORY_ID,
  CASH_FLOW_BUDGET_CRITERION_LABELS,
  CASH_FLOW_BUDGET_CRITERION_MAX_POINTS,
  CASH_FLOW_MARGIN_BANDS,
  CASH_FLOW_NET_FALLBACK_POINTS,
  CASH_FLOW_SOURCE_CONFLICT_TOLERANCE,
  EXPENSE_TRACKING_FREQUENCY,
  RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS,
  SAVINGS_RATE_BANDS,
  type CashFlowBudgetCriterionId,
} from './constants'
import type { CashFlowBudgetSignals } from './extractSignals'

export type CashFlowBudgetCriterionOutcome = {
  id: CashFlowBudgetCriterionId
  maxPoints: number
  points: number
  status: CriterionStatus
  explanation: string
}

function toEvidence(outcome: CashFlowBudgetCriterionOutcome): CriterionEvidence {
  return {
    criterion: CASH_FLOW_BUDGET_CRITERION_LABELS[outcome.id],
    earnedPoints: outcome.points,
    maxPoints: outcome.maxPoints,
    status: outcome.status,
    explanation: outcome.explanation,
  }
}

function formatPct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`
}

function pointsForMargin(margin: number): { points: number; status: CriterionStatus } {
  if (margin < 0) return { points: 0, status: 'unmet' }
  if (margin === 0) return { points: CASH_FLOW_BREAK_EVEN_POINTS, status: 'partial' }
  for (const band of CASH_FLOW_MARGIN_BANDS) {
    if (margin >= band.minMarginInclusive) {
      return { points: band.points, status: band.status }
    }
  }
  return { points: 0, status: 'unmet' }
}

function pointsForSavingsRate(rate: number): { points: number; status: CriterionStatus } {
  if (rate < 0) return { points: 0, status: 'incomplete' }
  if (rate === 0) return { points: 0, status: 'unmet' }
  for (const band of SAVINGS_RATE_BANDS) {
    if (rate >= band.minRateInclusive) {
      return { points: band.points, status: band.status }
    }
  }
  return { points: 0, status: 'unmet' }
}

function normalizeFrequencyToken(value: string): string {
  return value.toLowerCase().replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Monthly Cash Flow Position (max 6).
 * Prefer validated margin; else documented net cash-flow sign; else qualitative pattern.
 */
export function scoreMonthlyCashFlowPosition(
  signals: CashFlowBudgetSignals,
): CashFlowBudgetCriterionOutcome {
  const maxPoints = CASH_FLOW_BUDGET_CRITERION_MAX_POINTS.monthly_cash_flow_position
  const tolerancePct = Math.round(CASH_FLOW_SOURCE_CONFLICT_TOLERANCE * 100)

  if (signals.cashFlowDerivedConflict) {
    return {
      id: 'monthly_cash_flow_position',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: recorded cash-flow margin (${
        signals.derivedCashFlowMargin != null ? formatPct(signals.derivedCashFlowMargin) : 'n/a'
      }) materially conflicts with income minus expenses (${
        signals.rawCashFlowMargin != null ? formatPct(signals.rawCashFlowMargin) : 'n/a'
      }) beyond a ${tolerancePct}% relative tolerance, so scoring is withheld.`,
    }
  }

  if (signals.incomeSourceConflict || signals.expenseSourceConflict) {
    // Period conflicts block margin-from-raw; allow non-period fallbacks below.
    if (signals.cashFlowMargin == null) {
      const which = [
        signals.incomeSourceConflict ? 'income' : null,
        signals.expenseSourceConflict ? 'expenses' : null,
      ]
        .filter(Boolean)
        .join(' and ')
      // Fall through to net/qualitative when available.
      if (
        signals.cashFlowMarginSource !== 'net_cash_flow_fallback' &&
        signals.cashFlowMarginSource !== 'qualitative_cash_flow'
      ) {
        return {
          id: 'monthly_cash_flow_position',
          maxPoints,
          points: 0,
          status: 'incomplete',
          explanation: `Insufficient data: monthly and annual ${which} conflict beyond a ${tolerancePct}% relative tolerance, so cash-flow margin cannot be scored from those sources.`,
        }
      }
    }
  }

  if (signals.cashFlowDataInvalid && signals.cashFlowMargin == null) {
    return {
      id: 'monthly_cash_flow_position',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: income or expenses are missing, zero, negative, or non-finite, so cash-flow margin cannot be calculated.',
    }
  }

  if (signals.cashFlowMargin != null && Number.isFinite(signals.cashFlowMargin)) {
    const { points, status } = pointsForMargin(signals.cashFlowMargin)
    let sourceNote: string
    if (signals.cashFlowMarginSource === 'direct_margin') {
      sourceNote =
        signals.rawCashFlowMargin != null
          ? 'Scored from recorded cash-flow margin (consistent with income minus expenses).'
          : 'Scored from recorded cash-flow margin (raw income/expense inputs insufficient for cross-check).'
    } else {
      sourceNote =
        signals.derivedCashFlowMargin == null
          ? 'Scored from monthly household income minus monthly household expenses (derived margin unavailable or invalid).'
          : 'Scored from monthly household income minus monthly household expenses.'
    }
    return {
      id: 'monthly_cash_flow_position',
      maxPoints,
      points,
      status,
      explanation: `${sourceNote} Margin is ${formatPct(signals.cashFlowMargin)} (${points}/${maxPoints}).`,
    }
  }

  if (signals.cashFlowMarginSource === 'net_cash_flow_fallback' && signals.monthlyNetCashFlow != null) {
    const net = signals.monthlyNetCashFlow
    if (net > 0) {
      return {
        id: 'monthly_cash_flow_position',
        maxPoints,
        points: CASH_FLOW_NET_FALLBACK_POINTS.positive,
        status: 'partial',
        explanation: `Documented positive monthly net cash flow without an income denominator for margin (${CASH_FLOW_NET_FALLBACK_POINTS.positive}/${maxPoints}).`,
      }
    }
    if (net === 0) {
      return {
        id: 'monthly_cash_flow_position',
        maxPoints,
        points: CASH_FLOW_NET_FALLBACK_POINTS.breakEven,
        status: 'partial',
        explanation: `Documented zero monthly net cash flow (${CASH_FLOW_NET_FALLBACK_POINTS.breakEven}/${maxPoints}).`,
      }
    }
    return {
      id: 'monthly_cash_flow_position',
      maxPoints,
      points: CASH_FLOW_NET_FALLBACK_POINTS.negative,
      status: 'unmet',
      explanation: `Documented negative monthly net cash flow (${CASH_FLOW_NET_FALLBACK_POINTS.negative}/${maxPoints}).`,
    }
  }

  if (signals.cashFlowMarginSource === 'qualitative_cash_flow' && signals.qualitativeCashFlow) {
    if (signals.qualitativeCashFlow === 'positive') {
      return {
        id: 'monthly_cash_flow_position',
        maxPoints,
        points: CASH_FLOW_NET_FALLBACK_POINTS.positive,
        status: 'partial',
        explanation: `Assessment indicates the household consistently saves most months; percentage margin is not calculable (${CASH_FLOW_NET_FALLBACK_POINTS.positive}/${maxPoints}).`,
      }
    }
    if (signals.qualitativeCashFlow === 'break_even') {
      return {
        id: 'monthly_cash_flow_position',
        maxPoints,
        points: CASH_FLOW_NET_FALLBACK_POINTS.breakEven,
        status: 'partial',
        explanation: `Assessment indicates break-even cash flow; percentage margin is not calculable (${CASH_FLOW_NET_FALLBACK_POINTS.breakEven}/${maxPoints}).`,
      }
    }
    if (signals.qualitativeCashFlow === 'negative') {
      return {
        id: 'monthly_cash_flow_position',
        maxPoints,
        points: CASH_FLOW_NET_FALLBACK_POINTS.negative,
        status: 'unmet',
        explanation: `Assessment indicates the household often spends more than it takes in (${CASH_FLOW_NET_FALLBACK_POINTS.negative}/${maxPoints}).`,
      }
    }
  }

  return {
    id: 'monthly_cash_flow_position',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: record monthly income and expenses (or an authoritative cash-flow margin) to evaluate cash flow.',
  }
}

/**
 * Budgeting System (max 3).
 * Income/expense totals and generic advisor tasks do not prove an active budget.
 */
export function scoreBudgetingSystem(
  signals: CashFlowBudgetSignals,
): CashFlowBudgetCriterionOutcome {
  const maxPoints = CASH_FLOW_BUDGET_CRITERION_MAX_POINTS.budgeting_system

  if (signals.hasDocumentedBudget === 'no' || signals.budgetUse === 'none') {
    return {
      id: 'budgeting_system',
      maxPoints,
      points: 0,
      status: 'unmet',
      explanation: 'Household explicitly has no documented budget (0/3).',
    }
  }

  if (signals.vagueBudgetClaim || signals.budgetUse === 'vague') {
    return {
      id: 'budgeting_system',
      maxPoints,
      points: 2,
      status: 'partial',
      explanation:
        'Vague budgeting intent (for example, “tries to budget”) without confirmed active use of a documented plan (2/3).',
    }
  }

  const activeDocumented =
    (signals.hasDocumentedBudget === 'yes' || signals.budgetMethodRecognized) &&
    signals.budgetUse === 'active'

  if (activeDocumented) {
    const methodNote = signals.budgetMethodRecognized
      ? ` Recognized method: ${signals.budgetMethod}.`
      : ''
    return {
      id: 'budgeting_system',
      maxPoints,
      points: maxPoints,
      status: 'met',
      explanation: `Documented budget is actively used and reviewed.${methodNote} (3/3).`,
    }
  }

  if (
    signals.hasDocumentedBudget === 'yes' ||
    signals.budgetMethodRecognized ||
    signals.budgetUse === 'inconsistent'
  ) {
    return {
      id: 'budgeting_system',
      maxPoints,
      points: 2,
      status: 'partial',
      explanation:
        'A budget or spending-plan method is documented, but consistent use/review is unconfirmed or inconsistent (2/3).',
    }
  }

  if (signals.hasGenericBudgetTask) {
    return {
      id: 'budgeting_system',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'A generic advisor budget task exists, but that alone does not prove a documented, actively used household budget (0/3).',
    }
  }

  if (signals.hasIncomeExpenseWithoutBudget) {
    return {
      id: 'budgeting_system',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Income and/or expense values are recorded, but that alone does not prove a documented budgeting system (0/3).',
    }
  }

  return {
    id: 'budgeting_system',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: confirm whether the household uses a documented budget and how consistently it is reviewed.',
  }
}

/**
 * Savings Rate (max 4).
 * Verified total household rate only for band scoring.
 * Retirement-only evidence → capped partial credit (not total-rate bands).
 */
export function scoreSavingsRate(
  signals: CashFlowBudgetSignals,
): CashFlowBudgetCriterionOutcome {
  const maxPoints = CASH_FLOW_BUDGET_CRITERION_MAX_POINTS.savings_rate
  const tolerancePct = Math.round(CASH_FLOW_SOURCE_CONFLICT_TOLERANCE * 100)

  if (signals.savingsDerivedConflict) {
    return {
      id: 'savings_rate',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: recorded savings rate (${
        signals.derivedSavingsRate != null ? formatPct(signals.derivedSavingsRate) : 'n/a'
      }) materially conflicts with contributions ÷ income (${
        signals.rawSavingsRate != null ? formatPct(signals.rawSavingsRate) : 'n/a'
      }) beyond a ${tolerancePct}% relative tolerance, so scoring is withheld.`,
    }
  }

  if (signals.savingsContributionSourceConflict) {
    return {
      id: 'savings_rate',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: monthly and annual savings contributions conflict beyond a ${tolerancePct}% relative tolerance, so the savings rate cannot be scored from those sources.`,
    }
  }

  if (signals.incomeSourceConflict && signals.savingsRate == null) {
    return {
      id: 'savings_rate',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: `Insufficient data: monthly and annual income conflict beyond a ${tolerancePct}% relative tolerance, so contributions cannot be converted into a verified savings rate.`,
    }
  }

  if (signals.savingsRateInvalid) {
    return {
      id: 'savings_rate',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: savings rate is invalid (for example, negative contributions, non-finite values, zero/negative income, or an implausible rate above 100%). Values are not silently clamped.',
    }
  }

  if (signals.savingsRate != null && Number.isFinite(signals.savingsRate)) {
    const { points, status } = pointsForSavingsRate(signals.savingsRate)
    let sourceNote: string
    if (signals.savingsRateSource === 'derived') {
      sourceNote =
        signals.rawSavingsRate != null
          ? 'Scored from recorded total household savings rate (consistent with contributions ÷ income).'
          : 'Scored from recorded total household savings rate (raw contribution inputs insufficient for cross-check).'
    } else {
      sourceNote =
        'Scored from verified monthly household savings contributions ÷ monthly household income.'
    }
    return {
      id: 'savings_rate',
      maxPoints,
      points,
      status,
      explanation: `${sourceNote} Rate is ${formatPct(signals.savingsRate)} (${points}/${maxPoints}).`,
    }
  }

  if (signals.retirementOnlySavingConfirmed) {
    const kindNote =
      signals.retirementOnlyKind === 'employer_contribution'
        ? 'employer retirement contribution only'
        : signals.retirementOnlyKind === 'dollar_contribution'
          ? 'retirement dollar contribution only'
          : `retirement contribution band (${signals.retirementContributionBand ?? 'unknown'})`
    return {
      id: 'savings_rate',
      maxPoints,
      points: RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS,
      status: 'partial',
      explanation: `Retirement-only saving is confirmed (${kindNote}), but total household savings could not be verified (${RETIREMENT_ONLY_SAVINGS_PARTIAL_POINTS}/${maxPoints}).`,
    }
  }

  if (signals.ambiguousRetirementContribution) {
    return {
      id: 'savings_rate',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: retirement contribution evidence is ambiguous and does not establish a verified total household savings rate (0/4).',
    }
  }

  if (signals.hasSavingsBalanceOnly) {
    return {
      id: 'savings_rate',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'An account balance is recorded, but a balance alone is not a recurring savings contribution (0/4).',
    }
  }

  if (signals.hasDebtPaymentOnly) {
    return {
      id: 'savings_rate',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation: 'Debt payments are not counted as savings contributions (0/4).',
    }
  }

  if (signals.monthlyIncome != null && signals.monthlyIncome <= 0) {
    return {
      id: 'savings_rate',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Insufficient data: zero or negative income cannot be used as a savings-rate denominator.',
    }
  }

  return {
    id: 'savings_rate',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: record recurring household savings contributions (or an authoritative total household savings rate) to evaluate the savings rate.',
  }
}

/**
 * Expense Tracking Consistency (max 2).
 * Expense totals alone never prove tracking.
 */
export function scoreExpenseTrackingConsistency(
  signals: CashFlowBudgetSignals,
): CashFlowBudgetCriterionOutcome {
  const maxPoints = CASH_FLOW_BUDGET_CRITERION_MAX_POINTS.expense_tracking_consistency
  const raw = signals.expenseTrackingFrequencyRaw

  if (raw != null) {
    const normalized = normalizeFrequencyToken(raw)

    if (EXPENSE_TRACKING_FREQUENCY.met.some((alias) => alias === normalized)) {
      return {
        id: 'expense_tracking_consistency',
        maxPoints,
        points: maxPoints,
        status: 'met',
        explanation: `Spending is tracked or reviewed at least monthly (${normalized}) (2/2).`,
      }
    }
    if (EXPENSE_TRACKING_FREQUENCY.partial.some((alias) => alias === normalized)) {
      return {
        id: 'expense_tracking_consistency',
        maxPoints,
        points: 1,
        status: 'partial',
        explanation: `Spending is tracked occasionally or less than monthly (${normalized}) (1/2).`,
      }
    }
    if (EXPENSE_TRACKING_FREQUENCY.unmet.some((alias) => alias === normalized)) {
      return {
        id: 'expense_tracking_consistency',
        maxPoints,
        points: 0,
        status: 'unmet',
        explanation: `Spending is explicitly not tracked (${normalized}) (0/2).`,
      }
    }

    // Boolean-like tracksExpenses yes/no
    if (normalized === 'yes' || normalized === 'true' || normalized === 'tracked') {
      return {
        id: 'expense_tracking_consistency',
        maxPoints,
        points: maxPoints,
        status: 'met',
        explanation: 'Assessment indicates household expenses are tracked (2/2).',
      }
    }
    if (normalized === 'false') {
      return {
        id: 'expense_tracking_consistency',
        maxPoints,
        points: 0,
        status: 'unmet',
        explanation: 'Assessment indicates household expenses are not tracked (0/2).',
      }
    }
  }

  if (signals.hasExpenseTotalsWithoutTracking) {
    return {
      id: 'expense_tracking_consistency',
      maxPoints,
      points: 0,
      status: 'incomplete',
      explanation:
        'Expense totals are recorded, but totals alone do not prove consistent expense tracking or review (0/2).',
    }
  }

  return {
    id: 'expense_tracking_consistency',
    maxPoints,
    points: 0,
    status: 'incomplete',
    explanation:
      'Insufficient data: confirm how frequently household spending is reviewed or categorized.',
  }
}

export function scoreAllCashFlowBudgetCriteria(
  signals: CashFlowBudgetSignals,
): CashFlowBudgetCriterionOutcome[] {
  return [
    scoreMonthlyCashFlowPosition(signals),
    scoreBudgetingSystem(signals),
    scoreSavingsRate(signals),
    scoreExpenseTrackingConsistency(signals),
  ]
}

export function toCashFlowBudgetEvidence(
  outcomes: readonly CashFlowBudgetCriterionOutcome[],
): CriterionEvidence[] {
  return outcomes.map(toEvidence)
}

function recommendationForCriterion(
  outcome: CashFlowBudgetCriterionOutcome,
): Recommendation | null {
  if (outcome.status === 'not_applicable') return null
  if (outcome.status === 'met' && outcome.points >= outcome.maxPoints) return null

  const specs: Record<
    CashFlowBudgetCriterionId,
    { title: string; body: string; priority: ActionPriority; actionKey: string }
  > = {
    monthly_cash_flow_position: {
      title:
        outcome.status === 'incomplete'
          ? 'Record monthly income and expenses'
          : outcome.status === 'unmet'
            ? 'Restore positive monthly cash flow'
            : 'Increase the monthly cash flow margin',
      body:
        outcome.status === 'incomplete'
          ? 'Record monthly income and expenses to evaluate cash flow.'
          : outcome.status === 'unmet'
            ? 'Review spending and income to restore positive monthly cash flow.'
            : 'Increase the household’s monthly cash flow margin.',
      priority: outcome.status === 'incomplete' ? 'medium' : 'high',
      actionKey:
        outcome.status === 'incomplete'
          ? 'cashflow.record_income_expenses'
          : outcome.status === 'unmet'
            ? 'cashflow.restore_positive_flow'
            : 'cashflow.increase_margin',
    },
    budgeting_system: {
      title:
        outcome.status === 'unmet'
          ? 'Create a documented monthly spending plan'
          : outcome.status === 'incomplete'
            ? 'Confirm whether a documented budget is used'
            : 'Review and update the household budget consistently',
      body:
        outcome.status === 'unmet'
          ? 'Create a documented monthly spending plan.'
          : outcome.status === 'incomplete'
            ? 'Confirm whether the household uses a documented budget.'
            : 'Review and update the household budget consistently.',
      priority: 'medium',
      actionKey:
        outcome.status === 'unmet'
          ? 'cashflow.create_budget'
          : outcome.status === 'incomplete'
            ? 'cashflow.confirm_budget'
            : 'cashflow.review_budget_consistently',
    },
    savings_rate: {
      title:
        outcome.status === 'incomplete'
          ? 'Record recurring savings contributions'
          : outcome.status === 'unmet'
            ? 'Establish a consistent household savings contribution'
            : 'Increase the household savings rate',
      body:
        outcome.status === 'incomplete'
          ? 'Record recurring savings contributions to evaluate the savings rate.'
          : outcome.status === 'unmet'
            ? 'Establish a consistent household savings contribution.'
            : 'Increase the household savings rate as cash flow allows.',
      priority: 'medium',
      actionKey:
        outcome.status === 'incomplete'
          ? 'cashflow.record_savings_contributions'
          : outcome.status === 'unmet'
            ? 'cashflow.establish_savings'
            : 'cashflow.increase_savings_rate',
    },
    expense_tracking_consistency: {
      title:
        outcome.status === 'unmet'
          ? 'Begin monthly expense review'
          : outcome.status === 'incomplete'
            ? 'Confirm expense-review frequency'
            : 'Establish a consistent monthly expense-review routine',
      body:
        outcome.status === 'unmet'
          ? 'Begin reviewing and categorizing household expenses each month.'
          : outcome.status === 'incomplete'
            ? 'Confirm how frequently household spending is reviewed.'
            : 'Establish a consistent monthly expense-review routine.',
      priority: 'medium',
      actionKey:
        outcome.status === 'unmet'
          ? 'cashflow.begin_monthly_expense_review'
          : outcome.status === 'incomplete'
            ? 'cashflow.confirm_expense_tracking'
            : 'cashflow.establish_monthly_expense_review',
    },
  }

  const spec = specs[outcome.id]
  return {
    id: `${CASH_FLOW_BUDGET_CATEGORY_ID}:${spec.actionKey}`,
    categoryId: CASH_FLOW_BUDGET_CATEGORY_ID,
    title: spec.title,
    body: spec.body,
    priority: spec.priority,
    actionKey: spec.actionKey,
  }
}

export function buildCashFlowBudgetRecommendations(
  outcomes: readonly CashFlowBudgetCriterionOutcome[],
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

export function summarizeCashFlowBudgetScore(
  outcomes: readonly CashFlowBudgetCriterionOutcome[],
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
        'Cash Flow & Budget: insufficient data to score criteria. Record income, expenses, budgeting habits, savings contributions, and expense-tracking frequency.',
    }
  }

  const earned = Math.min(
    15,
    outcomes.reduce((sum, outcome) => sum + outcome.points, 0),
  )
  const available = outcomes.reduce((sum, outcome) => sum + outcome.maxPoints, 0)
  const incomplete = outcomes.filter((outcome) => outcome.status === 'incomplete').length
  const partial = outcomes.filter((outcome) => outcome.status === 'partial').length
  const belowFull = outcomes.filter(
    (outcome) =>
      outcome.status !== 'incomplete' &&
      outcome.status !== 'not_applicable' &&
      outcome.points < outcome.maxPoints,
  ).length

  const parts = [`Cash Flow & Budget scored ${earned} of ${available} points.`]
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
