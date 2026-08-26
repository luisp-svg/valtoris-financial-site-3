import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import { chromeCopy } from './chromeCopy'
import {
  ABOUT_NAV_LINKS,
  BOOK_NAV,
  HOME_NAV,
  BUSINESS_FOOTER_LINKS,
  COMPANY_FOOTER_LINKS,
  CONTACT_NAV,
  FAMILIES_FOOTER_LINKS,
  FUTURE_UNBUILT_PUBLIC_PATHS,
  SERVICES_NAV_LINKS,
  TOOLS_NAV_LINKS,
  VISIBLE_TOP_LEVEL_NAV_IDS,
} from './navConfig'
import { ROUTES } from '../../constants/routes'

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

function renderChrome(entry: string) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [entry] },
      createElement(
        'div',
        null,
        createElement(SiteHeader),
        createElement(SiteFooter),
      ),
    ),
  )
}

const EXISTING_PUBLIC_PATHS = new Set<string>([
  ROUTES.home,
  ROUTES.solutions,
  ROUTES.reportCard,
  ROUTES.familyAssessment,
  ROUTES.reportCardResults,
  ROUTES.protectionAnalysis,
  ROUTES.protectionGap,
  ROUTES.protectionResults,
  ROUTES.businessReportCard,
  ROUTES.businessAssessment,
  ROUTES.businessReportCardResults,
  ROUTES.retirementReportCard,
  ROUTES.retirementAssessment,
  ROUTES.retirementReportCardResults,
  ROUTES.studentLoans,
  ROUTES.studentLoanReportCard,
  ROUTES.studentLoanAssessment,
  ROUTES.studentLoanReportCardResults,
  ROUTES.credit,
  ROUTES.creditReportCard,
  ROUTES.creditAssessment,
  ROUTES.creditReportCardResults,
  ROUTES.insurance,
  ROUTES.healthDisability,
  ROUTES.businessFormation,
  ROUTES.estateLegacy,
  ROUTES.taxStrategy,
  ROUTES.checkup,
  ROUTES.schedule,
  ROUTES.privacy,
  ROUTES.crmLogin,
])

