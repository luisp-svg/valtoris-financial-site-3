import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../../platform/registry/registry'
import RetirementReportCardPage from '../../../pages/RetirementReportCardPage'
import RetirementReportCardResults from '../../../pages/RetirementReportCardResults'
import RetirementAssessment from '../../../pages/RetirementAssessment'
import SpecializedLocaleSwitcher from '../specialized/SpecializedLocaleSwitcher'
import { resolveSpecializedCopy, withSpecializedLocale } from '../specialized/locale'
import type { SpecializedCopyCatalog, SpecializedCopySection } from '../specialized/types'
import { DEMO_RETIREMENT_ANSWERS } from '../../reportCard/retirementReportCardData'
import { scoreRetirementAssessment } from '../scoring/scoreRetirementAssessment'
import { retirementCopy } from './copy'
import {
  buildLocalizedRetirementDashboard,
  localizeRetirementScoreResult,
} from './localizeResults'
import type { RetirementAssessmentAnswers } from './types'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function t(locale: 'en' | 'es', section: SpecializedCopySection, key: string): string {
  return resolveSpecializedCopy(retirementCopy, locale, section, key)
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

/** Placeholder-only strings (ages, amounts, phone masks) are intentionally shared. */
const SHARED_LITERAL_SECTIONS = new Set<SpecializedCopySection>(['placeholders'])

function renderAt(entry: string, page: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [entry] }, page))
}

