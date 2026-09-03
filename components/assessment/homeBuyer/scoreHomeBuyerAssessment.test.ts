import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scoreToGrade } from '../scoring/scoreFamilyAssessment'
import { isHomeBuyerDiagnosticComplete } from './completeness'
import { INITIAL_HOME_BUYER_ANSWERS, type HomeBuyerDiagnosticAnswers } from './types'
import {
  HOME_BUYER_CATEGORY_WEIGHTS,
  HOME_BUYER_SCORING_VERSION,
  collectHomeBuyerFlags,
  homeBuyerScoreToStatus,
  scoreHomeBuyerAssessment,
} from './scoreHomeBuyerAssessment'
import { scoreCreditAssessment } from '../credit/scoreCreditAssessment'
import { strongCreditDiagnostic } from '../credit/scoreCreditAssessment.test'
import { scoreStudentLoanAssessment } from '../studentLoan/scoreStudentLoanAssessment'
import { strongDiagnostic as strongStudentLoanDiagnostic } from '../studentLoan/scoreStudentLoanAssessment.test'

export function strongHomeBuyerDiagnostic(
  overrides: Partial<HomeBuyerDiagnosticAnswers> = {},
): HomeBuyerDiagnosticAnswers {
  return {
    ...INITIAL_HOME_BUYER_ANSWERS.diagnostic,
    self_reported_score_range: '740_plus',
    last_reviewed: 'last_30_days',
    credit_risk_flags: ['none'],
    household_income_band: '150k_plus',
    employment_income_type: 'w2',
    tenure_stability: '2_plus_years',
    monthly_debt_burden: 'comfortable',
    estimated_dti_readiness: 'under_36',
    liquid_savings_band: '50k_plus',
    emergency_reserve_months: '6_plus',
    housing_cost_burden: 'under_30',
    cash_flow_cushion: 'leftover_comfortable',
    down_payment_saved_pct: '20_plus',
    gift_assistance_availability: 'available',
    documentation_ready: ['income_docs', 'bank_statements', 'tax_docs', 'government_id'],
    buyer_history: 'repeat',
    intended_occupancy: 'primary',
    current_housing: 'renting',
    target_timing: 'exploring',
    readiness_confidence: 'very_ready',
    ...overrides,
  }
}

function notSureHomeBuyerDiagnostic(): HomeBuyerDiagnosticAnswers {
  return strongHomeBuyerDiagnostic({
    self_reported_score_range: 'not_sure',
    last_reviewed: 'not_sure',
    credit_risk_flags: ['not_sure'],
    household_income_band: 'not_sure',
    employment_income_type: 'not_sure',
    tenure_stability: 'not_sure',
    monthly_debt_burden: 'not_sure',
    estimated_dti_readiness: 'not_sure',
    liquid_savings_band: 'not_sure',
    emergency_reserve_months: 'not_sure',
    housing_cost_burden: 'not_sure',
    cash_flow_cushion: 'not_sure',
    down_payment_saved_pct: 'not_sure',
    gift_assistance_availability: 'not_sure',
    documentation_ready: ['not_sure'],
    target_timing: 'not_sure',
    readiness_confidence: 'not_sure',
  })
}

function weakHomeBuyerDiagnostic(): HomeBuyerDiagnosticAnswers {
  return strongHomeBuyerDiagnostic({
    self_reported_score_range: 'below_580',
    last_reviewed: 'never',
    credit_risk_flags: ['late_or_delinquent', 'collections_charge_offs', 'bankruptcy_foreclosure'],
    household_income_band: 'under_50k',
    employment_income_type: 'not_working',
    tenure_stability: 'under_1_year',
    monthly_debt_burden: 'difficult',
    estimated_dti_readiness: 'over_50',
    liquid_savings_band: 'under_2k',
    emergency_reserve_months: 'under_1',
    housing_cost_burden: 'over_50',
    cash_flow_cushion: 'none_or_negative',
    down_payment_saved_pct: 'none',
    gift_assistance_availability: 'none',
    documentation_ready: ['none'],
    buyer_history: 'first_time',
    target_timing: '0_3_months',
    readiness_confidence: 'early',
  })
}

describe('homeBuyerScoreToStatus and Family grade reuse', () => {
  it('maps approved status bands and reuses Family +/- grades', () => {
    expect(homeBuyerScoreToStatus(59).statusLabelKey).toBe('status.significant_barriers')
    expect(homeBuyerScoreToStatus(60).statusLabelKey).toBe('status.early_stage')
    expect(homeBuyerScoreToStatus(69).statusLabelKey).toBe('status.early_stage')
    expect(homeBuyerScoreToStatus(70).statusLabelKey).toBe('status.building_readiness')
    expect(homeBuyerScoreToStatus(79).statusLabelKey).toBe('status.building_readiness')
    expect(homeBuyerScoreToStatus(80).statusLabelKey).toBe('status.almost_prepared')
    expect(homeBuyerScoreToStatus(89).statusLabelKey).toBe('status.almost_prepared')
    expect(homeBuyerScoreToStatus(90).statusLabelKey).toBe('status.strongly_prepared')
    expect(homeBuyerScoreToStatus(100).statusLabelKey).toBe('status.strongly_prepared')
    expect(scoreToGrade(93)).toBe('A')
    expect(scoreToGrade(90)).toBe('A-')
    expect(scoreToGrade(87)).toBe('B+')
    expect(scoreToGrade(59)).toBe('F')
  })
})

