import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../constants/routes'
import {
  appendCardAttributionToPath,
  buildCampaignLink,
  buildReportCardSharePath,
  isReportCardShareType,
  REPORT_CARD_SHARE_LANDINGS,
  REPORT_CARD_SHARE_TYPES,
  reportCardShareSideEffects,
} from './campaignUrls'

const ROOT = process.cwd()
const KEY = 'pk_live_abcdefghijklmnop'
const ADVISOR_UUID = '11111111-2222-4333-8444-555555555555'

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

describe('Report Card personal share links', () => {
  it('maps all 6 supported types to canonical landings', () => {
    expect(REPORT_CARD_SHARE_TYPES).toEqual([
      'family',
      'business',
      'protection',
      'student_loan',
      'credit',
      'home_buyer',
    ])
    expect(REPORT_CARD_SHARE_LANDINGS).toEqual({
      family: ROUTES.reportCard,
      business: ROUTES.businessReportCard,
      protection: ROUTES.protectionGap,
      student_loan: ROUTES.studentLoanReportCard,
      credit: ROUTES.creditReportCard,
      home_buyer: ROUTES.homeBuyerReportCard,
    })
    expect(buildReportCardSharePath(KEY, 'family')).toBe(`${ROUTES.reportCard}?card=${KEY}`)
    expect(buildReportCardSharePath(KEY, 'business')).toBe(`${ROUTES.businessReportCard}?card=${KEY}`)
    expect(buildReportCardSharePath(KEY, 'protection')).toBe(`${ROUTES.protectionGap}?card=${KEY}`)
    expect(buildReportCardSharePath(KEY, 'student_loan')).toBe(
      `${ROUTES.studentLoanReportCard}?card=${KEY}`,
    )
    expect(buildReportCardSharePath(KEY, 'credit')).toBe(`${ROUTES.creditReportCard}?card=${KEY}`)
    expect(buildReportCardSharePath(KEY, 'home_buyer')).toBe(
      `${ROUTES.homeBuyerReportCard}?card=${KEY}`,
    )
  })

  it('uses the advisor public_key only and never an advisor UUID', () => {
    const path = buildReportCardSharePath(KEY, 'home_buyer')
    expect(path).toContain(`card=${KEY}`)
    expect(path).not.toContain(ADVISOR_UUID)
    expect(path).not.toContain('advisor')
    expect(path).not.toContain('/r/')
    expect(buildReportCardSharePath(ADVISOR_UUID, 'family')).toBeNull()
    expect(buildReportCardSharePath('short-key', 'family')).toBeNull()
  })

  it('encodes optional attribution only through allowlisted fields', () => {
    const path = buildReportCardSharePath(KEY, 'credit', {
      campaignCode: 'summit',
      eventCode: 'day1',
      sourceChannel: 'link',
      utmSource: 'flyer',
      utmMedium: 'print',
      utmCampaign: 'chamber',
    })
    expect(path).toBe(
      `${ROUTES.creditReportCard}?c=summit&e=day1&src=link&utm_source=flyer&utm_medium=print&utm_campaign=chamber&card=${KEY}`,
    )
    const rejected = buildReportCardSharePath(KEY, 'family', {
      campaignCode: 'bad code!',
      sourceChannel: 'email',
    })
    expect(rejected).toBe(`${ROUTES.reportCard}?card=${KEY}`)
    expect(rejected).not.toContain('c=')
    expect(rejected).not.toContain('src=email')
  })

  it('rejects unsupported Report Card types and assessment/results routes', () => {
    expect(isReportCardShareType('retirement')).toBe(false)
    expect(isReportCardShareType('household_onboarding')).toBe(false)
    expect(buildReportCardSharePath(KEY, 'retirement')).toBeNull()
    expect(buildReportCardSharePath(KEY, 'family-assessment')).toBeNull()
    expect(Object.values(REPORT_CARD_SHARE_LANDINGS)).not.toContain(ROUTES.familyAssessment)
    expect(Object.values(REPORT_CARD_SHARE_LANDINGS)).not.toContain(ROUTES.homeBuyerAssessment)
    expect(Object.values(REPORT_CARD_SHARE_LANDINGS)).not.toContain(ROUTES.reportCardResults)
  })

  it('leaves existing Digital Identity campaign URL behavior unchanged', () => {
    expect(buildCampaignLink(KEY, 'rr-chamber-2026')).toBe(
      `/c/k/${KEY}?c=rr-chamber-2026&src=link`,
    )
    expect(
      appendCardAttributionToPath('/family-report-card', KEY, { campaignCode: 'summit' }),
    ).toBe(`/family-report-card?c=summit&card=${KEY}`)
  })

  it('does not write leads, households, or activities when generating a link', () => {
    expect(reportCardShareSideEffects()).toEqual({
      writesAnalytics: false,
      writesDigitalCardEvents: false,
      createsLead: false,
      createsHousehold: false,
      createsActivity: false,
      createsTask: false,
      createsCase: false,
      usesAdvisorUuid: false,
      rotatesPublicKey: false,
      introducesVanityRoute: false,
    })
    const helper = source('modules/digital-identity/campaignUrls.ts')
    expect(helper).toContain('buildReportCardSharePath')
    expect(helper).not.toMatch(/from '\.\.\/\.\.\/server\/ingest/)
    expect(helper).not.toMatch(/activities|ingest_public_report_card|createLead/)
    expect(
      readdirSync(join(ROOT, 'supabase/migrations')).some((name) => name.startsWith('055_')),
    ).toBe(false)
  })
})
