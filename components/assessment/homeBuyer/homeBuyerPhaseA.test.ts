import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PUBLIC_REPORT_CARD_ASSESSMENT_TYPES } from '../../../modules/reportCard/publicIngestCatalog'
import {
  HOME_BUYER_ASSESSMENT_TYPE,
  SPECIALIZED_ASSESSMENT_PRODUCTS,
  isSpecializedAssessmentProduct,
} from '../../../modules/reportCard/specializedAssessmentCatalog'
import { applyExclusiveMultiValue } from '../specialized/answers'
import { resolveSpecializedCopy } from '../specialized/locale'
import {
  FORBIDDEN_HOME_BUYER_FIELD_TOKENS,
  HOME_BUYER_ASSESSMENT_STEPS,
  HOME_BUYER_CONTACT_STEP,
  HOME_BUYER_CONTACT_STEP_ID,
  HOME_BUYER_CREDIT_DATA_SOURCE,
  HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT,
  HOME_BUYER_DIAGNOSTIC_QUESTION_IDS,
  HOME_BUYER_FIRST_DIAGNOSTIC_STEP,
  HOME_BUYER_LAST_DIAGNOSTIC_STEP,
  HOME_BUYER_SCORE_NAME,
} from './constants'
import { homeBuyerCopy } from './copy'
import { isHomeBuyerContactComplete, isHomeBuyerDiagnosticComplete } from './completeness'
import { HOME_BUYER_CRM_INGEST_ENABLED, canSubmitHomeBuyerToCrm } from './ingestBoundary'
import { HOME_BUYER_QUESTIONS, homeBuyerQuestionById } from './questions'
import { INITIAL_HOME_BUYER_ANSWERS } from './types'

const ROOT = process.cwd()

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function collectCanonicalValues(): string[] {
  const values: string[] = []
  for (const question of HOME_BUYER_QUESTIONS) {
    for (const field of question.fields) {
      if (field.input === 'short_text') continue
      for (const option of field.options) values.push(option.value)
    }
  }
  return values
}

