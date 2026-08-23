import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { INITIAL_STUDENT_LOAN_ANSWERS, type StudentLoanDiagnosticAnswers } from './types'
import {
  STUDENT_LOAN_CATEGORY_WEIGHTS,
  collectStudentLoanFlags,
  scoreStudentLoanAssessment,
  studentLoanScoreToGrade,
} from './scoreStudentLoanAssessment'

export function strongDiagnostic(
  overrides: Partial<StudentLoanDiagnosticAnswers> = {},
): StudentLoanDiagnosticAnswers {
  return {
    ...INITIAL_STUDENT_LOAN_ANSWERS.diagnostic,
    loan_types: ['direct'],
    total_balance: 'over_100k',
    loan_status: 'repayment',
    servicer_mode: 'named',
    servicer_name: 'MOHELA',
    knows_plan: 'yes',
    current_plan: 'ibr',
    income: '75k_125k',
    household_size: '2',
    employment_type: 'private',
    employment_tenure: '5_10',
    payment_recent: 'consistent',
    payment_paused: 'no',
    previous_actions: ['idr'],
    primary_goal: 'understand_options',
    urgency: 'within_3_months',
    ...overrides,
  }
}

describe('studentLoanScoreToGrade', () => {
  it('maps approved boundaries without A-/B+ semantics', () => {
    expect(studentLoanScoreToGrade(59)).toEqual({ grade: 'F', statusLabelKey: 'status.high_priority' })
    expect(studentLoanScoreToGrade(60)).toEqual({ grade: 'D', statusLabelKey: 'status.needs_review' })
    expect(studentLoanScoreToGrade(69)).toEqual({ grade: 'D', statusLabelKey: 'status.needs_review' })
    expect(studentLoanScoreToGrade(70)).toEqual({ grade: 'C', statusLabelKey: 'status.opportunities' })
    expect(studentLoanScoreToGrade(79)).toEqual({ grade: 'C', statusLabelKey: 'status.opportunities' })
    expect(studentLoanScoreToGrade(80)).toEqual({ grade: 'B', statusLabelKey: 'status.strong' })
    expect(studentLoanScoreToGrade(89)).toEqual({ grade: 'B', statusLabelKey: 'status.strong' })
    expect(studentLoanScoreToGrade(90)).toEqual({ grade: 'A', statusLabelKey: 'status.optimized' })
    expect(studentLoanScoreToGrade(100)).toEqual({ grade: 'A', statusLabelKey: 'status.optimized' })
    expect(studentLoanScoreToGrade(90).grade).not.toBe('A-')
    expect(studentLoanScoreToGrade(87).grade).not.toBe('B+')
  })
})

