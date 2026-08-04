import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { resolveTrustedCampaignAttribution } from './resolveTrustedCampaign'

function campaignAdmin(row: Record<string, unknown> | null, error: unknown = null) {
  const maybeSingle = vi.fn(async () => ({ data: row, error }))
  const is = vi.fn(() => ({ maybeSingle }))
  const eq2 = vi.fn(() => ({ is }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const select = vi.fn(() => ({ eq: eq1 }))
  return {
    admin: {
      from: vi.fn(() => ({ select })),
    } as unknown as SupabaseClient,
    maybeSingle,
  }
}

const BASE = {
  digitalCardId: 'card-1',
  cardPublicKey: 'pk_live_abcdefghijklmnop',
  campaignCode: 'rr-chamber-2026',
  eventCode: 'breakfast-aug-12',
  sourceChannel: 'qr',
  utmSource: 'flyer',
  referrer: 'https://partner.example/page',
  occurredAt: '2026-08-03T18:00:00.000Z',
}

describe('resolveTrustedCampaignAttribution', () => {
  it('trusts active non-deleted campaign belonging to the card and merges default UTMs', async () => {
    const { admin } = campaignAdmin({
      id: 'camp-1',
      digital_card_id: 'card-1',
      campaign_code: 'rr-chamber-2026',
      event_code: 'breakfast-aug-12',
      label: 'Chamber Breakfast',
      status: 'active',
      default_utms: { utmMedium: 'offline', utmCampaign: 'chamber' },
      source_channel_default: 'link',
    })

    const result = await resolveTrustedCampaignAttribution(admin, BASE)
    expect(result.trusted).toBe(true)
    expect(result.campaignCode).toBe('rr-chamber-2026')
    expect(result.eventCode).toBe('breakfast-aug-12')
    expect(result.campaignLabel).toBe('Chamber Breakfast')
    expect(result.sourceChannel).toBe('qr')
    expect(result.firstTouchMetadata).toMatchObject({
      campaignLabel: 'Chamber Breakfast',
      firstSeenAt: BASE.occurredAt,
      referrer: 'partner.example',
      utms: {
        utmSource: 'flyer',
        utmMedium: 'offline',
        utmCampaign: 'chamber',
      },
    })
    expect(result.lastTouchMetadata).toMatchObject({
      campaignCode: 'rr-chamber-2026',
      occurredAt: BASE.occurredAt,
    })
    expect(result.lastTouchMetadata).not.toHaveProperty('firstSeenAt')
    expect(JSON.stringify(result)).not.toContain('camp-1')
  })

  it('rejects unknown, disabled, and soft-deleted campaigns', async () => {
    const unknown = await resolveTrustedCampaignAttribution(
      campaignAdmin(null).admin,
      BASE,
    )
    expect(unknown.trusted).toBe(false)
    expect(unknown.campaignCode).toBeNull()

    const disabled = await resolveTrustedCampaignAttribution(
      campaignAdmin({
        id: 'camp-1',
        digital_card_id: 'card-1',
        campaign_code: 'rr-chamber-2026',
        event_code: 'breakfast-aug-12',
        label: 'X',
        status: 'disabled',
        default_utms: {},
        source_channel_default: 'link',
      }).admin,
      BASE,
    )
    expect(disabled.trusted).toBe(false)
    expect(disabled.campaignCode).toBeNull()
  })

  it('rejects event-code mismatch and client event when campaign has none', async () => {
    const mismatch = await resolveTrustedCampaignAttribution(
      campaignAdmin({
        id: 'camp-1',
        digital_card_id: 'card-1',
        campaign_code: 'rr-chamber-2026',
        event_code: 'other-event',
        label: 'X',
        status: 'active',
        default_utms: {},
        source_channel_default: 'link',
      }).admin,
      BASE,
    )
    expect(mismatch.trusted).toBe(false)

    const noEvent = await resolveTrustedCampaignAttribution(
      campaignAdmin({
        id: 'camp-1',
        digital_card_id: 'card-1',
        campaign_code: 'rr-chamber-2026',
        event_code: null,
        label: 'X',
        status: 'active',
        default_utms: {},
        source_channel_default: 'link',
      }).admin,
      BASE,
    )
    expect(noEvent.trusted).toBe(false)
  })
})
