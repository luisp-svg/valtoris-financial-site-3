import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../constants/routes'
import HomeBuyerReportCardPage from '../../../pages/HomeBuyerReportCardPage'
import HomeBuyerAssessment from '../../../pages/HomeBuyerAssessment'
import HomeBuyerReportCardResults from '../../../pages/HomeBuyerReportCardResults'
import CreditReportCardPage from '../../../pages/CreditReportCardPage'
import StudentLoanReportCardPage from '../../../pages/StudentLoanReportCardPage'
import { homeBuyerCopy } from './copy'
import {
  HOME_BUYER_ASSESSMENT_STEPS,
  HOME_BUYER_CONTACT_STEP,
  HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT,
  HOME_BUYER_FIRST_DIAGNOSTIC_STEP,
  HOME_BUYER_LAST_DIAGNOSTIC_STEP,
} from './constants'
import { HOME_BUYER_QUESTIONS } from './questions'
import {
  isHomeBuyerContactComplete,
  isHomeBuyerDiagnosticComplete,
  isHomeBuyerStepComplete,
} from './completeness'
import {
  buildHomeBuyerResultsSession,
  getHomeBuyerResultsModel,
} from './resultsModel'
import { strongHomeBuyerDiagnostic } from './scoreHomeBuyerAssessment.test'
import { INITIAL_HOME_BUYER_ANSWERS, type HomeBuyerAssessmentAnswers } from './types'
import { resolveSpecializedCopy } from '../specialized/locale'
import type { SpecializedCopyCatalog } from '../specialized/types'

const ROOT = process.cwd()

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function renderAt(path: string, element: ReturnType<typeof createElement>, state?: unknown) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [{ pathname: path, state }] }, element),
  )
}

