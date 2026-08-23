/**
 * Deterministic Valtoris Student Loan Report Card Score.
 * Uses canonical answer values only. Never reads translated labels.
 * Does not infer federal eligibility, payment, forgiveness, or savings.
 *
 * Plan scoring is plan-neutral: recognized configured plan / other / not sure.
 * Adding rap or tiered_standard only expands the recognized-configured set.
 * Do not award or deduct points because one federal plan is "better."
 * Reverify federal repayment terminology before future launches or major edits.
 */

import { STUDENT_LOAN_REPAYMENT_PLAN_VALUES } from './repaymentPlans.js'
import type { StudentLoanDiagnosticAnswers } from './types'

export const STUDENT_LOAN_SCORING_VERSION = 1

export const STUDENT_LOAN_CATEGORY_WEIGHTS = {
  status_stability: 30,
  repayment_strategy: 25,
  forgiveness_optimization: 20,
  knowledge_structure: 15,
  goal_alignment: 10,
} as const

export type StudentLoanCategoryId = keyof typeof STUDENT_LOAN_CATEGORY_WEIGHTS

export const STUDENT_LOAN_CATEGORY_IDS = [
  'status_stability',
  'repayment_strategy',
  'forgiveness_optimization',
  'knowledge_structure',
  'goal_alignment',
] as const satisfies readonly StudentLoanCategoryId[]

export type StudentLoanGradeLetter = 'A' | 'B' | 'C' | 'D' | 'F'

export type StudentLoanGradeResult = {
  readonly grade: StudentLoanGradeLetter
  readonly statusLabelKey: string
}

export type StudentLoanFlagSeverity =
  | 'immediate_review'
  | 'high_priority'
  | 'potential_opportunity'
  | 'review_recommended'

export const STUDENT_LOAN_FLAG_SEVERITY_ORDER: readonly StudentLoanFlagSeverity[] = [
  'immediate_review',
  'high_priority',
  'potential_opportunity',
  'review_recommended',
]

export type StudentLoanCriticalFlag = {
  readonly id: string
  readonly severity: StudentLoanFlagSeverity
  readonly labelKey: string
  readonly categoryId: StudentLoanCategoryId
}

export type StudentLoanReviewArea = {
  readonly id: string
  readonly categoryId: StudentLoanCategoryId
  readonly titleKey: string
  readonly explanationKey: string
  readonly severity: StudentLoanFlagSeverity
}

export type StudentLoanCategoryPoints = {
  readonly id: StudentLoanCategoryId
  readonly labelKey: string
  readonly score: number
  readonly max: number
}

export type StudentLoanScoreResult = {
  readonly overallScore: number
  readonly grade: StudentLoanGradeLetter
  readonly statusLabelKey: string
  readonly categories: readonly StudentLoanCategoryPoints[]
  readonly flags: readonly StudentLoanCriticalFlag[]
  readonly reviewAreas: readonly StudentLoanReviewArea[]
  readonly scoringVersion: number
}

const KNOWN_LOAN_TYPES = new Set(['direct', 'ffelp', 'parent_plus', 'private'])
const PUBLIC_SERVICE_EMPLOYMENT = new Set(['government', 'nonprofit'])
const RECOGNIZED_CONFIGURED_PLANS = new Set<string>(
  STUDENT_LOAN_REPAYMENT_PLAN_VALUES.filter((value) => value !== 'other' && value !== 'not_sure'),
)

function clampScore(value: number, max: number): number {
  if (value < 0) return 0
  if (value > max) return max
  return value
}

export function studentLoanScoreToGrade(score: number): StudentLoanGradeResult {
  const rounded = Math.round(score)
  if (rounded >= 90) return { grade: 'A', statusLabelKey: 'status.optimized' }
  if (rounded >= 80) return { grade: 'B', statusLabelKey: 'status.strong' }
  if (rounded >= 70) return { grade: 'C', statusLabelKey: 'status.opportunities' }
  if (rounded >= 60) return { grade: 'D', statusLabelKey: 'status.needs_review' }
  return { grade: 'F', statusLabelKey: 'status.high_priority' }
}

function hasKnownLoanType(loanTypes: readonly string[]): boolean {
  return loanTypes.some((value) => KNOWN_LOAN_TYPES.has(value))
}

