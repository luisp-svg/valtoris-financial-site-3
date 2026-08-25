import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry/registry'
import FamilyProtectionCalculator from '../../pages/FamilyProtectionCalculator'
import FamilyProtectionResults from '../../pages/FamilyProtectionResults'
import ProtectionAnalysisPage from '../../pages/ProtectionAnalysisPage'
import SpecializedLocaleSwitcher from '../assessment/specialized/SpecializedLocaleSwitcher'
import ProtectionSummaryBreakdown from './ProtectionSummaryBreakdown'
import { resolveSpecializedCopy, withSpecializedLocale } from '../assessment/specialized/locale'
import type {
  SpecializedCopyCatalog,
  SpecializedCopySection,
} from '../assessment/specialized/types'
import { validProtectionAnswersFixture } from '../../server/ingest/familyReportCard/testFixtures'
import { calculateSelectedNeed, formatCurrency, getTotalDebt } from './calculations'
import {
  COLLEGE_FUND_OPTIONS,
  FINAL_EXPENSE_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  INCOME_REPLACEMENT_OPTIONS,
} from './constants'
import { localizeCalculatorOptions, protectionCopy } from './protectionCopy'

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
  return resolveSpecializedCopy(protectionCopy, locale, section, key)
}

function copyFn(locale: 'en' | 'es') {
  return (section: SpecializedCopySection, key: string) => t(locale, section, key)
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

describe('Protection Gap Spanish localization', () => {
  it('gives Spanish every English copy key', () => {
    expect(protectionCopy.en).not.toBeNull()
    expect(protectionCopy.es).not.toBeNull()
    expect(catalogKeys(protectionCopy.es!)).toEqual(catalogKeys(protectionCopy.en!))
    for (const [section, keys] of Object.entries(catalogKeys(protectionCopy.en!))) {
      for (const key of keys) {
        const spanish = t('es', section as SpecializedCopySection, key)
        expect(spanish, `${section}.${key}`).not.toBe(key)
        expect(spanish.trim().length, `${section}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps canonical option values identical between locales', () => {
    for (const [options, prefix] of [
      [HOUSING_TYPE_OPTIONS, 'housingType'],
      [INCOME_REPLACEMENT_OPTIONS, 'incomeReplacementYears'],
      [COLLEGE_FUND_OPTIONS, 'collegeFundPerChild'],
      [FINAL_EXPENSE_OPTIONS, 'finalExpenses'],
    ] as const) {
      const english = localizeCalculatorOptions(options, copyFn('en'), prefix)
      const spanish = localizeCalculatorOptions(options, copyFn('es'), prefix)
      expect(english.map((option) => option.value)).toEqual(options.map((option) => option.value))
      expect(spanish.map((option) => option.value)).toEqual(english.map((option) => option.value))
      for (const option of spanish) {
        expect(option.label, `${prefix}.${option.value}`).not.toBe(`${prefix}.${option.value}`)
      }
    }

    expect(HOUSING_TYPE_OPTIONS.map((option) => option.value)).toEqual(['own', 'rent'])
    expect(INCOME_REPLACEMENT_OPTIONS.map((option) => option.value)).toEqual([
      '10',
      '15',
      '20',
      'custom',
    ])
    expect(COLLEGE_FUND_OPTIONS.map((option) => option.value)).toEqual([
      '50000',
      '100000',
      '150000',
      'custom',
    ])
    expect(FINAL_EXPENSE_OPTIONS.map((option) => option.value)).toEqual([
      '15000',
      '25000',
      '50000',
      'custom',
    ])

    const answers = validProtectionAnswersFixture()
    expect(answers.housing.housingType).toBe('own')
    expect(answers.income.incomeReplacementYears).toBe('15')
    expect(answers.education.collegeFundPerChild).toBe('100000')
    expect(answers.finalExpenses.amount).toBe('25000')
    expect(answers.family.maritalStatus).toBe('married')
    expect(t('en', 'answers', 'housingType.own')).toBe('Own a Home')
    expect(t('es', 'answers', 'housingType.own')).toBe('Es dueño(a) de su casa')
  })

  it('produces identical Protection Gap™ math regardless of locale', () => {
    const answers = validProtectionAnswersFixture()
    const breakdown = calculateSelectedNeed(answers)

    // The calculator is locale-independent: same input object, same numbers.
    expect(calculateSelectedNeed(answers)).toEqual(breakdown)
    expect(breakdown.income).toBe(150000 * 15)
    expect(breakdown.housing).toBe(24000 * 5)
    expect(breakdown.debt).toBe(17000)
    expect(breakdown.education).toBe(2 * 100000)
    expect(breakdown.finalExpenses).toBe(25000)
    expect(breakdown.total).toBe(2612000)
    expect(breakdown.netNeed).toBe(2612000 - 250000)
    expect(getTotalDebt(answers)).toBe(17000)

    // Currency stays USD for both locales so amounts are numerically identical.
    expect(formatCurrency(breakdown.netNeed)).toBe('$2,362,000')
    const amountsByLocale = (['en', 'es'] as const).map((locale) => {
      const t = copyFn(locale)
      const markup = renderToStaticMarkup(
        createElement(ProtectionSummaryBreakdown, {
          breakdown,
          existingCoverage: 250000,
          labels: {
            incomeLabel: t('results', 'row.income.label'),
            housingLabel: t('results', 'row.housing.label'),
            debtLabel: t('results', 'row.debt.label'),
            educationLabel: t('results', 'row.education.label'),
            finalExpensesLabel: t('results', 'row.finalExpenses.label'),
            existingCoverageLabel: t('results', 'row.existingCoverage.label'),
          },
        }),
      )
      return markup.match(/-?\$[\d,]+/g)
    })
    expect(amountsByLocale[0]).toEqual([
      '$2,250,000',
      '$120,000',
      '$17,000',
      '$200,000',
      '$25,000',
      '-$250,000',
    ])
    expect(amountsByLocale[1]).toEqual(amountsByLocale[0])
  })

  it('renders the calculator and results funnel in Spanish', () => {
    const calculator = renderAt('/protection-gap?lang=es', createElement(FamilyProtectionCalculator))
    expect(calculator).toContain('Paso 1 de 7')
    expect(calculator).toContain('Sobre su familia')
    expect(calculator).toContain('Comenzar mi Family Protection Analysis™')
    expect(calculator).toContain('Family Protection Analysis™')
    expect(calculator).not.toContain('About Your Family')

    const results = renderAt('/protection-results?lang=es', createElement(FamilyProtectionResults))
    expect(results).toContain('Su Family Protection Analysis™')
    expect(results).toContain('Protection Gap™ estimado')
    expect(results).toContain('Desglose de la protección')
    expect(results).toContain('/report-card?lang=es')
    expect(results).not.toContain('Protection Breakdown')
  })

  it('renders the protection landing in Spanish without changing routes', () => {
    const landing = renderAt('/protection-analysis?lang=es', createElement(ProtectionAnalysisPage))
    expect(landing).toContain('¿Está su familia protegida financieramente?')
    expect(landing).not.toContain('Is Your Family Financially Protected?')
    expect(landing).toContain('Protection Gap™')
    expect(landing).toContain('Family Protection Analysis™')
    expect(landing).toContain('/protection-gap?lang=es')
    expect(landing).not.toContain('/es/')

    const english = renderAt('/protection-analysis', createElement(ProtectionAnalysisPage))
    expect(english).toContain('Is Your Family Financially Protected?')
    expect(english).toContain('Start My Family Protection Analysis™')

    const switcher = renderAt(
      '/protection-gap?lang=es',
      createElement(SpecializedLocaleSwitcher, {
        locale: 'es',
        groupLabel: t('es', 'ui', 'languageGroupLabel'),
        englishLabel: t('es', 'ui', 'languageEnglish'),
        spanishLabel: t('es', 'ui', 'languageSpanish'),
      }),
    )
    expect(switcher).toContain('Español')
  })

  it('preserves attribution and calculator state across the locale switch', () => {
    expect(
      withSpecializedLocale('/protection-gap', 'es', '?utm_source=qa&utm_campaign=spanish&card=test-card'),
    ).toBe('/protection-gap?utm_source=qa&utm_campaign=spanish&card=test-card&lang=es')
    expect(
      withSpecializedLocale('/protection-gap', 'en', '?lang=es&utm_source=qa&utm_campaign=spanish&card=test-card'),
    ).toBe('/protection-gap?utm_source=qa&utm_campaign=spanish&card=test-card')
    expect(source('components/assessment/specialized/SpecializedLocaleSwitcher.tsx')).toContain(
      'replace: true',
    )

    const calculator = source('pages/FamilyProtectionCalculator.tsx')
    expect(calculator).toContain('useState<CalculatorAnswers>')
    expect(calculator).toContain('navigate(withLocale(ROUTES.protectionResults)')
    expect(calculator).toContain('state: { answers, submissionSaved: true')
    expect(source('pages/FamilyProtectionResults.tsx')).toContain('loadAnswers(location.state)')
  })

  it('does not change calculations, ingest, credit_repair, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(52)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_spanish.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)

    const calculations = source('components/calculator/calculations.ts')
    expect(calculations).not.toContain('protectionCopy')
    expect(calculations).not.toContain('./protectionCopy')
    expect(calculations).not.toContain('lang=es')
    expect(source('components/calculator/types.ts')).not.toContain('protectionCopy')
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).not.toContain(
      'protectionCopy',
    )
    expect(source('components/reportCard/familyIngest/buildFamilyIngestPayload.ts')).not.toContain(
      'lang=es',
    )
  })
})
