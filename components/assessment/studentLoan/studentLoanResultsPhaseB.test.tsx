import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CALENDLY_REPORT_CARD_URL } from '../../../constants/urls'
import StudentLoanReportCardResults from '../../../pages/StudentLoanReportCardResults'
import { PUBLIC_REPORT_CARD_ASSESSMENT_TYPES } from '../../../modules/reportCard/publicIngestCatalog'
import { canSubmitStudentLoanToCrm, getStudentLoanSubmitBoundary } from './ingestBoundary'
import {
  buildStudentLoanResultsSession,
  getStudentLoanResultsModel,
  type StudentLoanResultsSession,
} from './resultsModel'
import { STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS } from './constants'
import { INITIAL_STUDENT_LOAN_ANSWERS, type StudentLoanAssessmentAnswers } from './types'
import { strongDiagnostic } from './scoreStudentLoanAssessment.test'

function answersFrom(diagnostic = strongDiagnostic()): StudentLoanAssessmentAnswers {
  return {
    diagnostic,
    contact: {
      firstName: 'Alex',
      lastName: 'Rivera',
      email: 'alex@example.com',
      phone: '5551112222',
    },
  }
}

function resultsSessionFrom(diagnostic = strongDiagnostic()): StudentLoanResultsSession {
  return buildStudentLoanResultsSession(answersFrom(diagnostic))
}

function renderResults(state?: { answers: StudentLoanResultsSession }) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: '/student-loan-results', state }] },
      createElement(StudentLoanReportCardResults),
    ),
  )
}

describe('Student Loan Phase B results', () => {
  it('renders a real score, grade, categories, goal, and booking CTA from valid answers', () => {
    const model = getStudentLoanResultsModel(answersFrom())
    expect(model.available).toBe(true)
    expect(model.overallScore).toBe(100)
    expect(model.grade).toBe('A')
    expect(model.categoryScores).toHaveLength(5)
    expect(model.primaryGoal).toBe('understand_options')
    expect(model.informationalBalance).toBe('over_100k')
    expect(model.recommendedNextStep?.href).toBe(CALENDLY_REPORT_CARD_URL)

    const html = renderResults({ answers: resultsSessionFrom() })
    expect(html).toContain('Student Loan Health Score')
    expect(html).toContain('100')
    expect(html).toContain('A — Optimized')
    expect(html).toContain('Loan Status &amp; Payment Stability')
    expect(html).toContain('Understand my options')
    expect(html).toContain('Prepared for Alex')
    expect(html).not.toContain('Rivera')
    expect(html).not.toContain('alex@example.com')
    expect(html).not.toContain('5551112222')
    expect(html).toContain('Review My Results With Valtoris')
    expect(html).toContain(CALENDLY_REPORT_CARD_URL)
    expect(html).toContain('not a federal determination')
    expect(html).not.toContain('Your Student Loan Report Card results are not available yet.')
    expect(html).not.toMatch(/you qualify|you will save|eligible for forgiveness|new monthly payment/i)
  })

  it('renders the default Immediate Review flag above the score', () => {
    const html = renderResults({
      answers: resultsSessionFrom(strongDiagnostic({ loan_status: 'default' })),
    })
    expect(html).toContain('data-flag-id="flag_default"')
    expect(html).toContain('Immediate Review')
    expect(html.indexOf('Critical review flags')).toBeLessThan(html.indexOf('student-loan-overall-score'))
  })

  it('shows a safe unavailable state without session answers', () => {
    const html = renderResults()
    expect(html).toContain('Your Student Loan Report Card results are not available yet.')
    expect(html).not.toContain('data-testid="student-loan-overall-score"')
    expect(html).not.toContain('Review My Results With Valtoris')
    expect(getStudentLoanResultsModel(INITIAL_STUDENT_LOAN_ANSWERS).available).toBe(false)
  })

  it('stores only diagnostic answers and firstName in the results session', () => {
    const full = answersFrom()
    const session = buildStudentLoanResultsSession(full)
    const serialized = JSON.stringify(session)
    expect(session.diagnostic).toEqual(full.diagnostic)
    expect(session.firstName).toBe('Alex')
    expect(Object.keys(session).sort()).toEqual(['diagnostic', 'firstName'])
    expect(serialized).not.toContain('Rivera')
    expect(serialized).not.toContain('alex@example.com')
    expect(serialized).not.toContain('5551112222')
    expect(serialized).not.toContain('lastName')
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('phone')
    expect(serialized).not.toContain('consent')
    expect(serialized).not.toContain('privacy')
    expect(serialized).not.toContain('honeypot')
    expect(getStudentLoanResultsModel(session).available).toBe(true)
    expect(getStudentLoanResultsModel(session).overallScore).toBe(100)

    const assessment = readFileSync(join(process.cwd(), 'pages/StudentLoanAssessment.tsx'), 'utf8')
    expect(assessment).toContain('buildStudentLoanResultsSession')
    expect(assessment).not.toContain('JSON.stringify(finalAnswers)')
  })

  it('keeps CRM ingest disabled and does not auto-create Opportunities', () => {
    expect(canSubmitStudentLoanToCrm()).toBe(false)
    expect(getStudentLoanSubmitBoundary().enabled).toBe(false)
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).not.toContain('student_loan')
    const assessment = readFileSync(join(process.cwd(), 'pages/StudentLoanAssessment.tsx'), 'utf8')
    const results = readFileSync(join(process.cwd(), 'pages/StudentLoanReportCardResults.tsx'), 'utf8')
    expect(assessment).not.toContain('completePublicReportCardCrmSubmission')
    expect(assessment).not.toContain('/api/ingest-family-report-card')
    expect(results).not.toContain('/api/ingest-family-report-card')
    expect(`${assessment}\n${results}`.toLowerCase()).not.toContain('create opportunity')
  })

  it('still has exactly 10 diagnostic questions', () => {
    expect(STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS).toHaveLength(10)
  })
})
