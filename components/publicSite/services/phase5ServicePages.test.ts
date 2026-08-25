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
import EstateLegacyServicePage from '../../../pages/EstateLegacyServicePage'
import TaxStrategyServicePage from '../../../pages/TaxStrategyServicePage'
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
  SERVICES_NAV_GROUPS,
  SERVICES_NAV_LINKS,
  TOOLS_NAV_LINKS,
} from '../navConfig'
import { HOME_FEATURED_DIAGNOSTICS, HOME_SERVICE_CARDS } from '../home/homeConfig'
import { estateServiceCopy } from './estateCopy'
import { taxStrategyServiceCopy } from './taxCopy'
import type { ServiceCopy } from './copy'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

const SPECIALIZED_REPORT_CARD_PATHS = [
  '/estate-report-card',
  '/tax-report-card',
  '/llc-report-card',
]

const FORBIDDEN_PROMISES = [
  'we prepare your taxes',
  'we draft your will',
  'licensed attorney',
  'we guarantee tax savings',
  'attorney-client relationship with valtoris',
  'trusteefriend.com',
  'excelempire.com',
  'starting at $',
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

describe('Phase 5 estate and tax strategy service pages', () => {
  it('creates estate and tax routes without colliding with diagnostics', () => {
    expect(ROUTES.estateLegacy).toBe('/estate-legacy')
    expect(ROUTES.taxStrategy).toBe('/tax-strategy')
    expect(ROUTES.reportCard).toBe('/report-card')
    expect(ROUTES.businessReportCard).toBe('/business-report-card')
    expect(ROUTES.insurance).toBe('/insurance')
    const app = source('src/App.tsx')
    expect(app).toContain('path={ROUTES.estateLegacy}')
    expect(app).toContain('path={ROUTES.taxStrategy}')
    expect(app).toContain('EstateLegacyServicePage')
    expect(app).toContain('TaxStrategyServicePage')
    expect(app).not.toContain('Navigate to={ROUTES.estateLegacy}')
    expect(app).not.toContain('Navigate to={ROUTES.taxStrategy}')
  })

  it('points Services at the new pages in grouped nav and leaves Tools unchanged', () => {
    expect(SERVICES_NAV_GROUPS.map((group) => group.id)).toEqual(['individuals', 'business'])
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'estate')?.to).toBe(ROUTES.estateLegacy)
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'tax')?.to).toBe(ROUTES.taxStrategy)
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'insurance')?.to).toBe(ROUTES.insurance)
    expect(SERVICES_NAV_LINKS.find((item) => item.id === 'businessFormation')?.to).toBe(
      ROUTES.businessFormation,
    )
    expect(TOOLS_NAV_LINKS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
    ])
    const html = renderChrome('/')
    expect(html).toContain(`href="${ROUTES.estateLegacy}"`)
    expect(html).toContain(`href="${ROUTES.taxStrategy}"`)
    expect(html).toContain('Estate &amp; Legacy')
    expect(html).toContain('Tax Strategy')
    expect(html).toContain('site-nav-menu--grouped')
  })

  it('updates homepage estate and tax cards without moving diagnostic cards', () => {
    expect(HOME_SERVICE_CARDS.find((item) => item.id === 'estate')?.to).toBe(ROUTES.estateLegacy)
    expect(HOME_SERVICE_CARDS.find((item) => item.id === 'tax')?.to).toBe(ROUTES.taxStrategy)
    expect(HOME_FEATURED_DIAGNOSTICS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
    ])
    const html = renderAt('/', createElement(HomePage))
    expect(html).toContain(`href="${ROUTES.estateLegacy}"`)
    expect(html).toContain(`href="${ROUTES.taxStrategy}"`)
    const diagnostics = html.match(/id="home-diagnostics"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(diagnostics).not.toContain(`href="${ROUTES.estateLegacy}"`)
    expect(diagnostics).not.toContain(`href="${ROUTES.taxStrategy}"`)
  })

  it('exposes estate in Families footer and tax in Business footer, not Tools', () => {
    expect(FAMILIES_FOOTER_LINKS.find((item) => item.id === 'estate')?.to).toBe(ROUTES.estateLegacy)
    expect(BUSINESS_FOOTER_LINKS.find((item) => item.id === 'tax')?.to).toBe(ROUTES.taxStrategy)
    expect(TOOLS_NAV_LINKS.some((item) => item.to === ROUTES.estateLegacy)).toBe(false)
    expect(TOOLS_NAV_LINKS.some((item) => item.to === ROUTES.taxStrategy)).toBe(false)
  })

  it('has complete EN/ES catalogs and supported partner naming only', () => {
    expect(catalogShape(estateServiceCopy.en)).toBe(catalogShape(estateServiceCopy.es))
    expect(catalogShape(taxStrategyServiceCopy.en)).toBe(catalogShape(taxStrategyServiceCopy.es))
    expect(estateServiceCopy.en.heroTitle).toBe('Protect More Than Assets. Protect the Plan Behind Them.')
    expect(estateServiceCopy.es.heroTitle).toBe('Proteja más que los bienes. Proteja el plan que hay detrás.')
    expect(taxStrategyServiceCopy.en.heroTitle).toBe(
      'Make Tax Planning Part of the Bigger Financial Picture.',
    )
    expect(taxStrategyServiceCopy.es.heroTitle).toBe(
      'Integre la planificación fiscal en el panorama financiero más amplio.',
    )
    expect(estateServiceCopy.en.partnerName).toBe('TrusteeFriend')
    expect(taxStrategyServiceCopy.en.partnerName).toBe('Excel Empire')
    expect(estateServiceCopy.en.partnerBody).toContain('independent external resource partner')
    expect(taxStrategyServiceCopy.en.partnerBody).toContain('independent external resource partner')
    expect(estateServiceCopy.en.partnerBody).not.toMatch(/https?:\/\//)
    expect(taxStrategyServiceCopy.en.partnerBody).not.toMatch(/https?:\/\//)
  })

  it('renders valid CTAs and legal/tax boundary language', () => {
    const estate = renderAt('/estate-legacy', createElement(EstateLegacyServicePage))
    const tax = renderAt('/tax-strategy', createElement(TaxStrategyServicePage))
    expect(estate).toContain('Book an Estate &amp; Legacy Review')
    expect(estate).toContain(`href="${ROUTES.schedule}"`)
    expect(estate).toContain(`href="${ROUTES.solutions}"`)
    expect(estate).toContain(`href="${ROUTES.reportCard}"`)
    expect(estate).toContain(`href="${ROUTES.protectionAnalysis}"`)
    expect(estate).toContain('TrusteeFriend')
    expect(estate.toLowerCase()).toContain('not a law firm')
    expect(estate.toLowerCase()).toContain('does not provide legal advice')
    expect(tax).toContain('Book a Tax Strategy Review')
    expect(tax).toContain(`href="${ROUTES.schedule}"`)
    expect(tax).toContain(`href="${ROUTES.solutions}"`)
    expect(tax).toContain(`href="${ROUTES.businessReportCard}"`)
    expect(tax).toContain(`href="${ROUTES.reportCard}"`)
    expect(tax).toContain('Excel Empire')
    expect(tax.toLowerCase()).toContain('does not provide legal or tax advice')
    expect(tax.toLowerCase()).toContain('does not guarantee tax savings')
    expect(estate.match(/<h1[^>]*>/g)?.length).toBe(1)
    expect(tax.match(/<h1[^>]*>/g)?.length).toBe(1)
  })

  it('keeps partner and marketing copy free of unsupported claims', () => {
    const blob = `${JSON.stringify(estateServiceCopy)} ${JSON.stringify(taxStrategyServiceCopy)} ${renderAt('/estate-legacy', createElement(EstateLegacyServicePage))} ${renderAt('/tax-strategy', createElement(TaxStrategyServicePage))}`.toLowerCase()
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
    const estate = renderAt('/estate-legacy', createElement(EstateLegacyServicePage))
    const tax = renderAt('/tax-strategy', createElement(TaxStrategyServicePage))
    for (const path of FUTURE_UNBUILT_PUBLIC_PATHS) {
      expect(estate).not.toContain(`href="${path}"`)
      expect(tax).not.toContain(`href="${path}"`)
    }
  })

  it('preserves locale and attribution and keeps prior service pages intact', () => {
    const query = '?lang=es&utm_source=qa&utm_campaign=phase5&card=test-card'
    const suffix = 'lang=es&amp;utm_source=qa&amp;utm_campaign=phase5&amp;card=test-card'
    const estate = renderAt(`/estate-legacy${query}`, createElement(EstateLegacyServicePage))
    const tax = renderAt(`/tax-strategy${query}`, createElement(TaxStrategyServicePage))
    const formation = renderAt(`/business-formation${query}`, createElement(BusinessFormationServicePage))
    expect(estate).toContain(`href="${ROUTES.schedule}?${suffix}"`)
    expect(estate).toContain(`href="${ROUTES.reportCard}?${suffix}"`)
    expect(tax).toContain(`href="${ROUTES.schedule}?${suffix}"`)
    expect(tax).toContain(`href="${ROUTES.businessReportCard}?${suffix}"`)
    expect(formation).toContain(`href="${ROUTES.taxStrategy}?${suffix}"`)
    expect(estate).toContain('Proteja más que los bienes. Proteja el plan que hay detrás.')
    expect(tax).toContain('Integre la planificación fiscal en el panorama financiero más amplio.')
    const sl = renderAt('/student-loans', createElement(StudentLoanServicePage))
    const credit = renderAt('/credit', createElement(CreditServicePage))
    const insurance = renderAt('/insurance', createElement(InsuranceServicePage))
    const health = renderAt('/health-disability', createElement(HealthDisabilityServicePage))
    expect(sl).toContain(`href="${ROUTES.studentLoanReportCard}"`)
    expect(credit).toContain(`href="${ROUTES.creditReportCard}"`)
    expect(insurance).toContain(`href="${ROUTES.protectionAnalysis}"`)
    expect(health).toContain(`href="${ROUTES.schedule}"`)
  })

  it('does not change scoring, ingest, CRM, credit_repair, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(52)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_phase5_services.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('crm/financial-progress/calculators/estateLegacyCalculator.ts')).not.toContain(
      'EstateLegacyServicePage',
    )
    expect(source('src/App.tsx')).toContain('path="/crm"')
    expect(source('pages/EstateLegacyServicePage.tsx')).not.toContain('crm/')
    expect(source('pages/TaxStrategyServicePage.tsx')).not.toContain('crm/')
  })
})
