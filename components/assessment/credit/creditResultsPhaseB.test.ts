import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CALENDLY_REPORT_CARD_URL } from '../../../constants/urls'
import CreditReportCardResults from '../../../pages/CreditReportCardResults'
import { PUBLIC_REPORT_CARD_ASSESSMENT_TYPES } from '../../../modules/reportCard/publicIngestCatalog'
import { canSubmitCreditToCrm, CREDIT_CRM_INGEST_ENABLED } from './ingestBoundary'
import {
  buildCreditResultsSession,
  creditTopReviewAreasHeadingKey,
  getCreditResultsModel,
  type CreditResultsSession,
} from './resultsModel'
import { CREDIT_DIAGNOSTIC_QUESTION_IDS } from './constants'
import { INITIAL_CREDIT_ANSWERS, type CreditAssessmentAnswers } from './types'
import { strongCreditDiagnostic } from './scoreCreditAssessment.test'
import { CREDIT_SCORING_VERSION } from './scoreCreditAssessment'

function answersFrom(diagnostic = strongCreditDiagnostic()): CreditAssessmentAnswers {
  return {
    diagnostic,
    contact: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '555-0100',
    },
  }
}

function resultsSessionFrom(diagnostic = strongCreditDiagnostic()): CreditResultsSession {
  return buildCreditResultsSession(answersFrom(diagnostic))
}

function renderResults(state?: { answers: CreditResultsSession }) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: '/credit-results', state }] },
      createElement(CreditReportCardResults),
    ),
  )
}

