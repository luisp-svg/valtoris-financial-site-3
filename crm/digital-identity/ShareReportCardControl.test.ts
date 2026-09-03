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
  shareReportCardControlSideEffects,
} from './ShareReportCardControl'

const ROOT = process.cwd()
const KEY = 'pk_live_abcdefghijklmnop'
const ADVISOR_UUID = '11111111-2222-4333-8444-555555555555'

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
    expect(html).toContain(`${ROUTES.reportCard}?card=${KEY}`)
    expect(html).toContain('value="family"')
    expect(html).toContain('value="business"')
    expect(html).toContain('value="protection"')
    expect(html).toContain('value="student_loan"')
    expect(html).toContain('value="credit"')
    expect(html).toContain('value="home_buyer"')
    expect(html).not.toContain('retirement')
    expect(html).not.toContain(ADVISOR_UUID)
    expect(html).not.toContain(ROUTES.familyAssessment)
    expect(REPORT_CARD_SHARE_TYPES).toHaveLength(6)
  })

  it('copies the generated share URL and does not write CRM records', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const path = buildReportCardSharePath(KEY, 'family')
    expect(path).toBe(`${ROUTES.reportCard}?card=${KEY}`)
    const copied = await copyReportCardShareLink('https://valtoris.example/', path!, writeText)
    expect(copied).toBe(`https://valtoris.example${path}`)
    expect(writeText).toHaveBeenCalledWith(`https://valtoris.example${path}`)
    expect(await copyReportCardShareLink('https://valtoris.example', ADVISOR_UUID, writeText)).toBeNull()
    expect(shareReportCardControlSideEffects().createsLead).toBe(false)
    expect(shareReportCardControlSideEffects().createsActivity).toBe(false)
    expect(shareReportCardControlSideEffects().createsHousehold).toBe(false)
    expect(shareReportCardControlSideEffects().downloadsQr).toBe(false)
    expect(source('crm/digital-identity/ShareReportCardControl.tsx')).toContain(
      'copyReportCardShareLink(window.location.origin, sharePath)',
    )
  })

  it('is wired into the Campaigns Digital Identity area without a new page or ingest writes', () => {
    const panel = source('crm/digital-identity/AdvisorDigitalCardPanel.tsx')
    const campaigns = source('pages/crm/CrmCampaignsPage.tsx')
    const control = source('crm/digital-identity/ShareReportCardControl.tsx')
    expect(panel).toContain('ShareReportCardControl')
    expect(panel).toContain('publicKey={card.publicKey}')
    expect(campaigns).toContain('AdvisorDigitalCardPanel')
    expect(campaigns).not.toContain('ShareReportCardControl')
    expect(control).toContain('buildReportCardSharePath')
    expect(control).not.toMatch(/advisorProfileId|advisor_profile_id/)
    expect(control).not.toMatch(/from '\.\.\/\.\.\/server\/ingest/)
    expect(control).not.toContain('/r/')
    expect(control).not.toContain('downloadPublicCardQr')
  })
})