function isUnknownLoanType(loanTypes: readonly string[]): boolean {
  return loanTypes.length === 0 || loanTypes.every((value) => value === 'not_sure')
}

function isRecognizedConfiguredPlan(plan: string): boolean {
  return RECOGNIZED_CONFIGURED_PLANS.has(plan)
}

function scoreStatusStability(diagnostic: StudentLoanDiagnosticAnswers): number {
  let status = 0
  if (diagnostic.loan_status === 'repayment') status = 18
  else if (diagnostic.loan_status === 'deferment_forbearance') status = 10
  else if (diagnostic.loan_status === 'not_sure') status = 6
  else if (diagnostic.loan_status === 'delinquent') status = 3
  else status = 0

  let recent = 0
  if (diagnostic.payment_recent === 'consistent') recent = 9
  else if (diagnostic.payment_recent === 'not_currently_required') recent = 7
  else if (diagnostic.payment_recent === 'missed_some') recent = 4
  else if (diagnostic.payment_recent === 'not_sure') recent = 4
  else if (diagnostic.payment_recent === 'difficult_to_afford') recent = 2
  else if (diagnostic.payment_recent === 'have_not_been_paying') recent = 1

  let paused = 0
  if (diagnostic.payment_paused === 'no') paused = 3
  else if (diagnostic.payment_paused === 'yes') paused = 2
  else paused = 1

  return clampScore(status + recent + paused, STUDENT_LOAN_CATEGORY_WEIGHTS.status_stability)
}

function scoreRepaymentStrategy(diagnostic: StudentLoanDiagnosticAnswers): number {
  let knowledge = 0
  if (diagnostic.knows_plan === 'yes' && isRecognizedConfiguredPlan(diagnostic.current_plan)) {
    knowledge = 15
  } else if (diagnostic.knows_plan === 'yes' && diagnostic.current_plan === 'other') {
    knowledge = 11
  } else if (diagnostic.knows_plan === 'yes') {
    knowledge = 6
  } else {
    knowledge = 4
  }

  let alignment = 3
  const knowsNamedPlan =
    diagnostic.knows_plan === 'yes' &&
    (isRecognizedConfiguredPlan(diagnostic.current_plan) || diagnostic.current_plan === 'other')
  if (knowsNamedPlan && diagnostic.loan_status === 'repayment' && diagnostic.payment_recent === 'consistent') {
    alignment = 10
  } else if (knowsNamedPlan && diagnostic.loan_status === 'repayment') {
    alignment = 8
  } else if (knowsNamedPlan) {
    alignment = 6
  } else if (
    diagnostic.primary_goal === 'exit_delinquency_default' &&
    (diagnostic.loan_status === 'default' || diagnostic.loan_status === 'delinquent')
  ) {
    alignment = 5
  }

  return clampScore(knowledge + alignment, STUDENT_LOAN_CATEGORY_WEIGHTS.repayment_strategy)
}

function scoreForgivenessOptimization(diagnostic: StudentLoanDiagnosticAnswers): number {
  const publicService = PUBLIC_SERVICE_EMPLOYMENT.has(diagnostic.employment_type)
  let employment = 8
  if (publicService) {
    if (diagnostic.employment_tenure === '10_plus' || diagnostic.employment_tenure === '5_10') {
      employment = 8
    } else if (diagnostic.employment_tenure === '1_5') {
      employment = 7
    } else {
      employment = 6
    }
  } else if (diagnostic.employment_type === 'not_employed') {
    employment = 7
  }

  const actions = diagnostic.previous_actions
  let review = 6
  if (publicService) {
    if (actions.includes('pslf')) review = 12
    else if (actions.includes('idr')) review = 8
    else if (actions.includes('borrower_defense')) review = 7
    else review = 4
  } else if (actions.includes('idr')) {
    review = 12
  } else if (actions.includes('none')) {
    review = 11
  } else if (actions.includes('federal_consolidation') || actions.includes('private_refinancing')) {
    review = 10
  } else if (actions.includes('borrower_defense')) {
    review = 9
  } else if (actions.includes('not_sure')) {
    review = 7
  }

  return clampScore(employment + review, STUDENT_LOAN_CATEGORY_WEIGHTS.forgiveness_optimization)
}

