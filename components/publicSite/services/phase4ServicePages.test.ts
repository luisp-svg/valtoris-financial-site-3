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
import InsuranceServicePage from '../../../pages/InsuranceServicePage'
import HealthDisabilityServicePage from '../../../pages/HealthDisabilityServicePage'
import BusinessFormationServicePage from '../../../pages/BusinessFormationServicePage'
import StudentLoanServicePage from '../../../pages/StudentLoanServicePage'
import CreditServicePage from '../../../pages/CreditServicePage'
import { ROUTES } from '../../../constants/routes'
import {
  BUSINESS_FOOTER_LINKS,
  FAMILIES_FOOTER_LINKS,
  FUTURE_UNBUILT_PUBLIC_PATHS,
  SERVICES_NAV_LINKS,
  TOOLS_NAV_LINKS,
} from '../navConfig'
import { HOME_FEATURED_DIAGNOSTICS, HOME_SERVICE_CARDS } from '../home/homeConfig'
import { creditServiceCopy, studentLoanServiceCopy } from './copy'
import { insuranceServiceCopy } from './insuranceCopy'
import { healthServiceCopy } from './healthCopy'
import { businessFormationServiceCopy } from './businessFormationCopy'
import type { ServiceCopy } from './copy'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

const SPECIALIZED_REPORT_CARD_PATHS = [
  '/insurance-report-card',
  '/health-disability-report-card',
  '/commercial-insurance-report-card',
  '/trucking-report-card',
  '/pc-report-card',
]

