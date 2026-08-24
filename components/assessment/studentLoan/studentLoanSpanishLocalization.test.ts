import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { validateStudentLoanAnswers } from '../../../server/ingest/familyReportCard/validateStudentLoanAnswers'
import { validStudentLoanAnswersFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import StudentLoanReportCardPage from '../../../pages/StudentLoanReportCardPage'
import StudentLoanReportCardResults from '../../../pages/StudentLoanReportCardResults'
import SpecializedLocaleSwitcher from '../specialized/SpecializedLocaleSwitcher'
import SpecializedQuestionRenderer from '../specialized/renderer'
import { withSpecializedLocale, resolveSpecializedCopy, readSpecializedLocale } from '../specialized/locale'
import type { SpecializedAnswerMap, SpecializedCopyCatalog, SpecializedCopySection } from '../specialized/types'
import { studentLoanCopy } from './copy'
import { STUDENT_LOAN_QUESTIONS } from './questions'
import { STUDENT_LOAN_DIAGNOSTIC_QUESTION_COUNT, STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS } from './constants'
import {
  STUDENT_LOAN_REPAYMENT_PLAN_VALUES,
  STUDENT_LOAN_REPAYMENT_PLAN_CATALOG_VERSION,
} from './repaymentPlans'
import { scoreStudentLoanAssessment, STUDENT_LOAN_SCORING_VERSION } from './scoreStudentLoanAssessment'
import { getStudentLoanResultsModel, buildStudentLoanResultsSession } from './resultsModel'
import { phaseDStudentLoanDiagnostic } from './scoreStudentLoanAssessment.test'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function t(locale: 'en' | 'es', section: SpecializedCopySection, key: string): string {
  return resolveSpecializedCopy(studentLoanCopy, locale, section, key)
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
  for (const question of STUDENT_LOAN_QUESTIONS) {
    for (const field of question.fields) {
      if (field.input === 'short_text') continue
      for (const option of field.options) values.push(option.value)
    }
  }
  return values
}

describe('Student Loan Spanish localization', () => {
  it('gives Spanish every English copy key used by the experience', () => {
    expect(studentLoanCopy.en).not.toBeNull()
    expect(studentLoanCopy.es).not.toBeNull()
    expect(catalogKeys(studentLoanCopy.es!)).toEqual(catalogKeys(studentLoanCopy.en!))
    for (const [section, keys] of Object.entries(catalogKeys(studentLoanCopy.en!))) {
      for (const key of keys) {
        const spanish = t('es', section as SpecializedCopySection, key)
        expect(spanish, `${section}.${key}`).not.toBe(key)
        expect(spanish.trim().length, `${section}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('does not leave English question titles in the normal Spanish flow', () => {
    for (const question of STUDENT_LOAN_QUESTIONS) {
      expect(t('es', 'questions', question.labelKey)).not.toBe(t('en', 'questions', question.labelKey))
    }
    expect(t('es', 'ui', 'startCta')).not.toBe(t('en', 'ui', 'startCta'))
    expect(t('es', 'ui', 'back')).toBe('Atrás')
    expect(t('es', 'results', 'score')).not.toBe(t('en', 'results', 'score'))
    expect(t('es', 'ui', 'landingReceiveHeading')).toBe('Qué recibirá')
    expect(t('en', 'ui', 'landingReceiveHeading')).toBe("What You'll Receive")
    expect(t('es', 'ui', 'productTitle')).toContain('Reporte de Préstamos Estudiantiles')
    expect(t('es', 'results', 'score')).toBe('Puntaje del Reporte de Préstamos Estudiantiles')
  })

  it('keeps canonical option values identical in EN and ES', () => {
    const values = collectCanonicalValues()
    expect(STUDENT_LOAN_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(STUDENT_LOAN_QUESTIONS).toHaveLength(10)
    expect(STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS).toHaveLength(10)
    expect(values).toContain('government')
    expect(values).not.toContain('Gobierno')
    expect(values).not.toContain('Government')
    expect(t('es', 'answers', 'employment_type.government')).toBe('Gobierno')
    expect(t('en', 'answers', 'employment_type.government')).toBe('Government')
  })

  it('scores the same Phase D answers in English and Spanish catalogs', () => {
    expect(STUDENT_LOAN_SCORING_VERSION).toBe(1)
    const diagnostic = phaseDStudentLoanDiagnostic()
    const scored = scoreStudentLoanAssessment(diagnostic)
    const enModel = getStudentLoanResultsModel({ diagnostic })
    const esModel = getStudentLoanResultsModel({ diagnostic })
    expect(enModel.overallScore).toBe(96)
    expect(esModel.overallScore).toBe(96)
    expect(enModel.grade).toBe(esModel.grade)
    expect(enModel.criticalFlags.map((flag) => flag.id)).toEqual(esModel.criticalFlags.map((flag) => flag.id))
    expect(enModel.topReviewAreas.map((area) => area.id)).toEqual(esModel.topReviewAreas.map((area) => area.id))
    expect(scored.overallScore).toBe(96)
    expect(scored.grade).toBe('A')
    expect(source('components/assessment/studentLoan/scoreStudentLoanAssessment.ts')).not.toContain("from './copy'")
  })

  it('preserves official plan names and legacy SAVE/REPAYE distinction in Spanish', () => {
    expect(STUDENT_LOAN_REPAYMENT_PLAN_CATALOG_VERSION).toBe(2)
    expect(STUDENT_LOAN_REPAYMENT_PLAN_VALUES).toEqual([
      'rap',
      'tiered_standard',
      'standard',
      'ibr',
      'paye',
      'icr',
      'save',
      'repaye',
      'other',
      'not_sure',
    ])
    expect(t('es', 'answers', 'current_plan.rap')).toBe('Repayment Assistance Plan (RAP)')
    expect(t('es', 'answers', 'current_plan.tiered_standard')).toBe('Tiered Standard')
    expect(t('es', 'answers', 'current_plan.ibr')).toContain('IBR')
    expect(t('es', 'answers', 'current_plan.save')).toMatch(/SAVE/)
    expect(t('es', 'answers', 'current_plan.save')).toMatch(/anterior|transici/)
    expect(t('es', 'answers', 'current_plan.repaye')).toMatch(/REPAYE/)
    expect(t('es', 'answers', 'current_plan.repaye')).toMatch(/anterior/)
    expect(t('es', 'helpers', 'current_plan')).toMatch(/no significa que usted califique/)
    expect(t('es', 'helpers', 'current_plan')).toMatch(/abierto a nuevas inscripciones/)
    expect(t('es', 'answers', 'current_plan.save')).not.toMatch(/inscr[ií]base|solicite ahora/i)
  })

  it('keeps the Spanish disclaimer educational and non-governmental', () => {
    const disclaimer = t('es', 'results', 'disclaimer')
    expect(disclaimer).toMatch(/evaluación educativa de Valtoris/)
    expect(disclaimer).toMatch(/respuestas que usted dio/)
    expect(disclaimer).toMatch(/No es una determinación del gobierno/)
    expect(disclaimer).toMatch(/no garantiza elegibilidad, condonación, aprobación, ahorros/)
    expect(disclaimer).toMatch(/Departamento de Educación de EE\. UU\./)
    expect(disclaimer).toMatch(/reglas federales vigentes/)
    expect(t('es', 'results', 'officialResourceLink')).toBe('StudentAid.gov')
    expect(t('es', 'results', 'score')).not.toMatch(/gobierno|federal|elegibilidad|condonaci[oó]n$/i)
  })

  it('renders Spanish landing and questions without changing canonical values', () => {
    const landing = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/student-loan-report-card?lang=es'] },
        createElement(StudentLoanReportCardPage),
      ),
    )
    expect(landing).toContain('Reporte de Préstamos Estudiantiles')
    expect(landing).toContain('Puntaje del Reporte de Préstamos Estudiantiles')
    expect(landing).toContain('Español')
    expect(landing).not.toContain('Get Clarity on Your Student Loans')

    const planQuestion = STUDENT_LOAN_QUESTIONS.find((question) => question.id === 'repayment_plan')!
    const html = renderToStaticMarkup(
      createElement(SpecializedQuestionRenderer, {
        question: planQuestion,
        values: { knows_plan: 'yes', current_plan: '' } as SpecializedAnswerMap,
        t: (section, key) => t('es', section, key),
        onChange: () => undefined,
      }),
    )
    expect(html).toContain('value="ibr"')
    expect(html).toContain('Income-Based Repayment (IBR)')
    expect(html).toContain('SAVE (programa anterior / en transición)')
    expect(html).toContain('REPAYE (plan anterior)')
    expect(html).not.toContain('value="Income-Based')
  })

  it('renders Spanish results with the same score and review IDs', () => {
    const session = buildStudentLoanResultsSession({
      diagnostic: phaseDStudentLoanDiagnostic(),
      contact: {
        firstName: 'QA',
        lastName: 'Locale',
        email: 'qa@example.com',
        phone: '5550148900',
      },
    })
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {
          initialEntries: [
            { pathname: '/student-loan-results', search: '?lang=es', state: { answers: session } },
          ],
        },
        createElement(StudentLoanReportCardResults),
      ),
    )
    expect(html).toContain('Puntaje del Reporte de Préstamos Estudiantiles')
    expect(html).toContain('96')
    expect(html).toContain('data-flag-id="flag_pslf_unreviewed"')
    expect(html).toContain('data-review-id="review_flag_pslf_unreviewed"')
    expect(html).toContain('StudentAid.gov')
    expect(html).not.toContain('Student Loan Report Card Score')
  })

  it('preserves campaign params and assessment state when switching language', () => {
    expect(readSpecializedLocale('?lang=es&utm_source=card&card=abc')).toBe('es')
    expect(withSpecializedLocale('/student-loan-assessment', 'es', '?utm_source=card&card=abc')).toBe(
      '/student-loan-assessment?utm_source=card&card=abc&lang=es',
    )
    expect(withSpecializedLocale('/student-loan-assessment', 'en', '?lang=es&utm_source=card')).toBe(
      '/student-loan-assessment?utm_source=card',
    )
    expect(source('components/assessment/specialized/SpecializedLocaleSwitcher.tsx')).toContain('replace: true')
    expect(source('pages/StudentLoanAssessment.tsx')).toContain('useState<StudentLoanAssessmentAnswers>')
    expect(source('src/App.tsx')).not.toContain('/es/student-loan')

    const switcher = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/student-loan-assessment?lang=es'] },
        createElement(SpecializedLocaleSwitcher, {
          locale: 'es',
          groupLabel: 'Idioma',
          englishLabel: 'English',
          spanishLabel: 'Español',
        }),
      ),
    )
    expect(switcher).toContain('aria-pressed="true"')
    expect(switcher).toContain('Español')
    expect(switcher).toContain('English')
  })

  it('persists canonical diagnostic values, not Spanish labels', () => {
    const answers = validStudentLoanAnswersFixture({
      diagnostic: phaseDStudentLoanDiagnostic(),
    })
    const validated = validateStudentLoanAnswers(answers)
    expect(validated.ok).toBe(true)
    expect(answers.diagnostic.employment_type).toBe('government')
    expect(JSON.stringify(answers.diagnostic)).toContain('"employment_type":"government"')
    expect(JSON.stringify(answers.diagnostic)).not.toContain('Gobierno')
    expect(JSON.stringify(answers.diagnostic)).not.toContain('Government')
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).toContain(
      'persistableAssessmentAnswers',
    )
  })

  it('leaves 047–049 unchanged and does not add Migration 051', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(50)
    expect(files[49]).toBe('050_credit_report_card_ingest.sql')
    expect(files.some((name) => name.startsWith('051_'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
  })
})
