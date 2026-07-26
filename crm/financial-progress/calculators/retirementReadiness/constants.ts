/**
 * Retirement Readiness criterion budgets (sum = 15).
 *
 * 1. Retirement Contribution Activity .... 4
 * 2. Employer Match Utilization .......... 3
 * 3. Retirement Savings Progress ......... 5
 * 4. Retirement Plan & Goal Definition ... 3
 */
export const RETIREMENT_READINESS_CRITERION_MAX_POINTS = {
  retirement_contribution_activity: 4,
  employer_match_utilization: 3,
  retirement_savings_progress: 5,
  retirement_plan_goal_definition: 3,
} as const

export type RetirementReadinessCriterionId =
  keyof typeof RETIREMENT_READINESS_CRITERION_MAX_POINTS

export const RETIREMENT_READINESS_CRITERION_LABELS: Record<
  RetirementReadinessCriterionId,
  string
> = {
  retirement_contribution_activity: 'Retirement Contribution Activity',
  employer_match_utilization: 'Employer Match Utilization',
  retirement_savings_progress: 'Retirement Savings Progress',
  retirement_plan_goal_definition: 'Retirement Plan & Goal Definition',
}

export const RETIREMENT_READINESS_CATEGORY_ID = 'retirement_readiness' as const

/**
 * Relative tolerance for monthly/annual, derived-vs-raw, and rate/amount conflicts.
 * |a − b| / max(|a|, |b|, ε) ≤ 0.10 → consistent.
 */
export const RETIREMENT_SOURCE_CONFLICT_TOLERANCE = 0.1

/**
 * Contribution-rate bands (employee/household retirement contribution ÷ income).
 * Evaluated from highest threshold first.
 */
export const RETIREMENT_CONTRIBUTION_RATE_BANDS = [
  { minRateInclusive: 0.15, points: 4, status: 'met' as const, label: '≥15%' },
  { minRateInclusive: 0.1, points: 3, status: 'partial' as const, label: '10% to <15%' },
  { minRateInclusive: 0.05, points: 2, status: 'partial' as const, label: '5% to <10%' },
  { minRateInclusive: Number.MIN_VALUE, points: 1, status: 'partial' as const, label: '>0% to <5%' },
] as const

/**
 * Fallback when retirement saving is confirmed but a verified rate cannot be calculated.
 * Coded bands (e.g. over-15) never map to full rate bands.
 */
export const RETIREMENT_CONTRIBUTION_ACTIVITY_CONFIRMED_POINTS = 1

/**
 * Funding / income progress ratio bands.
 * Evaluated from highest threshold first.
 */
export const RETIREMENT_PROGRESS_RATIO_BANDS = [
  { minRatioInclusive: 1, points: 5, status: 'met' as const, label: '≥100%' },
  { minRatioInclusive: 0.75, points: 4, status: 'partial' as const, label: '75% to <100%' },
  { minRatioInclusive: 0.5, points: 3, status: 'partial' as const, label: '50% to <75%' },
  { minRatioInclusive: 0.25, points: 2, status: 'partial' as const, label: '25% to <50%' },
  { minRatioInclusive: Number.MIN_VALUE, points: 1, status: 'partial' as const, label: '>0% to <25%' },
] as const

/** Plausible target retirement age bounds (inclusive). No default age is invented. */
export const RETIREMENT_AGE_PLAUSIBLE_MIN = 40
export const RETIREMENT_AGE_PLAUSIBLE_MAX = 100

/**
 * Family-assessment retirementContribution bands that confirm some retirement saving
 * without establishing a verified numeric contribution rate.
 */
export const FAMILY_RETIREMENT_SAVING_BANDS = [
  'under-3',
  '3-5',
  '6-10',
  '11-15',
  'over-15',
] as const

export const FAMILY_RETIREMENT_NOT_SAVING_BAND = 'not-saving' as const

/**
 * Retirement-assessment employerMatch values.
 * Affirmative no-match / self-employed → not_applicable.
 */
export const EMPLOYER_MATCH_STATUS = {
  full: ['full-match', 'full_match', 'full'],
  partial: ['partial-match', 'partial_match', 'partial'],
  unused: ['not-participating', 'not_participating', 'none-captured', 'zero-match'],
  notApplicable: [
    'no-match-offered',
    'no_match_offered',
    'no-match',
    'self-employed',
    'self_employed',
    'unemployed',
    'not-employed',
    'not_employed',
  ],
  unknown: ['unsure', 'unknown', 'not-sure'],
} as const

/**
 * planClarity values that satisfy the documented-strategy element.
 * Assessment semantics: "very-clear" = "Very clear written plan".
 * "somewhat-clear" alone is directional interest only — not a documented strategy.
 */
export const DOCUMENTED_PLAN_CLARITY = ['very-clear', 'very_clear'] as const

/** Directional clarity that does not earn the strategy point by itself. */
export const DIRECTIONAL_PLAN_CLARITY = ['somewhat-clear', 'somewhat_clear'] as const

/** planClarity values that explicitly deny a plan (for unmet aggregation). */
export const EXPLICIT_NO_PLAN_CLARITY = ['no-plan', 'no_plan'] as const