describe('scoreHomeBuyerAssessment', () => {
  it('keeps totals in 0–100, honors category ceilings, and uses scoring version 1', () => {
    const scored = scoreHomeBuyerAssessment(strongHomeBuyerDiagnostic())
    expect(isHomeBuyerDiagnosticComplete(strongHomeBuyerDiagnostic())).toBe(true)
    expect(scored.overallScore).toBeGreaterThanOrEqual(0)
    expect(scored.overallScore).toBeLessThanOrEqual(100)
    expect(scored.overallScore).toBe(100)
    expect(scored.grade).toBe('A')
    expect(scored.statusLabelKey).toBe('status.strongly_prepared')
    expect(scored.scoringVersion).toBe(1)
    expect(HOME_BUYER_SCORING_VERSION).toBe(1)
    const weightSum = Object.values(HOME_BUYER_CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
    expect(weightSum).toBe(100)
    expect(HOME_BUYER_CATEGORY_WEIGHTS).toEqual({
      credit_readiness: 20,
      income_employment: 15,
      debt_dti_readiness: 15,
      savings_reserves: 15,
      cash_flow_housing: 15,
      down_payment_readiness: 10,
      documentation_readiness: 5,
      purchase_timeline: 5,
    })
    for (const category of scored.categories) {
      expect(category.score).toBeGreaterThanOrEqual(0)
      expect(category.score).toBeLessThanOrEqual(category.max)
      expect(category.max).toBe(HOME_BUYER_CATEGORY_WEIGHTS[category.id])
    }
  })

  it('is deterministic and does not invent a precise DTI from income or debt bands', () => {
    const base = scoreHomeBuyerAssessment(strongHomeBuyerDiagnostic())
    const again = scoreHomeBuyerAssessment(strongHomeBuyerDiagnostic())
    const otherIncome = scoreHomeBuyerAssessment(strongHomeBuyerDiagnostic({ household_income_band: 'under_50k' }))
    expect(again).toEqual(base)
    expect(otherIncome.categories.find((item) => item.id === 'debt_dti_readiness')?.score).toBe(
      base.categories.find((item) => item.id === 'debt_dti_readiness')?.score,
    )
    expect(otherIncome.overallScore).toBeLessThan(base.overallScore)
  })

  it('gives not_sure cautious partial credit and never treats it as clean evidence', () => {
    const unsure = scoreHomeBuyerAssessment(notSureHomeBuyerDiagnostic())
    const clean = scoreHomeBuyerAssessment(strongHomeBuyerDiagnostic())
    expect(unsure.overallScore).toBeGreaterThan(0)
    expect(unsure.overallScore).toBeLessThan(60)
    expect(unsure.overallScore).toBeLessThan(clean.overallScore)
    expect(unsure.statusLabelKey).toBe('status.significant_barriers')
    expect(unsure.flags.map((flag) => flag.id)).not.toContain('flag_serious_delinquency')
    expect(unsure.flags.map((flag) => flag.id)).toContain('flag_missing_core_docs')
    for (const category of unsure.categories) {
      expect(category.score).toBeLessThan(category.max)
    }
  })

  it('raises hard-risk flags without zeroing the overall score', () => {
    const weak = scoreHomeBuyerAssessment(weakHomeBuyerDiagnostic())
    const ids = collectHomeBuyerFlags(weakHomeBuyerDiagnostic()).map((flag) => flag.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'flag_serious_delinquency',
        'flag_derogatory_credit',
        'flag_unstable_income',
        'flag_high_debt_burden',
        'flag_no_savings',
        'flag_no_down_payment_path',
        'flag_missing_core_docs',
      ]),
    )
    expect(weak.flags.map((flag) => flag.id)).toContain('flag_near_term_gaps')
    expect(weak.overallScore).toBeGreaterThan(0)
    expect(weak.overallScore).toBeLessThan(60)
    expect(weak.barriers.length).toBeGreaterThan(0)
    expect(weak.nextActions.length).toBeGreaterThan(0)
    const source = readFileSync(join(process.cwd(), 'components/assessment/homeBuyer/scoreHomeBuyerAssessment.ts'), 'utf8')
    const copy = readFileSync(join(process.cwd(), 'components/assessment/homeBuyer/copy.ts'), 'utf8')
    expect(`${source}\n${copy}`.toLowerCase()).not.toMatch(
      /mortgage ready|prequalified|pre-qualified|you are approved|you qualify/,
    )
  })

  it('leaves Credit and Student Loan scores unchanged for their strong fixtures', () => {
    expect(scoreCreditAssessment(strongCreditDiagnostic()).overallScore).toBe(100)
    expect(scoreStudentLoanAssessment(strongStudentLoanDiagnostic()).overallScore).toBeGreaterThan(0)
  })
})
