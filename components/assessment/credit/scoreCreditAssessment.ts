/**
 * Deterministic Valtoris Credit Report Card Score.
 * Uses canonical Phase A diagnostic values only. Never reads translated labels.
 * Contact, urgency, and prior actions do not change the numeric score.
 * Does not imply bureau accuracy, deletion, approval, or a future FICO change.
 */

import type { CreditDiagnosticAnswers } from './types'

export const CREDIT_SCORING_VERSION = 1

export const CREDIT_CATEGORY_WEIGHTS = {
  payment_history: 24,
  negative_items: 18,
  utilization: 14,
  financial_stability: 12,
  credit_structure: 10,
  recent_credit: 8,
  report_review: 8,
  self_reported_score: 6,
} as const

export type CreditCategoryId = keyof typeof CREDIT_CATEGORY_WEIGHTS

export const CREDIT_CATEGORY_IDS = [
  'payment_history',
  'negative_items',
  'utilization',
  'financial_stability',
  'credit_structure',
  'recent_credit',
  'report_review',
  'self_reported_score',
] as const satisfies readonly CreditCategoryId[]

export type CreditGradeLetter = 'A' | 'B' | 'C' | 'D' | 'F'

export type CreditGradeResult = {
  readonly grade: CreditGradeLetter
  readonly statusLabelKey: string
}

export type CreditFlagSeverity =
  | 'immediate_review'
  | 'high_priority'
  | 'potential_opportunity'
  | 'review_recommended'

export const CREDIT_FLAG_SEVERITY_ORDER: readonly CreditFlagSeverity[] = [
  'immediate_review',
  'high_priority',
  'potential_opportunity',
  'review_recommended',
]

export type CreditCriticalFlag = {
  readonly id: string
  readonly severity: CreditFlagSeverity
  readonly labelKey: string
  readonly categoryId: CreditCategoryId
}

export type CreditReviewArea = {
  readonly id: string
  readonly categoryId: CreditCategoryId
  readonly titleKey: string
  readonly explanationKey: string
  readonly severity: CreditFlagSeverity
}

export type CreditCategoryPoints = {
  readonly id: CreditCategoryId
  readonly labelKey: string
  readonly score: number
  readonly max: number
}

export type CreditScoreResult = {
  readonly overallScore: number
  readonly grade: CreditGradeLetter
  readonly statusLabelKey: string
  readonly categories: readonly CreditCategoryPoints[]
  readonly flags: readonly CreditCriticalFlag[]
  readonly reviewAreas: readonly CreditReviewArea[]
  readonly scoringVersion: number
}

const SIGNIFICANT_NEGATIVES = new Set([
  'collections',
  'charge_offs',
  'repossession',
  'foreclosure',
  'bankruptcy',
])
const SEVERE_NEGATIVES = new Set(['repossession', 'foreclosure', 'bankruptcy'])
const TIME_SENSITIVE_GOALS = new Set(['buy_home', 'vehicle', 'rent', 'business_financing'])

function clampScore(value: number, max: number): number {
  if (value < 0) return 0
  if (value > max) return max
  return Math.round(value)
}

export function creditScoreToGrade(score: number): CreditGradeResult {
  const rounded = Math.round(score)
  if (rounded >= 90) return { grade: 'A', statusLabelKey: 'status.strong' }
  if (rounded >= 80) return { grade: 'B', statusLabelKey: 'status.solid' }
  if (rounded >= 70) return { grade: 'C', statusLabelKey: 'status.review_recommended' }
  if (rounded >= 60) return { grade: 'D', statusLabelKey: 'status.needs_review' }
  return { grade: 'F', statusLabelKey: 'status.high_priority' }
}

function scorePaymentHistory(diagnostic: CreditDiagnosticAnswers): number {
  let late = 0
  if (diagnostic.late_recent === 'none') late = 12
  else if (diagnostic.late_recent === '30_days') late = 7
  else if (diagnostic.late_recent === '60_days') late = 4
  else if (diagnostic.late_recent === '90_plus') late = 1
  else if (diagnostic.late_recent === 'not_sure') late = 5

  let consistency = 0
  if (diagnostic.payment_consistency === 'on_time') consistency = 12
  else if (diagnostic.payment_consistency === 'mostly_on_time') consistency = 8
  else if (diagnostic.payment_consistency === 'missed_some') consistency = 4
  else if (diagnostic.payment_consistency === 'currently_behind') consistency = 1
  else if (diagnostic.payment_consistency === 'not_sure') consistency = 5

  return clampScore(late + consistency, CREDIT_CATEGORY_WEIGHTS.payment_history)
}

