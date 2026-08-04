import { describe, expect, it } from 'vitest'
import { buildHowWeMetFromActivities, buildHowWeMetViewModel } from './howWeMet'

describe('How We Met formatting', () => {
  it('formats safe attribution fields and never surfaces private notes or raw JSON keys as labels', () => {
    const model = buildHowWeMetViewModel({
      originalCampaign: 'rr-chamber-2026',
      originalSourceMetadata: {
        campaignLabel: 'Chamber Breakfast',
        eventCode: 'breakfast-aug-12',
        sourceChannel: 'qr',
        utms: { utmSource: 'flyer', utmMedium: 'offline' },
        advisor_notes: 'SECRET',
        campaignId: 'should-not-show',
        referrer: 'partner.example',
      },
      submittedAt: '2026-08-03T18:00:00.000Z',
      cardOwnerName: 'Jane Advisor',
      sourcePage: '/c/k/pk_live_abcdefghijklmnop?c=rr-chamber-2026',
      hasRelationshipPhoto: true,
    })

    expect(model).toMatchObject({
      campaignLabel: 'Chamber Breakfast',
      eventLabel: 'breakfast-aug-12',
      sourceChannel: 'QR code',
      cardOwner: 'Jane Advisor',
      relationshipPhoto: 'present',
      utmSummary: 'source=flyer · medium=offline',
    })
    expect(model?.connectedDate).toMatch(/Aug/)
    expect(JSON.stringify(model)).not.toContain('SECRET')
    expect(JSON.stringify(model)).not.toContain('should-not-show')
  })

  it('returns null when there is no attribution signal', () => {
    expect(buildHowWeMetViewModel({})).toBeNull()
  })

  it('builds from campaign attribution activities', () => {
    const model = buildHowWeMetFromActivities([
      {
        occurred_at: '2026-08-03T18:00:00.000Z',
        metadata: {
          eventKey: 'digital_identity.campaign_attributed',
          campaignCode: 'summit',
          eventCode: 'day1',
          sourceChannel: 'link',
        },
      },
    ])
    expect(model?.campaignLabel).toBe('summit')
    expect(model?.eventLabel).toBe('day1')
    expect(model?.sourceChannel).toBe('Link')
  })
})
