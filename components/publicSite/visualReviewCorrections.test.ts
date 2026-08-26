import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry/registry'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import HomePage from '../../pages/HomePage'
import StudentLoanReportCardPage from '../../pages/StudentLoanReportCardPage'
import CreditReportCardPage from '../../pages/CreditReportCardPage'
import { ROUTES } from '../../constants/routes'
import {
  BOOK_NAV,
  CONTACT_NAV,
  FUTURE_UNBUILT_PUBLIC_PATHS,
  HOME_NAV,
  VISIBLE_TOP_LEVEL_NAV_IDS,
} from './navConfig'
import { HOME_FEATURED_DIAGNOSTICS } from './home/homeConfig'
import { homeCopy } from './home/copy'
import { studentLoanCopy } from '../assessment/studentLoan/copy'
import {
  STUDENT_LOAN_ASSESSMENT_STEPS,
  STUDENT_LOAN_DIAGNOSTIC_QUESTION_COUNT,
} from '../assessment/studentLoan/constants'
import { creditCopy } from '../assessment/credit/copy'
import {
  CREDIT_ASSESSMENT_STEPS,
  CREDIT_DIAGNOSTIC_QUESTION_COUNT,
} from '../assessment/credit/constants'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

const FIXED_QUESTION_COUNT = [
  /\b10 questions\b/i,
  /\b10 diagnostic questions\b/i,
  /\b12 questions\b/i,
  /\b12 diagnostic questions\b/i,
  /\b10 preguntas\b/i,
  /\b12 preguntas\b/i,
  /las 10 preguntas/i,
  /las 12 preguntas/i,
  /10 preguntas de diagnóstico/i,
  /12 preguntas de diagnóstico/i,
]

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

function navHtml(html: string, className: string) {
  const match = html.match(new RegExp(`<nav class="${className}"[\\s\\S]*?<\\/nav>`))
  expect(match?.[0]).toBeTruthy()
  return match?.[0] ?? ''
}

function assertNoFixedQuestionCount(text: string) {
  for (const pattern of FIXED_QUESTION_COUNT) {
    expect(text).not.toMatch(pattern)
  }
}