describe('Home Buyer Phase A foundation', () => {
  it('defines exactly 10 diagnostic question groups and excludes contact', () => {
    expect(HOME_BUYER_DIAGNOSTIC_QUESTION_IDS).toEqual([
      'credit_profile',
      'credit_risk_flags',
      'income_employment',
      'debt_dti_readiness',
      'savings_reserves',
      'cash_flow_housing',
      'down_payment_readiness',
      'documentation_readiness',
      'purchase_situation',
      'purchase_timeline',
    ])
    expect(HOME_BUYER_QUESTIONS.map((question) => question.id)).toEqual([...HOME_BUYER_DIAGNOSTIC_QUESTION_IDS])
    expect(HOME_BUYER_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(HOME_BUYER_CONTACT_STEP_ID).toBe('contact')
    expect(HOME_BUYER_DIAGNOSTIC_QUESTION_IDS).not.toContain(HOME_BUYER_CONTACT_STEP_ID)
    expect(HOME_BUYER_CONTACT_STEP).toBe(1)
    expect(HOME_BUYER_FIRST_DIAGNOSTIC_STEP).toBe(2)
    expect(HOME_BUYER_LAST_DIAGNOSTIC_STEP).toBe(11)
    expect(HOME_BUYER_ASSESSMENT_STEPS).toBe(11)
    expect(isHomeBuyerContactComplete(INITIAL_HOME_BUYER_ANSWERS)).toBe(false)
    expect(isHomeBuyerDiagnosticComplete(INITIAL_HOME_BUYER_ANSWERS.diagnostic)).toBe(false)
  })

  it('stores language-neutral canonical values', () => {
    const values = collectCanonicalValues()
    expect(values).toEqual(
      expect.arrayContaining([
        '740_plus',
        'below_580',
        'late_or_delinquent',
        'collections_charge_offs',
        'bankruptcy_foreclosure',
        'w2',
        'not_working',
        'under_36',
        'over_50',
        'under_2k',
        '6_plus',
        'leftover_comfortable',
        '20_plus',
        'income_docs',
        'government_id',
        'first_time',
        '0_3_months',
        'not_sure',
      ]),
    )
    expect(values).not.toContain('740+')
    expect(values).not.toContain('First-time buyer')
    for (const value of values) {
      expect(value).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('treats exclusive none / not_sure values as replacements on multi-selects', () => {
    const risks = homeBuyerQuestionById('credit_risk_flags')?.fields[0]
    const docs = homeBuyerQuestionById('documentation_readiness')?.fields[0]
    expect(risks?.input).toBe('multi')
    expect(docs?.input).toBe('multi')
    if (risks?.input !== 'multi' || docs?.input !== 'multi') throw new Error('expected multi fields')
    expect(risks.exclusiveValues).toEqual(['none', 'not_sure'])
    expect(docs.exclusiveValues).toEqual(['none', 'not_sure'])
    expect(applyExclusiveMultiValue(risks, ['late_or_delinquent'], ['late_or_delinquent', 'none'])).toEqual([
      'none',
    ])
    expect(applyExclusiveMultiValue(risks, ['none'], ['none', 'collections_charge_offs'])).toEqual([
      'collections_charge_offs',
    ])
    expect(applyExclusiveMultiValue(docs, ['income_docs'], ['income_docs', 'not_sure'])).toEqual(['not_sure'])
  })

  it('does not collect SSN, DOB, credit logins, lender credentials, uploads, or account numbers', () => {
    const fieldIds = HOME_BUYER_QUESTIONS.flatMap((question) => [
      question.id,
      ...question.fields.map((field) => field.id),
    ])
    const typeKeys = source('components/assessment/homeBuyer/types.ts')
    const questionsSource = source('components/assessment/homeBuyer/questions.ts')
    expect(questionsSource).not.toContain('short_text')
    expect(questionsSource.toLowerCase()).not.toContain('upload')
    expect(HOME_BUYER_CREDIT_DATA_SOURCE).toBe('public_self_report')
    expect(typeKeys).toContain('self_reported_score_range')
    expect(typeKeys).not.toMatch(/idiq|verified_credit|bureau_score/i)
    for (const token of FORBIDDEN_HOME_BUYER_FIELD_TOKENS) {
      expect(fieldIds.join(' ')).not.toContain(token)
      expect(typeKeys).not.toMatch(new RegExp(`\\b${token}\\b`, 'i'))
    }
  })

  it('keeps English labels on locale keys and implements Spanish as a presentation layer', () => {
    expect(homeBuyerCopy.es).not.toBeNull()
    expect(homeBuyerCopy.en).toBeTruthy()
    expect(HOME_BUYER_SCORE_NAME).toBe('Home Buyer Report Card Score')
    expect(HOME_BUYER_ASSESSMENT_TYPE).toBe('home_buyer')
    for (const question of HOME_BUYER_QUESTIONS) {
      expect(homeBuyerCopy.en?.questions[question.labelKey]).toBeTruthy()
      expect(homeBuyerCopy.en?.questions[question.labelKey]).not.toBe(question.labelKey)
      if (question.helperKey) {
        expect(homeBuyerCopy.en?.helpers[question.helperKey]).toBeTruthy()
      }
      for (const field of question.fields) {
        expect(homeBuyerCopy.en?.fields[field.labelKey] ?? homeBuyerCopy.en?.questions[field.labelKey]).toBeTruthy()
        if (field.input === 'short_text') continue
        for (const option of field.options) {
          const label = resolveSpecializedCopy(homeBuyerCopy, 'en', 'answers', option.labelKey)
          expect(label).not.toBe(option.labelKey)
          expect(option.value).not.toBe(label)
        }
      }
    }
  })

  it('registers the specialized product without adding App routes or UI pages', () => {
    expect(isSpecializedAssessmentProduct('home_buyer')).toBe(true)
    expect(SPECIALIZED_ASSESSMENT_PRODUCTS).toEqual(['student_loan', 'credit', 'home_buyer'])
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).toContain('home_buyer')
    expect(HOME_BUYER_CRM_INGEST_ENABLED).toBe(true)
    expect(canSubmitHomeBuyerToCrm()).toBe(true)
    const app = source('src/App.tsx')
    expect(app).not.toContain('HomeBuyer')
    expect(app).not.toContain('home-buyer-assessment')
    expect(source('components/assessment/homeBuyer/ingestBoundary.ts')).not.toContain('opportunity')
    expect(source('components/assessment/homeBuyer/ingestBoundary.ts')).not.toContain('idiq')
  })
})
