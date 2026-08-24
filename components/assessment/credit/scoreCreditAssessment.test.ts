import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCreditDiagnosticComplete } from './completeness'
import { INITIAL_CREDIT_ANSWERS, type CreditDiagnosticAnswers } from './types'
import {
  CREDIT_CATEGORY_WEIGHTS,
  CREDIT_SCORING_VERSION,
  collectCreditFlags,
  creditScoreToGrade,
  scoreCreditAssessment,
} from './scoreCreditAssessment'
import { STUDENT_LOAN_SCORING_VERSION, scoreStudentLoanAssessment } from '../studentLoan/scoreStudentLoanAssessment'
import { strongDiagnostic as strongStudentLoanDiagnostic } from '../studentLoan/scoreStudentLoanAssessment.test'

export function strongCreditDiagnostic(
  overrides: Partial<CreditDiagnosticAnswers> = {},
): CreditDiagnosticAnswers {
  return {
    ...INITIAL_CREDIT_ANSWERS.diagnostic,
    credit_goal: 'general_health',
    self_reported_score: '740_plus',
    last_reviewed: 'last_30_days',
    inaccuracy_belief: 'no',
    late_recent: 'none',
    payment_consistency: 'on_time',
    negative_items: ['none'],
    utilization: 'under_10',
    open_revolving: '3_5',
    oldest_account: '10_plus',
    hard_inquiries: 'none',
    new_accounts: 'none',
    minimums: 'comfortable',
    current_status: 'current',
    urgency: 'just_exploring',
    prior_actions: ['none'],
    ...overrides,
  }
}

describe('creditScoreToGrade', () => {
  it('maps approved boundaries without plus/minus grades', () => {
    expect(creditScoreToGrade(59)).toEqual({ grade: 'F', statusLabelKey: 'status.high_priority' })
    expect(creditScoreToGrade(60)).toEqual({ grade: 'D', statusLabelKey: 'status.needs_review' })
    expect(creditScoreToGrade(69)).toEqual({ grade: 'D', statusLabelKey: 'status.needs_review' })
    expect(creditScoreToGrade(70)).toEqual({ grade: 'C', statusLabelKey: 'status.review_recommended' })
    expect(creditScoreToGrade(79)).toEqual({ grade: 'C', statusLabelKey: 'status.review_recommended' })
    expect(creditScoreToGrade(80)).toEqual({ grade: 'B', statusLabelKey: 'status.solid' })
    expect(creditScoreToGrade(89)).toEqual({ grade: 'B', statusLabelKey: 'status.solid' })
    expect(creditScoreToGrade(90)).toEqual({ grade: 'A', statusLabelKey: 'status.strong' })
    expect(creditScoreToGrade(100)).toEqual({ grade: 'A', statusLabelKey: 'status.strong' })
    expect(creditScoreToGrade(90).grade).not.toBe('A-')
    expect(creditScoreToGrade(87).grade).not.toBe('B+')
  })
})

