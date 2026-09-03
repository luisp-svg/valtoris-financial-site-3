import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GOAL_OPTIONS } from '../constants'
import { resolveSpecializedCopy } from '../specialized/locale'
import type { SpecializedCopyCatalog, SpecializedCopySection } from '../specialized/types'
import { scoreFamilyAssessment } from '../scoring/scoreFamilyAssessment'
import {
  AVERAGE_FAMILY_PROFILE,
  STRONG_FAMILY_PROFILE,
  WEAK_FAMILY_PROFILE,
} from '../scoring/scoreFamilyAssessment.test'
import { validFamilyAnswersFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import FamilyReportCardResults from '../../../pages/FamilyReportCardResults'
import { ROUTES } from '../../../constants/routes'
import { familyCopy } from './copy'

const ROOT = process.cwd()

const EXISTING_GOAL_VALUES = [
  'protect-family',
  'debt-free',
  'build-wealth',
  'reduce-taxes',
  'retire',
  'college',
  'legacy',
] as const

const EXISTING_GOAL_LABELS: Record<(typeof EXISTING_GOAL_VALUES)[number], string> = {
  'protect-family': 'Protect my family',
  'debt-free': 'Become debt free',
  'build-wealth': 'Build wealth',
  'reduce-taxes': 'Reduce taxes',
  retire: 'Retire comfortably',
  college: 'Pay for college',
  legacy: 'Leave a legacy',
}

const PROHIBITED_MORTGAGE_LANGUAGE =
  /pre-?qualif|underwrit|mortgage approval|loan approval|\bqualified\b|\bqualification\b/i

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function t(locale: 'en' | 'es', section: SpecializedCopySection, key: string): string {
  return resolveSpecializedCopy(familyCopy, locale, section, key)
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

function renderResults(answers = validFamilyAnswersFixture(), search = '') {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: ROUTES.reportCardResults, search, state: { answers } }] },
      createElement(FamilyReportCardResults),
    ),
  )
}

