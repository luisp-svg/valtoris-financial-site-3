/**
 * Deterministic Home Buyer Report Card Score.
 * Uses canonical diagnostic values only. Never reads translated labels.
 * Contact does not change the numeric score.
 * Does not calculate DTI from income/debt bands.
 * Does not imply mortgage approval, prequalification, or lending decisions.
 * Credit inputs remain self-reported / public_self_report.
 */

import { scoreToGrade } from '../scoring/scoreFamilyAssessment'
import type { HomeBuyerDiagnosticAnswers } from './types'

export const HOME_BUYER_SCORING_VERSION = 1

export const HOME_BUYER_CATEGORY_WEIGHTS = {
  credit_readiness: 20,
  income_employment: 15,
  debt_dti_readiness: 15,
  savings_reserves: 15,
  cash_flow_housing: 15,
  down_payment_readiness: 10,
  documentation_readiness: 5,
  purchase_timeline: 5,
} as const

export type HomeBuyerCategoryId = keyof typeof HOME_BUYER_CATEGORY_WEIGHTS

export const HOME_BUYER_CATEGORY_IDS = [
  'credit_readiness',
  'income_employment',
  'debt_dti_readiness',
  'savings_reserves',
  'cash_flow_housing',
  'down_payment_readiness',
  'documentation_readiness',
  'purchase_timeline',
] as const satisfies readonly HomeBuyerCategoryId[]

export type HomeBuyerFlagSeverity = 'immediate_review' | 'high_priority' | 'review_recommended'

export const HOME_BUYER_FLAG_SEVERITY_ORDER: readonly HomeBuyerFlagSeverity[] = [
  'immediate_review',
  'high_priority',
  'review_recommended',
]

export type HomeBuyerHardRiskFlag = {
  readonly id: string
  readonly severity: HomeBuyerFlagSeverity
  readonly labelKey: string
  readonly categoryId: HomeBuyerCategoryId
}

export type HomeBuyerInsight = {
  readonly id: string
  readonly categoryId: HomeBuyerCategoryId
  readonly titleKey: string
  readonly explanationKey: string
  readonly severity: HomeBuyerFlagSeverity
}

export type HomeBuyerCategoryPoints = {
  readonly id: HomeBuyerCategoryId
  readonly labelKey: string
  readonly score: number
  readonly max: number
}

export type HomeBuyerScoreResult = {
  readonly overallScore: number
  readonly grade: string
  readonly statusLabelKey: string
  readonly categories: readonly HomeBuyerCategoryPoints[]
  readonly flags: readonly HomeBuyerHardRiskFlag[]
  readonly strengths: readonly HomeBuyerInsight[]
  readonly barriers: readonly HomeBuyerInsight[]
  readonly nextActions: readonly HomeBuyerInsight[]
  readonly scoringVersion: number
}

const CORE_DOCS = ['income_docs', 'bank_statements', 'government_id'] as const
const NEAR_TERM = new Set(['0_3_months', '3_6_months'])

function clampScore(value: number, max: number): number {
  if (value < 0) return 0
  if (value > max) return max
  return Math.round(value)
}

export function homeBuyerScoreToStatus(score: number): { statusLabelKey: string } {
  const rounded = Math.round(score)
  if (rounded >= 90) return { statusLabelKey: 'status.strongly_prepared' }
  if (rounded >= 80) return { statusLabelKey: 'status.almost_prepared' }
  if (rounded >= 70) return { statusLabelKey: 'status.building_readiness' }
  if (rounded >= 60) return { statusLabelKey: 'status.early_stage' }
  return { statusLabelKey: 'status.significant_barriers' }
}

