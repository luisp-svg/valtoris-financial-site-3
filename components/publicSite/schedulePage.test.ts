import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry/registry'
import ScheduleReportCardPage from '../../pages/ScheduleReportCardPage'
import { CALENDLY_REPORT_CARD_URL } from '../../constants/urls'
import { SCHEDULE_CTA } from '../../constants/homepage'
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

function renderSchedule(entry: string) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [entry] }, createElement(ScheduleReportCardPage)),
  )
}

const FORBIDDEN = [
  'valtoris advisor',
  'financial advisor',
  'financial planning',
  'fiduciary',
  'investment management',
  'legal advice',
  'tax advice',
  'asesor financiero',
  'family financial report card',
]

describe('generic strategy-meeting schedule page', () => {
  it('positions /schedule as a generic strategy meeting, not a Family Report Card review', () => {
    const html = renderSchedule('/schedule')
    const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1]
    expect(h1).toBe('Book a Strategy Meeting')
    expect(html).toContain('Book a Meeting')
    expect(html).toContain(
      'Talk with a Valtoris Financial Strategist about where you stand, what deserves attention, and which next step may make sense.',
    )
    expect(html).toContain('Choose a Time')
    expect(html).toContain('Return Home')
    expect(html).toContain('Financial Strategist')
    expect(html).not.toContain('Book Your Review')
    expect(html).not.toContain(SCHEDULE_CTA)
    expect(html).not.toContain('Family Financial Report Card')
    expect(html).not.toContain('Valtoris advisor')
    expect(html).not.toContain('Strategy Meeting™')
    const blob = html.toLowerCase()
    for (const phrase of FORBIDDEN) {
      expect(blob).not.toContain(phrase)
    }
  })

  it('keeps the existing Calendly URL and opens it from Choose a Time', () => {
    expect(CALENDLY_REPORT_CARD_URL).toBe('https://calendly.com/valtoris/reportcard')
    const html = renderSchedule('/schedule')
    expect(html).toContain(`href="${CALENDLY_REPORT_CARD_URL}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(source('pages/ScheduleReportCardPage.tsx')).toContain('ScheduleReportCardLink')
    expect(source('pages/ScheduleReportCardPage.tsx')).not.toContain('SCHEDULE_CTA')
    expect(source('constants/urls.ts')).toContain(
      "export const CALENDLY_REPORT_CARD_URL = 'https://calendly.com/valtoris/reportcard'",
    )
    expect(source('constants/homepage.ts')).toContain(
      "export const SCHEDULE_CTA = 'Schedule Complimentary Strategy Session™'",
    )
  })

  it('localizes with tú, keeps Financial Strategist in English, and preserves Return Home attribution', () => {
    const spanish = renderSchedule(
      '/schedule?lang=es&utm_source=qa&utm_campaign=schedule&card=test-card',
    )
    expect(spanish).toContain('Agenda una reunión')
    expect(spanish).toContain('Agenda una reunión estratégica')
    expect(spanish).toContain(
      'Habla con un Financial Strategist de Valtoris sobre dónde te encuentras, qué merece atención y cuál podría ser el siguiente paso adecuado.',
    )
    expect(spanish).toContain('Elegir una hora')
    expect(spanish).toContain('Volver al inicio')
    expect(spanish).toContain('Financial Strategist')
    expect(spanish).not.toContain('asesor financiero')
    expect(spanish).not.toContain('Book a Strategy Meeting')
    expect(spanish).toContain(
      `href="/?lang=es&amp;utm_source=qa&amp;utm_campaign=schedule&amp;card=test-card"`,
    )
    expect(source('pages/ScheduleReportCardPage.tsx')).toContain('PublicLink')
    expect(source('pages/ScheduleReportCardPage.tsx')).toContain('PublicLocaleSwitcher')
    expect(source('pages/ScheduleReportCardPage.tsx')).toContain('readPublicLocale')
    expect(source('pages/ScheduleReportCardPage.tsx')).toContain('usePublicDocumentLang')
    expect(source('pages/ScheduleReportCardPage.tsx')).not.toContain('SiteLayout')
  })

  it('does not change scoring, ingest, CRM, credit_repair, or add Migration 053', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    expect(files).toHaveLength(52)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_schedule_cleanup.sql'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(
      SHA_047,
    )
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(
      SHA_049,
    )
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(fileSha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(fileSha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('modules/digital-identity/cta.ts')).toContain("label: 'Future Credit Assessment'")
    expect(source('pages/CheckupPage.tsx')).toContain('Family Financial Report Card™')
    expect(source('components/LeadForm.tsx')).toContain('credit-repair')
    expect(source('src/App.tsx')).toContain(
      'path={ROUTES.schedule} element={<ScheduleReportCardPage />}',
    )
    expect(source('src/App.tsx')).not.toContain(
      'path={ROUTES.schedule}\n        element={\n          <SiteLayout>',
    )
    expect(ROUTES.schedule).toBe('/schedule')
  })
})