function scoreKnowledgeStructure(diagnostic: StudentLoanDiagnosticAnswers): number {
  const typePoints = hasKnownLoanType(diagnostic.loan_types) ? 6 : 2
  const balanceKnown =
    diagnostic.total_balance !== '' && diagnostic.total_balance !== 'not_sure'
  const balancePoints = balanceKnown ? 4 : 1
  let planPoints = 1
  if (diagnostic.knows_plan === 'yes' && isRecognizedConfiguredPlan(diagnostic.current_plan)) {
    planPoints = 5
  } else if (diagnostic.knows_plan === 'yes' && diagnostic.current_plan === 'other') {
    planPoints = 4
  } else if (diagnostic.knows_plan === 'yes') {
    planPoints = 2
  }
  return clampScore(
    typePoints + balancePoints + planPoints,
    STUDENT_LOAN_CATEGORY_WEIGHTS.knowledge_structure,
  )
}

function scoreGoalAlignment(diagnostic: StudentLoanDiagnosticAnswers): number {
  const goalPoints = diagnostic.primary_goal.trim() ? 6 : 0
  const knowsNamedPlan =
    diagnostic.knows_plan === 'yes' &&
    (isRecognizedConfiguredPlan(diagnostic.current_plan) || diagnostic.current_plan === 'other')
  const inDistress =
    diagnostic.loan_status === 'default' || diagnostic.loan_status === 'delinquent'

  let compatibility = 2
  if (inDistress && diagnostic.primary_goal === 'exit_delinquency_default') {
    compatibility = 4
  } else if (inDistress) {
    compatibility = 2
  } else if (knowsNamedPlan && diagnostic.primary_goal.trim()) {
    compatibility = 4
  } else if (diagnostic.primary_goal === 'understand_options') {
    compatibility = 4
  } else if (diagnostic.primary_goal.trim()) {
    compatibility = 3
  }

  return clampScore(goalPoints + compatibility, STUDENT_LOAN_CATEGORY_WEIGHTS.goal_alignment)
}

export function collectStudentLoanFlags(
  diagnostic: StudentLoanDiagnosticAnswers,
): StudentLoanCriticalFlag[] {
  const flags: StudentLoanCriticalFlag[] = []
  if (diagnostic.loan_status === 'default') {
    flags.push({
      id: 'flag_default',
      severity: 'immediate_review',
      labelKey: 'flag.immediate_review',
      categoryId: 'status_stability',
    })
  }
  if (diagnostic.loan_status === 'delinquent') {
    flags.push({
      id: 'flag_delinquent',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'status_stability',
    })
  }
  if (diagnostic.payment_recent === 'difficult_to_afford') {
    flags.push({
      id: 'flag_difficult_payments',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'status_stability',
    })
  }
  if (
    PUBLIC_SERVICE_EMPLOYMENT.has(diagnostic.employment_type) &&
    !diagnostic.previous_actions.includes('pslf')
  ) {
    flags.push({
      id: 'flag_pslf_unreviewed',
      severity: 'potential_opportunity',
      labelKey: 'flag.potential_opportunity',
      categoryId: 'forgiveness_optimization',
    })
  }
  if (isUnknownLoanType(diagnostic.loan_types)) {
    flags.push({
      id: 'flag_unknown_loan_type',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'knowledge_structure',
    })
  }
  if (
    diagnostic.knows_plan === 'no' ||
    diagnostic.knows_plan === 'not_sure' ||
    diagnostic.current_plan === 'not_sure'
  ) {
    flags.push({
      id: 'flag_unknown_plan',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'repayment_strategy',
    })
  }

  const seen = new Set<string>()
  return flags.filter((flag) => {
    if (seen.has(flag.id)) return false
    seen.add(flag.id)
    return true
  })
}

function severityRank(severity: StudentLoanFlagSeverity): number {
  return STUDENT_LOAN_FLAG_SEVERITY_ORDER.indexOf(severity)
}

function reviewAreaForFlag(flag: StudentLoanCriticalFlag): StudentLoanReviewArea {
  return {
    id: `review_${flag.id}`,
    categoryId: flag.categoryId,
    titleKey: `review.${flag.id}.title`,
    explanationKey: `review.${flag.id}.body`,
    severity: flag.severity,
  }
}

