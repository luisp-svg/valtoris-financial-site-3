import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../../platform/registry/registry'
import BusinessReportCardPage from '../../../pages/BusinessReportCardPage'
import BusinessReportCardResults from '../../../pages/BusinessReportCardResults'
import BusinessFinancialAssessment from '../../../pages/BusinessFinancialAssessment'
import SpecializedLocaleSwitcher from '../specialized/SpecializedLocaleSwitcher'
import { resolveSpecializedCopy, withSpecializedLocale } from '../specialized/locale'
import type { SpecializedCopyCatalog, SpecializedCopySection } from '../specialized/types'
import { DEMO_BUSINESS_ANSWERS } from '../../reportCard/businessReportCardData'
import { scoreBusinessAssessment } from '../scoring/scoreBusinessAssessment'
import { businessCopy } from './copy'
import { localizeBusinessScoreResult } from './localizeResults'

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
  return resolveSpecializedCopy(businessCopy, locale, section, key)
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

function renderAt(entry: string, page: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [entry] }, page))
}

describe('Business Report Card Spanish localization', () => {
  it('gives Spanish every English copy key', () => {
    expect(businessCopy.en).not.toBeNull()
    expect(businessCopy.es).not.toBeNull()
    expect(catalogKeys(businessCopy.es!)).toEqual(catalogKeys(businessCopy.en!))
    for (const [section, keys] of Object.entries(catalogKeys(businessCopy.en!))) {
      for (const key of keys) {
        const spanish = t('es', section as SpecializedCopySection, key)
        expect(spanish, `${section}.${key}`).not.toBe(key)
        expect(spanish.trim().length, `${section}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps canonical answer values identical between locales', () => {
    const answers = DEMO_BUSINESS_ANSWERS
    expect(answers.foundation.entityStructure).toBe('multi-member-llc')
    expect(answers.cashFlowTax.operatingCashFlow).toBe('positive-reinvest')
    expect(answers.retirementFundingExit.successionPlan).toBe('informal')
    expect(answers.goals.selected).toEqual([
      'protect-key-people',
      'improve-cash-flow',
      'plan-exit',
    ])
    expect(t('en', 'answers', 'entityStructure.multi-member-llc')).toBe('Multi-Member LLC')
    expect(t('es', 'answers', 'entityStructure.multi-member-llc')).toBe('LLC de varios miembros')
    expect(source('components/assessment/business/constants.ts')).toContain(
      "{ value: 'multi-member-llc', label: 'Multi-Member LLC' }",
    )
  })

  it('renders landing, assessment, and results in Spanish without changing routes', () => {
    const landing = renderAt('/business-report-card?lang=es', createElement(BusinessReportCardPage))
    expect(landing).toContain('¿Qué tan preparado está su negocio en lo financiero?')
    expect(landing).toContain('Business Financial Report Card™')
    expect(landing).not.toContain('How Financially Prepared Is Your Business?')
    const assessment = renderAt(
      '/business-assessment?lang=es',
      createElement(BusinessFinancialAssessment),
    )
    expect(assessment).toContain('Comience su Business Financial Report Card™')
    expect(assessment).toContain('Paso 1 de 6')
    const results = renderAt('/business-results?lang=es', createElement(BusinessReportCardResults))
    expect(results).toContain('Business Financial Report Card™')
    expect(results).toContain('Protección del negocio')
    expect(source('pages/BusinessReportCardPage.tsx')).not.toContain('/es/')
  })

  it('preserves assessment state across locale switch', () => {
    expect(source('pages/BusinessFinancialAssessment.tsx')).toContain(
      'useState<BusinessAssessmentAnswers>',
    )
    expect(source('components/assessment/specialized/SpecializedLocaleSwitcher.tsx')).toContain(
      'replace: true',
    )
    expect(
      withSpecializedLocale(
        '/business-assessment',
        'es',
        '?utm_source=qa&utm_campaign=spanish&card=test-card',
      ),
    ).toBe('/business-assessment?utm_source=qa&utm_campaign=spanish&card=test-card&lang=es')
    expect(
      withSpecializedLocale(
        '/business-assessment',
        'en',
        '?lang=es&utm_source=qa&utm_campaign=spanish&card=test-card',
      ),
    ).toBe('/business-assessment?utm_source=qa&utm_campaign=spanish&card=test-card')
    const switcher = renderAt(
      '/business-assessment?lang=es',
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
    const answers = DEMO_BUSINESS_ANSWERS
    const scored = scoreBusinessAssessment(answers)
    const english = localizeBusinessScoreResult(scored, answers, (section, key) =>
      t('en', section, key),
    )
    const spanish = localizeBusinessScoreResult(scored, answers, (section, key) =>
      t('es', section, key),
    )
    expect(english.overallScore).toBe(scored.overallScore)
    expect(spanish.overallScore).toBe(scored.overallScore)
    expect(english.overallGrade).toBe(spanish.overallGrade)
    expect(english.growthReadiness).toBe(spanish.growthReadiness)
    expect(
      english.categories.map((item) => `${item.id}:${item.score}:${item.grade}:${item.status}`),
    ).toEqual(
      spanish.categories.map((item) => `${item.id}:${item.score}:${item.grade}:${item.status}`),
    )
    expect(english.priorities.map((item) => item.level)).toEqual(
      spanish.priorities.map((item) => item.level),
    )
    expect(english.priorities.map((item) => item.level)).toEqual([
      'Critical',
      'Important',
      'Long-Term',
    ])
    expect(english.priorities[0]?.title).not.toBe(spanish.priorities[0]?.title)
    expect(english.defaultOpenCategory).toBe(spanish.defaultOpenCategory)
    expect(source('components/assessment/scoring/scoreBusinessAssessment.ts')).not.toContain(
      'businessCopy',
    )
    expect(source('components/assessment/scoring/scoreBusinessAssessment.ts')).not.toContain(
      "from '../business/copy'",
    )
  })

  it('rebuilds every English scorer string it localizes', () => {
    const answers = DEMO_BUSINESS_ANSWERS
    const scored = scoreBusinessAssessment(answers)
    const english = localizeBusinessScoreResult(scored, answers, (section, key) =>
      t('en', section, key),
    )
    expect(english.currentLevel).toBe(scored.currentLevel)
    expect(english.protectionRating).toBe(scored.protectionRating)
    expect(english.narrative).toBe(scored.narrative)
    expect(english.blueprintBullets).toEqual(scored.blueprintBullets)
    expect(english.actionPlan).toEqual(scored.actionPlan)
    expect(english.categories.map((item) => item.title)).toEqual(
      scored.categories.map((item) => item.title),
    )
    expect(english.categories.map((item) => item.summary)).toEqual(
      scored.categories.map((item) => item.summary),
    )
    expect(english.categories.map((item) => item.guidance)).toEqual(
      scored.categories.map((item) => item.guidance),
    )
    expect(english.categories.map((item) => item.explanation)).toEqual(
      scored.categories.map((item) => item.explanation),
    )
    expect(english.categories.map((item) => item.recommendations)).toEqual(
      scored.categories.map((item) => item.recommendations),
    )
    expect(english.priorities).toEqual(scored.priorities)
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
    expect(
      source('components/reportCard/familyIngest/completeFamilyReportCardSubmission.ts'),
    ).not.toContain('businessCopy')
    expect(source('components/reportCard/businessReportCardData.ts')).not.toContain('lang=es')
  })
})