function scoreCreditReadiness(diagnostic: HomeBuyerDiagnosticAnswers): number {
  let range = 0
  if (diagnostic.self_reported_score_range === '740_plus') range = 10
  else if (diagnostic.self_reported_score_range === '700_739') range = 9
  else if (diagnostic.self_reported_score_range === '660_699') range = 7
  else if (diagnostic.self_reported_score_range === '620_659') range = 5
  else if (diagnostic.self_reported_score_range === '580_619') range = 3
  else if (diagnostic.self_reported_score_range === 'below_580') range = 1
  else if (diagnostic.self_reported_score_range === 'not_sure') range = 4

  let reviewed = 0
  if (diagnostic.last_reviewed === 'last_30_days') reviewed = 4
  else if (diagnostic.last_reviewed === 'last_6_months') reviewed = 3
  else if (diagnostic.last_reviewed === 'last_year') reviewed = 2
  else if (diagnostic.last_reviewed === 'more_than_year') reviewed = 1
  else if (diagnostic.last_reviewed === 'never') reviewed = 0
  else if (diagnostic.last_reviewed === 'not_sure') reviewed = 2

  const flags = diagnostic.credit_risk_flags
  let risk = 0
  if (flags.length === 1 && flags[0] === 'none') risk = 6
  else if (flags.length === 1 && flags[0] === 'not_sure') risk = 3
  else {
    risk = 6
    if (flags.includes('late_or_delinquent')) risk -= 3
    if (flags.includes('collections_charge_offs')) risk -= 4
    if (flags.includes('bankruptcy_foreclosure')) risk -= 5
  }

  return clampScore(range + reviewed + risk, HOME_BUYER_CATEGORY_WEIGHTS.credit_readiness)
}

function scoreIncomeEmployment(diagnostic: HomeBuyerDiagnosticAnswers): number {
  let income = 0
  if (diagnostic.household_income_band === '150k_plus') income = 6
  else if (diagnostic.household_income_band === '100_150k') income = 5
  else if (diagnostic.household_income_band === '75_100k') income = 4
  else if (diagnostic.household_income_band === '50_75k') income = 3
  else if (diagnostic.household_income_band === 'under_50k') income = 2
  else if (diagnostic.household_income_band === 'not_sure') income = 3

  let type = 0
  if (diagnostic.employment_income_type === 'w2') type = 5
  else if (diagnostic.employment_income_type === 'mixed') type = 4
  else if (diagnostic.employment_income_type === 'self_employed') type = 3
  else if (diagnostic.employment_income_type === 'contract_gig') type = 3
  else if (diagnostic.employment_income_type === 'retired_fixed') type = 3
  else if (diagnostic.employment_income_type === 'not_working') type = 0
  else if (diagnostic.employment_income_type === 'not_sure') type = 2

  let tenure = 0
  if (diagnostic.tenure_stability === '2_plus_years') tenure = 4
  else if (diagnostic.tenure_stability === '1_2_years') tenure = 3
  else if (diagnostic.tenure_stability === 'under_1_year') tenure = 1
  else if (diagnostic.tenure_stability === 'not_sure') tenure = 2

  return clampScore(income + type + tenure, HOME_BUYER_CATEGORY_WEIGHTS.income_employment)
}

function scoreDebtDti(diagnostic: HomeBuyerDiagnosticAnswers): number {
  let burden = 0
  if (diagnostic.monthly_debt_burden === 'comfortable') burden = 8
  else if (diagnostic.monthly_debt_burden === 'stretching') burden = 4
  else if (diagnostic.monthly_debt_burden === 'difficult') burden = 1
  else if (diagnostic.monthly_debt_burden === 'not_sure') burden = 4

  let dti = 0
  if (diagnostic.estimated_dti_readiness === 'under_36') dti = 7
  else if (diagnostic.estimated_dti_readiness === '36_43') dti = 5
  else if (diagnostic.estimated_dti_readiness === '43_50') dti = 3
  else if (diagnostic.estimated_dti_readiness === 'over_50') dti = 1
  else if (diagnostic.estimated_dti_readiness === 'not_sure') dti = 3

  return clampScore(burden + dti, HOME_BUYER_CATEGORY_WEIGHTS.debt_dti_readiness)
}

function scoreSavings(diagnostic: HomeBuyerDiagnosticAnswers): number {
  let liquid = 0
  if (diagnostic.liquid_savings_band === '50k_plus') liquid = 8
  else if (diagnostic.liquid_savings_band === '25_50k') liquid = 7
  else if (diagnostic.liquid_savings_band === '10_25k') liquid = 5
  else if (diagnostic.liquid_savings_band === '2_10k') liquid = 3
  else if (diagnostic.liquid_savings_band === 'under_2k') liquid = 1
  else if (diagnostic.liquid_savings_band === 'not_sure') liquid = 4

  let reserve = 0
  if (diagnostic.emergency_reserve_months === '6_plus') reserve = 7
  else if (diagnostic.emergency_reserve_months === '3_6') reserve = 5
  else if (diagnostic.emergency_reserve_months === '1_3') reserve = 3
  else if (diagnostic.emergency_reserve_months === 'under_1') reserve = 1
  else if (diagnostic.emergency_reserve_months === 'not_sure') reserve = 3

  return clampScore(liquid + reserve, HOME_BUYER_CATEGORY_WEIGHTS.savings_reserves)
}

