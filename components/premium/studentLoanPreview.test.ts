import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, createRef } from 'react'
import { expect, it } from 'vitest'
import { combinedQuestions, updateCombined, validateCombined } from '../../modules/reportCard/combined/engine'
import { STUDENT_LOAN_CONCERN, STUDENT_LOAN_TIMING } from '../../modules/reportCard/combined/studentLoanRouting'
import { StudentLoanPreliminary } from './StudentLoanPreliminary'

const priorities = ['student_loan'] as const

it('routes each concern to its own follow-up and reserves timing for booking', () => {
  const branches = { payments: 'payment_range', options: 'repayment_update', pslf: 'pslf_count', past_due: 'latest_notice', records: 'records_available', unknown: 'loan_type' }
  for (const [concern, followUp] of Object.entries(branches)) {
    const ids = combinedQuestions(priorities, { [STUDENT_LOAN_CONCERN]: concern }, 1, 1, 1).map(({ id }) => id)
    expect(ids.slice(0, 2)).toEqual([STUDENT_LOAN_CONCERN, `student_loan.${followUp}`])
    expect(ids[ids.length - 1]).toBe(STUDENT_LOAN_TIMING)
    expect(ids.length - 1).toBeGreaterThanOrEqual(4)
    expect(ids.length - 1).toBeLessThanOrEqual(6)
  }
  const changed = updateCombined(priorities, { [STUDENT_LOAN_CONCERN]: 'pslf', 'student_loan.pslf_count': 'yes' }, STUDENT_LOAN_CONCERN, 'payments', 1, 1, 1)
  expect(changed['student_loan.pslf_count']).toBeUndefined()
})

it('accepts both assessment generations and shows borrower responses before contact collection', () => {
  const answers = {
    [STUDENT_LOAN_CONCERN]: 'pslf', 'student_loan.pslf_count': 'where',
    'student_loan.loan_type': 'federal', 'student_loan.status': 'current',
    'shared.state': 'TX', [STUDENT_LOAN_TIMING]: 'unknown',
  }
  const saved = {
    format: 'combined-priorities-v2', selected: [...priorities], locale: 'en', strategyVersion: 1, cardVersion: 1, insuranceRoutingVersion: 1,
    contact: { fullName: 'Sample Borrower', email: 'test@example.com', phone: '2025550101' },
  }
  expect(validateCombined({ ...saved, diagnostic: answers })).not.toBeNull()
  expect(validateCombined({ ...saved, diagnostic: {
    'student_loan.goal': 'pslf', 'student_loan.loan_type': 'federal',
    'student_loan.status': 'current', 'student_loan.review': 'current',
    'shared.state': 'TX', [STUDENT_LOAN_TIMING]: 'unknown',
  } })).not.toBeNull()
  const html = renderToStaticMarkup(createElement(StudentLoanPreliminary, {
    locale: 'en', answers, heading: createRef<HTMLHeadingElement>(), onBook: () => {}, onBack: () => {},
  }))
  expect(html).toContain('Check your PSLF records')
  expect(html).toContain('I’m not sure where to find it')
  expect(html).toContain('Review My Student Loan Options')
  expect(html).not.toContain('<input')
})
