import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../../platform/registry/registry'
import HomePage from '../../../pages/HomePage'
import { ROUTES } from '../../../constants/routes'
import { FUTURE_UNBUILT_PUBLIC_PATHS } from '../navConfig'
import { homeCopy } from './copy'
import {
  HOME_AUDIENCE_PATHS,
  HOME_DIAGNOSTICS_HASH,
  HOME_FEATURED_DIAGNOSTICS,
  HOME_SERVICE_CARDS,
} from './homeConfig'

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

function renderHome(entry = '/') {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [entry] }, createElement(HomePage)),
  )
}

const FORBIDDEN = [
  'guaranteed',
  'guarantee',
  'fiduciary',
  'registered investment',
  'financial advisor',
  'loan forgiveness',
  'lower your payment',
  'increase your score',
  'delete negative',
  'best financial',
]

describe('service-led bilingual homepage', () => {
  it('positions Valtoris around coordinated financial life, not the Family Report Card', () => {
    const html = renderHome('/')
    const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1]
    expect(h1).toBe("Your Financial Life Shouldn&#x27;t Be Managed in Pieces.")
    expect(html).toContain('Valtoris Financial')
    expect(html).toContain('complete financial picture')
    expect(html).toContain('Know Your Score. See Your Risks. Build Your Plan.')
    expect(html).toContain('We Diagnose Before We Prescribe.')
    expect(html).not.toContain('How Financially Prepared Is Your Family?')
    expect(html).not.toContain('VALTORIS FAMILY FINANCIAL REPORT CARD™')
    expect(html).not.toContain('Get My Free Financial Score')
    expect(html).not.toContain('sample-results-preview')
    expect(html.indexOf("Your Financial Life Shouldn&#x27;t Be Managed in Pieces.")).toBeLessThan(
      html.indexOf('Know Your Score. See Your Risks. Build Your Plan.'),
    )
  })

  it('uses Find Out Where I Stand as the primary hero CTA and keeps Book a Meeting', () => {
    const html = renderHome('/')
    expect(html).toContain('Find Out Where I Stand')
    expect(html).toContain(`href="${HOME_DIAGNOSTICS_HASH}"`)
    expect(html).toContain('Book a Meeting')
    expect(html).toContain(`href="${ROUTES.schedule}"`)
    expect(html).toContain('Explore Solutions')
    expect(html).toContain(`href="${ROUTES.solutions}"`)
    const primary = html.indexOf('Find Out Where I Stand')
    const familyScore = html.indexOf('Get My Family Score')
    expect(primary).toBeGreaterThan(-1)
    expect(familyScore).toBe(-1)
  })

  it('renders clarity paths, process, diagnostics, services, why, and final CTA', () => {
    const html = renderHome('/')
    expect(html).toContain('Where Do You Want More Clarity?')
    expect(html).toContain('Take the Family Financial Report Card')
    expect(html).toContain('Take the Business Financial Report Card')
    expect(html).toContain('Take the Student Loan Report Card')
    expect(html).toContain('Take the Credit Report Card')
    expect(html).toContain('Your Strategy Determines the Solution. Not the Other Way Around.')
    expect(html).toContain('Protection')
    expect(html).toContain('Retirement')
    expect(html).toContain('Credit')
    expect(html).toContain('Student Loans')
    expect(html).toContain('Business Planning')
    expect(html).toContain('Insurance &amp; Risk Management')
    expect(html).toContain('Estate / Legacy Coordination')
    expect(html).toContain('Tax Strategy Coordination')
    expect(html).toContain('Diagnose')
    expect(html).toContain('Prioritize')
    expect(html).toContain('Build')
    expect(html).toContain('id="home-diagnostics"')
    expect(source('src/styles.css')).toContain('.site-home #home-diagnostics {\n  scroll-margin-top: 96px;\n}')
    expect(html).toContain('Family Report Card™')
    expect(html).toContain('Business Report Card™')
    expect(html).toContain('Student Loan Report Card™')
    expect(html).toContain('Credit Report Card™')
    expect(html).toContain('Retirement Report Card™')
    expect(html).toContain('Protection Gap')
    expect(html).not.toContain('Explore Solutions for You')
    expect(html).not.toContain('Choose a broader path')
    expect(html).not.toContain('Also available')
    expect(html).not.toContain('id="home-journeys-heading"')
    expect(html).toContain('Why Valtoris')
    expect(html).toContain("You Can&#x27;t Improve What You Haven&#x27;t Measured.")
    expect(html).toContain('Financial Strategist')
  })

  it('maps CTAs to existing routes and never invents /services/* or /tools', () => {
    const html = renderHome('/?utm_source=qa&utm_campaign=home&card=test-card')
    expect(html).toContain(`href="${ROUTES.solutions}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`)
    expect(html).toContain(`href="${ROUTES.schedule}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`)
    expect(html).toContain(`href="${ROUTES.reportCard}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`)
    expect(html).toContain(
      `href="${ROUTES.businessReportCard}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.studentLoans}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.credit}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.studentLoanReportCard}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.creditReportCard}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.retirementReportCard}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.protectionAnalysis}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.insurance}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.estateLegacy}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="${ROUTES.taxStrategy}?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="/?utm_source=qa&amp;utm_campaign=home&amp;card=test-card#home-diagnostics"`,
    )
    for (const path of FUTURE_UNBUILT_PUBLIC_PATHS) {
      expect(html).not.toContain(`href="${path}"`)
    }
    expect(HOME_SERVICE_CARDS.some((item) => item.to.startsWith('/services'))).toBe(false)
    expect(HOME_AUDIENCE_PATHS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
    ])
    expect(HOME_FEATURED_DIAGNOSTICS.map((item) => item.to)).toEqual([
      ROUTES.reportCard,
      ROUTES.businessReportCard,
      ROUTES.studentLoanReportCard,
      ROUTES.creditReportCard,
      ROUTES.retirementReportCard,
      ROUTES.protectionAnalysis,
    ])
    expect(source('components/publicSite/home/homeConfig.ts')).not.toContain('HOME_MORE_DIAGNOSTICS')
    expect(source('components/publicSite/home/HomeDiagnostics.tsx')).not.toContain('site-home-more-tools')
    expect(HOME_DIAGNOSTICS_HASH).toBe('/#home-diagnostics')
  })

  it('preserves locale plus attribution on Spanish homepage CTAs', () => {
    const html = renderHome(
      '/?lang=es&utm_source=qa&utm_medium=site&utm_campaign=home&utm_content=hero&utm_term=family&card=test-card',
    )
    expect(html).toContain('Descubre en qué punto estás')
    expect(html).toContain('Agendar una reunión')
    expect(html).toContain('Explorar soluciones')
    expect(html).toContain(
      `href="${ROUTES.solutions}?lang=es&amp;utm_source=qa&amp;utm_medium=site&amp;utm_campaign=home&amp;utm_content=hero&amp;utm_term=family&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="/?lang=es&amp;utm_source=qa&amp;utm_medium=site&amp;utm_campaign=home&amp;utm_content=hero&amp;utm_term=family&amp;card=test-card#home-diagnostics"`,
    )
  })

  it('has complete EN/ES homepage copy without forbidden guarantee language', () => {
    expect(Object.keys(homeCopy.en).sort()).toEqual(Object.keys(homeCopy.es).sort())
    const blob = `${JSON.stringify(homeCopy.en)} ${JSON.stringify(homeCopy.es)}`.toLowerCase()
    for (const phrase of FORBIDDEN) {
      expect(blob).not.toContain(phrase)
    }
    expect(homeCopy.es.heroTitle).toBe('Tu vida financiera no debería gestionarse en pedazos.')
    expect(homeCopy.en.heroBrand).toBe('Know Your Score. See Your Risks. Build Your Plan.')
    expect(homeCopy.es.heroBrand).toBe('Know Your Score. See Your Risks. Build Your Plan.')
    expect(homeCopy.es.diagnosticsFamilyTitle).toBe('Family Report Card™')
    expect(homeCopy.es.diagnosticsStudentTitle).toBe('Student Loan Report Card™')
  })

  it('does not change scoring, ingest, Digital Identity, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(54)
    expect(files.some((name) => name.startsWith('053_'))).toBe(true)
    expect(files.some((name) => name.startsWith('054_'))).toBe(true)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_homepage.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('pages/HomePage.tsx')).not.toContain('scoreFamilyAssessment')
    expect(source('pages/HomePage.tsx')).not.toContain('ingestFamilyReportCard')
    expect(source('components/publicSite/home/HomeHero.tsx')).not.toContain('scoreFamilyAssessment')
    expect(source('modules/digital-identity/cta.ts')).toContain("label: 'Future Credit Assessment'")
    expect(source('src/App.tsx')).toContain('path={ROUTES.solutions}')
    expect(source('src/App.tsx')).toContain('path={ROUTES.checkup}')
  })
})