function scoreCashFlow(diagnostic: HomeBuyerDiagnosticAnswers): number {
  let housing = 0
  if (diagnostic.housing_cost_burden === 'under_30') housing = 8
  else if (diagnostic.housing_cost_burden === '30_40') housing = 6
  else if (diagnostic.housing_cost_burden === '40_50') housing = 3
  else if (diagnostic.housing_cost_burden === 'over_50') housing = 1
  else if (diagnostic.housing_cost_burden === 'not_sure') housing = 4

  let cushion = 0
  if (diagnostic.cash_flow_cushion === 'leftover_comfortable') cushion = 7
  else if (diagnostic.cash_flow_cushion === 'leftover_tight') cushion = 4
  else if (diagnostic.cash_flow_cushion === 'none_or_negative') cushion = 1
  else if (diagnostic.cash_flow_cushion === 'not_sure') cushion = 3

  return clampScore(housing + cushion, HOME_BUYER_CATEGORY_WEIGHTS.cash_flow_housing)
}

function scoreDownPayment(diagnostic: HomeBuyerDiagnosticAnswers): number {
  let saved = 0
  if (diagnostic.down_payment_saved_pct === '20_plus') saved = 7
  else if (diagnostic.down_payment_saved_pct === '10_20') saved = 6
  else if (diagnostic.down_payment_saved_pct === '5_10') saved = 4
  else if (diagnostic.down_payment_saved_pct === 'under_5') saved = 2
  else if (diagnostic.down_payment_saved_pct === 'none') saved = 0
  else if (diagnostic.down_payment_saved_pct === 'not_sure') saved = 3

  let gift = 0
  if (diagnostic.gift_assistance_availability === 'available') gift = 3
  else if (diagnostic.gift_assistance_availability === 'possible') gift = 2
  else if (diagnostic.gift_assistance_availability === 'none') gift = 1
  else if (diagnostic.gift_assistance_availability === 'not_sure') gift = 1

  return clampScore(saved + gift, HOME_BUYER_CATEGORY_WEIGHTS.down_payment_readiness)
}

function scoreDocumentation(diagnostic: HomeBuyerDiagnosticAnswers): number {
  const docs = diagnostic.documentation_ready
  if (docs.length === 1 && docs[0] === 'none') return 0
  if (docs.length === 1 && docs[0] === 'not_sure') return 2
  const counted = docs.filter((item) => item !== 'none' && item !== 'not_sure')
  if (counted.length >= 4) return 5
  if (counted.length === 3) return 4
  if (counted.length === 2) return 3
  if (counted.length === 1) return 2
  return 0
}

function scoreTimeline(diagnostic: HomeBuyerDiagnosticAnswers): number {
  let timing = 0
  if (diagnostic.target_timing === 'exploring' || diagnostic.target_timing === '12_plus') timing = 2
  else if (diagnostic.target_timing === '6_12_months') timing = 2
  else if (diagnostic.target_timing === '3_6_months') timing = 1
  else if (diagnostic.target_timing === '0_3_months') timing = 1
  else if (diagnostic.target_timing === 'not_sure') timing = 1

  let confidence = 0
  if (diagnostic.readiness_confidence === 'very_ready') confidence = 3
  else if (diagnostic.readiness_confidence === 'somewhat_ready') confidence = 2
  else if (diagnostic.readiness_confidence === 'early') confidence = 1
  else if (diagnostic.readiness_confidence === 'not_sure') confidence = 1

  return clampScore(timing + confidence, HOME_BUYER_CATEGORY_WEIGHTS.purchase_timeline)
}

function hasCoreDocs(diagnostic: HomeBuyerDiagnosticAnswers): boolean {
  const docs = diagnostic.documentation_ready
  if (docs.includes('none') || docs.includes('not_sure')) return false
  return CORE_DOCS.every((item) => docs.includes(item))
}

function noDownPaymentPath(diagnostic: HomeBuyerDiagnosticAnswers): boolean {
  const savedNone =
    diagnostic.down_payment_saved_pct === 'none' || diagnostic.down_payment_saved_pct === 'under_5'
  return savedNone && diagnostic.gift_assistance_availability === 'none'
}