describe('Retirement Report Card Spanish localization', () => {
  it('gives Spanish every English copy key', () => {
    expect(retirementCopy.en).not.toBeNull()
    expect(retirementCopy.es).not.toBeNull()
    expect(catalogKeys(retirementCopy.es!)).toEqual(catalogKeys(retirementCopy.en!))
    for (const [section, keys] of Object.entries(catalogKeys(retirementCopy.en!))) {
      for (const key of keys) {
        const spanish = t('es', section as SpecializedCopySection, key)
        expect(spanish, `${section}.${key}`).not.toBe(key)
        expect(spanish.trim().length, `${section}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('translates every non-literal string away from English', () => {
    const sections = Object.entries(catalogKeys(retirementCopy.en!)) as Array<
      [SpecializedCopySection, string[]]
    >
    let translated = 0
    for (const [section, keys] of sections) {
      if (SHARED_LITERAL_SECTIONS.has(section)) continue
      for (const key of keys) {
        if (t('es', section, key) !== t('en', section, key)) translated += 1
      }
    }
    expect(translated).toBeGreaterThan(300)
  })

  it('keeps canonical answer values identical between locales', () => {
    const answers = DEMO_RETIREMENT_ANSWERS
    expect(answers.household.maritalStatus).toBe('married')
    expect(answers.household.alreadyRetired).toBe('no')
    expect(answers.savings.employerMatch).toBe('full-match')
    expect(answers.tax.accountTypes).toEqual(['traditional', 'roth', 'taxable'])
    expect(answers.goals.selected).toEqual([
      'close-income-gap',
      'plan-healthcare',
      'diversify-taxes',
    ])
    expect(t('en', 'answers', 'employerMatch.full-match')).toBe('Yes — I capture the full match')
    expect(t('es', 'answers', 'employerMatch.full-match')).toBe(
      'Sí — aprovecho la aportación completa',
    )
    expect(source('components/assessment/retirement/constants.ts')).toContain("value: 'full-match'")
  })

  it('renders landing, assessment, and results in Spanish without changing routes', () => {
    const landing = renderAt(
      '/retirement-report-card?lang=es',
      createElement(RetirementReportCardPage),
    )
    expect(landing).toContain('¿Está en camino de retirarse con confianza?')
    expect(landing).not.toContain('Are You on Track to Retire With Confidence?')
    expect(landing).toContain('Retirement Report Card™')
    const assessment = renderAt(
      '/retirement-assessment?lang=es',
      createElement(RetirementAssessment),
    )
    expect(assessment).toContain('Obtener mi puntuación de retiro')
    expect(assessment).toContain('Paso 1 de 9')
    expect(assessment).toContain('specialized-locale-option is-current')
    const assessmentSource = source('pages/RetirementAssessment.tsx')
    expect(assessmentSource).toContain('withLocale(ROUTES.retirementReportCard)')
    expect(assessmentSource).toContain('withLocale(ROUTES.retirementReportCardResults)')
    expect(source('pages/RetirementReportCardPage.tsx')).toContain(
      'withLocale(ROUTES.retirementAssessment)',
    )
    expect(source('pages/RetirementReportCardResults.tsx')).toContain(
      'withLocale(ROUTES.retirementAssessment)',
    )
    const results = renderAt(
      '/retirement-results?lang=es',
      createElement(RetirementReportCardResults),
    )
    expect(results).toContain('Retirement Report Card™')
    expect(results).toContain('Su panorama de retiro')
    expect(results).not.toContain('Your Retirement Snapshot')
    expect(source('pages/RetirementReportCardPage.tsx')).not.toContain('/es/')
  })

  it('resolves every dynamic results key for working and already-retired profiles', () => {
    const RAW_KEY = /(?:category|summary|guidance|rec|priority|explanation|blueprint|action|status|chrome|hero|level|readiness|narrative)\.[a-zA-Z0-9-]/
    const retired: RetirementAssessmentAnswers = {
      ...DEMO_RETIREMENT_ANSWERS,
      household: { ...DEMO_RETIREMENT_ANSWERS.household, alreadyRetired: 'yes' },
    }
    for (const answers of [DEMO_RETIREMENT_ANSWERS, retired]) {
      for (const locale of ['en', 'es'] as const) {
        const dashboard = buildLocalizedRetirementDashboard('', '', answers, (section, key) =>
          t(locale, section, key),
        )
        expect(JSON.stringify(dashboard)).not.toMatch(RAW_KEY)
      }
    }
  })

  it('preserves assessment state across locale switch', () => {
    expect(source('pages/RetirementAssessment.tsx')).toContain(
      'useState<RetirementAssessmentAnswers>',
    )
    expect(source('components/assessment/specialized/SpecializedLocaleSwitcher.tsx')).toContain(
      'replace: true',
    )
    expect(
      withSpecializedLocale(
        '/retirement-assessment',
        'es',
        '?utm_source=qa&utm_campaign=spanish&card=test-card',
      ),
    ).toBe('/retirement-assessment?utm_source=qa&utm_campaign=spanish&card=test-card&lang=es')
    expect(
      withSpecializedLocale(
        '/retirement-assessment',
        'en',
        '?lang=es&utm_source=qa&utm_campaign=spanish&card=test-card',
      ),
    ).toBe('/retirement-assessment?utm_source=qa&utm_campaign=spanish&card=test-card')
    const switcher = renderAt(
      '/retirement-assessment?lang=es',
      createElement(SpecializedLocaleSwitcher, {
        locale: 'es',
        groupLabel: 'Idioma',
        englishLabel: 'English',
        spanishLabel: 'Español',
      }),
    )
    expect(switcher).toContain('Español')
  })

  it('produces identical scores and canonical priorities in both locales', () => {
    const answers = DEMO_RETIREMENT_ANSWERS
    const scored = scoreRetirementAssessment(answers)
    const english = localizeRetirementScoreResult(scored, answers, (section, key) =>
      t('en', section, key),
    )
    const spanish = localizeRetirementScoreResult(scored, answers, (section, key) =>
      t('es', section, key),
    )
    expect(english.overallScore).toBe(scored.overallScore)
    expect(spanish.overallScore).toBe(scored.overallScore)
    expect(english.overallGrade).toBe(spanish.overallGrade)
    expect(english.metrics.annualIncomeGap).toBe(spanish.metrics.annualIncomeGap)
    expect(english.metrics.projectedNestEgg).toBe(spanish.metrics.projectedNestEgg)
    expect(
      english.categories.map((item) => `${item.id}:${item.score}:${item.grade}:${item.status}`),
    ).toEqual(
      spanish.categories.map((item) => `${item.id}:${item.score}:${item.grade}:${item.status}`),
    )
    expect(english.priorities.map((item) => item.level)).toEqual(
      spanish.priorities.map((item) => item.level),
    )
    expect(english.priorities[0]?.title).not.toBe(spanish.priorities[0]?.title)
    expect(english.defaultOpenCategory).toBe(spanish.defaultOpenCategory)
    expect(source('components/assessment/scoring/scoreRetirementAssessment.ts')).not.toContain(
      'retirementCopy',
    )
    expect(source('components/assessment/scoring/scoreRetirementAssessment.ts')).not.toContain(
      "from '../retirement/copy'",
    )
  })

  it('does not change ingest, scoring files, credit_repair, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(54)
    expect(files.some((name) => name.startsWith('053_'))).toBe(true)
    expect(files.some((name) => name.startsWith('054_'))).toBe(true)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_spanish.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(
      SHA_047,
    )
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(
      fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql'),
    ).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).not.toContain(
      'retirementCopy',
    )
    expect(source('components/reportCard/familyIngest/buildFamilyIngestPayload.ts')).not.toContain(
      'lang=es',
    )
  })
})
