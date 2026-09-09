import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ROUTES } from '../../constants/routes'
import {
  buildReportCardSharePath,
  REPORT_CARD_SHARE_TYPES,
} from '../../modules/digital-identity'
import ShareReportCardControl, {
  copyReportCardShareLink,
  isSafeReportCardQrDestination,
  shareReportCardControlSideEffects,
} from './ShareReportCardControl'

const ROOT = process.cwd()
const KEY = 'pk_live_abcdefghijklmnop'
const ADVISOR_UUID = '11111111-2222-4333-8444-555555555555'
const ORIGIN = 'https://valtoris.example'

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

describe('Share a Report Card CRM control', () => {
  it('renders the generated personal URL and only the 6 supported types', () => {
    const html = renderToStaticMarkup(
      createElement(ShareReportCardControl, { publicKey: KEY }),
    )
    expect(html).toContain('Share a Report Card')
    expect(html).toContain('crm-share-report-card-copy')
    expect(html).toContain('crm-share-report-card-qr-svg')
    expect(html).toContain('crm-share-report-card-qr-png')
    expect(html).toContain(`${ROUTES.reportCard}?card=${KEY}`)
    expect(html).toContain('value="family"')
    expect(html).toContain('value="home_buyer"')
    expect(html).not.toContain('retirement')
    expect(html).not.toContain(ADVISOR_UUID)
    expect(html).not.toContain(ROUTES.familyAssessment)
    expect(REPORT_CARD_SHARE_TYPES).toHaveLength(6)
  })

  it('copies the generated share URL unchanged from Batch 1', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const path = buildReportCardSharePath(KEY, 'family')
    expect(path).toBe(`${ROUTES.reportCard}?card=${KEY}`)
    const copied = await copyReportCardShareLink('https://valtoris.example/', path!, writeText)
    expect(copied).toBe(`https://valtoris.example${path}`)
    expect(writeText).toHaveBeenCalledWith(`https://valtoris.example${path}`)
    expect(await copyReportCardShareLink('https://valtoris.example', ADVISOR_UUID, writeText)).toBeNull()
    expect(source('crm/digital-identity/ShareReportCardControl.tsx')).toContain(
      'copyReportCardShareLink(window.location.origin, sharePath)',
    )
  })

  it('accepts only allowlisted QR destinations for the same public key', () => {
    expect(
      isSafeReportCardQrDestination(`${ORIGIN}${ROUTES.reportCard}?card=${KEY}`, KEY, ORIGIN),
    ).toBe(true)
    expect(isSafeReportCardQrDestination(`${ORIGIN}/c/k/${KEY}`, KEY, ORIGIN)).toBe(true)
    expect(
      isSafeReportCardQrDestination(`https://evil.example${ROUTES.reportCard}?card=${KEY}`, KEY, ORIGIN),
    ).toBe(false)
    expect(isSafeReportCardQrDestination(`${ORIGIN}${ROUTES.reportCard}?card=${ADVISOR_UUID}`, KEY, ORIGIN)).toBe(
      false,
    )
  })

  it('reuses the existing QR download API and does not write CRM records', () => {
    const control = source('crm/digital-identity/ShareReportCardControl.tsx')
    expect(control).toContain('downloadPublicCardQr')
    expect(control).toContain('reportCardType')
    expect(control).toContain("format: 'svg'")
    expect(control).toContain("format: 'png'")
    expect(control).toContain('crm-share-report-card-qr-${item.format}')
    expect(control).toContain("{ format: 'svg', label: 'SVG' }")
    expect(control).toContain("{ format: 'png', label: 'PNG' }")
    expect(control).not.toMatch(/advisorProfileId|advisor_profile_id/)
    expect(control).not.toMatch(/from '\.\.\/\.\.\/server\/ingest/)
    expect(control).not.toContain('/r/')
    expect(shareReportCardControlSideEffects().createsLead).toBe(false)
    expect(shareReportCardControlSideEffects().createsActivity).toBe(false)
    expect(shareReportCardControlSideEffects().createsHousehold).toBe(false)
    expect(shareReportCardControlSideEffects().writesAnalytics).toBe(false)
    expect(shareReportCardControlSideEffects().writesCampaigns).toBe(false)
    expect(source('pages/crm/CrmCampaignsPage.tsx')).toContain('AdvisorDigitalCardPanel')
    expect(source('pages/crm/CrmCampaignsPage.tsx')).not.toContain('ShareReportCardControl')
  })
})