const FORBIDDEN_PROMISES = [
  'guaranteed coverage',
  'guaranteed approval',
  'guaranteed savings',
  'premium savings guaranteed',
  'claim will be paid',
  'we will approve',
  'provides legal advice',
  'provides tax advice',
  'our attorneys will',
  'we file your llc',
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

function catalogShape(copy: ServiceCopy): string {
  return JSON.stringify({
    keys: Object.keys(copy).sort(),
    audience: copy.audienceItems.length,
    review: copy.reviewAreas.map((item) => Object.keys(item).sort()),
    process: copy.processSteps.map((item) => Object.keys(item).sort()),
  })
}

describe('Phase 4 insurance, health, and business formation service pages', () => {
  it('creates the three service routes without colliding with diagnostics', () => {
    expect(ROUTES.insurance).toBe('/insurance')
    expect(ROUTES.healthDisability).toBe('/health-disability')
    expect(ROUTES.businessFormation).toBe('/business-formation')
    expect(ROUTES.protectionAnalysis).toBe('/protection-analysis')
    expect(ROUTES.businessReportCard).toBe('/business-report-card')
    expect(ROUTES.studentLoans).toBe('/student-loans')
    expect(ROUTES.credit).toBe('/credit')
    const app = source('src/App.tsx')
    expect(app).toContain('path={ROUTES.insurance}')
    expect(app).toContain('path={ROUTES.healthDisability}')
    expect(app).toContain('path={ROUTES.businessFormation}')
    expect(app).toContain('InsuranceServicePage')
    expect(app).toContain('HealthDisabilityServicePage')
    expect(app).toContain('BusinessFormationServicePage')
    expect(app).not.toContain('Navigate to={ROUTES.insurance}')
    expect(app).not.toContain('Navigate to={ROUTES.healthDisability}')
    expect(app).not.toContain('Navigate to={ROUTES.businessFormation}')
  })

  it('points Services at the new pages and leaves Tools on the six diagnostics', () => {
    expect(SERVICES_NAV_LINKS.map((item) => item.id)).toEqual([
      'protection',
      'retirement',
      'insurance',
      'health',
      'credit',
      'studentLoans',
      'estate',
      'businessFormation',
      'tax',
      'viewSolutions',
    ])
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'insurance')?.to).toBe(ROUTES.insurance)
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'health')?.to).toBe(ROUTES.healthDisability)
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'businessFormation')?.to).toBe(
      ROUTES.businessFormation,
    )
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'credit')?.to).toBe(ROUTES.credit)
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'studentLoans')?.to).toBe(ROUTES.studentLoans)
    expect(TOOLS_NAV_LINKS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
    ])
    const html = renderChrome('/')
    expect(html).toContain(`href="${ROUTES.insurance}"`)
    expect(html).toContain(`href="${ROUTES.healthDisability}"`)
    expect(html).toContain(`href="${ROUTES.businessFormation}"`)
    expect(html).toContain('Insurance &amp; Risk Management')
    expect(html).toContain('Health &amp; Disability')
    expect(html).toContain('Business Formation')
  })

  it('updates the homepage insurance service card and keeps Business Planning on solutions', () => {
    expect(HOME_SERVICE_CARDS.find((item) => item.id === 'insurance')?.to).toBe(ROUTES.insurance)
    expect(HOME_SERVICE_CARDS.find((item) => item.id === 'business')?.to).toBe(ROUTES.solutions)
    expect(HOME_FEATURED_DIAGNOSTICS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
    ])
    const html = renderAt('/', createElement(HomePage))
    expect(html).toContain(`href="${ROUTES.insurance}"`)
    const diagnostics = html.match(/id="home-diagnostics"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(diagnostics).not.toContain(`href="${ROUTES.insurance}"`)
    expect(diagnostics).not.toContain(`href="${ROUTES.healthDisability}"`)
    expect(diagnostics).not.toContain(`href="${ROUTES.businessFormation}"`)
  })

  it('exposes the three services in footer Families/Business and not under Tools', () => {
    expect(FAMILIES_FOOTER_LINKS.find((item) => item.id === 'insurance')?.to).toBe(ROUTES.insurance)
    expect(FAMILIES_FOOTER_LINKS.find((item) => item.id === 'health')?.to).toBe(ROUTES.healthDisability)
    expect(BUSINESS_FOOTER_LINKS.find((item) => item.id === 'businessFormation')?.to).toBe(
      ROUTES.businessFormation,
    )
    expect(TOOLS_NAV_LINKS.some((item) => item.to === ROUTES.insurance)).toBe(false)
    expect(TOOLS_NAV_LINKS.some((item) => item.to === ROUTES.healthDisability)).toBe(false)
    expect(TOOLS_NAV_LINKS.some((item) => item.to === ROUTES.businessFormation)).toBe(false)
  })

  it('has complete EN/ES catalogs for all three pages', () => {
    expect(catalogShape(insuranceServiceCopy.en)).toBe(catalogShape(insuranceServiceCopy.es))
    expect(catalogShape(healthServiceCopy.en)).toBe(catalogShape(healthServiceCopy.es))
    expect(catalogShape(businessFormationServiceCopy.en)).toBe(
      catalogShape(businessFormationServiceCopy.es),
    )
    expect(insuranceServiceCopy.en.heroTitle).toBe('Protect What You’ve Built.')
    expect(insuranceServiceCopy.es.heroTitle).toBe('Proteja lo que ha construido.')
    expect(healthServiceCopy.en.heroTitle).toBe('Protect Your Health, Income, and Financial Stability.')
    expect(healthServiceCopy.es.heroTitle).toBe(
      'Proteja su salud, su ingreso y su estabilidad financiera.',
    )
    expect(businessFormationServiceCopy.en.heroTitle).toBe('Build the Business on a Stronger Foundation.')
    expect(businessFormationServiceCopy.es.heroTitle).toBe(
      'Construya el negocio sobre una base más sólida.',
    )
  })

  it('renders valid primary and secondary CTAs for each page', () => {
    const insurance = renderAt('/insurance', createElement(InsuranceServicePage))
    const health = renderAt('/health-disability', createElement(HealthDisabilityServicePage))
    const formation = renderAt('/business-formation', createElement(BusinessFormationServicePage))
    expect(insurance).toContain('Explore Protection')
    expect(insurance).toContain(`href="${ROUTES.protectionAnalysis}"`)
    expect(insurance).toContain('Book a Meeting')
    expect(insurance).toContain(`href="${ROUTES.schedule}"`)
    expect(health).toContain('Book a Meeting')
    expect(health).toContain(`href="${ROUTES.schedule}"`)
    expect(health).toContain('Explore Solutions')
    expect(health).toContain(`href="${ROUTES.solutions}"`)
    expect(health).not.toContain(`href="${ROUTES.protectionAnalysis}"`)
    expect(formation).toContain('Book a Business Setup Review')
    expect(formation).toContain(`href="${ROUTES.schedule}"`)
    expect(formation).toContain('Explore Business Solutions')
    expect(formation).toContain(`href="${ROUTES.solutions}"`)
    expect(formation).toContain(`href="${ROUTES.businessReportCard}"`)
    expect(insurance.match(/<h1[^>]*>/g)?.length).toBe(1)
    expect(health.match(/<h1[^>]*>/g)?.length).toBe(1)
    expect(formation.match(/<h1[^>]*>/g)?.length).toBe(1)
  })

  it('keeps insurance, health, and formation compliance language educational', () => {
    const insurance = `${JSON.stringify(insuranceServiceCopy)} ${renderAt('/insurance', createElement(InsuranceServicePage))}`.toLowerCase()
    const health = `${JSON.stringify(healthServiceCopy)} ${renderAt('/health-disability', createElement(HealthDisabilityServicePage))}`.toLowerCase()
    const formation = `${JSON.stringify(businessFormationServiceCopy)} ${renderAt('/business-formation', createElement(BusinessFormationServicePage))}`.toLowerCase()
    expect(insurance).toContain('vary by state')
    expect(insurance).toContain('does not guarantee coverage')
    expect(insurance).toContain('policy terms')
    expect(insurance).toContain('not operate a public quoting engine')
    expect(health).toContain('does not guarantee eligibility')
    expect(health).toContain('underwriting')
    expect(health).toContain('not operate a public quoting')
    expect(formation).toContain('not a law firm')
    expect(formation).toContain('does not provide legal or tax advice')
    expect(formation).toContain('qualified legal professionals')
    expect(formation).toContain('qualified tax professionals')
    expect(formation).toContain('state filing requirements')
    const blob = `${insurance} ${health} ${formation}`
    for (const phrase of FORBIDDEN_PROMISES) {
      expect(blob).not.toContain(phrase)
    }
  })

  it('does not create specialized Report Cards or unbuilt service paths', () => {
    const app = source('src/App.tsx')
    const routes = source('constants/routes.ts')
    for (const path of SPECIALIZED_REPORT_CARD_PATHS) {
      expect(app).not.toContain(path)
      expect(routes).not.toContain(path)
    }
    const insurance = renderAt('/insurance', createElement(InsuranceServicePage))
    const health = renderAt('/health-disability', createElement(HealthDisabilityServicePage))
    const formation = renderAt('/business-formation', createElement(BusinessFormationServicePage))
    for (const path of FUTURE_UNBUILT_PUBLIC_PATHS) {
      expect(insurance).not.toContain(`href="${path}"`)
      expect(health).not.toContain(`href="${path}"`)
      expect(formation).not.toContain(`href="${path}"`)
    }
  })

  it('preserves locale and attribution through the three service journeys', () => {
    const query = '?lang=es&utm_source=qa&utm_campaign=phase4&card=test-card'
    const suffix = 'lang=es&amp;utm_source=qa&amp;utm_campaign=phase4&amp;card=test-card'
    const insurance = renderAt(`/insurance${query}`, createElement(InsuranceServicePage))
    const health = renderAt(`/health-disability${query}`, createElement(HealthDisabilityServicePage))
    const formation = renderAt(`/business-formation${query}`, createElement(BusinessFormationServicePage))
    expect(insurance).toContain(`href="${ROUTES.protectionAnalysis}?${suffix}"`)
    expect(insurance).toContain(`href="${ROUTES.schedule}?${suffix}"`)
    expect(health).toContain(`href="${ROUTES.schedule}?${suffix}"`)
    expect(health).toContain(`href="${ROUTES.solutions}?${suffix}"`)
    expect(formation).toContain(`href="${ROUTES.schedule}?${suffix}"`)
    expect(formation).toContain(`href="${ROUTES.solutions}?${suffix}"`)
    expect(formation).toContain(`href="${ROUTES.businessReportCard}?${suffix}"`)
    expect(insurance).toContain('Proteja lo que ha construido.')
    expect(health).toContain('Proteja su salud, su ingreso y su estabilidad financiera.')
    expect(formation).toContain('Construya el negocio sobre una base más sólida.')
  })

  it('leaves Student Loan and Credit service pages on their Report Card CTAs', () => {
    const sl = renderAt('/student-loans', createElement(StudentLoanServicePage))
    const credit = renderAt('/credit', createElement(CreditServicePage))
    expect(sl).toContain('Understand Your Student Loans. Build a Clearer Path Forward.')
    expect(sl).toContain(`href="${ROUTES.studentLoanReportCard}"`)
    expect(credit).toContain('Understand Your Credit. Know What to Work on Next.')
    expect(credit).toContain(`href="${ROUTES.creditReportCard}"`)
    expect(Object.keys(studentLoanServiceCopy.en).sort()).toEqual(
      Object.keys(studentLoanServiceCopy.es).sort(),
    )
    expect(Object.keys(creditServiceCopy.en).sort()).toEqual(Object.keys(creditServiceCopy.es).sort())
  })

  it('does not change scoring, ingest, CRM, credit_repair, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(53)
    expect(files.some((name) => name.startsWith('053_'))).toBe(true)
    expect(files.some((name) => name.startsWith('054_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_phase4_services.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('components/assessment/studentLoan/scoreStudentLoanAssessment.ts')).not.toContain(
      'InsuranceServicePage',
    )
    expect(source('components/assessment/credit/scoreCreditAssessment.ts')).not.toContain(
      'InsuranceServicePage',
    )
    expect(source('pages/StudentLoanReportCardResults.tsx')).not.toContain('InsuranceServicePage')
    expect(source('pages/CreditReportCardResults.tsx')).not.toContain('InsuranceServicePage')
    expect(source('src/App.tsx')).toContain('path="/crm"')
    expect(source('pages/InsuranceServicePage.tsx')).not.toContain('crm/')
    expect(source('pages/HealthDisabilityServicePage.tsx')).not.toContain('crm/')
    expect(source('pages/BusinessFormationServicePage.tsx')).not.toContain('crm/')
  })
})