describe('scoreStudentLoanAssessment', () => {
  it('keeps totals in 0–100 and honors category ceilings', () => {
    const scored = scoreStudentLoanAssessment(strongDiagnostic())
    expect(scored.overallScore).toBeGreaterThanOrEqual(0)
    expect(scored.overallScore).toBeLessThanOrEqual(100)
    expect(scored.overallScore).toBe(100)
    expect(scored.grade).toBe('A')
    const weightSum = Object.values(STUDENT_LOAN_CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
    expect(weightSum).toBe(100)
    for (const category of scored.categories) {
      expect(category.score).toBeGreaterThanOrEqual(0)
      expect(category.score).toBeLessThanOrEqual(category.max)
      expect(category.max).toBe(STUDENT_LOAN_CATEGORY_WEIGHTS[category.id])
    }
  })

  it('does not reduce the score for a large balance or a different servicer', () => {
    const large = scoreStudentLoanAssessment(strongDiagnostic({ total_balance: 'over_100k' }))
    const small = scoreStudentLoanAssessment(strongDiagnostic({ total_balance: 'under_25k' }))
    expect(large.overallScore).toBe(small.overallScore)

    const named = scoreStudentLoanAssessment(
      strongDiagnostic({ servicer_mode: 'named', servicer_name: 'MOHELA' }),
    )
    const unknown = scoreStudentLoanAssessment(
      strongDiagnostic({ servicer_mode: 'not_sure', servicer_name: '' }),
    )
    const otherName = scoreStudentLoanAssessment(
      strongDiagnostic({ servicer_mode: 'named', servicer_name: 'Nelnet' }),
    )
    expect(named.overallScore).toBe(unknown.overallScore)
    expect(named.overallScore).toBe(otherName.overallScore)
  })

  it('uses canonical values and does not import display copy', () => {
    const source = readFileSync(
      join(process.cwd(), 'components/assessment/studentLoan/scoreStudentLoanAssessment.ts'),
      'utf8',
    )
    expect(source).not.toContain("from './copy'")
    expect(source).not.toContain('Federal Direct Loan')
    expect(source).not.toContain('you qualify')
    expect(source).not.toContain('you will save')
    expect(source).not.toContain('eligible for forgiveness')
  })
})

describe('Student Loan critical flags', () => {
  it('flags default as Immediate Review', () => {
    const flags = collectStudentLoanFlags(strongDiagnostic({ loan_status: 'default' }))
    expect(flags.some((flag) => flag.id === 'flag_default' && flag.severity === 'immediate_review')).toBe(
      true,
    )
  })

  it('flags delinquent as High Priority', () => {
    const flags = collectStudentLoanFlags(strongDiagnostic({ loan_status: 'delinquent' }))
    expect(flags.some((flag) => flag.id === 'flag_delinquent' && flag.severity === 'high_priority')).toBe(
      true,
    )
  })

  it('flags difficult payments as High Priority', () => {
    const flags = collectStudentLoanFlags(strongDiagnostic({ payment_recent: 'difficult_to_afford' }))
    expect(
      flags.some((flag) => flag.id === 'flag_difficult_payments' && flag.severity === 'high_priority'),
    ).toBe(true)
  })

  it('flags government or nonprofit employment without PSLF action', () => {
    const government = collectStudentLoanFlags(
      strongDiagnostic({ employment_type: 'government', previous_actions: ['idr'] }),
    )
    const nonprofit = collectStudentLoanFlags(
      strongDiagnostic({ employment_type: 'nonprofit', previous_actions: ['none'] }),
    )
    expect(government.some((flag) => flag.id === 'flag_pslf_unreviewed')).toBe(true)
    expect(nonprofit.some((flag) => flag.id === 'flag_pslf_unreviewed')).toBe(true)
  })

  it('does not flag public-service employment when PSLF was already reviewed', () => {
    const flags = collectStudentLoanFlags(
      strongDiagnostic({ employment_type: 'government', previous_actions: ['pslf'] }),
    )
    expect(flags.some((flag) => flag.id === 'flag_pslf_unreviewed')).toBe(false)
  })

  it('flags unknown loan type and unknown repayment plan', () => {
    const typeFlags = collectStudentLoanFlags(strongDiagnostic({ loan_types: ['not_sure'] }))
    const planFlags = collectStudentLoanFlags(
      strongDiagnostic({ knows_plan: 'no', current_plan: '' }),
    )
    const unsurePlan = collectStudentLoanFlags(
      strongDiagnostic({ knows_plan: 'yes', current_plan: 'not_sure' }),
    )
    expect(typeFlags.some((flag) => flag.id === 'flag_unknown_loan_type')).toBe(true)
    expect(planFlags.some((flag) => flag.id === 'flag_unknown_plan')).toBe(true)
    expect(unsurePlan.some((flag) => flag.id === 'flag_unknown_plan')).toBe(true)
  })

  it('caps review areas at 3 and prefers flag severity', () => {
    const scored = scoreStudentLoanAssessment(
      strongDiagnostic({
        loan_status: 'default',
        payment_recent: 'difficult_to_afford',
        employment_type: 'government',
        previous_actions: ['none'],
        loan_types: ['not_sure'],
        knows_plan: 'not_sure',
        current_plan: '',
      }),
    )
    expect(scored.reviewAreas.length).toBeLessThanOrEqual(3)
    expect(scored.reviewAreas.map((area) => area.id)).toEqual([
      'review_flag_default',
      'review_flag_difficult_payments',
      'review_flag_pslf_unreviewed',
    ])
  })
})
