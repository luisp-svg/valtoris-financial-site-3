import { renderToStaticMarkup } from 'react-dom/server'
import { createElement, createRef } from 'react'
import { expect, it } from 'vitest'
import { combinedQuestions, validCombinedQuestion } from '../../modules/reportCard/combined/engine'
import { StudentLoanPreliminary } from './StudentLoanPreliminary'

it('asks about the borrower’s concern first and formats a next step before contact collection', () => {
  const [goal] = combinedQuestions(['student_loan'], {}, 1, 1, 1)
  expect(goal.id).toBe('student_loan.goal')
  for (const value of ['payments', 'options', 'pslf', 'past_due', 'unknown']) {
    expect(validCombinedQuestion(goal, value)).toBe(true)
  }

  const html = renderToStaticMarkup(createElement(StudentLoanPreliminary, {
    locale: 'en', goal: 'pslf', heading: createRef<HTMLHeadingElement>(),
    onBook: () => {}, onBack: () => {},
  }))
  expect(html).toContain('Check your PSLF records')
  expect(html).toContain('Review My Student Loan Options')
  expect(html).not.toContain('<input')
})