describe('visual review corrections', () => {
  it('adds Home to desktop and mobile primary navigation without restoring Contact', () => {
    expect(VISIBLE_TOP_LEVEL_NAV_IDS).toEqual(['home', 'services', 'tools'])
    expect(HOME_NAV.to).toBe(ROUTES.home)
    expect(HOME_NAV.labelKey).toBe('navHome')
    expect(CONTACT_NAV.to).toBe(ROUTES.schedule)
    expect(BOOK_NAV.to).toBe(ROUTES.schedule)

    const header = source('components/SiteHeader.tsx')
    const mobile = source('components/publicSite/SiteMobileNav.tsx')
    expect(header).toContain('HOME_NAV')
    expect(header).toContain('copy.navHome')
    expect(header).not.toContain('copy.navContact')
    expect(mobile).toContain('HOME_NAV')
    expect(mobile).toContain('copy.navHome')
    expect(mobile).not.toContain('copy.navContact')
    expect(header).toContain('BOOK_NAV')
    expect(mobile).toContain('BOOK_NAV')

    const html = renderChrome('/')
    const primary = navHtml(html, 'site-nav-primary')
    const drawer = navHtml(html, 'site-mobile-nav')
    expect(primary).toContain('Home')
    expect(primary).toContain(`href="${ROUTES.home}"`)
    expect(primary).not.toContain('Contact')
    expect(drawer).toContain('Home')
    expect(drawer).toContain(`href="${ROUTES.home}"`)
    expect(drawer).not.toContain('Contact')
    expect(html).toContain('Book a Meeting')
    expect(html).toContain(`href="${ROUTES.schedule}"`)
    expect(html).not.toContain('>Contact</')
    expect(source('components/SiteFooter.tsx')).toContain('COMPANY_FOOTER_LINKS')
  })

  it('preserves Home locale and attribution through PublicLink', () => {
    const es = renderChrome('/?utm_source=qa&utm_campaign=visual-corrections&card=test-card&lang=es')
    expect(es).toContain('Inicio')
    expect(es).toContain(
      `href="/?utm_source=qa&amp;utm_campaign=visual-corrections&amp;card=test-card&amp;lang=es"`,
    )
    const en = renderChrome('/?utm_source=qa&utm_campaign=visual-corrections&card=test-card')
    expect(en).toContain('Home')
    expect(en).toContain(`href="/?utm_source=qa&amp;utm_campaign=visual-corrections&amp;card=test-card"`)
    expect(en).not.toContain('lang=en')
  })

  it('renders all six diagnostic tools as equal cards and removes Also available', () => {
    const html = renderAt('/', createElement(HomePage))
    const diagnostics = html.match(/id="home-diagnostics"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(diagnostics).toContain('site-home-card-grid--3')
    expect(diagnostics.match(/class="site-home-card site-home-card--centered"/g)?.length).toBe(6)
    expect(diagnostics).toContain('Family Report Card™')
    expect(diagnostics).toContain('Business Report Card™')
    expect(diagnostics).toContain('Student Loan Report Card™')
    expect(diagnostics).toContain('Credit Report Card™')
    expect(diagnostics).toContain('Retirement Report Card™')
    expect(diagnostics).toContain('Protection Gap')
    expect(diagnostics).not.toContain('Also available')
    expect(diagnostics).not.toContain('site-home-more-tools')
    expect(HOME_FEATURED_DIAGNOSTICS.map((item) => item.id)).toEqual([
      'family',
      'business',
      'studentLoan',
      'credit',
      'retirement',
      'protection',
    ])
    expect(HOME_FEATURED_DIAGNOSTICS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
    ])
    const styles = source('src/styles.css')
    expect(styles).toContain('.site-home-card {\n  display: flex;\n  flex-direction: column;')
    expect(styles).toContain('height: 100%;')
    expect(styles).toContain('.site-home-card-link,\n.site-home-card-actions {\n  margin-top: auto;\n}')
    expect(source('components/publicSite/home/HomeDiagnostics.tsx')).toContain('site-home-card-link')
    expect(source('components/publicSite/home/homeConfig.ts')).not.toContain('HOME_MORE_DIAGNOSTICS')
  })

  it('keeps unused journey architecture off the rendered homepage', () => {
    expect(homeCopy.en.journeysHeading).toBe('Explore Solutions for You')
    expect(homeCopy.es.journeysHeading).toBe('Explore soluciones para usted')
    const html = renderAt('/', createElement(HomePage))
    expect(html).not.toContain('Explore Solutions for You')
    expect(html).not.toContain('id="home-journeys-heading"')
    expect(html).not.toContain('Choose a broader path')
    expect(source('pages/HomePage.tsx')).not.toContain('HomeAudienceJourneys')
    const styles = source('src/styles.css')
    expect(styles).toContain('.site-home-card.site-home-card--journey')
    expect(styles).toContain('grid-template-rows: subgrid;')
    expect(source('components/publicSite/home/HomeAudienceJourneys.tsx')).toContain(
      'site-home-card-grid--journeys',
    )
  })

  it('does not introduce unbuilt public routes', () => {
    const html = `${renderChrome('/')}${renderAt('/', createElement(HomePage))}`
    for (const path of FUTURE_UNBUILT_PUBLIC_PATHS) {
      expect(html).not.toContain(`href="${path}"`)
    }
  })

  it('rewrites Student Loan hero copy and uses a family sample preview', () => {
    const html = renderAt('/student-loan-report-card', createElement(StudentLoanReportCardPage))
    expect(html).toContain('Get Clarity on Your Student Loans')
    expect(html).toContain('Understand where you stand with your student loans')
    expect(html).toContain('The Student Loan Report Card™ helps organize your repayment situation')
    expect(html).not.toContain('No FSA login')
    expect(html).not.toContain('No Social Security number. No cost to start')
    expect(html).toContain('sample-results-preview')
    expect(html).toContain('Sample / Example')
    expect(html).toContain('74')
    expect(html).toContain('Example review flag')
    expect(html).toContain('StudentAid.gov')
    expect(html).toContain('not the U.S. Department of Education')
    expect(html).not.toContain('funnel-preview-card')
    assertNoFixedQuestionCount(html)
  })

  it('rewrites Credit hero copy and uses a family sample preview', () => {
    const html = renderAt('/credit-report-card', createElement(CreditReportCardPage))
    expect(html).toContain('Understand Your Credit. Know What to Work on Next.')
    expect(html).toContain('strengths and weaknesses in your current credit profile')
    expect(html).toContain('The Credit Report Card™ helps organize the factors affecting your credit')
    expect(html).not.toContain('About 3–5 minutes. 10 diagnostic questions')
    expect(html).not.toContain('No bureau login. No cost to start')
    expect(html).toContain('sample-results-preview')
    expect(html).toContain('Sample / Example')
    expect(html).toContain('73')
    expect(html).toContain('not a FICO')
    expect(html).not.toContain('funnel-preview-card')
    assertNoFixedQuestionCount(html)
  })

  it('keeps Spanish landing complete without English hero leaks or fixed question counts', () => {
    const sl = renderAt('/student-loan-report-card?lang=es', createElement(StudentLoanReportCardPage))
    const credit = renderAt('/credit-report-card?lang=es', createElement(CreditReportCardPage))
    expect(sl).toContain('Tenga más claridad sobre sus préstamos estudiantiles')
    expect(sl).toContain('Muestra / Ejemplo')
    expect(sl).not.toContain('Get Clarity on Your Student Loans')
    expect(credit).toContain('Entienda su crédito. Sepa en qué enfocarse después.')
    expect(credit).toContain('Muestra / Ejemplo')
    expect(credit).not.toContain('Understand Your Credit. Know What to Work on Next.')
    assertNoFixedQuestionCount(sl)
    assertNoFixedQuestionCount(credit)
    assertNoFixedQuestionCount(JSON.stringify(studentLoanCopy.en?.ui) + JSON.stringify(studentLoanCopy.es?.ui))
    assertNoFixedQuestionCount(JSON.stringify(creditCopy.en?.ui) + JSON.stringify(creditCopy.es?.ui))
  })

  it('does not change Student Loan or Credit assessment steps, scoring, or ingest', () => {
    expect(STUDENT_LOAN_ASSESSMENT_STEPS).toBe(12)
    expect(STUDENT_LOAN_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(CREDIT_ASSESSMENT_STEPS).toBe(12)
    expect(CREDIT_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(source('components/assessment/studentLoan/questions.ts')).toContain('loan_types')
    expect(source('components/assessment/credit/questions.ts')).toContain('credit_goal')
    expect(source('components/assessment/studentLoan/scoreStudentLoanAssessment.ts')).not.toContain(
      'SpecializedSampleResultsPreview',
    )
    expect(source('components/assessment/credit/scoreCreditAssessment.ts')).not.toContain(
      'SpecializedSampleResultsPreview',
    )
    expect(source('pages/StudentLoanReportCardResults.tsx')).not.toContain('SpecializedSampleResultsPreview')
    expect(source('pages/CreditReportCardResults.tsx')).not.toContain('SpecializedSampleResultsPreview')
  })

  it('does not change scoring, ingest, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(52)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_visual_review.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
  })
})