function scoreNegativeItems(diagnostic: CreditDiagnosticAnswers): number {
  const items = diagnostic.negative_items
  if (items.length === 1 && items[0] === 'none') return CREDIT_CATEGORY_WEIGHTS.negative_items
  if (items.length === 1 && items[0] === 'not_sure') return 8

  let score = 8
  if (items.includes('collections')) score -= 5
  if (items.includes('charge_offs')) score -= 5
  if (items.includes('repossession')) score -= 6
  if (items.includes('foreclosure')) score -= 6
  if (items.includes('bankruptcy')) score -= 8
  if (items.includes('other_derogatory')) score -= 3
  return clampScore(score, CREDIT_CATEGORY_WEIGHTS.negative_items)
}

function scoreUtilization(diagnostic: CreditDiagnosticAnswers): number {
  if (diagnostic.utilization === 'under_10') return 14
  if (diagnostic.utilization === '10_30') return 12
  if (diagnostic.utilization === '30_50') return 8
  if (diagnostic.utilization === '50_75') return 5
  if (diagnostic.utilization === '75_plus') return 2
  if (diagnostic.utilization === 'maxed') return 0
  if (diagnostic.utilization === 'not_sure') return 7
  return 0
}

function scoreFinancialStability(diagnostic: CreditDiagnosticAnswers): number {
  let minimums = 0
  if (diagnostic.minimums === 'comfortable') minimums = 6
  else if (diagnostic.minimums === 'sometimes_difficult') minimums = 3
  else if (diagnostic.minimums === 'struggling') minimums = 1
  else if (diagnostic.minimums === 'not_sure') minimums = 3

  let status = 0
  if (diagnostic.current_status === 'current') status = 6
  else if (diagnostic.current_status === 'past_due') status = 0
  else if (diagnostic.current_status === 'not_sure') status = 3

  return clampScore(minimums + status, CREDIT_CATEGORY_WEIGHTS.financial_stability)
}

function scoreCreditStructure(diagnostic: CreditDiagnosticAnswers): number {
  let revolving = 0
  if (diagnostic.open_revolving === '1_2' || diagnostic.open_revolving === '3_5') revolving = 5
  else if (diagnostic.open_revolving === '6_plus') revolving = 4
  else if (diagnostic.open_revolving === '0') revolving = 3
  else if (diagnostic.open_revolving === 'not_sure') revolving = 2

  let age = 0
  if (diagnostic.oldest_account === '10_plus') age = 5
  else if (diagnostic.oldest_account === '5_10') age = 4
  else if (diagnostic.oldest_account === '2_5') age = 3
  else if (diagnostic.oldest_account === 'under_2') age = 2
  else if (diagnostic.oldest_account === 'not_sure') age = 2

  return clampScore(revolving + age, CREDIT_CATEGORY_WEIGHTS.credit_structure)
}

function scoreRecentCredit(diagnostic: CreditDiagnosticAnswers): number {
  let inquiries = 0
  if (diagnostic.hard_inquiries === 'none') inquiries = 4
  else if (diagnostic.hard_inquiries === '1_2') inquiries = 3
  else if (diagnostic.hard_inquiries === '3_5') inquiries = 2
  else if (diagnostic.hard_inquiries === '6_plus') inquiries = 0
  else if (diagnostic.hard_inquiries === 'not_sure') inquiries = 2

  let opened = 0
  if (diagnostic.new_accounts === 'none') opened = 4
  else if (diagnostic.new_accounts === 'one') opened = 3
  else if (diagnostic.new_accounts === 'several') opened = 1
  else if (diagnostic.new_accounts === 'not_sure') opened = 2

  return clampScore(inquiries + opened, CREDIT_CATEGORY_WEIGHTS.recent_credit)
}

function scoreReportReview(diagnostic: CreditDiagnosticAnswers): number {
  let reviewed = 0
  if (diagnostic.last_reviewed === 'last_30_days') reviewed = 4
  else if (diagnostic.last_reviewed === 'last_6_months' || diagnostic.last_reviewed === 'last_year') {
    reviewed = 3
  } else if (diagnostic.last_reviewed === 'more_than_year') reviewed = 2
  else if (diagnostic.last_reviewed === 'never') reviewed = 1
  else if (diagnostic.last_reviewed === 'not_sure') reviewed = 2

  let belief = 0
  if (diagnostic.last_reviewed === 'never') {
    belief = 0
  } else if (diagnostic.inaccuracy_belief === 'no') {
    belief = 4
  } else if (diagnostic.inaccuracy_belief === 'yes' || diagnostic.inaccuracy_belief === 'not_sure') {
    belief = 2
  }

  return clampScore(reviewed + belief, CREDIT_CATEGORY_WEIGHTS.report_review)
}

