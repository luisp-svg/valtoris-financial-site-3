import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../constants/routes'
import {
  buildReportCardSharePath,
  REPORT_CARD_SHARE_TYPES,
  resolveReportCardShareAttribution,
} from '../../modules/digital-identity'
import ShareReportCardControl, {
  reportCardQrMatchesSharePath,
  selectShareableReportCardCampaigns,
  shareReportCardControlSideEffects,
} from './ShareReportCardControl'

const KEY = 'pk_live_abcdefghijklmnop'
const OTHER_KEY = 'pk_live_othercardkey01'
const ADVISOR_UUID = '11111111-2222-4333-8444-555555555555'
const ORIGIN = 'https://valtoris.example'

const CAMPAIGN = {
  campaignCode: 'summit',
  eventCode: 'day1',
  label: 'Summit',
  status: 'active',
  sourceChannelDefault: 'link',
  cardPublicKey: KEY,
}

describe('Report Card campaign-linked sharing', () => {
  it('keeps the default personal link when no campaign is selected', () => {
    expect(resolveReportCardShareAttribution(null)).toEqual({})
    expect(buildReportCardSharePath(KEY, 'family')).toBe(`${ROUTES.reportCard}?card=${KEY}`)
    const html = renderToStaticMarkup(
      createElement(ShareReportCardControl, { publicKey: KEY, campaigns: [CAMPAIGN] }),
    )
    expect(html).toContain(`${ROUTES.reportCard}?card=${KEY}`)
    expect(html).not.toContain('c=summit')
    expect(html).toContain('crm-share-report-card-campaign')
    expect(html).toContain('None (personal link)')
  })

  it('encodes trusted campaign, event, and allowlisted src through the share helper', () => {
    const attribution = resolveReportCardShareAttribution(CAMPAIGN, {
      includeEvent: true,
      sourceChannel: 'qr',
    })
    expect(attribution).toEqual({
      campaignCode: 'summit',
      eventCode: 'day1',
      sourceChannel: 'qr',
    })
    const path = buildReportCardSharePath(KEY, 'home_buyer', attribution)
    expect(path).toBe(
      `${ROUTES.homeBuyerReportCard}?c=summit&e=day1&src=qr&card=${KEY}`,
    )
    expect(path).not.toContain(ADVISOR_UUID)
    expect(path).not.toContain('redirect=')
    expect(path).not.toContain('advisor')
  })

  it('omits invalid campaign/event/src values instead of trusting them', () => {
    expect(
      resolveReportCardShareAttribution({
        campaignCode: 'bad code!',
        eventCode: 'day1',
        status: 'active',
        sourceChannelDefault: 'email',
      }),
    ).toEqual({})
    expect(
      resolveReportCardShareAttribution(
        { ...CAMPAIGN, eventCode: 'no spaces allowed!' },
        { includeEvent: true, sourceChannel: 'link' },
      ),
    ).toEqual({ campaignCode: 'summit', sourceChannel: 'link' })
    expect(resolveReportCardShareAttribution({ ...CAMPAIGN, status: 'disabled' })).toEqual({})
    expect(
      selectShareableReportCardCampaigns(
        [
          CAMPAIGN,
          { ...CAMPAIGN, campaignCode: 'other', cardPublicKey: OTHER_KEY },
          { ...CAMPAIGN, campaignCode: 'archived', status: 'disabled' },
        ],
        KEY,
      ).map((item) => item.campaignCode),
    ).toEqual(['summit'])
  })

  it('makes QR destination and copied link resolve to the same path', () => {
    const sharePath = buildReportCardSharePath(
      KEY,
      'credit',
      resolveReportCardShareAttribution(CAMPAIGN, {
        includeEvent: true,
        sourceChannel: 'link',
      }),
    )
    expect(sharePath).toBe(`${ROUTES.creditReportCard}?c=summit&e=day1&src=link&card=${KEY}`)
    expect(
      reportCardQrMatchesSharePath(`${ORIGIN}${sharePath}`, sharePath, ORIGIN),
    ).toBe(true)
    expect(reportCardQrMatchesSharePath(sharePath, sharePath, ORIGIN)).toBe(true)
    expect(
      reportCardQrMatchesSharePath(
        `${ORIGIN}${ROUTES.creditReportCard}?c=summit&e=day1&src=qr&card=${KEY}`,
        sharePath,
        ORIGIN,
      ),
    ).toBe(false)
  })

  it('keeps all six Report Card landings unchanged', () => {
    expect(REPORT_CARD_SHARE_TYPES).toHaveLength(6)
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

  it('does not write leads, households, or activities when sharing', () => {
    expect(shareReportCardControlSideEffects()).toMatchObject({
      createsLead: false,
      createsHousehold: false,
      createsActivity: false,
      writesAnalytics: false,
      writesCampaigns: false,
    })
    const page = readFileSync(join(process.cwd(), 'pages/crm/CrmCampaignsPage.tsx'), 'utf8')
    expect(page).toContain('campaigns={campaigns.map')
    expect(page).toContain('campaignCode: row.campaignCode')
    expect(page).not.toMatch(/campaigns=\{\s*campaigns\s*\}/)
    expect(page).not.toContain('advisorProfileId: row.advisorProfileId')
  })
})
