import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../../platform/registry/registry'
import HomePage from '../../../pages/HomePage'
import StudentLoanServicePage from '../../../pages/StudentLoanServicePage'
import CreditServicePage from '../../../pages/CreditServicePage'
import InsuranceServicePage from '../../../pages/InsuranceServicePage'
import HealthDisabilityServicePage from '../../../pages/HealthDisabilityServicePage'
import BusinessFormationServicePage from '../../../pages/BusinessFormationServicePage'
import EstateLegacyServicePage from '../../../pages/EstateLegacyServicePage'
import TaxStrategyServicePage from '../../../pages/TaxStrategyServicePage'
import { ROUTES } from '../../../constants/routes'
import { FUTURE_UNBUILT_PUBLIC_PATHS, SERVICES_NAV_LINKS, TOOLS_NAV_LINKS } from '../navConfig'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function renderAt(entry: string, page: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [entry] }, page))
}

function section(html: string, id: string) {
  return html.match(new RegExp(`id="${id}"[\\s\\S]*?<\\/section>`))?.[0] ?? ''
}

function heroActions(html: string) {
  return html.match(/class="site-home-hero site-service-hero"[\s\S]*?<\/section>/)?.[0] ?? ''
}

const SERVICE_PAGES = [
  { path: '/student-loans', page: createElement(StudentLoanServicePage) },
  { path: '/credit', page: createElement(CreditServicePage) },
  { path: '/insurance', page: createElement(InsuranceServicePage) },
  { path: '/health-disability', page: createElement(HealthDisabilityServicePage) },
  { path: '/business-formation', page: createElement(BusinessFormationServicePage) },
  { path: '/estate-legacy', page: createElement(EstateLegacyServicePage) },
  { path: '/tax-strategy', page: createElement(TaxStrategyServicePage) },
]

describe('Phase 6 public CTA hierarchy and alignment', () => {
  it('gives each homepage diagnostic card one consistent action', () => {
    const html = renderAt('/', createElement(HomePage))
    const diagnostics = section(html, 'home-diagnostics-heading')
    expect(diagnostics.match(/class="site-home-card site-home-card--centered"/g)?.length).toBe(6)
    expect(diagnostics.match(/class="site-home-card-link"/g)?.length).toBe(6)
    expect(diagnostics).not.toContain('platform-btn')
    expect(diagnostics).not.toContain('Also available')
  })

  it('keeps Family and Business journey cards to one primary solutions action', () => {
    const html = renderAt('/', createElement(HomePage))
    const journeys = section(html, 'home-journeys-heading')
    expect(journeys).toContain('Explore Family Solutions')
    expect(journeys).toContain('Explore Business Solutions')
    expect(journeys.match(/class="platform-btn platform-btn-primary"/g)?.length).toBe(2)
    expect(journeys).not.toContain('site-home-text-link')
    expect(journeys).not.toContain(`href="${ROUTES.reportCard}"`)
    expect(journeys).not.toContain(`href="${ROUTES.businessReportCard}"`)
  })

  it('limits service heroes to two actions and removes See How It Works', () => {
    expect(source('components/publicSite/services/ServiceHero.tsx')).not.toContain('heroTertiaryCta')
    expect(source('components/publicSite/services/ServiceHero.tsx')).not.toContain('#service-process')
    for (const item of SERVICE_PAGES) {
      const html = renderAt(item.path, item.page)
      const hero = heroActions(html)
      expect(hero.match(/class="platform-btn /g)?.length).toBe(2)
      expect(hero).not.toContain('See How It Works')
      expect(hero).not.toContain('Vea cómo funciona')
      expect(hero).not.toContain('#service-process')
    }
  })

  it('gives related-service panels a single action', () => {
    const html = renderAt('/business-formation', createElement(BusinessFormationServicePage))
    const related = html.match(/class="site-service-related"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(related).toContain(`href="${ROUTES.taxStrategy}"`)
    expect(related.match(/class="platform-btn /g)?.length).toBe(1)
    expect(related).not.toContain('site-home-text-link')
  })

  it('leaves Services and Tools destinations unchanged and does not invent routes', () => {
    expect(SERVICES_NAV_LINKS.map((item) => item.to)).toEqual([
      ROUTES.protectionAnalysis,
      ROUTES.retirementReportCard,
      ROUTES.insurance,
      ROUTES.healthDisability,
      ROUTES.credit,
      ROUTES.studentLoans,
      ROUTES.estateLegacy,
      ROUTES.businessFormation,
      ROUTES.taxStrategy,
      ROUTES.solutions,
      ROUTES.solutions,
    ])
    expect(TOOLS_NAV_LINKS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
    ])
    const home = renderAt('/', createElement(HomePage))
    for (const path of FUTURE_UNBUILT_PUBLIC_PATHS) {
      expect(home).not.toContain(`href="${path}"`)
    }
  })

  it('does not change Student Loan or Credit scoring, ingest, credit_repair, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(52)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_visual_cta.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('components/assessment/studentLoan/scoreStudentLoanAssessment.ts')).not.toContain('site-home-card--centered')
    expect(source('components/assessment/credit/scoreCreditAssessment.ts')).not.toContain('site-home-card--centered')
    expect(source('pages/StudentLoanReportCardResults.tsx')).not.toContain('ServiceHero')
    expect(source('pages/CreditReportCardResults.tsx')).not.toContain('ServiceHero')
  })
})
