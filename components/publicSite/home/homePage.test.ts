import { EXPECTED_MIGRATION_FILES } from '../../../tests/helpers/migrationInventory'
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

describe('assessment-first bilingual homepage', () => {
  it('uses an editorial composition while retaining the approved positioning and actual photography', () => {
    const html = renderHome('/')
    expect(html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1]).toBe("Protect What You&#x27;ve Built. Preserve What You&#x27;ll Leave Behind.")
    expect(html.match(/<h1[ >]/g)).toHaveLength(1)
    expect(html).toContain('atelier-hero')
    expect(html).toContain('/images/valtoris-home-hero.webp')
    expect(html).toContain('Protection. Strategy. Legacy.')
    expect(html).toContain('Meet Luis Perez, Financial Strategist and Founder.')
    expect(html).toContain('Meet our specialist team')
    expect(html).not.toContain('Illustrative score')
    expect(html).not.toContain('sample-results-preview')
  })

  it('organizes three audiences and six categories without adding invented service routes', () => {
    const html = renderHome('/')
    for (const audience of ['Business Owners', 'Accomplished Professionals', 'Established Families']) expect(html).toContain(audience)
    for (const category of ['Business Formation &amp; Financial Operations', 'Business Protection &amp; Employee Benefits', 'Personal &amp; Lifestyle Protection', 'Financial Optimization', 'Retirement &amp; Legacy', 'Homeownership &amp; Real Estate']) expect(html).toContain(category)
    expect(html.match(/class="atelier-solution-content"/g)).toHaveLength(6)
    expect(html).toContain('professional partnership')
    expect(html).not.toMatch(/Kenn|Renner|BuyAustin/)
    expect(html).toContain('href="/education"')
    expect(html).toContain('href="/report-cards"')
  })

  it('explains all five steps and keeps the full priority selector on the assessment screen', () => {
    const html = renderHome('/')
    for (const step of ['Complete Your Financial Report Card', 'Reserve Your Complimentary Review', 'Access Your Personalized Report Card', 'Attend Your Financial Strategy Review', 'Discuss Your Recommended Action Plan']) expect(html).toContain(step)
    expect(html).toContain('before accessing your detailed report')
    expect(html).toContain('preliminary educational diagnostic')
    expect(html).toContain('deeper consultation intake')
    expect(html).toContain('id="home-diagnostics"')
    expect(html).toContain('Choose Your Priorities')
    expect(html).not.toContain('class="premium-priorities"')
    expect(html).toContain('href="/financial-assessment"')
    expect(html).toContain('href="/schedule"')
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
      `href="/financial-assessment?utm_source=qa&amp;utm_campaign=home&amp;card=test-card"`,
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
    expect(html).toContain('Comenzar tu Report Card financiero')
    expect(html).toContain('Reservar una consulta')
    expect(html).toContain('Explorar soluciones')
    expect(html).toContain(
      `href="${ROUTES.solutions}?lang=es&amp;utm_source=qa&amp;utm_medium=site&amp;utm_campaign=home&amp;utm_content=hero&amp;utm_term=family&amp;card=test-card"`,
    )
    expect(html).toContain(
      `href="/financial-assessment?lang=es&amp;utm_source=qa&amp;utm_medium=site&amp;utm_campaign=home&amp;utm_content=hero&amp;utm_term=family&amp;card=test-card"`,
    )
  })

  it('has complete EN/ES homepage copy without forbidden guarantee language', () => {
    expect(Object.keys(homeCopy.en).sort()).toEqual(Object.keys(homeCopy.es).sort())
    const blob = `${JSON.stringify(homeCopy.en)} ${JSON.stringify(homeCopy.es)}`.toLowerCase()
    for (const phrase of FORBIDDEN) {
      expect(blob).not.toContain(phrase)
    }
    expect(homeCopy.es.heroTitle).toBe('Protege lo que has construido. Preserva lo que dejarás como legado.')
    expect(homeCopy.en.heroBrand).toBe('Protection. Strategy. Legacy.')
    expect(homeCopy.es.heroBrand).toBe('Protección. Estrategia. Legado.')
    expect(homeCopy.es.diagnosticsFamilyTitle).toBe('Family Report Card™')
    expect(homeCopy.es.diagnosticsStudentTitle).toBe('Student Loan Report Card™')
  })

  it('does not change scoring, ingest, Digital Identity, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    // Existing main includes the household-member migration; phase 1 adds none.
    expect(files).toEqual(EXPECTED_MIGRATION_FILES)
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
    expect(source('modules/digital-identity/cta.ts')).toContain("label: 'Credit Report Card'")
    expect(source('src/App.tsx')).toContain('path={ROUTES.solutions}')
    expect(source('src/App.tsx')).toContain('path={ROUTES.checkup}')
  })
})
