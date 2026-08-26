import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../../platform/registry/registry'
import SiteHeader from '../../SiteHeader'
import SiteFooter from '../../SiteFooter'
import SolutionsPage from '../../../pages/SolutionsPage'
import { ROUTES } from '../../../constants/routes'
import {
  BUSINESS_FOOTER_LINKS,
  COMPANY_FOOTER_LINKS,
  FAMILIES_FOOTER_LINKS,
  FUTURE_UNBUILT_PUBLIC_PATHS,
  SERVICES_NAV_LINKS,
  TOOLS_NAV_LINKS,
} from '../navConfig'
import { chromeCopy } from '../chromeCopy'
import { solutionsCopy } from './copy'
import {
  SOLUTIONS_BUSINESS_CARDS,
  SOLUTIONS_DIAGNOSTICS_HASH,
  SOLUTIONS_FAMILY_CARDS,
  SOLUTIONS_TOOL_CARDS,
} from './solutionsConfig'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

const REAL_CARD_DESTINATIONS = new Set<string>([
  ROUTES.protectionAnalysis,
  ROUTES.insurance,
  ROUTES.healthDisability,
  ROUTES.credit,
  ROUTES.studentLoans,
  ROUTES.estateLegacy,
  ROUTES.taxStrategy,
  ROUTES.businessFormation,
  ROUTES.reportCard,
  ROUTES.businessReportCard,
  ROUTES.retirementReportCard,
  ROUTES.studentLoanReportCard,
  ROUTES.creditReportCard,
  ROUTES.schedule,
])

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function renderAt(entry: string, page: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [entry] }, page))
}

function renderChrome(entry: string) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [entry] },
      createElement('div', null, createElement(SiteHeader), createElement(SiteFooter)),
    ),
  )
}

function sectionHtml(html: string, headingId: string) {
  const match = html.match(new RegExp(`<section[^>]*aria-labelledby="${headingId}"[\\s\\S]*?<\\/section>`))
  return match?.[0] ?? ''
}

