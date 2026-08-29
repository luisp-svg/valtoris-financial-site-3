import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { validateCreditAnswers } from '../../../server/ingest/familyReportCard/validateCreditAnswers'
import { validCreditAnswersFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'
import { validCreditIngestRequestBodyFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import CreditReportCardPage from '../../../pages/CreditReportCardPage'
import CreditAssessment from '../../../pages/CreditAssessment'
import CreditReportCardResults from '../../../pages/CreditReportCardResults'
import SpecializedLocaleSwitcher from '../specialized/SpecializedLocaleSwitcher'
import SpecializedQuestionRenderer from '../specialized/renderer'
import { applyExclusiveMultiValue, isFieldVisible } from '../specialized/answers'
import { withSpecializedLocale, resolveSpecializedCopy, readSpecializedLocale } from '../specialized/locale'
import type { SpecializedAnswerMap, SpecializedCopyCatalog, SpecializedCopySection } from '../specialized/types'
import FamilyConsentSection from '../steps/FamilyConsentSection'
import StepCreditContact from '../steps/credit/StepCreditContact'
import { INITIAL_FAMILY_CONSENT_STATE, FAMILY_CONSENT_VERSION } from '../../reportCard/familyIngest/familyConsent'
import { creditCopy } from './copy'
import { CREDIT_QUESTIONS } from './questions'
import {
  CREDIT_DIAGNOSTIC_QUESTION_COUNT,
  CREDIT_DIAGNOSTIC_QUESTION_IDS,
  CREDIT_SCORE_NAME,
} from './constants'
import { CREDIT_SCORING_VERSION, scoreCreditAssessment } from './scoreCreditAssessment'
import {
  buildCreditResultsSession,
  getCreditResultsModel,
} from './resultsModel'
import { CREDIT_CRM_INGEST_ENABLED, canSubmitCreditToCrm } from './ingestBoundary'
import { getModule } from '../../../platform/registry'
import { strongCreditDiagnostic } from './scoreCreditAssessment.test'
import { CREDIT_ASSESSMENT_TYPE } from '../../../modules/reportCard/specializedAssessmentCatalog'
import {
  HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT,
  LEAD_TYPE_BY_ASSESSMENT,
  PUBLIC_REPORT_CARD_ASSESSMENT_TYPES,
} from '../../../modules/reportCard/publicIngestCatalog'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'

const ENGLISH_LEAK_PHRASES = [
  'Understand Your Credit. Know What to Work on Next.',
  'Get My Credit Report Card',
  'Start Your Credit Report Card',
  'Credit Report Card Score',
  'This field is required.',
  'Review My Results With Valtoris',
  'What is the main reason you want a credit review?',
  'Your answers were reviewed on this device. They were not sent to Valtoris CRM.',
]

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function t(locale: 'en' | 'es', section: SpecializedCopySection, key: string): string {
  return resolveSpecializedCopy(creditCopy, locale, section, key)
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

function qaCreditDiagnostic() {
  return strongCreditDiagnostic({
    utilization: '50_75',
    hard_inquiries: '3_5',
    new_accounts: 'one',
    self_reported_score: '700_739',
  })
}

function spanishLanding(): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/credit-report-card?lang=es'] },
      createElement(CreditReportCardPage),
    ),
  )
}

function spanishQuestion(questionId: string, values: SpecializedAnswerMap = {}): string {
  const question = CREDIT_QUESTIONS.find((item) => item.id === questionId)!
  return renderToStaticMarkup(
    createElement(SpecializedQuestionRenderer, {
      question,
      values,
      t: (section, key) => t('es', section, key),
      onChange: () => undefined,
    }),
  )
}

