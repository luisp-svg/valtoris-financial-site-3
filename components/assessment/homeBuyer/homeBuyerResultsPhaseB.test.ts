import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCreditResultsModel } from '../credit/resultsModel'
import { strongCreditDiagnostic } from '../credit/scoreCreditAssessment.test'
import { getStudentLoanResultsModel } from '../studentLoan/resultsModel'
import { strongDiagnostic as strongStudentLoanDiagnostic } from '../studentLoan/scoreStudentLoanAssessment.test'
import {
  HOME_BUYER_CREDIT_DATA_SOURCE,
  HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT,
} from './constants'
import {
  buildHomeBuyerResultsSession,
  getHomeBuyerResultsModel,
  UNAVAILABLE_HOME_BUYER_RESULTS,
} from './resultsModel'
import { HOME_BUYER_SCORING_VERSION } from './scoreHomeBuyerAssessment'
import { strongHomeBuyerDiagnostic } from './scoreHomeBuyerAssessment.test'
import { INITIAL_HOME_BUYER_ANSWERS, type HomeBuyerAssessmentAnswers } from './types'

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

describe('Home Buyer Phase B results model', () => {
  it('produces score, grade, status, categories, strengths, barriers, actions, and flags', () => {
    const model = getHomeBuyerResultsModel(answersFrom())
    expect(model.available).toBe(true)
    expect(model.overallScore).toBe(100)
    expect(model.grade).toBe('A')
    expect(model.statusLabelKey).toBe('status.strongly_prepared')
    expect(model.categoryScores).toHaveLength(8)
    expect(model.strengths.length).toBeGreaterThan(0)
    expect(model.hardRiskFlags).toEqual([])
    expect(model.scoringVersion).toBe(1)
    expect(HOME_BUYER_SCORING_VERSION).toBe(1)
    expect(HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(HOME_BUYER_CREDIT_DATA_SOURCE).toBe('public_self_report')
  })

  it('keeps only firstName on the results session and ignores a fabricated client score', () => {
    const session = buildHomeBuyerResultsSession(answersFrom())
    expect(session.firstName).toBe('Ada')
    expect(session).not.toHaveProperty('lastName')
    expect(session).not.toHaveProperty('email')
    expect(session).not.toHaveProperty('phone')
    expect(JSON.stringify(session)).not.toContain('Lovelace')
    expect(JSON.stringify(session)).not.toContain('ada@example.com')

    const fromSession = getHomeBuyerResultsModel(session)
    const fromAnswers = getHomeBuyerResultsModel(answersFrom())
    expect(fromSession.overallScore).toBe(fromAnswers.overallScore)
    expect(fromSession.grade).toBe(fromAnswers.grade)
  })

  it('does not fabricate results when the diagnostic is incomplete', () => {
    expect(getHomeBuyerResultsModel()).toEqual(UNAVAILABLE_HOME_BUYER_RESULTS)
    expect(getHomeBuyerResultsModel(INITIAL_HOME_BUYER_ANSWERS)).toEqual(UNAVAILABLE_HOME_BUYER_RESULTS)
    expect(getHomeBuyerResultsModel(null).available).toBe(false)
  })

  it('keeps wording diagnostic and leaves other Report Card result models unchanged', () => {
    const copy = readFileSync(join(process.cwd(), 'components/assessment/homeBuyer/copy.ts'), 'utf8')
    expect(copy.toLowerCase()).not.toMatch(/mortgage ready|prequalified|pre-qualified|you are approved/)
    expect(copy).toContain('Strongly prepared')
    expect(copy).toContain('Almost prepared')
    expect(copy).toContain('Building readiness')
    expect(copy).toContain('Early-stage readiness')
    expect(copy).toContain('Significant barriers')
    expect(getCreditResultsModel({ diagnostic: strongCreditDiagnostic() }).available).toBe(true)
    expect(getStudentLoanResultsModel({ diagnostic: strongStudentLoanDiagnostic() }).available).toBe(true)
  })
})
