import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_CODES_IMMUTABLE_COPY,
  CAMPAIGN_EDITABLE_FIELD_KEYS,
  CAMPAIGN_IMMUTABLE_IDENTIFIER_KEYS,
  CAMPAIGN_QR_FORMATS,
  assertCampaignQrDestinationSafe,
  buildCampaignQrQuery,
  campaignEditFormFromRow,
  validateCampaignLifecycle,
} from './campaignEditContract'
import type { CrmCampaignRow } from './campaignsApi'

const sample: CrmCampaignRow = {
  id: 'camp-uuid-internal',
  digitalCardId: 'card-1',
  cardPublicKey: 'pk_live_abcdefghijklmnop',
  cardSlug: 'jane-advisor',
  advisorProfileId: 'adv-1',
  advisorDisplayName: 'Jane Advisor',
  campaignCode: 'rr-chamber-2026',
  eventCode: 'breakfast-aug-12',
  label: 'Chamber Breakfast',
  description: 'Desc',
  status: 'active',
  sourceChannelDefault: 'link',
  defaultUtms: {},
  startsAt: '2026-08-12T14:00:00.000Z',
  endsAt: '2026-08-12T16:00:00.000Z',
  locationLabel: 'Round Rock',
  organizer: 'Chamber',
  advisorNotes: 'private',
  createdByUserId: 'user-1',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
  deletedAt: null,
}

describe('campaign edit contract', () => {
  it('lists every approved mutable Phase-1 edit field', () => {
    expect([...CAMPAIGN_EDITABLE_FIELD_KEYS]).toEqual([
      'label',
      'description',
      'locationLabel',
      'organizer',
      'advisorNotes',
      'startsAt',
      'endsAt',
    ])
  })

  it('marks campaignCode and eventCode as immutable identifiers', () => {
    expect(CAMPAIGN_IMMUTABLE_IDENTIFIER_KEYS).toContain('campaignCode')
    expect(CAMPAIGN_IMMUTABLE_IDENTIFIER_KEYS).toContain('eventCode')
    expect(CAMPAIGN_IMMUTABLE_IDENTIFIER_KEYS).toContain('digitalCardId')
    expect(CAMPAIGN_IMMUTABLE_IDENTIFIER_KEYS).toContain('createdByUserId')
    expect(CAMPAIGN_IMMUTABLE_IDENTIFIER_KEYS).toContain('id')
  })

  it('exposes immutable-code UI copy and QR format controls', () => {
    expect(CAMPAIGN_CODES_IMMUTABLE_COPY).toMatch(/cannot be changed after creation/i)
    expect(CAMPAIGN_QR_FORMATS.map((item) => item.format)).toEqual(['svg', 'png', 'png-hires'])
  })

  it('builds edit form state without mutable identifier fields', () => {
    const form = campaignEditFormFromRow(sample)
    expect(form).toEqual(
      expect.objectContaining({
        label: 'Chamber Breakfast',
        description: 'Desc',
        locationLabel: 'Round Rock',
        organizer: 'Chamber',
        advisorNotes: 'private',
      }),
    )
    expect(form).not.toHaveProperty('campaignCode')
    expect(form).not.toHaveProperty('eventCode')
  })

  it('rejects endsAt before startsAt', () => {
    expect(
      validateCampaignLifecycle('2026-08-12T16:00:00.000Z', '2026-08-12T14:00:00.000Z'),
    ).toMatch(/end date/i)
    expect(
      validateCampaignLifecycle('2026-08-12T14:00:00.000Z', '2026-08-12T16:00:00.000Z'),
    ).toBeNull()
  })

  it('builds campaign QR query with public_key and codes — never slug or UUID', () => {
    for (const format of ['svg', 'png', 'png-hires'] as const) {
      const params = buildCampaignQrQuery({
        publicKey: sample.cardPublicKey,
        campaignCode: sample.campaignCode,
        eventCode: sample.eventCode,
        format,
      })
      expect(params.get('key')).toBe('pk_live_abcdefghijklmnop')
      expect(params.get('c')).toBe('rr-chamber-2026')
      expect(params.get('e')).toBe('breakfast-aug-12')
      expect(params.get('format')).toBe(format)
      expect(params.toString()).not.toContain('jane-advisor')
      expect(params.toString()).not.toContain('camp-uuid')
    }
  })

  it('accepts only public_key QR destinations', () => {
    expect(
      assertCampaignQrDestinationSafe(
        'https://valtoris.example/c/k/pk_live_abcdefghijklmnop?c=rr-chamber-2026&src=qr',
      ).ok,
    ).toBe(true)
    expect(assertCampaignQrDestinationSafe('https://valtoris.example/c/jane-advisor').ok).toBe(
      false,
    )
  })
})

describe('CrmCampaignsPage edit UI source contract', () => {
  const pageSource = readFileSync(
    resolve(process.cwd(), 'pages/crm/CrmCampaignsPage.tsx'),
    'utf8',
  )

  it('exposes every approved mutable edit field in the edit form', () => {
    expect(pageSource).toContain('data-testid="crm-campaign-edit-label"')
    expect(pageSource).toContain('data-testid="crm-campaign-edit-description"')
    expect(pageSource).toContain('data-testid="crm-campaign-edit-location"')
    expect(pageSource).toContain('data-testid="crm-campaign-edit-organizer"')
    expect(pageSource).toContain('data-testid="crm-campaign-edit-advisor-notes"')
    expect(pageSource).toContain('data-testid="crm-campaign-edit-starts"')
    expect(pageSource).toContain('data-testid="crm-campaign-edit-ends"')
    for (const key of CAMPAIGN_EDITABLE_FIELD_KEYS) {
      expect(pageSource).toContain(key === 'startsAt' || key === 'endsAt' ? key : key)
    }
  })

  it('renders campaignCode and eventCode as read-only after creation', () => {
    expect(pageSource).toContain('data-testid="crm-campaign-edit-campaign-code"')
    expect(pageSource).toContain('data-testid="crm-campaign-edit-event-code"')
    expect(pageSource).toMatch(
      /readOnly[\s\S]{0,120}data-testid="crm-campaign-edit-campaign-code"/,
    )
    expect(pageSource).toMatch(
      /readOnly[\s\S]{0,120}data-testid="crm-campaign-edit-event-code"/,
    )
    expect(pageSource).toContain('crm-campaign-codes-immutable-note')
    expect(pageSource).toContain('CAMPAIGN_CODES_IMMUTABLE_COPY')
    expect(CAMPAIGN_CODES_IMMUTABLE_COPY).toMatch(/cannot be changed after creation/i)
  })

  it('offers SVG, PNG, and print QR download controls', () => {
    expect(pageSource).toContain('CAMPAIGN_QR_FORMATS')
    expect(pageSource).toContain('crm-campaign-qr-${item.format}')
    expect(CAMPAIGN_QR_FORMATS.map((item) => item.format)).toEqual([
      'svg',
      'png',
      'png-hires',
    ])
  })
})