describe('Credit Spanish localization', () => {
  it('gives Spanish every English copy key used by the experience', () => {
    expect(creditCopy.en).not.toBeNull()
    expect(creditCopy.es).not.toBeNull()
    expect(catalogKeys(creditCopy.es!)).toEqual(catalogKeys(creditCopy.en!))
    for (const [section, keys] of Object.entries(catalogKeys(creditCopy.en!))) {
      for (const key of keys) {
        const spanish = t('es', section as SpecializedCopySection, key)
        expect(spanish, `${section}.${key}`).not.toBe(key)
        expect(spanish.trim().length, `${section}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('does not leave English question titles or CTAs in the normal Spanish flow', () => {
    for (const question of CREDIT_QUESTIONS) {
      expect(t('es', 'questions', question.labelKey)).not.toBe(t('en', 'questions', question.labelKey))
    }
    expect(t('es', 'ui', 'startCta')).not.toBe(t('en', 'ui', 'startCta'))
    expect(t('es', 'ui', 'back')).toBe('Atrás')
    expect(t('es', 'ui', 'productTitle')).toContain('Reporte de Crédito')
    expect(t('es', 'results', 'score')).toBe('Puntaje del Reporte de Crédito')
    expect(t('es', 'ui', 'landingTitle')).toBe(
      'Entienda su crédito. Sepa en qué enfocarse después.',
    )
    expect(t('es', 'results', 'reviewWithValtoris')).toBe('Revisar mis resultados con Valtoris')
    expect(t('es', 'ui', 'landingReceiveHeading')).toBe('Qué recibirá')

    const landing = spanishLanding()
    expect(landing).toContain('Reporte de Crédito')
    expect(landing).toContain('Puntaje del Reporte de Crédito')
    expect(landing).toContain('Español')
    expect(landing).toContain('aria-pressed="true"')
    for (const phrase of ENGLISH_LEAK_PHRASES) {
      expect(landing).not.toContain(phrase)
    }
    expect(landing).not.toContain('Get My Credit Report Card')

    const assessment = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/credit-assessment?lang=es&utm_source=card&card=abc'] },
        createElement(CreditAssessment),
      ),
    )
    expect(assessment).toContain('Comience su Reporte de Crédito')
    expect(assessment).toContain('Idioma')
    expect(assessment).toContain('Español')
    expect(assessment).not.toContain('Start Your Credit Report Card')
    expect(assessment).not.toContain('Your answers were reviewed on this device')
  })

  it('keeps exactly 10 diagnostic groups and language-neutral canonical values', () => {
    const values = collectCanonicalValues()
    expect(CREDIT_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(CREDIT_QUESTIONS).toHaveLength(10)
    expect(CREDIT_DIAGNOSTIC_QUESTION_IDS).toHaveLength(10)
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
    expect(values).toContain('buy_home')
    expect(values).toContain('700_739')
    expect(values).toContain('last_30_days')
    expect(values).toContain('on_time')
    expect(values).toContain('50_75')
    expect(values).toContain('3_5')
    expect(values).toContain('5_10')
    expect(values).toContain('1_2')
    expect(values).toContain('one')
    expect(values).toContain('comfortable')
    expect(values).toContain('current')
    expect(values).toContain('within_30_days')
    expect(values).not.toContain('Comprar una casa')
    expect(values).not.toContain('Buy a home')
    expect(t('es', 'answers', 'credit_goal.buy_home')).toBe('Comprar una casa')
    expect(t('en', 'answers', 'credit_goal.buy_home')).toBe('Buy a home')
  })

  it('renders all 10 Spanish groups with canonical option values only', () => {
    for (const question of CREDIT_QUESTIONS) {
      const html = spanishQuestion(question.id)
      expect(html).toContain(t('es', 'questions', question.labelKey))
      expect(html).not.toContain(t('en', 'questions', question.labelKey))
      for (const field of question.fields) {
        if (field.input === 'short_text') continue
        for (const option of field.options) {
          const spanishLabel = t('es', 'answers', option.labelKey)
          const englishLabel = t('en', 'answers', option.labelKey)
          expect(option.value).toMatch(/^[a-z0-9_]+$/)
          if (field.input === 'single') {
            expect(html).toContain(`value="${option.value}"`)
            if (spanishLabel !== option.value) {
              expect(html).not.toContain(`value="${spanishLabel}"`)
            }
          } else {
            expect(html).toContain(spanishLabel)
            if (englishLabel !== spanishLabel) {
              expect(html).not.toContain(`>${englishLabel}<`)
            }
          }
        }
      }
    }
  })

  it('preserves report_review and exclusive multi-select behavior across locales', () => {
    const reportReview = CREDIT_QUESTIONS.find((question) => question.id === 'report_review')!
    const inaccuracy = reportReview.fields.find((field) => field.id === 'inaccuracy_belief')!
    expect(isFieldVisible(inaccuracy, { last_reviewed: 'never' })).toBe(false)
    expect(isFieldVisible(inaccuracy, { last_reviewed: 'last_30_days' })).toBe(true)

    const neverHtml = spanishQuestion('report_review', { last_reviewed: 'never' })
    expect(neverHtml).toContain(t('es', 'fields', 'last_reviewed'))
    expect(neverHtml).not.toContain(t('es', 'fields', 'inaccuracy_belief'))
    expect(neverHtml).toContain('value="never"')

    const visibleHtml = spanishQuestion('report_review', { last_reviewed: 'last_30_days' })
    expect(visibleHtml).toContain(t('es', 'fields', 'inaccuracy_belief'))

    const negatives = CREDIT_QUESTIONS.find((question) => question.id === 'negative_items')!.fields[0]
    expect(negatives.input).toBe('multi')
    if (negatives.input !== 'multi') throw new Error('negative_items must stay multi-select')
    expect(negatives.exclusiveValues).toEqual(['none', 'not_sure'])
    expect(applyExclusiveMultiValue(negatives, ['collections'], ['collections', 'none'])).toEqual(['none'])
    expect(applyExclusiveMultiValue(negatives, ['none'], ['none', 'collections'])).toEqual(['collections'])

    const prior = CREDIT_QUESTIONS.find((question) => question.id === 'urgency_actions')!.fields.find(
      (field) => field.id === 'prior_actions',
    )!
    expect(prior.input).toBe('multi')
    if (prior.input !== 'multi') throw new Error('prior_actions must stay multi-select')
    expect(prior.exclusiveValues).toEqual(['none', 'not_sure'])
    expect(applyExclusiveMultiValue(prior, ['self_disputes'], ['self_disputes', 'not_sure'])).toEqual([
      'not_sure',
    ])
  })

  it('scores the same canonical fixture in English and Spanish catalogs', () => {
    expect(CREDIT_SCORING_VERSION).toBe(1)
    const diagnostic = qaCreditDiagnostic()
    const scored = scoreCreditAssessment(diagnostic)
    const enModel = getCreditResultsModel({ diagnostic })
    const esModel = getCreditResultsModel({ diagnostic })
    expect(enModel.overallScore).toBe(87)
    expect(esModel.overallScore).toBe(87)
    expect(enModel.grade).toBe('B')
    expect(esModel.grade).toBe(enModel.grade)
    expect(enModel.criticalFlags.map((flag) => flag.id)).toEqual(
      esModel.criticalFlags.map((flag) => flag.id),
    )
    expect(enModel.topReviewAreas.map((area) => area.id)).toEqual(
      esModel.topReviewAreas.map((area) => area.id),
    )
    expect(scored.overallScore).toBe(87)
    expect(scored.grade).toBe('B')
    expect(scored.flags.map((flag) => flag.id)).toEqual(['flag_elevated_utilization'])
    expect(source('components/assessment/credit/scoreCreditAssessment.ts')).not.toContain("from './copy'")
    expect(source('server/ingest/familyReportCard/validateCreditAnswers.ts')).not.toContain('copy')
  })

  it('keeps the Spanish disclaimer educational and non-guaranteeing', () => {
    const disclaimer = t('es', 'results', 'disclaimer')
    expect(disclaimer).toMatch(/evaluación educativa de Valtoris/)
    expect(disclaimer).toMatch(/respuestas que usted dio/)
    expect(disclaimer).toMatch(/FICO®/)
    expect(disclaimer).toMatch(/VantageScore®/)
    expect(disclaimer).toMatch(/agencia de crédito/)
    expect(disclaimer).toMatch(/decisi[oó]n de pr[eé]stamo/)
    expect(disclaimer).toMatch(/No garantiza/)
    expect(disclaimer).toMatch(/eliminar/)
    expect(disclaimer).toMatch(/puntaje suba/)
    expect(disclaimer).toMatch(/aprueben/)
    expect(disclaimer).toMatch(/disputa/)
    expect(disclaimer).toMatch(/informaci[oó]n negativa precisa puede permanecer/)
    expect(disclaimer).toMatch(/reportes de cr[eé]dito reales/)
    expect(disclaimer).toMatch(/Valtoris no es una agencia de cr[eé]dito/)
    expect(disclaimer).toMatch(/^Este Puntaje del Reporte de Crédito/)
    expect(disclaimer.toLowerCase()).not.toMatch(/garantizado|aprobado automáticamente|eliminaremos/)
    expect(t('es', 'results', 'review.flag_report_concern.title')).toBe(
      'Posible área del reporte para revisar',
    )
    expect(t('es', 'results', 'review.flag_report_concern.title')).not.toMatch(
      /contiene errores|fraude confirmado|robo de identidad/i,
    )
    const spanishCatalog = JSON.stringify(creditCopy.es)
    expect(spanishCatalog).not.toMatch(/Start Credit Repair Now|Delete My Accounts|Raise My Score|Get Approved/)
    expect(spanishCatalog).not.toMatch(/Reporte Crediticio|Informe de Crédito|Reparación de Crédito™/)
  })

  it('renders Spanish contact, consent, validation, and retry copy without changing consent semantics', () => {
    expect(FAMILY_CONSENT_VERSION).toBe('family-report-card-consent-v1')
    expect(INITIAL_FAMILY_CONSENT_STATE.contactPermission).toBe(false)
    expect(INITIAL_FAMILY_CONSENT_STATE.emailMarketingConsent).toBe(false)
    expect(INITIAL_FAMILY_CONSENT_STATE.smsMarketingConsent).toBe(false)
    expect(INITIAL_FAMILY_CONSENT_STATE.assessmentStorageAcknowledged).toBe(false)
    expect(INITIAL_FAMILY_CONSENT_STATE.privacyAcknowledged).toBe(false)

    const contact = renderToStaticMarkup(
      createElement(StepCreditContact, {
        contact: { firstName: '', lastName: '', email: '', phone: '' },
        t: (section, key) => t('es', section, key),
        showErrors: true,
        onChange: () => undefined,
      }),
    )
    expect(contact).toContain('Nombre')
    expect(contact).toContain('Apellido')
    expect(contact).toContain('Correo electrónico')
    expect(contact).toContain('Teléfono')
    expect(contact).toContain('Este campo es obligatorio.')
    expect(contact).not.toContain('This field is required.')
    expect(contact).not.toContain('First Name')

    const consent = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/credit-assessment?lang=es'] },
        createElement(FamilyConsentSection, {
          consent: INITIAL_FAMILY_CONSENT_STATE,
          phone: '5550180824',
          showErrors: true,
          missing: ['assessmentStorageAcknowledged', 'privacyAcknowledged'],
          onChange: () => undefined,
          honeypotValue: '',
          onHoneypotChange: () => undefined,
          productTitle: t('es', 'ui', 'productTitle'),
          storageResultName: t('es', 'ui', 'storageResultName'),
          intro: t('es', 'ui', 'consentIntro'),
          labels: {
            heading: t('es', 'ui', 'consentHeading'),
            storage: t('es', 'ui', 'consentStorage'),
            storageHint: t('es', 'ui', 'consentStorageHint'),
            storageError: t('es', 'ui', 'consentStorageError'),
            contact: t('es', 'ui', 'consentContact'),
            emailMarketing: t('es', 'ui', 'consentEmailMarketing'),
            sms: t('es', 'ui', 'consentSms'),
            smsPhoneNote: t('es', 'ui', 'consentSmsPhoneNote'),
            privacyBefore: t('es', 'ui', 'consentPrivacyBefore'),
            privacyLink: t('es', 'ui', 'consentPrivacyLink'),
            privacyAfter: t('es', 'ui', 'consentPrivacyAfter'),
            privacyHint: t('es', 'ui', 'consentPrivacyHint'),
            privacyError: t('es', 'ui', 'consentPrivacyError'),
            disclaimer: t('es', 'ui', 'consentDisclaimer'),
            honeypot: t('es', 'ui', 'consentHoneypot'),
          },
        }),
      ),
    )
    expect(consent).toContain('Reconocimientos')
    expect(consent).toContain('Reporte de Crédito')
    expect(consent).toContain('Política de privacidad de Valtoris')
    expect(consent).not.toContain('I understand that Valtoris')
    expect(consent).toContain('type="checkbox"')
    expect(t('es', 'ui', 'submitFailed')).toBe('No pudimos guardar su Reporte de Crédito. Inténtelo de nuevo.')
  })

  it('renders Spanish results with the same score, grade, flags, and review IDs', () => {
    const session = buildCreditResultsSession({
      diagnostic: qaCreditDiagnostic(),
      contact: {
        firstName: 'QA',
        lastName: 'Locale',
        email: 'qa@example.com',
        phone: '5550148900',
      },
    })
    expect(session).toEqual({ diagnostic: qaCreditDiagnostic(), firstName: 'QA' })
    expect(JSON.stringify(session)).not.toMatch(/lastName|email|phone|consent|honeypot/)

    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {
          initialEntries: [
            { pathname: '/credit-results', search: '?lang=es', state: { answers: session } },
          ],
        },
        createElement(CreditReportCardResults),
      ),
    )
    expect(html).toContain('Puntaje del Reporte de Crédito')
    expect(html).toContain('87')
    expect(html).toContain('B')
    expect(html).toContain('Sólido')
    expect(html).toContain('data-flag-id="flag_elevated_utilization"')
    expect(html).toContain('data-review-id="review_flag_elevated_utilization"')
    expect(html).toContain('Revisar mis resultados con Valtoris')
    expect(html).toContain('3 áreas principales para revisar')
    expect(html).toContain('Uso del crédito')
    expect(html).not.toContain('Credit Report Card Score')
    expect(html).not.toContain('Review My Results With Valtoris')
    expect(html).not.toContain('Top 3 Areas to Review')
  })

  it('preserves campaign params and assessment state when switching language', () => {
    expect(readSpecializedLocale('?lang=es&utm_source=card&card=abc')).toBe('es')
    expect(readSpecializedLocale('?locale=es&utm_campaign=spring')).toBe('es')
    expect(withSpecializedLocale('/credit-assessment', 'es', '?utm_source=card&card=abc')).toBe(
      '/credit-assessment?utm_source=card&card=abc&lang=es',
    )
    expect(withSpecializedLocale('/credit-assessment', 'en', '?lang=es&utm_source=card')).toBe(
      '/credit-assessment?utm_source=card',
    )
    expect(withSpecializedLocale('/credit-results', 'es', '?utm_campaign=qa&card=crc')).toBe(
      '/credit-results?utm_campaign=qa&card=crc&lang=es',
    )
    expect(source('components/assessment/specialized/SpecializedLocaleSwitcher.tsx')).toContain(
      'replace: true',
    )
    expect(source('pages/CreditAssessment.tsx')).toContain('useState<CreditAssessmentAnswers>')
    expect(source('src/App.tsx')).not.toContain('/es/credit')
    expect(source('src/styles.css')).toContain('flex-wrap: wrap')

    const switcher = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/credit-assessment?lang=es'] },
        createElement(SpecializedLocaleSwitcher, {
          locale: 'es',
          groupLabel: 'Idioma',
          englishLabel: 'English',
          spanishLabel: 'Español',
        }),
      ),
    )
    expect(switcher).toContain('aria-pressed="true"')
    expect(switcher).toContain('aria-current="true"')
    expect(switcher).toContain('Español')
    expect(switcher).toContain('English')
  })

  it('persists canonical diagnostic values, not Spanish labels, and leaves ingest/scoring contracts unchanged', () => {
    const answers = validCreditAnswersFixture({
      diagnostic: qaCreditDiagnostic(),
    })
    const validated = validateCreditAnswers(answers)
    expect(validated.ok).toBe(true)
    expect(answers.diagnostic.credit_goal).toBe('general_health')
    expect(answers.diagnostic.utilization).toBe('50_75')
    expect(JSON.stringify(answers.diagnostic)).toContain('"credit_goal":"general_health"')
    expect(JSON.stringify(answers.diagnostic)).not.toContain('Mejorar mi salud crediticia general')
    expect(JSON.stringify(answers.diagnostic)).not.toContain('Improve my overall credit health')

    const request = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers,
      }),
    )
    expect(request.ok).toBe(true)
    if (request.ok) {
      expect(request.value.assessmentType).toBe('credit')
      expect(JSON.stringify(request.value.answers)).toContain('"credit_goal":"general_health"')
      expect(JSON.stringify(request.value.answers)).not.toContain('Mejorar mi salud crediticia general')
    }

    expect(CREDIT_ASSESSMENT_TYPE).toBe('credit')
    expect(CREDIT_SCORE_NAME).toBe('Credit Report Card Score')
    expect(CREDIT_SCORING_VERSION).toBe(1)
    expect(CREDIT_CRM_INGEST_ENABLED).toBe(true)
    expect(canSubmitCreditToCrm()).toBe(true)
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).toContain('credit')
    expect(LEAD_TYPE_BY_ASSESSMENT.credit).toBe('Credit Report Card')
    expect(HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT.credit).toBe('credit_report_card')
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).toContain(
      'persistableAssessmentAnswers',
    )
    expect(source('pages/CreditAssessment.tsx')).toContain('buildCreditResultsSession')
  })

  it('leaves 047–050 byte-identical and does not add Migration 051', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(53)
    expect(files[49]).toBe('050_credit_report_card_ingest.sql')
    expect(files.some((name) => name.startsWith('051_'))).toBe(true)
    expect(files.some((name) => name.startsWith('052_'))).toBe(true)
    expect(files.some((name) => name.startsWith('053_'))).toBe(true)
    expect(files.some((name) => name.startsWith('054_'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(
      SHA_049,
    )
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
  })
})