describe('Phase 8 solutions hub', () => {
  it('positions solutions around strategy and diagnoses before exploring services', () => {
    const html = renderAt('/solutions', createElement(SolutionsPage))
    expect(html.match(/<h1[^>]*>/g)).toHaveLength(1)
    expect(html).toContain('Solutions Built Around Your Strategy.')
    expect(html).toContain('Your Strategy Determines the Solution. Not the Other Way Around.')
    expect(html).toContain('Find Out Where I Stand')
    expect(html).toContain('Book a Meeting')
    expect(html).toContain(`href="${ROUTES.schedule}"`)
    expect(html).toContain(`href="${SOLUTIONS_DIAGNOSTICS_HASH}"`)
    expect(html.indexOf('Find Out Where I Stand')).toBeLessThan(html.indexOf('Book a Meeting'))
    const hero = sectionHtml(html, 'solutions-hero-heading')
    expect(hero).toContain('Find Out Where I Stand')
    expect(hero).toContain('Book a Meeting')
    expect(hero).toContain(`href="${SOLUTIONS_DIAGNOSTICS_HASH}"`)
    expect(hero).not.toContain('Start Family Report Card')
    expect(hero).not.toContain('protection and retirement to credit')
    expect(html).not.toContain('Business Owner? Start Here')
    expect(html).not.toContain('Solutions Built Around Your Whole Financial Life')
    expect(html).not.toContain('Take the Family Report Card™')
    expect(source('pages/SolutionsPage.tsx')).not.toContain('<Link')
    expect(source('components/publicSite/solutions/SolutionsHub.tsx')).toContain('PublicLink')
    expect(source('components/publicSite/solutions/SolutionsHub.tsx')).not.toContain(
      "from 'react-router-dom'",
    )
  })

  it('renders diagnostics before family and business solution sections', () => {
    const html = renderAt('/solutions', createElement(SolutionsPage))
    expect(html).toContain('Solutions for Individuals &amp; Families')
    expect(html).toContain('Solutions for Business Owners')
    expect(html).toContain('Start With Clarity.')
    expect(html).toContain('Know Your Score. See Your Risks. Build Your Plan.')
    expect(html).toContain('id="solutions-diagnostics"')
    expect(html).toContain('Financial Strategist')
    const family = sectionHtml(html, 'solutions-families-heading')
    const business = sectionHtml(html, 'solutions-business-heading')
    const tools = sectionHtml(html, 'solutions-tools-heading')
    expect(html.indexOf('id="solutions-diagnostics"')).toBeLessThan(html.indexOf('solutions-families-heading'))
    expect(html.indexOf('solutions-families-heading')).toBeLessThan(html.indexOf('solutions-business-heading'))
    expect(html.indexOf('solutions-coordination-heading')).toBeLessThan(html.indexOf('solutions-final-heading'))
    expect(family).toContain('which areas deserve attention')
    expect(business).toContain('Business and personal financial decisions often overlap')
    expect(tools).toContain('conversation begins with your situation')
    expect(family).not.toContain('Retirement Report Card™')
    expect(business).not.toContain('Business Report Card™')
  })

  it('wires every card to a real destination and never self-links to /solutions', () => {
    const allCards = [...SOLUTIONS_FAMILY_CARDS, ...SOLUTIONS_BUSINESS_CARDS, ...SOLUTIONS_TOOL_CARDS]
    for (const card of allCards) {
      expect(REAL_CARD_DESTINATIONS.has(card.to), card.id).toBe(true)
      expect(card.to).not.toBe(ROUTES.solutions)
      expect(card.to.startsWith('/services')).toBe(false)
      expect(FUTURE_UNBUILT_PUBLIC_PATHS).not.toContain(card.to)
    }
    const html = renderAt('/solutions', createElement(SolutionsPage))
    const cardHrefs = [...html.matchAll(/class="platform-btn platform-btn-outline"[^>]*href="([^"]+)"/g)].map(
      (match) => match[1],
    )
    expect(cardHrefs.length).toBe(allCards.length)
    expect(cardHrefs.every((href) => href !== ROUTES.solutions && !href.startsWith(`${ROUTES.solutions}?`))).toBe(
      true,
    )
    expect(SOLUTIONS_TOOL_CARDS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
    ])
  })

  it('keeps one action per card and does not misrepresent retirement or Protection', () => {
    const hub = source('components/publicSite/solutions/SolutionsHub.tsx')
    expect(hub).toContain('platform-btn platform-btn-outline')
    expect(hub).not.toContain('site-home-card-heading-link')
    expect(solutionsCopy.en.familyProtectionBody.toLowerCase()).toContain('life-insurance')
    expect(solutionsCopy.en.familyProtectionBody.toLowerCase()).toContain('diagnostic')
    expect(solutionsCopy.en.familyProtectionBody.toLowerCase()).not.toContain('property')
    expect(solutionsCopy.en.familyProtectionBody.toLowerCase()).not.toContain('health insurance')
    expect(SOLUTIONS_FAMILY_CARDS.some((item) => item.to === ROUTES.retirementReportCard)).toBe(false)
    expect(SOLUTIONS_TOOL_CARDS.some((item) => item.to === ROUTES.retirementReportCard)).toBe(true)
    expect(solutionsCopy.en.toolRetirementBody.toLowerCase()).toContain('readiness')
  })

  it('resolves the duplicate Services-nav /solutions labels and keeps a concise footer', () => {
    const solutionNav = SERVICES_NAV_LINKS.filter((item) => item.to === ROUTES.solutions)
    expect(solutionNav.map((item) => item.id)).toEqual(['viewSolutions'])
    expect(SERVICES_NAV_LINKS.some((item) => item.id === 'business')).toBe(false)
    expect(FAMILIES_FOOTER_LINKS.map((item) => item.to)).toEqual([
      ROUTES.insurance,
      ROUTES.healthDisability,
      ROUTES.estateLegacy,
      ROUTES.studentLoans,
      ROUTES.credit,
      ROUTES.solutions,
    ])
    expect(BUSINESS_FOOTER_LINKS.map((item) => item.to)).toEqual([
      ROUTES.businessFormation,
      ROUTES.taxStrategy,
      ROUTES.insurance,
      ROUTES.solutions,
    ])
    expect(COMPANY_FOOTER_LINKS.map((item) => item.to)).toEqual([
      ROUTES.home,
      ROUTES.schedule,
      ROUTES.privacy,
      ROUTES.crmLogin,
    ])
    expect(TOOLS_NAV_LINKS).toHaveLength(6)
    const chrome = renderChrome('/')
    expect(chrome).toContain('Explore All Solutions')
    expect(chrome).toContain('View Solutions')
    expect((chrome.match(/Business Owners/g) ?? []).length).toBeLessThan(2)
  })

  it('gives Spanish every English copy key and preserves attribution', () => {
    expect(Object.keys(solutionsCopy.en).sort()).toEqual(Object.keys(solutionsCopy.es).sort())
    expect(Object.keys(chromeCopy.en).sort()).toEqual(Object.keys(chromeCopy.es).sort())
    const blob = `${JSON.stringify(solutionsCopy.en)} ${JSON.stringify(solutionsCopy.es)}`.toLowerCase()
    for (const phrase of [
      'financial advisor',
      'fiduciary',
      'registered investment',
      'loan forgiveness',
      'increase your score',
      'credit repair',
    ]) {
      expect(blob).not.toContain(phrase)
    }
    expect(solutionsCopy.en.heroBrand).toBe('Your Strategy Determines the Solution. Not the Other Way Around.')
    expect(solutionsCopy.es.finalLead).toContain('Financial Strategist')
    const spanish = renderAt('/solutions?lang=es&utm_source=qa&utm_campaign=solutions&card=test-card', createElement(SolutionsPage))
    expect(spanish).toContain('Soluciones construidas alrededor de tu estrategia.')
    expect(spanish).toContain('Descubre en qué punto estás')
    expect(spanish).toContain('Agendar una reunión')
    expect(spanish).toContain(
      `href="${ROUTES.schedule}?lang=es&amp;utm_source=qa&amp;utm_campaign=solutions&amp;card=test-card"`,
    )
    expect(spanish).toContain(
      `href="${ROUTES.solutions}?lang=es&amp;utm_source=qa&amp;utm_campaign=solutions&amp;card=test-card#solutions-diagnostics"`,
    )
    expect(spanish).toContain(
      `href="${ROUTES.studentLoans}?lang=es&amp;utm_source=qa&amp;utm_campaign=solutions&amp;card=test-card"`,
    )
    expect(spanish).toContain(
      `href="${ROUTES.reportCard}?lang=es&amp;utm_source=qa&amp;utm_campaign=solutions&amp;card=test-card"`,
    )
    expect(spanish).toContain('Soluciones para personas y familias')
    expect(spanish).toContain('Soluciones para dueños de negocio')
    expect(spanish).toContain('Empieza con claridad.')
    expect(spanish).toContain('Financial Strategist')
    expect(spanish).not.toContain('asesor financiero')
    expect(spanish).not.toContain('Explore las áreas en las que Valtoris puede ayudar')
  })

  it('does not change scoring, ingest, CRM, credit_repair, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(52)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_solutions_hub.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('modules/digital-identity/cta.ts')).toContain("label: 'Future Credit Assessment'")
    expect(source('components/assessment/scoring/scoreFamilyAssessment.ts')).not.toContain('solutionsCopy')
    expect(source('components/calculator/calculations.ts')).not.toContain('solutionsCopy')
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).not.toContain('SolutionsHub')
  })
})