describe('Credit Report Card Phase B results', () => {
  it('renders a real score, grade, categories, goal, and booking CTA from valid answers', () => {
    const model = getCreditResultsModel(answersFrom())
    expect(model.available).toBe(true)
    expect(model.overallScore).toBe(100)
    expect(model.grade).toBe('A')
    expect(model.categoryScores).toHaveLength(8)
    expect(model.primaryGoal).toBe('general_health')
    expect(model.recommendedNextStep?.href).toBe(CALENDLY_REPORT_CARD_URL)
    expect(CREDIT_SCORING_VERSION).toBe(1)

    const html = renderResults({ answers: resultsSessionFrom() })
    expect(html).toContain('Credit Report Card Score')
    expect(html).toContain('data-testid="credit-overall-score"')
    expect(html).toContain('100')
    expect(html).toContain('A — Strong')
    expect(html).toContain('Payment History')
    expect(html).toContain('Improve my overall credit health')
    expect(html).toContain('Prepared for Ada')
    expect(html).not.toContain('Lovelace')
    expect(html).not.toContain('ada@example.com')
    expect(html).not.toContain('555-0100')
    expect(html).toContain('Review My Results With Valtoris')
    expect(html).toContain(CALENDLY_REPORT_CARD_URL)
    expect(html).not.toContain('Your Credit Report Card results are not available yet.')
    expect(html.toLowerCase()).not.toMatch(
      /guaranteed deletion|guaranteed score increase|you qualify|100-point/,
    )
    expect(html.toLowerCase()).toMatch(/does not guarantee/)
  })

  it('recomputes the score from diagnostic answers and ignores a score in navigation state', () => {
    const fromDiagnostic = getCreditResultsModel(resultsSessionFrom())
    const fromIncomplete = getCreditResultsModel(INITIAL_CREDIT_ANSWERS)
    expect(fromDiagnostic.available).toBe(true)
    expect(fromDiagnostic.overallScore).toBe(100)
    expect(fromIncomplete.available).toBe(false)
    expect(fromIncomplete.overallScore).toBeNull()

    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {
          initialEntries: [
            {
              pathname: '/credit-results?score=99&grade=A',
              state: { answers: resultsSessionFrom(strongCreditDiagnostic({ utilization: 'maxed' })) },
            },
          ],
        },
        createElement(CreditReportCardResults),
      ),
    )
    expect(html).toContain('data-testid="credit-overall-score"')
    expect(html).not.toContain('>99<')
    expect(html).not.toMatch(/[?&]email=|[?&]phone=|[?&]ssn=/)
  })

  it('renders Immediate Review flags above the score', () => {
    const html = renderResults({
      answers: resultsSessionFrom(strongCreditDiagnostic({ current_status: 'past_due' })),
    })
    expect(html).toContain('data-flag-id="flag_past_due"')
    expect(html).toContain('Immediate Review')
    expect(html.indexOf('Critical review flags')).toBeLessThan(html.indexOf('credit-overall-score'))
  })

  it('shows a safe unavailable state without session answers', () => {
    const html = renderResults()
    expect(html).toContain('Your Credit Report Card results are not available yet.')
    expect(html).not.toContain('data-testid="credit-overall-score"')
    expect(html).not.toContain('Review My Results With Valtoris')
    expect(getCreditResultsModel(INITIAL_CREDIT_ANSWERS).available).toBe(false)
  })

  it('stores only diagnostic answers and firstName in the results session', () => {
    const full = answersFrom()
    const session = buildCreditResultsSession(full)
    const serialized = JSON.stringify(session)
    expect(session.diagnostic).toEqual(full.diagnostic)
    expect(session.firstName).toBe('Ada')
    expect(Object.keys(session).sort()).toEqual(['diagnostic', 'firstName'])
    expect(serialized).not.toContain('Lovelace')
    expect(serialized).not.toContain('ada@example.com')
    expect(serialized).not.toContain('555-0100')
    expect(serialized).not.toContain('lastName')
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('phone')
    expect(serialized).not.toContain('consent')
    expect(serialized).not.toContain('honeypot')
    expect(getCreditResultsModel(session).available).toBe(true)
    expect(getCreditResultsModel(session).overallScore).toBe(100)

    const assessment = readFileSync(join(process.cwd(), 'pages/CreditAssessment.tsx'), 'utf8')
    expect(assessment).toContain('buildCreditResultsSession')
    expect(assessment).not.toContain('JSON.stringify(finalAnswers)')
  })

  it('uses the existing public ingest path and does not auto-create Opportunities', () => {
    expect(CREDIT_CRM_INGEST_ENABLED).toBe(true)
    expect(canSubmitCreditToCrm()).toBe(true)
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).toContain('credit')
    const assessment = readFileSync(join(process.cwd(), 'pages/CreditAssessment.tsx'), 'utf8')
    const results = readFileSync(join(process.cwd(), 'pages/CreditReportCardResults.tsx'), 'utf8')
    expect(assessment).toContain('completePublicReportCardCrmSubmission')
    expect(assessment).not.toContain('/api/ingest-credit')
    expect(`${assessment}\n${results}`.toLowerCase()).not.toContain('create opportunity')
  })

  it('still has exactly 10 diagnostic questions', () => {
    expect(CREDIT_DIAGNOSTIC_QUESTION_IDS).toHaveLength(10)
  })

  it('uses count-aware review-area headings and a zero-area state without empty cards', () => {
    expect(creditTopReviewAreasHeadingKey(0)).toBe('noReviewAreas')
    expect(creditTopReviewAreasHeadingKey(1)).toBe('topAreas1')
    expect(creditTopReviewAreasHeadingKey(2)).toBe('topAreas2')
    expect(creditTopReviewAreasHeadingKey(3)).toBe('topAreas3')

    const zero = renderResults({ answers: resultsSessionFrom() })
    expect(getCreditResultsModel(answersFrom()).topReviewAreas).toEqual([])
    expect(zero).toContain('No immediate review areas were identified from your answers.')
    expect(zero).not.toContain('Top Area to Review')
    expect(zero).not.toContain('data-review-id=')

    const one = renderResults({
      answers: resultsSessionFrom(strongCreditDiagnostic({ utilization: '10_30' })),
    })
    expect(one).toContain('Top Area to Review')
    expect(one).toContain('data-review-id="review_category_utilization"')
    expect(one).not.toContain('Top 3 Areas to Review')

    const two = renderResults({
      answers: resultsSessionFrom(
        strongCreditDiagnostic({ utilization: '10_30', oldest_account: '5_10' }),
      ),
    })
    expect(two).toContain('Top 2 Areas to Review')
    expect(two).toContain('data-review-id="review_category_utilization"')
    expect(two).toContain('data-review-id="review_category_credit_structure"')

    const three = renderResults({
      answers: resultsSessionFrom(
        strongCreditDiagnostic({
          current_status: 'past_due',
          negative_items: ['collections'],
          utilization: 'maxed',
        }),
      ),
    })
    expect(three).toContain('Top 3 Areas to Review')
  })
})
