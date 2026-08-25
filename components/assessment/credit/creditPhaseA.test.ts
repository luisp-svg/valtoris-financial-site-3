import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PUBLIC_REPORT_CARD_ASSESSMENT_TYPES } from '../../../modules/reportCard/publicIngestCatalog'
import {
  CREDIT_ASSESSMENT_TYPE,
  SPECIALIZED_ASSESSMENT_PRODUCTS,
  isSpecializedAssessmentProduct,
} from '../../../modules/reportCard/specializedAssessmentCatalog'
import { ROUTES } from '../../../constants/routes'
import { validIngestRequestBodyFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'
import CreditReportCardPage from '../../../pages/CreditReportCardPage'
import CreditReportCardResults from '../../../pages/CreditReportCardResults'
import { INITIAL_FAMILY_CONSENT_STATE } from '../../reportCard/familyIngest/familyConsent'
import {
  applyExclusiveMultiValue,
  applyFieldChange,
  isFieldVisible,
  isQuestionComplete,
} from '../specialized/answers'
import { resolveSpecializedCopy } from '../specialized/locale'
import {
  CREDIT_ASSESSMENT_STEPS,
  CREDIT_CONTACT_STEP,
  CREDIT_CONTACT_STEP_ID,
  CREDIT_DIAGNOSTIC_QUESTION_COUNT,
  CREDIT_DIAGNOSTIC_QUESTION_IDS,
  CREDIT_SCORE_NAME,
  FORBIDDEN_CREDIT_FIELD_TOKENS,
} from './constants'
import { creditCopy } from './copy'
import {
  CREDIT_CRM_INGEST_ENABLED,
  canSubmitCreditToCrm,
} from './ingestBoundary'
import { CREDIT_QUESTIONS, creditQuestionById } from './questions'
import { buildCreditResultsSession, getCreditResultsModel } from './resultsModel'
import { isCreditContactComplete, isCreditDiagnosticComplete } from './completeness'
import { INITIAL_CREDIT_ANSWERS } from './types'

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations')
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function collectCanonicalValues(): string[] {
  const values: string[] = []
  for (const question of CREDIT_QUESTIONS) {
    for (const field of question.fields) {
      if (field.input === 'short_text') continue
      for (const option of field.options) values.push(option.value)
    }
  }
  return values
}

describe('Credit Report Card Phase A foundation', () => {
  it('defines exactly 10 diagnostic question groups and excludes contact', () => {
    expect(CREDIT_DIAGNOSTIC_QUESTION_IDS).toEqual([
      'credit_goal',
      'self_reported_score',
      'report_review',
      'payment_history',
      'negative_items',
      'utilization',
      'credit_structure',
      'recent_credit',
      'financial_stability',
      'urgency_actions',
    ])
    expect(CREDIT_QUESTIONS.map((question) => question.id)).toEqual([...CREDIT_DIAGNOSTIC_QUESTION_IDS])
    expect(CREDIT_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(CREDIT_CONTACT_STEP_ID).toBe('contact')
    expect(CREDIT_DIAGNOSTIC_QUESTION_IDS).not.toContain(CREDIT_CONTACT_STEP_ID)
    expect(CREDIT_CONTACT_STEP).toBe(12)
    expect(CREDIT_ASSESSMENT_STEPS).toBe(12)
    expect(isCreditContactComplete(INITIAL_CREDIT_ANSWERS)).toBe(false)
    expect(isCreditDiagnosticComplete(INITIAL_CREDIT_ANSWERS.diagnostic)).toBe(false)
    expect(creditQuestionById('report_review')?.kind).toBe('group')
    expect(creditQuestionById('payment_history')?.kind).toBe('group')
    expect(creditQuestionById('credit_structure')?.kind).toBe('group')
    expect(creditQuestionById('recent_credit')?.kind).toBe('group')
    expect(creditQuestionById('financial_stability')?.kind).toBe('group')
    expect(creditQuestionById('urgency_actions')?.kind).toBe('group')
  })

  it('stores language-neutral canonical values matching the approved set', () => {
    const values = collectCanonicalValues()
    expect(values).toEqual(
      expect.arrayContaining([
        'buy_home',
        'vehicle',
        'rent',
        'lower_rates',
        'business_financing',
        'rebuild_credit',
        'general_health',
        '740_plus',
        '700_739',
        '660_699',
        '620_659',
        '580_619',
        'below_580',
        'last_30_days',
        'never',
        '30_days',
        '90_plus',
        'currently_behind',
        'collections',
        'charge_offs',
        'other_derogatory',
        'under_10',
        'maxed',
        '0',
        '6_plus',
        'under_2',
        '10_plus',
        'one',
        'several',
        'comfortable',
        'struggling',
        'past_due',
        'asap',
        'just_exploring',
        'self_disputes',
        'prior_repair_company',
      ]),
    )
    expect(values).not.toContain('Buy a home')
    expect(values).not.toContain('740+')
    for (const value of values) {
      expect(value).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('treats exclusive none / not_sure values as replacements on multi-selects', () => {
    const negative = creditQuestionById('negative_items')?.fields[0]
    const prior = creditQuestionById('urgency_actions')?.fields.find((field) => field.id === 'prior_actions')
    expect(negative?.input).toBe('multi')
    expect(prior?.input).toBe('multi')
    if (negative?.input !== 'multi' || prior?.input !== 'multi') throw new Error('expected multi fields')
    expect(negative.exclusiveValues).toEqual(['none', 'not_sure'])
    expect(prior.exclusiveValues).toEqual(['none', 'not_sure'])
    expect(applyExclusiveMultiValue(negative, ['collections'], ['collections', 'none'])).toEqual(['none'])
    expect(applyExclusiveMultiValue(negative, ['none'], ['none', 'collections'])).toEqual(['collections'])
    expect(applyExclusiveMultiValue(prior, ['self_disputes'], ['self_disputes', 'not_sure'])).toEqual([
      'not_sure',
    ])
  })

  it('hides inaccuracy follow-up when last_reviewed is never and prunes the hidden value', () => {
    const question = creditQuestionById('report_review')
    expect(question).toBeDefined()
    if (!question) throw new Error('missing report_review')
    const followUp = question.fields.find((field) => field.id === 'inaccuracy_belief')
    expect(followUp?.when).toEqual({ field: 'last_reviewed', notEquals: 'never' })
    expect(isFieldVisible(followUp!, { last_reviewed: 'never' })).toBe(false)
    expect(isFieldVisible(followUp!, { last_reviewed: 'last_year' })).toBe(true)
    expect(isQuestionComplete(question, { last_reviewed: 'never', inaccuracy_belief: '' })).toBe(true)
    expect(isQuestionComplete(question, { last_reviewed: 'last_year', inaccuracy_belief: '' })).toBe(false)
    const pruned = applyFieldChange(
      question,
      question.fields[0],
      { last_reviewed: 'last_year', inaccuracy_belief: 'yes' },
      'never',
    )
    expect(pruned.last_reviewed).toBe('never')
    expect(pruned.inaccuracy_belief).toBe('')
  })

  it('does not collect SSN, DOB, bureau credentials, uploads, or account numbers', () => {
    const fieldIds = CREDIT_QUESTIONS.flatMap((question) => [
      question.id,
      ...question.fields.map((field) => field.id),
    ])
    const typeKeys = source('components/assessment/credit/types.ts')
    const questionsSource = source('components/assessment/credit/questions.ts')
    expect(questionsSource).not.toContain('short_text')
    for (const token of FORBIDDEN_CREDIT_FIELD_TOKENS) {
      expect(fieldIds.join(' ')).not.toContain(token)
      expect(typeKeys).not.toMatch(new RegExp(`\\b${token}\\b`, 'i'))
    }
  })

  it('keeps English labels on locale keys and implements Spanish as a presentation layer', () => {
    expect(creditCopy.es).not.toBeNull()
    expect(creditCopy.en).toBeTruthy()
    expect(CREDIT_SCORE_NAME).toBe('Credit Report Card Score')
    expect(CREDIT_ASSESSMENT_TYPE).toBe('credit')
    for (const question of CREDIT_QUESTIONS) {
      expect(creditCopy.en?.questions[question.labelKey]).toBeTruthy()
      expect(creditCopy.en?.questions[question.labelKey]).not.toBe(question.labelKey)
      if (question.helperKey) {
        expect(creditCopy.en?.helpers[question.helperKey]).toBeTruthy()
      }
      for (const field of question.fields) {
        expect(creditCopy.en?.fields[field.labelKey] ?? creditCopy.en?.questions[field.labelKey]).toBeTruthy()
        if (field.input === 'short_text') continue
        for (const option of field.options) {
          const label = resolveSpecializedCopy(creditCopy, 'en', 'answers', option.labelKey)
          expect(label).not.toBe(option.labelKey)
          if (option.value !== '0') {
            expect(option.value).not.toBe(label)
          }
        }
      }
    }
    const renderer = source('components/assessment/specialized/renderer.tsx')
    expect(renderer).not.toContain('Buy a home')
    expect(renderer).not.toContain('Get My Credit Report Card')
  })

  it('adds public Credit routes without opening server ingest', () => {
    expect(ROUTES.creditReportCard).toBe('/credit-report-card')
    expect(ROUTES.creditAssessment).toBe('/credit-assessment')
    expect(ROUTES.creditReportCardResults).toBe('/credit-results')
    const app = source('src/App.tsx')
    expect(app).toContain('CreditReportCardPage')
    expect(app).toContain('CreditAssessment')
    expect(app).toContain('CreditReportCardResults')
    expect(app).not.toContain('/es/credit')
    expect(isSpecializedAssessmentProduct('credit')).toBe(true)
    expect(SPECIALIZED_ASSESSMENT_PRODUCTS).toEqual(['student_loan', 'credit'])
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).toContain('credit')
  })

  it('uses the existing public ingest path and does not auto-create Opportunities', () => {
    expect(CREDIT_CRM_INGEST_ENABLED).toBe(true)
    expect(canSubmitCreditToCrm()).toBe(true)
    const assessmentSource = source('pages/CreditAssessment.tsx')
    expect(assessmentSource).toContain('completePublicReportCardCrmSubmission')
    expect(assessmentSource).not.toContain('/api/ingest-credit')
    expect(assessmentSource.toLowerCase()).not.toContain('create opportunity')
    expect(source('components/assessment/credit/ingestBoundary.ts')).not.toContain('opportunity')
    const rejected = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ assessmentType: 'household_onboarding' }),
    )
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.code).toBe('invalid_assessment_type')
  })

  it('does not fabricate a results score or grade', () => {
    const model = getCreditResultsModel()
    expect(model.available).toBe(false)
    expect(model.score).toBeNull()
    expect(model.overallScore).toBeNull()
    expect(model.grade).toBeNull()
    expect(model.categoryScores).toEqual([])
    expect(model.criticalFlags).toEqual([])
    expect(model.topReviewAreas).toEqual([])
    expect(model.primaryGoal).toBeNull()
    expect(model.bookingCta).toBeNull()

    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/credit-results'] },
        createElement(CreditReportCardResults),
      ),
    )
    expect(html).toContain('Your Credit Report Card results are not available yet.')
    expect(html).not.toContain('Unexpected scored result')
    expect(html).not.toMatch(/\b(A\+|A-|B\+|72|88)\b/)
    expect(html).not.toContain('data-score')
    expect(html).not.toContain('points gained')
  })

  it('keeps landing educational and free of deletion or score-increase promises', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/credit-report-card'] },
        createElement(CreditReportCardPage),
      ),
    )
    expect(html).toContain('See What Areas of Your Credit Profile Deserve Attention')
    expect(html).toContain('Get My Credit Report Card')
    expect(html).toContain('not a FICO')
    expect(html.toLowerCase()).not.toContain('guaranteed deletion')
    expect(html.toLowerCase()).not.toContain('100-point')
    expect(html.toLowerCase()).not.toContain('guaranteed approval')
  })

  it('reuses existing consent defaults and excludes consent/PII from the results session', () => {
    expect(INITIAL_FAMILY_CONSENT_STATE).toEqual({
      assessmentStorageAcknowledged: false,
      contactPermission: false,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      privacyAcknowledged: false,
    })
    const session = buildCreditResultsSession({
      diagnostic: { ...INITIAL_CREDIT_ANSWERS.diagnostic, credit_goal: 'buy_home' },
      contact: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '555-0100',
      },
    })
    expect(session).toEqual({
      diagnostic: { ...INITIAL_CREDIT_ANSWERS.diagnostic, credit_goal: 'buy_home' },
      firstName: 'Ada',
    })
    expect(JSON.stringify(session)).not.toMatch(/Lovelace|ada@example.com|555-0100|consent|honeypot/)
  })

  it('leaves the disabled credit_repair module and migrations 047–050 unchanged', () => {
    const catalog = source('platform/registry/catalog.ts')
    expect(catalog).toContain("key: 'credit_repair'")
    expect(catalog).toContain('featureFlag: { enabled: false }')
    expect(source('pages/CreditAssessment.tsx')).not.toContain('credit_repair')
    expect(source('components/assessment/credit/questions.ts')).not.toContain('credit_repair')
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(50)
    expect(files[49]).toBe('050_credit_report_card_ingest.sql')
    expect(files.some((name) => name.startsWith('051_'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
  })
})
