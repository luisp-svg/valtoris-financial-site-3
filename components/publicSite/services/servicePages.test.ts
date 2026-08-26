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
import HomePage from '../../../pages/HomePage'
import StudentLoanServicePage from '../../../pages/StudentLoanServicePage'
import CreditServicePage from '../../../pages/CreditServicePage'
import { ROUTES } from '../../../constants/routes'
import {
  FAMILIES_FOOTER_LINKS,
  FUTURE_UNBUILT_PUBLIC_PATHS,
  SERVICES_NAV_LINKS,
  TOOLS_NAV_LINKS,
} from '../navConfig'
import { HOME_AUDIENCE_PATHS, HOME_FEATURED_DIAGNOSTICS, HOME_SERVICE_CARDS } from '../home/homeConfig'
import { creditServiceCopy, studentLoanServiceCopy } from './copy'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

const FIXED_COUNT = [
  /\b10 questions\b/i,
  /\b10 diagnostic questions\b/i,
  /\b12 questions\b/i,
  /\b12 diagnostic questions\b/i,
  /\b10 preguntas\b/i,
  /\b12 preguntas\b/i,
  /las 10 preguntas/i,
  /las 12 preguntas/i,
]

const FORBIDDEN_PROMISES = [
  'increase your score',
  'delete negative',
  'guaranteed deletion',
  'guaranteed forgiveness',
  'loan forgiveness company',
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

function assertNoFixedCount(text: string) {
  for (const pattern of FIXED_COUNT) {
    expect(text).not.toMatch(pattern)
  }
}

describe('Phase 3 Student Loan and Credit service pages', () => {
  it('creates distinct service routes without replacing Report Card routes', () => {
    expect(ROUTES.studentLoans).toBe('/student-loans')
    expect(ROUTES.credit).toBe('/credit')
    expect(ROUTES.studentLoanReportCard).toBe('/student-loan-report-card')
    expect(ROUTES.creditReportCard).toBe('/credit-report-card')
    const app = source('src/App.tsx')
    expect(app).toMatch(/path=\{ROUTES\.studentLoans\}/)
    expect(app).toMatch(/path=\{ROUTES\.credit\}\s/)
    expect(app).toContain('path={ROUTES.studentLoanReportCard}')
    expect(app).toContain('path={ROUTES.creditReportCard}')
    expect(app).not.toContain('Navigate to={ROUTES.studentLoanReportCard}')
    expect(app).not.toContain('Navigate to={ROUTES.creditReportCard}')
  })

  it('points Services at service pages and Tools at Report Cards', () => {
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'studentLoans')?.to).toBe(ROUTES.studentLoans)
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'credit')?.to).toBe(ROUTES.credit)
    expect(TOOLS_NAV_LINKS.find((item) => item.id === 'studentLoan')?.to).toBe(ROUTES.studentLoanReportCard)
    expect(TOOLS_NAV_LINKS.find((item) => item.id === 'credit')?.to).toBe(ROUTES.creditReportCard)
    const html = renderChrome('/')
    expect(html).toContain(`href="${ROUTES.studentLoans}"`)
    expect(html).toContain(`href="${ROUTES.credit}"`)
    expect(html).toContain(`href="${ROUTES.studentLoanReportCard}"`)
    expect(html).toContain(`href="${ROUTES.creditReportCard}"`)
  })

  it('updates homepage service links and leaves diagnostic cards on Report Cards', () => {
    expect(HOME_AUDIENCE_PATHS.find((item) => item.id === 'studentLoans')?.to).toBe(
      ROUTES.studentLoanReportCard,
    )
    expect(HOME_AUDIENCE_PATHS.find((item) => item.id === 'credit')?.to).toBe(ROUTES.creditReportCard)
    expect(HOME_SERVICE_CARDS.find((item) => item.id === 'studentLoans')?.to).toBe(ROUTES.studentLoans)
    expect(HOME_SERVICE_CARDS.find((item) => item.id === 'credit')?.to).toBe(ROUTES.credit)
    expect(HOME_FEATURED_DIAGNOSTICS.find((item) => item.id === 'studentLoan')?.to).toBe(
      ROUTES.studentLoanReportCard,
    )
    expect(HOME_FEATURED_DIAGNOSTICS.find((item) => item.id === 'credit')?.to).toBe(ROUTES.creditReportCard)
    const html = renderAt('/', createElement(HomePage))
    expect(html).toContain(`href="${ROUTES.studentLoans}"`)
    expect(html).toContain(`href="${ROUTES.credit}"`)
    const diagnostics = html.match(/id="home-diagnostics"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(diagnostics).toContain(`href="${ROUTES.studentLoanReportCard}"`)
    expect(diagnostics).toContain(`href="${ROUTES.creditReportCard}"`)
    expect(diagnostics).not.toContain(`href="${ROUTES.studentLoans}"`)
    expect(diagnostics).not.toContain(`href="${ROUTES.credit}"`)
  })

  it('keeps footer Families as services and footer Tools as Report Cards', () => {
    expect(FAMILIES_FOOTER_LINKS.find((item) => item.id === 'studentLoans')?.to).toBe(ROUTES.studentLoans)
    expect(FAMILIES_FOOTER_LINKS.find((item) => item.id === 'credit')?.to).toBe(ROUTES.credit)
    expect(TOOLS_NAV_LINKS.find((item) => item.id === 'studentLoan')?.to).toBe(ROUTES.studentLoanReportCard)
    expect(TOOLS_NAV_LINKS.find((item) => item.id === 'credit')?.to).toBe(ROUTES.creditReportCard)
  })

  it('renders complete Student Loan EN and ES pages with Report Card and Book CTAs', () => {
    const en = renderAt('/student-loans', createElement(StudentLoanServicePage))
    const es = renderAt('/student-loans?lang=es', createElement(StudentLoanServicePage))
    expect(en).toContain('Understand Your Student Loans. Build a Clearer Path Forward.')
    expect(en).toContain('Take the Student Loan Report Card™')
    expect(en).toContain('Book a Meeting')
    expect(en).toContain('StudentAid.gov')
    expect(en).toContain(`href="${ROUTES.studentLoanReportCard}"`)
    expect(en).toContain(`href="${ROUTES.schedule}"`)
    expect(en).not.toContain('Get Clarity on Your Student Loans')
    expect(es).toContain('Entienda sus préstamos estudiantiles. Trace un camino más claro.')
    expect(es).toContain('Hacer el Reporte de Préstamos Estudiantiles™')
    expect(es).toContain('Agendar una reunión')
    expect(es).not.toContain('Understand Your Student Loans. Build a Clearer Path Forward.')
    expect(Object.keys(studentLoanServiceCopy.en).sort()).toEqual(Object.keys(studentLoanServiceCopy.es).sort())
    assertNoFixedCount(en)
    assertNoFixedCount(es)
    assertNoFixedCount(JSON.stringify(studentLoanServiceCopy))
  })

  it('renders complete Credit EN and ES pages without bureau-score claims', () => {
    const en = renderAt('/credit', createElement(CreditServicePage))
    const es = renderAt('/credit?lang=es', createElement(CreditServicePage))
    expect(en).toContain('Understand Your Credit. Know What to Work on Next.')
    expect(en).toContain('Take the Credit Report Card™')
    expect(en).toContain('does not pull a bureau score')
    expect(en).toContain('not a FICO®')
    expect(en).toContain(`href="${ROUTES.creditReportCard}"`)
    expect(en).toContain(`href="${ROUTES.schedule}"`)
    expect(es).toContain('Entienda su crédito. Sepa en qué enfocarse después.')
    expect(es).toContain('Hacer el Reporte de Crédito™')
    expect(es).not.toContain('Understand Your Credit. Know What to Work on Next.')
    expect(Object.keys(creditServiceCopy.en).sort()).toEqual(Object.keys(creditServiceCopy.es).sort())
    assertNoFixedCount(en)
    assertNoFixedCount(es)
    assertNoFixedCount(JSON.stringify(creditServiceCopy))
  })

  it('preserves locale and attribution from homepage through service CTAs', () => {
    const query = '?lang=es&utm_source=qa&utm_campaign=phase3&card=test-card'
    const sl = renderAt(`/student-loans${query}`, createElement(StudentLoanServicePage))
    const credit = renderAt(`/credit${query}`, createElement(CreditServicePage))
    const suffix = 'lang=es&amp;utm_source=qa&amp;utm_campaign=phase3&amp;card=test-card'
    expect(sl).toContain(`href="${ROUTES.studentLoanReportCard}?${suffix}"`)
    expect(sl).toContain(`href="${ROUTES.schedule}?${suffix}"`)
    expect(credit).toContain(`href="${ROUTES.creditReportCard}?${suffix}"`)
    expect(credit).toContain(`href="${ROUTES.schedule}?${suffix}"`)
  })

  it('does not invent unbuilt routes or promise guarantee outcomes', () => {
    const sl = renderAt('/student-loans', createElement(StudentLoanServicePage))
    const credit = renderAt('/credit', createElement(CreditServicePage))
    const blob = `${sl} ${credit} ${JSON.stringify(studentLoanServiceCopy)} ${JSON.stringify(creditServiceCopy)}`.toLowerCase()
    for (const path of FUTURE_UNBUILT_PUBLIC_PATHS) {
      expect(sl).not.toContain(`href="${path}"`)
      expect(credit).not.toContain(`href="${path}"`)
    }
    for (const phrase of FORBIDDEN_PROMISES) {
      expect(blob).not.toContain(phrase)
    }
  })

  it('does not change scoring, ingest, credit_repair, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(52)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_service_pages.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('components/assessment/studentLoan/scoreStudentLoanAssessment.ts')).not.toContain('ServicePage')
    expect(source('components/assessment/credit/scoreCreditAssessment.ts')).not.toContain('ServicePage')
    expect(source('pages/StudentLoanReportCardResults.tsx')).not.toContain('ServicePage')
    expect(source('pages/CreditReportCardResults.tsx')).not.toContain('ServicePage')
  })
})
