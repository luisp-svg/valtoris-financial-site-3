import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { extractReportCardSubmittedAnswers } from './submittedReportCardAnswers'
import { mapPublicFamilyDiagnosticDetail } from './diagnosticFormatters'
import PublicFamilyDiagnosticDetailView from './PublicFamilyDiagnosticDetailView'
import { INITIAL_DEMO_ANSWERS } from '../../../components/assessment/types'
import { INITIAL_BUSINESS_ANSWERS } from '../../../components/assessment/business/types'
import { INITIAL_RETIREMENT_ANSWERS } from '../../../components/assessment/retirement/types'
import { INITIAL_CALCULATOR_ANSWERS } from '../../../components/calculator/types'
import { validStudentLoanAnswersFixture, validCreditAnswersFixture, validHomeBuyerAnswersFixture } from '../../../server/ingest/familyReportCard/testFixtures'

const shapes = { family: INITIAL_DEMO_ANSWERS, business: INITIAL_BUSINESS_ANSWERS, retirement: INITIAL_RETIREMENT_ANSWERS, protection: INITIAL_CALCULATOR_ANSWERS }
const populated = Object.fromEntries(Object.entries(shapes).map(([type, shape]) => [type,
  Object.fromEntries(Object.entries(shape).map(([section, fields]) => [section,
    Object.fromEntries(Object.keys(fields).map(field => [field, field === 'selected' || field === 'accountTypes' ? ['saved-choice'] : 'saved-response'])),
  ])),
]))

describe('saved report card answers', () => {
  it.each(Object.entries(shapes))('covers every known %s response without exposing unknown fields', (type, shape) => {
    const answers = { ...populated[type], internal: { secret: 'hidden' } }
    const rows = extractReportCardSubmittedAnswers(type, answers)
    const expected = Object.entries(shape).flatMap(([section, fields]) => Object.keys(fields)
      .filter(field => !(section === 'leadDetails' && field === 'consentGiven'))
      .map(field => `${section}.${field}`))
    expect(rows.map(row => row.id)).toEqual(expected)
    expect(JSON.stringify(rows)).not.toContain('hidden')
  })

  it('uses original wording for choices, goals and account selections', () => {
    expect(extractReportCardSubmittedAnswers('family', { financial: { monthlyCashFlow: 'break-even' }, goals: { selected: ['protect-family', 'buy-home'] } }).map(row => row.value))
      .toEqual(['We usually break even', 'Protect my family, Buy a Home / Homeownership'])
    expect(extractReportCardSubmittedAnswers('business', { business: { employees: '2-5', name: 'Example Company' } }).map(row => row.value))
      .toEqual(['Example Company', '2–5 employees'])
    expect(extractReportCardSubmittedAnswers('protection', { income: { incomeReplacementYears: '15' }, finalExpenses: { amount: '25000' } }).map(row => row.value))
      .toEqual(['15 Years (Recommended)', '$25,000'])
    expect(extractReportCardSubmittedAnswers('retirement', { incomeSources: { pensionElectionUnderstood: 'na' }, tax: { accountTypes: ['roth-ira'] } })[0].value).toBe('Not applicable')
  })

  it('does not invent missing answers or discard zero and negative responses', () => {
    for (const type of Object.keys(shapes)) expect(extractReportCardSubmittedAnswers(type, null)).toEqual([])
    expect(extractReportCardSubmittedAnswers('family', { financial: { totalDebt: 0 }, protection: { hasWill: false, hasTrust: { private: 'hidden' } } }).map(row => row.value)).toEqual(['0', 'false'])
  })

  const fixtures = { ...populated, student_loan: validStudentLoanAnswersFixture(), credit: validCreditAnswersFixture(), home_buyer: validHomeBuyerAnswersFixture() }
  it.each(Object.entries(fixtures))('renders %s saved responses and stored grades in both CRM views', (type, answers) => {
    const detail = mapPublicFamilyDiagnosticDetail({
      id: 'assessment-test', assessment_type: type, capture_channel: 'public_self_report',
      status: 'completed', completed_at: '2026-09-24T12:00:00Z', answers,
      overall_score: 71, overall_grade: 'C', derived_metrics: { protectionGapFormatted: '$250,000', categories: [{ id: 'test', title: 'Stored category', score: 63, grade: 'D' }] },
    }, 'household-test', null)!
    expect(detail.submittedAnswers.length).toBeGreaterThan(0)
    for (const variant of ['embedded', 'page'] as const) {
      const html = renderToStaticMarkup(createElement(StaticRouter, { location: "/" }, createElement(PublicFamilyDiagnosticDetailView, { detail, variant })))
      expect(html).toContain('Submitted questions and answers')
      if (type === 'protection') expect(html).toContain('$250,000')
      else expect(html).toContain('Diagnostic grade">C')
      expect(html).toContain('Stored category')
      expect(html).toContain('(D)')
      for (const answer of detail.submittedAnswers) {
        const escaped = renderToStaticMarkup(createElement('span', null, answer.value)).slice(6, -7)
        expect(html).toContain(escaped)
      }
    }
  })
})