function scoreSelfReported(diagnostic: CreditDiagnosticAnswers): number {
  if (diagnostic.self_reported_score === '740_plus') return 6
  if (diagnostic.self_reported_score === '700_739') return 5
  if (diagnostic.self_reported_score === '660_699') return 4
  if (diagnostic.self_reported_score === '620_659') return 3
  if (diagnostic.self_reported_score === '580_619') return 2
  if (diagnostic.self_reported_score === 'below_580') return 1
  if (diagnostic.self_reported_score === 'not_sure') return 3
  return 0
}

export function collectCreditFlags(diagnostic: CreditDiagnosticAnswers): CreditCriticalFlag[] {
  const flags: CreditCriticalFlag[] = []

  if (diagnostic.current_status === 'past_due' || diagnostic.payment_consistency === 'currently_behind') {
    flags.push({
      id: 'flag_past_due',
      severity: 'immediate_review',
      labelKey: 'flag.immediate_review',
      categoryId: 'financial_stability',
    })
  }

  if (diagnostic.late_recent === '90_plus' || diagnostic.late_recent === '60_days') {
    flags.push({
      id: 'flag_severe_lates',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'payment_history',
    })
  } else if (diagnostic.late_recent === '30_days' || diagnostic.payment_consistency === 'missed_some') {
    flags.push({
      id: 'flag_recent_lates',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'payment_history',
    })
  }

  const negatives = diagnostic.negative_items.filter((value) => SIGNIFICANT_NEGATIVES.has(value))
  if (negatives.some((value) => SEVERE_NEGATIVES.has(value))) {
    flags.push({
      id: 'flag_severe_negatives',
      severity: 'immediate_review',
      labelKey: 'flag.immediate_review',
      categoryId: 'negative_items',
    })
  } else if (negatives.length > 0) {
    flags.push({
      id: 'flag_negative_items',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'negative_items',
    })
  } else if (diagnostic.negative_items.includes('other_derogatory')) {
    flags.push({
      id: 'flag_other_derogatory',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'negative_items',
    })
  } else if (diagnostic.negative_items.includes('not_sure')) {
    flags.push({
      id: 'flag_unknown_negatives',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'negative_items',
    })
  }

  if (diagnostic.utilization === 'maxed' || diagnostic.utilization === '75_plus') {
    flags.push({
      id: 'flag_high_utilization',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'utilization',
    })
  } else if (diagnostic.utilization === '50_75') {
    flags.push({
      id: 'flag_elevated_utilization',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'utilization',
    })
  }

  if (diagnostic.hard_inquiries === '6_plus' || diagnostic.new_accounts === 'several') {
    flags.push({
      id: 'flag_recent_applications',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'recent_credit',
    })
  }

  if (diagnostic.last_reviewed === 'never' || diagnostic.last_reviewed === 'not_sure') {
    flags.push({
      id: 'flag_report_uncertainty',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'report_review',
    })
  } else if (diagnostic.inaccuracy_belief === 'yes' || diagnostic.inaccuracy_belief === 'not_sure') {
    flags.push({
      id: 'flag_report_concern',
      severity: 'potential_opportunity',
      labelKey: 'flag.potential_opportunity',
      categoryId: 'report_review',
    })
  }

  if (diagnostic.minimums === 'struggling') {
    flags.push({
      id: 'flag_payment_strain',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'financial_stability',
    })
  }

  const seen = new Set<string>()
  return flags.filter((flag) => {
    if (seen.has(flag.id)) return false
    seen.add(flag.id)
    return true
  })
}

function severityRank(severity: CreditFlagSeverity): number {
  return CREDIT_FLAG_SEVERITY_ORDER.indexOf(severity)
}

function reviewAreaForFlag(flag: CreditCriticalFlag): CreditReviewArea {
  return {
    id: `review_${flag.id}`,
    categoryId: flag.categoryId,
    titleKey: `review.${flag.id}.title`,
    explanationKey: `review.${flag.id}.body`,
    severity: flag.severity,
  }
}