export function collectHomeBuyerFlags(diagnostic: HomeBuyerDiagnosticAnswers): HomeBuyerHardRiskFlag[] {
  const flags: HomeBuyerHardRiskFlag[] = []
  const risks = diagnostic.credit_risk_flags

  if (risks.includes('late_or_delinquent')) {
    flags.push({
      id: 'flag_serious_delinquency',
      severity: 'immediate_review',
      labelKey: 'flag.immediate_review',
      categoryId: 'credit_readiness',
    })
  }

  if (risks.includes('collections_charge_offs') || risks.includes('bankruptcy_foreclosure')) {
    flags.push({
      id: 'flag_derogatory_credit',
      severity: 'immediate_review',
      labelKey: 'flag.immediate_review',
      categoryId: 'credit_readiness',
    })
  }

  if (
    diagnostic.employment_income_type === 'not_working' ||
    (diagnostic.employment_income_type === 'contract_gig' && diagnostic.tenure_stability === 'under_1_year')
  ) {
    flags.push({
      id: 'flag_unstable_income',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'income_employment',
    })
  }

  if (diagnostic.monthly_debt_burden === 'difficult' || diagnostic.estimated_dti_readiness === 'over_50') {
    flags.push({
      id: 'flag_high_debt_burden',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'debt_dti_readiness',
    })
  }

  if (diagnostic.liquid_savings_band === 'under_2k' && diagnostic.emergency_reserve_months === 'under_1') {
    flags.push({
      id: 'flag_no_savings',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'savings_reserves',
    })
  }

  if (noDownPaymentPath(diagnostic)) {
    flags.push({
      id: 'flag_no_down_payment_path',
      severity: 'high_priority',
      labelKey: 'flag.high_priority',
      categoryId: 'down_payment_readiness',
    })
  }

  if (!hasCoreDocs(diagnostic)) {
    flags.push({
      id: 'flag_missing_core_docs',
      severity: 'review_recommended',
      labelKey: 'flag.review_recommended',
      categoryId: 'documentation_readiness',
    })
  }

  const seen = new Set<string>()
  return flags.filter((flag) => {
    if (seen.has(flag.id)) return false
    seen.add(flag.id)
    return true
  })
}

function severityRank(severity: HomeBuyerFlagSeverity): number {
  return HOME_BUYER_FLAG_SEVERITY_ORDER.indexOf(severity)
}

function insightFromFlag(flag: HomeBuyerHardRiskFlag, kind: 'barrier' | 'action'): HomeBuyerInsight {
  return {
    id: kind === 'action' ? `action_${flag.id}` : `barrier_${flag.id}`,
    categoryId: flag.categoryId,
    titleKey: `insight.${flag.id}.title`,
    explanationKey: `insight.${flag.id}.body`,
    severity: flag.severity,
  }
}

function insightFromCategory(
  category: HomeBuyerCategoryPoints,
  kind: 'strength' | 'barrier',
): HomeBuyerInsight {
  const ratio = category.max === 0 ? 1 : category.score / category.max
  const severity: HomeBuyerFlagSeverity = ratio < 0.4 ? 'high_priority' : 'review_recommended'
  return {
    id: `${kind}_category_${category.id}`,
    categoryId: category.id,
    titleKey: `insight.category.${category.id}.title`,
    explanationKey: `insight.category.${category.id}.body`,
    severity,
  }
}

function selectStrengths(categories: readonly HomeBuyerCategoryPoints[]): HomeBuyerInsight[] {
  return [...categories]
    .filter((category) => category.max > 0 && category.score / category.max >= 0.8)
    .sort((a, b) => {
      const aRatio = a.score / a.max
      const bRatio = b.score / b.max
      if (aRatio !== bRatio) return bRatio - aRatio
      return b.max - a.max
    })
    .slice(0, 3)
    .map((category) => insightFromCategory(category, 'strength'))
}

function selectBarriers(
  flags: readonly HomeBuyerHardRiskFlag[],
  categories: readonly HomeBuyerCategoryPoints[],
): HomeBuyerInsight[] {
  const selected: HomeBuyerInsight[] = []
  const used = new Set<HomeBuyerCategoryId>()
  const sortedFlags = [...flags].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
  for (const flag of sortedFlags) {
    if (selected.length >= 4) break
    selected.push(insightFromFlag(flag, 'barrier'))
    used.add(flag.categoryId)
  }
  const weak = [...categories]
    .filter((category) => !used.has(category.id) && category.score < category.max)
    .sort((a, b) => a.score / a.max - b.score / b.max)
  for (const category of weak) {
    if (selected.length >= 4) break
    selected.push(insightFromCategory(category, 'barrier'))
    used.add(category.id)
  }
  return selected
}