describe('public site foundation chrome', () => {
  it('does not keep six Report Cards as top-level nav peers', () => {
    expect(VISIBLE_TOP_LEVEL_NAV_IDS).toEqual(['home', 'services', 'tools'])
    expect(ABOUT_NAV_LINKS).toEqual([])
    const header = source('components/SiteHeader.tsx')
    expect(header).toContain('SERVICES_NAV_GROUPS')
    expect(header).toContain('TOOLS_NAV_LINKS')
    expect(header).not.toContain('copy.navContact')
    expect(header).not.toContain('to={ROUTES.reportCard}')
    expect(header).not.toContain('to={ROUTES.businessReportCard}')
    expect(header).not.toContain('to={ROUTES.retirementReportCard}')
    expect(header).not.toContain('to={ROUTES.protectionAnalysis}')
  })

  it('maps Services and Tools menus to existing landing destinations', () => {
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
    ])
    expect(TOOLS_NAV_LINKS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
    ])
  })

  it('makes Student Loan and Credit discoverable in nav and footer', () => {
    const html = renderChrome('/')
    expect(html).toContain(ROUTES.studentLoans)
    expect(html).toContain(ROUTES.credit)
    expect(html).toContain(ROUTES.studentLoanReportCard)
    expect(html).toContain(ROUTES.creditReportCard)
    expect(FAMILIES_FOOTER_LINKS.some((item) => item.to === ROUTES.studentLoans)).toBe(true)
    expect(FAMILIES_FOOTER_LINKS.some((item) => item.to === ROUTES.credit)).toBe(true)
    expect(TOOLS_NAV_LINKS.some((item) => item.to === ROUTES.studentLoanReportCard)).toBe(true)
    expect(TOOLS_NAV_LINKS.some((item) => item.to === ROUTES.creditReportCard)).toBe(true)
  })

  it('does not point navigation at unbuilt service, tools, about, or contact routes', () => {
    const destinations = [
      HOME_NAV,
      ...SERVICES_NAV_LINKS,
      ...TOOLS_NAV_LINKS,
      ...ABOUT_NAV_LINKS,
      CONTACT_NAV,
      BOOK_NAV,
      ...COMPANY_FOOTER_LINKS,
      ...FAMILIES_FOOTER_LINKS,
      ...BUSINESS_FOOTER_LINKS,
    ].map((item) => item.to)
    for (const to of destinations) {
      expect(FUTURE_UNBUILT_PUBLIC_PATHS).not.toContain(to)
      expect(EXISTING_PUBLIC_PATHS.has(to)).toBe(true)
    }
  })

  it('renders a mobile menu with accessibility semantics', () => {
    const html = renderChrome('/')
    const header = source('components/SiteHeader.tsx')
    const mobile = source('components/publicSite/SiteMobileNav.tsx')
    const styles = source('src/styles.css')
    expect(header).toContain('site-menu-toggle')
    expect(header).toContain('aria-expanded={mobileOpen}')
    expect(header).toContain('aria-controls="site-mobile-nav"')
    expect(html).toContain('id="site-mobile-nav"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(mobile).toContain("event.key === 'Escape'")
    expect(mobile).toContain('site-mobile-accordion')
    expect(styles).toContain('.site-menu-toggle')
    expect(styles).toContain('.site-nav-menu[hidden]')
    expect(styles).toContain('@media (max-width: 1023px)')
    expect(styles).toContain('.site-header-desktop')
    expect(styles).toContain('display: none')
    expect(styles).toContain('width: min(calc(100% - 56px), 400px)')
    expect(styles).toContain('max-width: min(calc(100% - 56px), 400px)')
    expect(styles).toContain('.site-mobile-utilities .specialized-locale-option')
  })

  it('renders EN and ES chrome without persisting Spanish as canonical values', () => {
    const en = renderChrome('/')
    const es = renderChrome('/solutions?lang=es')
    expect(en).toContain('Home')
    expect(en).toContain('Services')
    expect(en).toContain('Tools')
    expect(en).toContain('Book a Meeting')
    expect(en).toContain('Advisor Login')
    expect(en).toContain('Your financial life. One coordinated strategy.')
    expect(en).toContain(
      'For educational purposes only. Insurance products depend on underwriting, carrier availability, and state rules. Valtoris does not provide legal or tax advice, and outcomes are not guaranteed.',
    )
    expect(en).not.toContain('Coverage and solutions depend on underwriting')
    expect(es).toContain('Inicio')
    expect(es).toContain('Servicios')
    expect(es).toContain('Herramientas')
    expect(es).toContain('Agendar una reunión')
    expect(es).toContain('Acceso para estrategas')
    expect(es).toContain('Tu vida financiera. Una estrategia coordinada.')
    expect(es).toContain(
      'Solo con fines educativos. Los productos de seguros dependen de la suscripción, la disponibilidad de las aseguradoras y las normas estatales. Valtoris no ofrece asesoría legal ni fiscal, y los resultados no están garantizados.',
    )
    expect(chromeCopy.en.footerBrandLine).toBe('Your financial life. One coordinated strategy.')
    expect(chromeCopy.es.footerBrandLine).toBe('Tu vida financiera. Una estrategia coordinada.')
    expect(Object.keys(chromeCopy.en).sort()).toEqual(Object.keys(chromeCopy.es).sort())
    expect(JSON.stringify(SERVICES_NAV_LINKS.map((item) => item.id))).not.toContain('Servicios')
  })

  it('preserves UTM and card params on header and footer links', () => {
    const html = renderChrome('/solutions?utm_source=card&utm_campaign=spring&card=abc')
    expect(html).toContain('/credit-report-card?utm_source=card&amp;utm_campaign=spring&amp;card=abc')
    expect(html).toContain(
      '/student-loan-report-card?utm_source=card&amp;utm_campaign=spring&amp;card=abc',
    )
    expect(html).toContain('/schedule?utm_source=card&amp;utm_campaign=spring&amp;card=abc')
  })

  it('adds lang=es to public links while keeping attribution, and omits lang in English', () => {
    const es = renderChrome('/report-card?lang=es&utm_medium=qr')
    expect(es).toContain('/credit-report-card?lang=es&amp;utm_medium=qr')
    const en = renderChrome('/report-card?utm_medium=qr')
    expect(en).toContain('/credit-report-card?utm_medium=qr')
    expect(en).not.toContain('lang=en')
  })

  it('sets document.lang from the public locale hook', () => {
    expect(source('components/SiteHeader.tsx')).toContain('usePublicDocumentLang(locale)')
    expect(source('components/publicSite/usePublicDocumentLang.ts')).toContain('root.lang = locale')
    expect(source('components/assessment/specialized/SpecializedLocaleSwitcher.tsx')).toContain(
      'export const useSpecializedDocumentLang = usePublicDocumentLang',
    )
  })

  it('gives the shared language switcher a 44px interaction target', () => {
    const styles = source('src/styles.css')
    const optionRule = styles.match(/(?:^|\n)\.specialized-locale-option \{[\s\S]*?\n\}/m)?.[0] ?? ''
    expect(optionRule).toContain('min-height: 44px')
    expect(optionRule).toContain('min-width: 44px')
    expect(optionRule).toContain('font-size: 14px')
    expect(source('components/assessment/specialized/SpecializedLocaleSwitcher.tsx')).toContain(
      'specialized-locale-option',
    )
    expect(source('components/publicSite/PublicLocaleSwitcher.tsx')).toContain(
      'specialized-locale-option',
    )
  })

  it('exposes Student Loan and Credit in the footer tools sitemap', () => {
    const html = renderChrome('/')
    expect(html).toContain('Student Loan Report Card™')
    expect(html).toContain('Credit Report Card™')
    expect(source('components/SiteFooter.tsx')).toContain('TOOLS_NAV_LINKS')
  })

  it('keeps Advisor Login present but de-emphasized and books through /schedule', () => {
    const html = renderChrome('/')
    expect(html).toContain('Advisor Login')
    expect(html).toContain(ROUTES.crmLogin)
    expect(html).toContain('site-header-advisor')
    expect(html).toContain('platform-btn-ghost')
    expect(BOOK_NAV.to).toBe(ROUTES.schedule)
    expect(CONTACT_NAV.to).toBe(ROUTES.schedule)
    expect(html).toContain(ROUTES.schedule)
    expect(source('components/SiteHeader.tsx')).not.toContain('calendly.com')
    expect(source('components/SiteFooter.tsx')).not.toContain('calendly.com')
    expect(source('components/SiteHeader.tsx')).not.toContain('copy.navContact')
    expect(source('components/publicSite/SiteMobileNav.tsx')).not.toContain('copy.navContact')
    expect(source('components/SiteFooter.tsx')).toContain('COMPANY_FOOTER_LINKS')
    expect(source('components/SiteFooter.tsx')).toContain('copy.footerBrandLine')
  })

  it('removes the stale 404 #diagnostics target', () => {
    const notFound = source('pages/NotFoundPage.tsx')
    expect(notFound).not.toContain('#diagnostics')
    expect(notFound).toContain('ROUTES.solutions')
    expect(notFound).toContain('PublicLink')
  })

  it('preserves existing public Report Card and Digital Identity routes', () => {
    const app = source('src/App.tsx')
    for (const token of [
      'ROUTES.home',
      'ROUTES.solutions',
      'ROUTES.reportCard',
      'ROUTES.familyAssessment',
      'ROUTES.reportCardResults',
      'ROUTES.businessReportCard',
      'ROUTES.businessAssessment',
      'ROUTES.businessReportCardResults',
      'ROUTES.retirementReportCard',
      'ROUTES.retirementAssessment',
      'ROUTES.retirementReportCardResults',
      'ROUTES.protectionAnalysis',
      'ROUTES.protectionGap',
      'ROUTES.protectionResults',
      'ROUTES.studentLoans',
      'ROUTES.studentLoanReportCard',
      'ROUTES.studentLoanAssessment',
      'ROUTES.studentLoanReportCardResults',
      'ROUTES.credit',
      'ROUTES.creditReportCard',
      'ROUTES.creditAssessment',
      'ROUTES.creditReportCardResults',
      'ROUTES.insurance',
      'ROUTES.healthDisability',
      'ROUTES.businessFormation',
      'ROUTES.estateLegacy',
      'ROUTES.taxStrategy',
      'ROUTES.checkup',
      'ROUTES.schedule',
      'ROUTES.privacy',
      'ROUTES.publicCardByKey',
      'ROUTES.publicCardBySlug',
    ]) {
      expect(app).toContain(token)
    }
    expect(app).toContain('/assessment')
    expect(app).toContain('/report')
    expect(app).toContain('/protectioncalc')
    expect(app).toContain('/calculator')
    expect(app).toContain('path="/business"')
    expect(app).toContain('path="/crm"')
  })

  it('does not change scoring, ingest, Digital Identity, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(52)
    expect(files[files.length - 1]).toBe('052_fix_intake_archive_activity_order.sql')
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_website_foundation.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(source('platform/registry/catalog.ts')).toContain("key: 'credit_repair'")
    expect(source('platform/registry/catalog.ts')).toContain('featureFlag: { enabled: false }')
    expect(source('components/SiteHeader.tsx')).not.toContain('scoreFamilyAssessment')
    expect(source('components/SiteFooter.tsx')).not.toContain('ingestFamilyReportCard')
    expect(source('modules/digital-identity/cta.ts')).toContain("label: 'Future Credit Assessment'")
  })
})