function answersFrom(diagnostic = strongHomeBuyerDiagnostic()): HomeBuyerAssessmentAnswers {
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

function catalogKeys(catalog: SpecializedCopyCatalog): Record<string, string[]> {
  return {
    questions: Object.keys(catalog.questions).sort(),
    helpers: Object.keys(catalog.helpers).sort(),
    fields: Object.keys(catalog.fields).sort(),
    answers: Object.keys(catalog.answers).sort(),
    placeholders: Object.keys(catalog.placeholders).sort(),
    validation: Object.keys(catalog.validation).sort(),
    ui: Object.keys(catalog.ui).sort(),
    results: Object.keys(catalog.results).sort(),
  }
}

describe('Home Buyer public UI', () => {
  it('wires the three public routes in App using existing conventions', () => {
    const app = source('src/App.tsx')
    expect(app).toContain('HomeBuyerReportCardPage')
    expect(app).toContain('HomeBuyerAssessment')
    expect(app).toContain('HomeBuyerReportCardResults')
    expect(app).toContain('ROUTES.homeBuyerReportCard')
    expect(app).toContain('ROUTES.homeBuyerAssessment')
    expect(app).toContain('ROUTES.homeBuyerReportCardResults')
    expect(ROUTES.homeBuyerReportCard).toBe('/home-buyer-report-card')
    expect(ROUTES.homeBuyerAssessment).toBe('/home-buyer-assessment')
    expect(ROUTES.homeBuyerReportCardResults).toBe('/home-buyer-results')
    expect(app).toContain('CreditReportCardPage')
    expect(app).toContain('StudentLoanReportCardPage')
    expect(Object.values(ROUTES)).not.toContain('/home-buyer')
  })

  it('renders the landing CTA to the contact-first assessment', () => {
    const html = renderAt(ROUTES.homeBuyerReportCard, createElement(HomeBuyerReportCardPage))
    expect(html).toContain('Get My Home Buyer Report Card')
    expect(html).toContain(ROUTES.homeBuyerAssessment)
    expect(html).toContain('Share Contact and Consent')
    expect(html).toContain('Answer 10 Diagnostic Groups')
    expect(html.toLowerCase()).not.toMatch(/mortgage ready|prequalified|pre-qualified|you are approved/)
    expect(html).toContain('self-reported readiness diagnostic')
  })

  it('starts the assessment on contact + consent before any diagnostic group', () => {
    const html = renderAt(ROUTES.homeBuyerAssessment, createElement(HomeBuyerAssessment))
    expect(html).toContain('Contact and acknowledgments')
    expect(html).toContain('First Name')
    expect(html).toContain('Acknowledgments')
    expect(html).not.toContain(
      resolveSpecializedCopy(homeBuyerCopy, 'en', 'questions', HOME_BUYER_QUESTIONS[0].labelKey),
    )
    expect(HOME_BUYER_CONTACT_STEP).toBe(1)
    expect(HOME_BUYER_FIRST_DIAGNOSTIC_STEP).toBe(2)
    expect(HOME_BUYER_LAST_DIAGNOSTIC_STEP).toBe(11)
    expect(HOME_BUYER_ASSESSMENT_STEPS).toBe(11)
    expect(HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(HOME_BUYER_QUESTIONS).toHaveLength(10)
  })

  it('requires contact completeness before diagnostic progression', () => {
    expect(isHomeBuyerStepComplete(HOME_BUYER_CONTACT_STEP, INITIAL_HOME_BUYER_ANSWERS)).toBe(false)
    expect(isHomeBuyerContactComplete(answersFrom())).toBe(true)
    expect(isHomeBuyerStepComplete(HOME_BUYER_CONTACT_STEP, answersFrom())).toBe(true)
    expect(isHomeBuyerStepComplete(HOME_BUYER_FIRST_DIAGNOSTIC_STEP, INITIAL_HOME_BUYER_ANSWERS)).toBe(
      false,
    )
    expect(isHomeBuyerDiagnosticComplete(strongHomeBuyerDiagnostic())).toBe(true)
    expect(isHomeBuyerStepComplete(HOME_BUYER_FIRST_DIAGNOSTIC_STEP, answersFrom())).toBe(true)
  })

  it('submits through the existing public CRM path only', () => {
    const assessment = source('pages/HomeBuyerAssessment.tsx')
    expect(assessment).toContain('completePublicReportCardCrmSubmission')
    expect(assessment).toContain("assessmentType: 'home_buyer'")
    expect(assessment).toContain('buildHomeBuyerResultsSession')
    expect(assessment).not.toContain('/api/ingest-home-buyer')
    expect(assessment.toLowerCase()).not.toContain('create opportunity')
    expect(source('components/assessment/homeBuyer/ingestBoundary.ts')).not.toContain('opportunity')
  })

  it('renders server-derived results from diagnostic + firstName only', () => {
    const answers = answersFrom()
    const session = buildHomeBuyerResultsSession(answers)
    expect(session.firstName).toBe('Ada')
    expect(session).not.toHaveProperty('lastName')
    expect(session).not.toHaveProperty('email')
    expect(session).not.toHaveProperty('phone')
    const model = getHomeBuyerResultsModel(session)
    expect(model.available).toBe(true)
    expect(model.overallScore).toBe(100)
    expect(model.grade).toBe('A')
    expect(model.statusLabelKey).toBe('status.strongly_prepared')

    const html = renderAt(ROUTES.homeBuyerReportCardResults, createElement(HomeBuyerReportCardResults), {
      answers: session,
    })
    expect(html).toContain('100')
    expect(html).toContain('A — Strongly prepared')
    expect(html).toContain('Credit Readiness')
    expect(html).toContain('Strengths')
    expect(html).toContain('Prepared for Ada')
    expect(html).not.toContain('Lovelace')
    expect(html).not.toContain('ada@example.com')
    expect(html).not.toContain('555-0100')
    expect(html).toContain('self-reported readiness diagnostic')
    expect(html.toLowerCase()).not.toMatch(/mortgage ready|prequalified|pre-qualified|you are approved/)
    expect(html).toContain('Review My Results With Valtoris')
    expect(html).toContain('Retake Assessment')
  })

  it('keeps EN/ES catalogs key-complete and leaves Credit/Student Loan landings unchanged', () => {
    expect(catalogKeys(homeBuyerCopy.es!)).toEqual(catalogKeys(homeBuyerCopy.en!))
    for (const question of HOME_BUYER_QUESTIONS) {
      expect(resolveSpecializedCopy(homeBuyerCopy, 'en', 'questions', question.labelKey)).not.toBe(
        question.labelKey,
      )
      expect(resolveSpecializedCopy(homeBuyerCopy, 'es', 'questions', question.labelKey)).not.toBe(
        question.labelKey,
      )
    }
    const creditHtml = renderAt('/credit-report-card', createElement(CreditReportCardPage))
    const studentHtml = renderAt('/student-loan-report-card', createElement(StudentLoanReportCardPage))
    expect(creditHtml).toContain('Get My Credit Report Card')
    expect(studentHtml.toLowerCase()).toContain('student loan')
  })
})