function selectNextActions(
  flags: readonly HomeBuyerHardRiskFlag[],
  categories: readonly HomeBuyerCategoryPoints[],
): HomeBuyerInsight[] {
  const selected: HomeBuyerInsight[] = []
  const used = new Set<string>()
  const sortedFlags = [...flags].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
  for (const flag of sortedFlags) {
    if (selected.length >= 3) break
    selected.push(insightFromFlag(flag, 'action'))
    used.add(flag.categoryId)
  }
  const weak = [...categories]
    .filter((category) => !used.has(category.id) && category.score < category.max * 0.7)
    .sort((a, b) => a.score / a.max - b.score / b.max)
  for (const category of weak) {
    if (selected.length >= 3) break
    selected.push({
      id: `action_category_${category.id}`,
      categoryId: category.id,
      titleKey: `insight.category.${category.id}.title`,
      explanationKey: `insight.category.${category.id}.body`,
      severity: category.score / category.max < 0.4 ? 'high_priority' : 'review_recommended',
    })
  }
  return selected
}

export function scoreHomeBuyerAssessment(diagnostic: HomeBuyerDiagnosticAnswers): HomeBuyerScoreResult {
  const categories: HomeBuyerCategoryPoints[] = [
    {
      id: 'credit_readiness',
      labelKey: 'category.credit_readiness',
      score: scoreCreditReadiness(diagnostic),
      max: HOME_BUYER_CATEGORY_WEIGHTS.credit_readiness,
    },
    {
      id: 'income_employment',
      labelKey: 'category.income_employment',
      score: scoreIncomeEmployment(diagnostic),
      max: HOME_BUYER_CATEGORY_WEIGHTS.income_employment,
    },
    {
      id: 'debt_dti_readiness',
      labelKey: 'category.debt_dti_readiness',
      score: scoreDebtDti(diagnostic),
      max: HOME_BUYER_CATEGORY_WEIGHTS.debt_dti_readiness,
    },
    {
      id: 'savings_reserves',
      labelKey: 'category.savings_reserves',
      score: scoreSavings(diagnostic),
      max: HOME_BUYER_CATEGORY_WEIGHTS.savings_reserves,
    },
    {
      id: 'cash_flow_housing',
      labelKey: 'category.cash_flow_housing',
      score: scoreCashFlow(diagnostic),
      max: HOME_BUYER_CATEGORY_WEIGHTS.cash_flow_housing,
    },
    {
      id: 'down_payment_readiness',
      labelKey: 'category.down_payment_readiness',
      score: scoreDownPayment(diagnostic),
      max: HOME_BUYER_CATEGORY_WEIGHTS.down_payment_readiness,
    },
    {
      id: 'documentation_readiness',
      labelKey: 'category.documentation_readiness',
      score: scoreDocumentation(diagnostic),
      max: HOME_BUYER_CATEGORY_WEIGHTS.documentation_readiness,
    },
    {
      id: 'purchase_timeline',
      labelKey: 'category.purchase_timeline',
      score: scoreTimeline(diagnostic),
      max: HOME_BUYER_CATEGORY_WEIGHTS.purchase_timeline,
    },
  ]

  const overallScore = clampScore(
    categories.reduce((sum, category) => sum + category.score, 0),
    100,
  )
  const flags = collectHomeBuyerFlags(diagnostic)
  if (NEAR_TERM.has(diagnostic.target_timing)) {
    const majorGaps = flags.length >= 2 || overallScore < 70
    if (majorGaps && !flags.some((flag) => flag.id === 'flag_near_term_gaps')) {
      flags.push({
        id: 'flag_near_term_gaps',
        severity: 'high_priority',
        labelKey: 'flag.high_priority',
        categoryId: 'purchase_timeline',
      })
    }
  }

  return {
    overallScore,
    grade: scoreToGrade(overallScore),
    statusLabelKey: homeBuyerScoreToStatus(overallScore).statusLabelKey,
    categories,
    flags,
    strengths: selectStrengths(categories),
    barriers: selectBarriers(flags, categories),
    nextActions: selectNextActions(flags, categories),
    scoringVersion: HOME_BUYER_SCORING_VERSION,
  }
}