function reviewAreaForCategory(category: CreditCategoryPoints): CreditReviewArea {
  const ratio = category.max === 0 ? 1 : category.score / category.max
  const severity: CreditFlagSeverity = ratio < 0.4 ? 'high_priority' : 'review_recommended'
  return {
    id: `review_category_${category.id}`,
    categoryId: category.id,
    titleKey: `review.category.${category.id}.title`,
    explanationKey: `review.category.${category.id}.body`,
    severity,
  }
}

export function selectCreditReviewAreas(
  flags: readonly CreditCriticalFlag[],
  categories: readonly CreditCategoryPoints[],
  diagnostic: CreditDiagnosticAnswers,
): CreditReviewArea[] {
  const selected: CreditReviewArea[] = []
  const usedCategories = new Set<CreditCategoryId>()

  const sortedFlags = [...flags].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
  for (const flag of sortedFlags) {
    if (selected.length >= 3) break
    selected.push(reviewAreaForFlag(flag))
    usedCategories.add(flag.categoryId)
  }

  const imperfectCategories = [...categories]
    .filter((category) => !usedCategories.has(category.id) && category.score < category.max)
    .sort((a, b) => {
      const aRatio = a.max === 0 ? 1 : a.score / a.max
      const bRatio = b.max === 0 ? 1 : b.score / b.max
      if (aRatio !== bRatio) return aRatio - bRatio
      if (a.max !== b.max) return b.max - a.max
      return a.id.localeCompare(b.id)
    })

  for (const category of imperfectCategories) {
    if (selected.length >= 3) break
    selected.push(reviewAreaForCategory(category))
    usedCategories.add(category.id)
  }

  const hasRealIssue = flags.length > 0 || imperfectCategories.length > 0
  const timingSensitive =
    (diagnostic.urgency === 'asap' || diagnostic.urgency === 'within_30_days') &&
    TIME_SENSITIVE_GOALS.has(diagnostic.credit_goal)
  if (
    selected.length < 3 &&
    hasRealIssue &&
    timingSensitive &&
    !usedCategories.has('report_review')
  ) {
    selected.push({
      id: 'review_goal_timing',
      categoryId: 'report_review',
      titleKey: 'review.goal_timing.title',
      explanationKey: 'review.goal_timing.body',
      severity: 'review_recommended',
    })
  }

  return selected.slice(0, 3)
}

export function scoreCreditAssessment(diagnostic: CreditDiagnosticAnswers): CreditScoreResult {
  const categories: CreditCategoryPoints[] = [
    {
      id: 'payment_history',
      labelKey: 'category.payment_history',
      score: scorePaymentHistory(diagnostic),
      max: CREDIT_CATEGORY_WEIGHTS.payment_history,
    },
    {
      id: 'negative_items',
      labelKey: 'category.negative_items',
      score: scoreNegativeItems(diagnostic),
      max: CREDIT_CATEGORY_WEIGHTS.negative_items,
    },
    {
      id: 'utilization',
      labelKey: 'category.utilization',
      score: scoreUtilization(diagnostic),
      max: CREDIT_CATEGORY_WEIGHTS.utilization,
    },
    {
      id: 'financial_stability',
      labelKey: 'category.financial_stability',
      score: scoreFinancialStability(diagnostic),
      max: CREDIT_CATEGORY_WEIGHTS.financial_stability,
    },
    {
      id: 'credit_structure',
      labelKey: 'category.credit_structure',
      score: scoreCreditStructure(diagnostic),
      max: CREDIT_CATEGORY_WEIGHTS.credit_structure,
    },
    {
      id: 'recent_credit',
      labelKey: 'category.recent_credit',
      score: scoreRecentCredit(diagnostic),
      max: CREDIT_CATEGORY_WEIGHTS.recent_credit,
    },
    {
      id: 'report_review',
      labelKey: 'category.report_review',
      score: scoreReportReview(diagnostic),
      max: CREDIT_CATEGORY_WEIGHTS.report_review,
    },
    {
      id: 'self_reported_score',
      labelKey: 'category.self_reported_score',
      score: scoreSelfReported(diagnostic),
      max: CREDIT_CATEGORY_WEIGHTS.self_reported_score,
    },
  ]

  const overallScore = clampScore(
    categories.reduce((sum, category) => sum + category.score, 0),
    100,
  )
  const { grade, statusLabelKey } = creditScoreToGrade(overallScore)
  const flags = collectCreditFlags(diagnostic)
  const reviewAreas = selectCreditReviewAreas(flags, categories, diagnostic)

  return {
    overallScore,
    grade,
    statusLabelKey,
    categories,
    flags,
    reviewAreas,
    scoringVersion: CREDIT_SCORING_VERSION,
  }
}