describe('scoreCreditAssessment', () => {
  it('keeps totals in 0–100, honors category ceilings, and uses scoring version 1', () => {
    const scored = scoreCreditAssessment(strongCreditDiagnostic())
    expect(isCreditDiagnosticComplete(strongCreditDiagnostic())).toBe(true)
    expect(scored.overallScore).toBeGreaterThanOrEqual(0)
    expect(scored.overallScore).toBeLessThanOrEqual(100)
    expect(scored.overallScore).toBe(100)
    expect(scored.grade).toBe('A')
    expect(scored.scoringVersion).toBe(1)
    expect(CREDIT_SCORING_VERSION).toBe(1)
    const weightSum = Object.values(CREDIT_CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
    expect(weightSum).toBe(100)
    for (const category of scored.categories) {
      expect(category.score).toBeGreaterThanOrEqual(0)
      expect(category.score).toBeLessThanOrEqual(category.max)
      expect(category.max).toBe(CREDIT_CATEGORY_WEIGHTS[category.id])
    }
  })

  it('is deterministic and ignores urgency and prior actions in the numeric score', () => {
    const base = scoreCreditAssessment(strongCreditDiagnostic())
    const again = scoreCreditAssessment(strongCreditDiagnostic())
    const urgent = scoreCreditAssessment(strongCreditDiagnostic({ urgency: 'asap' }))
    const prior = scoreCreditAssessment(
      strongCreditDiagnostic({ prior_actions: ['self_disputes', 'prior_repair_company'] }),
    )
    expect(again).toEqual(base)
    expect(urgent.overallScore).toBe(base.overallScore)
    expect(prior.overallScore).toBe(base.overallScore)
  })

  it('does not let a high self-reported range overwhelm real problems', () => {
    const cleanLowRange = scoreCreditAssessment(strongCreditDiagnostic({ self_reported_score: 'below_580' }))
    const troubledHighRange = scoreCreditAssessment(
      strongCreditDiagnostic({
        self_reported_score: '740_plus',
        negative_items: ['collections'],
        utilization: 'maxed',
        current_status: 'past_due',
      }),
    )
    expect(cleanLowRange.overallScore).toBeGreaterThan(troubledHighRange.overallScore)
    expect(troubledHighRange.overallScore).toBeLessThan(80)
    expect(cleanLowRange.categories.find((item) => item.id === 'self_reported_score')?.score).toBe(1)
    expect(troubledHighRange.categories.find((item) => item.id === 'self_reported_score')?.score).toBe(6)
  })

  it('raises meaningful flags without guarantee or approval language', () => {
    const flags = collectCreditFlags(
      strongCreditDiagnostic({
        late_recent: '90_plus',
        payment_consistency: 'currently_behind',
        current_status: 'past_due',
        negative_items: ['collections', 'bankruptcy'],
        utilization: 'maxed',
        hard_inquiries: '6_plus',
        last_reviewed: 'never',
        inaccuracy_belief: '',
        minimums: 'struggling',
      }),
    )
    const ids = flags.map((flag) => flag.id)
    expect(ids).toEqual(expect.arrayContaining([
      'flag_past_due',
      'flag_severe_lates',
      'flag_severe_negatives',
      'flag_high_utilization',
      'flag_recent_applications',
      'flag_report_uncertainty',
      'flag_payment_strain',
    ]))
    const source = readFileSync(join(process.cwd(), 'components/assessment/credit/scoreCreditAssessment.ts'), 'utf8')
    const copy = readFileSync(join(process.cwd(), 'components/assessment/credit/copy.ts'), 'utf8')
    expect(`${source}\n${copy}`.toLowerCase()).not.toMatch(
      /guaranteed deletion|guaranteed score increase|you qualify|illegal/,
    )
    expect(copy.toLowerCase()).toMatch(/does not guarantee/)
  })

  it('returns 0–3 meaningful review areas and never fills with perfect categories', () => {
    const perfect = scoreCreditAssessment(strongCreditDiagnostic())
    expect(perfect.reviewAreas).toEqual([])

    const one = scoreCreditAssessment(strongCreditDiagnostic({ utilization: '10_30' }))
    expect(one.reviewAreas).toHaveLength(1)
    expect(one.reviewAreas[0]?.id).toBe('review_category_utilization')
    expect(one.categories.find((item) => item.id === 'utilization')?.score).toBeLessThan(14)

    const two = scoreCreditAssessment(
      strongCreditDiagnostic({ utilization: '10_30', oldest_account: '5_10' }),
    )
    expect(two.reviewAreas).toHaveLength(2)
    expect(two.reviewAreas.map((area) => area.id).sort()).toEqual([
      'review_category_credit_structure',
      'review_category_utilization',
    ])

    const three = scoreCreditAssessment(
      strongCreditDiagnostic({
        utilization: '10_30',
        oldest_account: '5_10',
        self_reported_score: '700_739',
      }),
    )
    expect(three.reviewAreas).toHaveLength(3)
    expect(three.reviewAreas.map((area) => area.id)).toEqual(
      expect.arrayContaining([
        'review_category_utilization',
        'review_category_credit_structure',
        'review_category_self_reported_score',
      ]),
    )
    expect(three.reviewAreas.some((area) => area.id === 'review_category_payment_history')).toBe(false)
    expect(three.categories.find((item) => item.id === 'payment_history')?.score).toBe(24)
  })

  it('selects flag-driven areas before category filler and caps at three', () => {
    const scored = scoreCreditAssessment(
      strongCreditDiagnostic({
        current_status: 'past_due',
        negative_items: ['collections'],
        utilization: 'maxed',
        last_reviewed: 'never',
        inaccuracy_belief: '',
      }),
    )
    expect(scored.reviewAreas.length).toBeLessThanOrEqual(3)
    expect(scored.reviewAreas[0]?.id).toMatch(/^review_flag_/)
    expect(scored.reviewAreas).toHaveLength(3)
  })

  it('leaves Student Loan scoring unchanged', () => {
    expect(STUDENT_LOAN_SCORING_VERSION).toBe(1)
    expect(scoreStudentLoanAssessment(strongStudentLoanDiagnostic()).overallScore).toBe(100)
  })
})