function reviewAreaForCategory(category: StudentLoanCategoryPoints): StudentLoanReviewArea {
  const ratio = category.max === 0 ? 1 : category.score / category.max
  const severity: StudentLoanFlagSeverity = ratio < 0.4 ? 'high_priority' : 'review_recommended'
  return {
    id: `review_category_${category.id}`,
    categoryId: category.id,
    titleKey: `review.category.${category.id}.title`,
    explanationKey: `review.category.${category.id}.body`,
    severity,
  }
}

export function selectStudentLoanReviewAreas(
  flags: readonly StudentLoanCriticalFlag[],
  categories: readonly StudentLoanCategoryPoints[],
  diagnostic: StudentLoanDiagnosticAnswers,
): StudentLoanReviewArea[] {
  const selected: StudentLoanReviewArea[] = []
  const usedCategories = new Set<StudentLoanCategoryId>()

  const sortedFlags = [...flags].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
  for (const flag of sortedFlags) {
    if (selected.length >= 3) break
    selected.push(reviewAreaForFlag(flag))
    usedCategories.add(flag.categoryId)
  }

  // Perfect categories (score === max) are never filler. Show 0–3 legitimate areas only.
  const lowestCategories = [...categories]
    .filter((category) => !usedCategories.has(category.id) && category.score < category.max)
    .sort((a, b) => {
      const aRatio = a.max === 0 ? 1 : a.score / a.max
      const bRatio = b.max === 0 ? 1 : b.score / b.max
      if (aRatio !== bRatio) return aRatio - bRatio
      if (a.max !== b.max) return b.max - a.max
      return a.id.localeCompare(b.id)
    })

  for (const category of lowestCategories) {
    if (selected.length >= 3) break
    selected.push(reviewAreaForCategory(category))
    usedCategories.add(category.id)
  }

  const goalUseful =
    diagnostic.urgency === 'asap' ||
    ((diagnostic.loan_status === 'default' || diagnostic.loan_status === 'delinquent') &&
      diagnostic.primary_goal !== 'exit_delinquency_default')
  if (selected.length < 3 && goalUseful && !usedCategories.has('goal_alignment')) {
    selected.push({
      id: 'review_goal_alignment',
      categoryId: 'goal_alignment',
      titleKey: 'review.category.goal_alignment.title',
      explanationKey: 'review.category.goal_alignment.body',
      severity: 'review_recommended',
    })
  }

  return selected.slice(0, 3)
}

export function scoreStudentLoanAssessment(
  diagnostic: StudentLoanDiagnosticAnswers,
): StudentLoanScoreResult {
  const categories: StudentLoanCategoryPoints[] = [
    {
      id: 'status_stability',
      labelKey: 'category.status_stability',
      score: scoreStatusStability(diagnostic),
      max: STUDENT_LOAN_CATEGORY_WEIGHTS.status_stability,
    },
    {
      id: 'repayment_strategy',
      labelKey: 'category.repayment_strategy',
      score: scoreRepaymentStrategy(diagnostic),
      max: STUDENT_LOAN_CATEGORY_WEIGHTS.repayment_strategy,
    },
    {
      id: 'forgiveness_optimization',
      labelKey: 'category.forgiveness_optimization',
      score: scoreForgivenessOptimization(diagnostic),
      max: STUDENT_LOAN_CATEGORY_WEIGHTS.forgiveness_optimization,
    },
    {
      id: 'knowledge_structure',
      labelKey: 'category.knowledge_structure',
      score: scoreKnowledgeStructure(diagnostic),
      max: STUDENT_LOAN_CATEGORY_WEIGHTS.knowledge_structure,
    },
    {
      id: 'goal_alignment',
      labelKey: 'category.goal_alignment',
      score: scoreGoalAlignment(diagnostic),
      max: STUDENT_LOAN_CATEGORY_WEIGHTS.goal_alignment,
    },
  ]

  const overallScore = clampScore(
    categories.reduce((sum, category) => sum + category.score, 0),
    100,
  )
  const { grade, statusLabelKey } = studentLoanScoreToGrade(overallScore)
  const flags = collectStudentLoanFlags(diagnostic)
  const reviewAreas = selectStudentLoanReviewAreas(flags, categories, diagnostic)

  return {
    overallScore,
    grade,
    statusLabelKey,
    categories,
    flags,
    reviewAreas,
    scoringVersion: STUDENT_LOAN_SCORING_VERSION,
  }
}
