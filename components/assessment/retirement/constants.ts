export const RETIREMENT_ANSWERS_STORAGE_KEY = 'valtoris-retirement-answers'

export const RETIREMENT_ASSESSMENT_STEPS = 9

export const CONTACT_METHOD_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone call' },
  { value: 'text', label: 'Text message' },
  { value: 'either', label: 'Email or phone — whichever is convenient' },
] as const

export const CONTACT_TIME_OPTIONS = [
  { value: 'morning', label: 'Morning (8am–12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm–5pm)' },
  { value: 'evening', label: 'Evening (5pm–8pm)' },
  { value: 'anytime', label: 'Anytime' },
] as const

/** Default projection assumptions used by scoring (not user-editable in Phase 1). */
export const RETIREMENT_PROJECTION_ASSUMPTIONS = {
  inflation: 0.03,
  preRetirementGrowth: 0.06,
  retirementReturn: 0.045,
  withdrawalRate: 0.04,
  longevityAge: 95,
  /** Fallback when estimated monthly retirement spending is not provided. */
  incomeReplacementFallback: 0.8,
} as const

/** Category weights as percentages of overall score (sum = 100). */
export const RETIREMENT_CATEGORY_WEIGHTS = {
  vision: 10,
  savings: 15,
  'income-sources': 15,
  'income-adequacy': 20,
  investments: 10,
  tax: 10,
  healthcare: 10,
  estate: 10,
} as const

export type RetirementCategoryId = keyof typeof RETIREMENT_CATEGORY_WEIGHTS

export const RETIREMENT_CATEGORY_IDS = Object.keys(
  RETIREMENT_CATEGORY_WEIGHTS,
) as RetirementCategoryId[]

export const ALREADY_RETIRED_OPTIONS = [
  { value: 'yes', label: 'Yes — I am already retired' },
  { value: 'no', label: 'No — I am still working toward retirement' },
] as const

export const RETIREMENT_LIFESTYLE_OPTIONS = [
  { value: 'essential', label: 'Essential / needs-focused' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'affluent', label: 'Affluent' },
  { value: 'luxury', label: 'Luxury / dream lifestyle' },
] as const

export const RETIREMENT_PLAN_CLARITY_OPTIONS = [
  { value: 'very-clear', label: 'Very clear written plan' },
  { value: 'somewhat-clear', label: 'Somewhat clear direction' },
  { value: 'unclear', label: 'Unclear / still figuring it out' },
  { value: 'no-plan', label: 'No plan yet' },
] as const

export const RETIREMENT_PRIMARY_MOTIVATION_OPTIONS = [
  { value: 'income-security', label: 'Secure lifetime income' },
  { value: 'leave-workforce', label: 'Leave the workforce on my terms' },
  { value: 'travel-lifestyle', label: 'Travel and lifestyle freedom' },
  { value: 'family-legacy', label: 'Support family and leave a legacy' },
  { value: 'reduce-stress', label: 'Reduce financial stress' },
] as const

export const EMPLOYER_MATCH_OPTIONS = [
  { value: 'full-match', label: 'Yes — I capture the full match' },
  { value: 'partial-match', label: 'Yes — but I do not capture the full match' },
  { value: 'no-match-offered', label: 'No employer match offered' },
  { value: 'not-participating', label: 'Match available, but I am not participating' },
  { value: 'self-employed', label: 'Self-employed / no employer plan' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const CONTRIBUTION_CONSISTENCY_OPTIONS = [
  { value: 'always', label: 'Every paycheck / always' },
  { value: 'most-months', label: 'Most months' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'not-saving', label: 'Not currently contributing' },
] as const

export const YES_NO_UNSURE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const YES_NO_NA_UNSURE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'Not applicable' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const EXPECTS_PART_TIME_OPTIONS = [
  { value: 'yes', label: 'Yes — expecting temporary part-time or consulting income' },
  { value: 'no', label: 'No' },
] as const

export const DEBT_BURDEN_OPTIONS = [
  { value: 'none', label: 'No meaningful consumer debt' },
  { value: 'low', label: 'Low — manageable payments' },
  { value: 'moderate', label: 'Moderate — limits flexibility' },
  { value: 'high', label: 'High — creates pressure' },
] as const

export const RISK_TOLERANCE_OPTIONS = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'growth', label: 'Growth-oriented' },
  { value: 'aggressive', label: 'Aggressive' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const DIVERSIFICATION_OPTIONS = [
  { value: 'well-diversified', label: 'Well diversified across asset classes' },
  { value: 'somewhat', label: 'Somewhat diversified' },
  { value: 'concentrated', label: 'Concentrated in a few holdings' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const ALLOCATION_REVIEW_OPTIONS = [
  { value: 'within-year', label: 'Reviewed within the last year' },
  { value: '1-3-years', label: '1–3 years ago' },
  { value: 'over-3-years', label: 'More than 3 years ago' },
  { value: 'never', label: 'Never formally reviewed' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const RETIREMENT_ACCOUNT_TYPE_OPTIONS = [
  { value: 'traditional', label: 'Traditional 401(k) / IRA' },
  { value: 'roth', label: 'Roth 401(k) / Roth IRA' },
  { value: 'taxable', label: 'Taxable brokerage' },
  { value: 'hsa', label: 'HSA' },
  { value: 'pension', label: 'Pension / defined benefit' },
  { value: 'annuity', label: 'Annuity' },
  { value: 'none', label: 'No retirement accounts yet' },
] as const

export const TAX_PLANNING_OPTIONS = [
  { value: 'proactive', label: 'Proactive multi-year tax planning' },
  { value: 'annual-review', label: 'Annual review with limited planning' },
  { value: 'compliance-only', label: 'File and pay only' },
  { value: 'none', label: 'No tax planning for retirement' },
] as const

export const ROTH_USAGE_OPTIONS = [
  { value: 'regular', label: 'Regular Roth contributions or conversions' },
  { value: 'some', label: 'Some Roth balance, infrequent additions' },
  { value: 'none', label: 'No Roth assets' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const MEDICARE_READINESS_OPTIONS = [
  { value: 'researched', label: 'Researched / enrollment plan ready' },
  { value: 'somewhat', label: 'Somewhat familiar' },
  { value: 'not-yet', label: 'Not yet explored' },
  { value: 'already-enrolled', label: 'Already enrolled in Medicare' },
  { value: 'years-away', label: 'Years away — not applicable yet' },
] as const

export const LONG_TERM_CARE_OPTIONS = [
  { value: 'has-coverage', label: 'Has LTC insurance or funded plan' },
  { value: 'self-fund', label: 'Plan to self-fund from assets' },
  { value: 'family-support', label: 'Expect family support' },
  { value: 'no-plan', label: 'No plan yet' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const LEGACY_INTENT_OPTIONS = [
  { value: 'strong', label: 'Strong legacy / inheritance goals' },
  { value: 'moderate', label: 'Moderate — leave something if possible' },
  { value: 'spend-down', label: 'Prefer to spend down assets' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const RETIREMENT_GOAL_OPTIONS = [
  { value: 'close-income-gap', label: 'Close my retirement income gap' },
  { value: 'increase-savings', label: 'Increase savings rate' },
  { value: 'diversify-taxes', label: 'Improve tax diversification' },
  { value: 'reduce-investment-risk', label: 'Align investment risk' },
  { value: 'plan-healthcare', label: 'Plan healthcare & long-term care' },
  { value: 'protect-legacy', label: 'Protect beneficiaries & legacy' },
  { value: 'clarify-timeline', label: 'Clarify retirement timeline' },
  { value: 'maximize-income-sources', label: 'Maximize income sources' },
] as const
