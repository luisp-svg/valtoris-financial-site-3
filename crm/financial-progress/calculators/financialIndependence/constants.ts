/**
 * Financial Independence criterion budgets (sum = 5).
 *
 * 1. Goal Definition ........................ 1
 * 2. Target ................................. 1
 * 3. Progress Toward Target ................. 2
 * 4. Funding Strategy & Progress Tracking ... 1
 *
 * Educational / planning-oriented only — not a projection or guarantee.
 */
export const FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS = {
  fi_goal_definition: 1,
  fi_target: 1,
  fi_progress_toward_target: 2,
  fi_funding_strategy_tracking: 1,
} as const

export type FinancialIndependenceCriterionId =
  keyof typeof FINANCIAL_INDEPENDENCE_CRITERION_MAX_POINTS

export const FINANCIAL_INDEPENDENCE_CRITERION_LABELS: Record<
  FinancialIndependenceCriterionId,
  string
> = {
  fi_goal_definition: 'Financial Independence Goal Definition',
  fi_target: 'Financial Independence Target',
  fi_progress_toward_target: 'Progress Toward Target',
  fi_funding_strategy_tracking: 'Funding Strategy & Progress Tracking',
}

export const FINANCIAL_INDEPENDENCE_CATEGORY_ID = 'financial_independence' as const

/**
 * Progress ratio bands (eligible assets ÷ target).
 * ≥75% → 2 | ≥25% and <75% → 1 | ≥0% and <25% → 0
 */
export const FI_PROGRESS_MET_RATIO = 0.75
export const FI_PROGRESS_PARTIAL_RATIO = 0.25

/**
 * Material disagreement between explicit and derived FI targets (percent).
 * Relative difference above this → incomplete target evidence.
 */
export const FI_TARGET_CONFLICT_TOLERANCE_PERCENT = 10

/** Plan-review freshness window relative to `input.asOf` (inclusive). */
export const FI_PLAN_REVIEW_CURRENT_MONTHS = 12

/**
 * Withdrawal-rate field aliases by documented unit semantics.
 * Generic fields must not be magnitude-guessed into percent vs decimal.
 */
export const FI_WITHDRAWAL_RATE_DECIMAL_ALIASES = [
  'fiWithdrawalRateDecimal',
  'fi_withdrawal_rate_decimal',
] as const

export const FI_WITHDRAWAL_RATE_PERCENT_ALIASES = [
  'fiWithdrawalRatePercent',
  'fi_withdrawal_rate_percent',
] as const

/** Generic rate fields — numeric values accepted only when already decimal in (0, 1]. */
export const FI_WITHDRAWAL_RATE_GENERIC_ALIASES = [
  'fiWithdrawalRate',
  'fi_withdrawal_rate',
  'withdrawalRate',
  'withdrawal_rate',
] as const

/** Absolute decimal tolerance for treating two normalized rates as equivalent. */
export const FI_WITHDRAWAL_RATE_EQUIVALENCE_EPSILON = 1e-6

/**
 * Authoritative goal-definition field aliases.
 * Vague wealth/savings desires are handled separately and do not score.
 */
export const FI_GOAL_YES_ALIASES = [
  'financialIndependenceGoalDocumented',
  'financial_independence_goal_documented',
  'hasFinancialIndependenceGoal',
  'has_financial_independence_goal',
  'fiGoalDocumented',
  'fi_goal_documented',
  'workOptionalGoalDocumented',
  'work_optional_goal_documented',
  'passiveIncomeObjectiveDocumented',
  'passive_income_objective_documented',
  'financialIndependenceDefined',
  'financial_independence_defined',
] as const

export const FI_GOAL_NARRATIVE_ALIASES = [
  'financialIndependenceGoal',
  'financial_independence_goal',
  'fiGoalNarrative',
  'fi_goal_narrative',
  'workOptionalObjective',
  'work_optional_objective',
  'passiveIncomeObjective',
  'passive_income_objective',
] as const

export const FI_TARGET_ALIASES = [
  'financialIndependenceTarget',
  'financial_independence_target',
  'fiTarget',
  'fi_target',
  'fiNumber',
  'fi_number',
  'requiredInvestmentAssetsTarget',
  'required_investment_assets_target',
  'passiveIncomeAssetTarget',
  'passive_income_asset_target',
  'retirementAssetTarget',
  'retirement_asset_target',
  'documentedRetirementAssetTarget',
  'targetRetirementAssets',
] as const

export const FI_ELIGIBLE_ASSET_TOTAL_ALIASES = [
  'fiEligibleAssets',
  'fi_eligible_assets',
  'financialIndependenceEligibleAssets',
  'investableAssetsForFi',
  'investable_assets_for_fi',
  'structuredInvestableAssetTotal',
  'structured_investable_asset_total',
] as const

export const FI_STRATEGY_YES_ALIASES = [
  'fiFundingStrategyDocumented',
  'fi_funding_strategy_documented',
  'financialIndependenceStrategyDocumented',
  'hasFiFundingPlan',
  'has_fi_funding_plan',
  'fiProgressTrackingDocumented',
  'fi_progress_tracking_documented',
  'fiMilestoneScheduleDocumented',
  'fi_milestone_schedule_documented',
  'passiveIncomeStrategyDocumented',
  'passive_income_strategy_documented',
  'retirementPlanTiedToFi',
  'retirement_plan_tied_to_fi',
] as const