describe('Family Report Card homeownership goal linkage', () => {
  it('adds buy-home without changing existing Family goal values or labels', () => {
    const values = GOAL_OPTIONS.map((option) => option.value)
    expect(values).toEqual([...EXISTING_GOAL_VALUES, 'buy-home'])
    expect(GOAL_OPTIONS.find((option) => option.value === 'buy-home')?.label).toBe(
      'Buy a Home / Homeownership',
    )
    for (const value of EXISTING_GOAL_VALUES) {
      expect(GOAL_OPTIONS.find((option) => option.value === value)?.label).toBe(
        EXISTING_GOAL_LABELS[value],
      )
    }
  })

  it('provides complete EN/ES copy for the new goal and Home Buyer CTA', () => {
    expect(familyCopy.en).not.toBeNull()
    expect(familyCopy.es).not.toBeNull()
    expect(catalogKeys(familyCopy.es!)).toEqual(catalogKeys(familyCopy.en!))
    expect(t('en', 'answers', 'goals.buy-home')).toBe('Buy a Home / Homeownership')
    expect(t('es', 'answers', 'goals.buy-home')).toBe('Comprar una casa / Ser propietario')
    expect(t('en', 'ui', 'resultsHomeBuyerCta')).toBe('Check Your Home Buyer Readiness')
    expect(t('en', 'ui', 'resultsHomeBuyerCopy')).toContain('down payment readiness')
    expect(t('es', 'ui', 'resultsHomeBuyerCta').trim().length).toBeGreaterThan(0)
    expect(t('es', 'ui', 'resultsHomeBuyerCopy').trim().length).toBeGreaterThan(0)
    expect(t('es', 'answers', 'goals.buy-home')).not.toBe('goals.buy-home')
    expect(t('en', 'answers', 'goals.protect-family')).toBe('Protect my family')
    expect(t('es', 'answers', 'goals.protect-family')).toBe('Proteger a mi familia')
  })

  it('keeps Family scoring valid and does not change category weights for buy-home', () => {
    const scoring = source('components/assessment/scoring/scoreFamilyAssessment.ts')
    expect(scoring).toMatch(/cashflow:\s*0\.15/)
    expect(scoring).toMatch(/emergency:\s*0\.15/)
    expect(scoring).toMatch(/debt:\s*0\.2/)
    expect(scoring).toMatch(/protection:\s*0\.2/)
    expect(scoring).toMatch(/retirement:\s*0\.15/)
    expect(scoring).toMatch(/estate:\s*0\.15/)
    expect(scoring).toContain("'buy-home': 'cashflow'")
    expect(scoring).not.toMatch(/homeownership|buy-home.*=/)

    const weak = scoreFamilyAssessment(WEAK_FAMILY_PROFILE)
    const average = scoreFamilyAssessment(AVERAGE_FAMILY_PROFILE)
    const strong = scoreFamilyAssessment(STRONG_FAMILY_PROFILE)
    expect(weak.overallScore).toBeLessThan(average.overallScore)
    expect(average.overallScore).toBeLessThan(strong.overallScore)
    expect(weak.categories.map((category) => category.id)).toEqual([
      'cashflow',
      'emergency',
      'debt',
      'protection',
      'retirement',
      'estate',
    ])

    const baseline = scoreFamilyAssessment(validFamilyAnswersFixture())
    const buyHomeOnly = scoreFamilyAssessment(
      validFamilyAnswersFixture({ goals: { selected: ['buy-home'] } }),
    )
    const sameGoalsPlusBuyHome = scoreFamilyAssessment(
      validFamilyAnswersFixture({
        goals: { selected: ['protect-family', 'debt-free', 'buy-home'] },
      }),
    )

    expect(buyHomeOnly.overallScore).toBe(baseline.overallScore)
    expect(sameGoalsPlusBuyHome.overallScore).toBe(baseline.overallScore)
    expect(buyHomeOnly.categories.map((category) => `${category.id}:${category.score}`)).toEqual(
      baseline.categories.map((category) => `${category.id}:${category.score}`),
    )
    expect(sameGoalsPlusBuyHome.categories.map((category) => `${category.id}:${category.score}`)).toEqual(
      baseline.categories.map((category) => `${category.id}:${category.score}`),
    )
    expect(buyHomeOnly.categories).toHaveLength(6)
  })

  it('shows the Home Buyer recommendation only when buy-home is selected', () => {
    const without = renderResults(validFamilyAnswersFixture())
    const withBuyHome = renderResults(
      validFamilyAnswersFixture({ goals: { selected: ['buy-home'] } }),
    )
    const mixed = renderResults(
      validFamilyAnswersFixture({
        goals: { selected: ['protect-family', 'buy-home'] },
      }),
    )

    expect(without).not.toContain('family-home-buyer-recommendation')
    expect(without).not.toContain('Check Your Home Buyer Readiness')
    expect(without).not.toContain(ROUTES.homeBuyerReportCard)
    expect(withBuyHome).toContain('family-home-buyer-recommendation')
    expect(withBuyHome).toContain('Check Your Home Buyer Readiness')
    expect(withBuyHome).toContain(`href="${ROUTES.homeBuyerReportCard}"`)
    expect(withBuyHome).toContain(
      'See how prepared you are across credit, income, debt, savings, cash flow, and down payment readiness.',
    )
    expect(mixed).toContain(`href="${ROUTES.homeBuyerReportCard}"`)
    expect(ROUTES.homeBuyerReportCard).toBe('/home-buyer-report-card')

    const spanish = renderResults(
      validFamilyAnswersFixture({ goals: { selected: ['buy-home'] } }),
      '?lang=es',
    )
    expect(spanish).toContain(`href="${ROUTES.homeBuyerReportCard}?lang=es"`)
    expect(spanish).toContain('Revise su preparación para comprar vivienda')
  })

  it('avoids prohibited mortgage-qualification language in the new Family copy and CTA', () => {
    const copy = source('components/assessment/family/copy.ts')
    const results = source('pages/FamilyReportCardResults.tsx')
    const goalBlock = [
      t('en', 'answers', 'goals.buy-home'),
      t('es', 'answers', 'goals.buy-home'),
      t('en', 'ui', 'resultsHomeBuyerCta'),
      t('es', 'ui', 'resultsHomeBuyerCta'),
      t('en', 'ui', 'resultsHomeBuyerCopy'),
      t('es', 'ui', 'resultsHomeBuyerCopy'),
    ].join('\n')

    expect(goalBlock).not.toMatch(PROHIBITED_MORTGAGE_LANGUAGE)
    expect(copy).not.toMatch(/prequalif|underwrit|mortgage approval/i)
    expect(results).toContain('ROUTES.homeBuyerReportCard')
    expect(results).not.toMatch(PROHIBITED_MORTGAGE_LANGUAGE)
    expect(readdirSync(join(ROOT, 'supabase/migrations')).some((name) => name.startsWith('055_'))).toBe(
      false,
    )
  })
})
