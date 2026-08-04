import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  buildCampaignPreviewDestination,
  buildCampaignPublicLink,
  buildCampaignUpdatePayload,
  updateCrmCampaign,
  type CrmCampaignRow,
} from './campaignsApi'

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
  description: null,
  status: 'active',
  sourceChannelDefault: 'link',
  defaultUtms: { utmSource: 'flyer' },
  startsAt: null,
  endsAt: null,
  locationLabel: null,
  organizer: null,
  advisorNotes: 'private note',
  createdByUserId: 'user-1',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
  deletedAt: null,
}

describe('campaignsApi URL helpers', () => {
  it('builds public links without campaign UUID or slug path', () => {
    const link = buildCampaignPublicLink(sample)
    expect(link).toBe(
      '/c/k/pk_live_abcdefghijklmnop?c=rr-chamber-2026&e=breakfast-aug-12&src=link',
    )
    expect(link).not.toContain('camp-uuid')
    expect(link).not.toContain('jane-advisor')
  })

  it('builds preview destination with allowlisted default UTMs', () => {
    const preview = buildCampaignPreviewDestination(sample)
    expect(preview).toContain('utm_source=flyer')
    expect(preview).toContain('/c/k/pk_live_abcdefghijklmnop')
    expect(preview).not.toContain('advisorNotes')
  })
})

describe('buildCampaignUpdatePayload / updateCrmCampaign immutability', () => {
  it('allows only approved mutable fields', () => {
    const built = buildCampaignUpdatePayload({
      label: 'Updated Label',
      description: 'New desc',
      locationLabel: 'Austin',
      organizer: 'Team',
      advisorNotes: 'note',
      startsAt: '2026-08-12T14:00:00.000Z',
      endsAt: '2026-08-12T16:00:00.000Z',
      status: 'disabled',
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.update).toEqual({
      label: 'Updated Label',
      description: 'New desc',
      location_label: 'Austin',
      organizer: 'Team',
      advisor_notes: 'note',
      starts_at: '2026-08-12T14:00:00.000Z',
      ends_at: '2026-08-12T16:00:00.000Z',
      status: 'disabled',
    })
    expect(built.update).not.toHaveProperty('campaign_code')
    expect(built.update).not.toHaveProperty('event_code')
    expect(built.update).not.toHaveProperty('digital_card_id')
    expect(built.update).not.toHaveProperty('created_by_user_id')
    expect(built.update).not.toHaveProperty('id')
  })

  it('rejects attempts to mutate immutable identifiers', () => {
    expect(
      buildCampaignUpdatePayload({
        label: 'x',
        campaignCode: 'hijack',
      } as never),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        message: expect.stringMatching(/cannot be changed/i),
      }),
    )
    expect(
      buildCampaignUpdatePayload({
        label: 'x',
        eventCode: 'hijack',
      } as never),
    ).toMatchObject({ ok: false })
    expect(
      buildCampaignUpdatePayload({
        label: 'x',
        digitalCardId: 'other-card',
      } as never),
    ).toMatchObject({ ok: false })
    expect(
      buildCampaignUpdatePayload({
        label: 'x',
        createdByUserId: 'other-user',
      } as never),
    ).toMatchObject({ ok: false })
    expect(
      buildCampaignUpdatePayload({
        label: 'x',
        id: 'other-id',
      } as never),
    ).toMatchObject({ ok: false })
  })

  it('rejects endsAt before startsAt at the application layer', () => {
    const built = buildCampaignUpdatePayload({
      startsAt: '2026-08-12T16:00:00.000Z',
      endsAt: '2026-08-12T14:00:00.000Z',
    })
    expect(built.ok).toBe(false)
    if (!built.ok) expect(built.message).toMatch(/end date/i)
  })

  it('owner/advisor update path writes only allowed columns (RLS remains authority)', async () => {
    let capturedUpdate: Record<string, unknown> | null = null
    const is = vi.fn(async () => ({ data: null, error: null }))
    const eq = vi.fn(() => ({ is }))
    const update = vi.fn((payload: Record<string, unknown>) => {
      capturedUpdate = payload
      return { eq }
    })
    const supabase = {
      from: vi.fn(() => ({ update })),
    } as unknown as SupabaseClient

    const result = await updateCrmCampaign(supabase, 'camp-1', {
      label: 'Owner/Advisor edit',
      description: 'Updated',
      locationLabel: 'HQ',
      organizer: 'Ops',
      advisorNotes: 'CRM only',
      startsAt: '2026-08-12T14:00:00.000Z',
      endsAt: '2026-08-12T16:00:00.000Z',
    })

    expect(result).toEqual({ ok: true })
    expect(supabase.from).toHaveBeenCalledWith('digital_card_campaigns')
    expect(eq).toHaveBeenCalledWith('id', 'camp-1')
    expect(capturedUpdate).toEqual({
      label: 'Owner/Advisor edit',
      description: 'Updated',
      location_label: 'HQ',
      organizer: 'Ops',
      advisor_notes: 'CRM only',
      starts_at: '2026-08-12T14:00:00.000Z',
      ends_at: '2026-08-12T16:00:00.000Z',
    })
    expect(JSON.stringify(capturedUpdate)).not.toContain('campaign_code')
    expect(JSON.stringify(capturedUpdate)).not.toContain('event_code')
    expect(JSON.stringify(capturedUpdate)).not.toContain('digital_card_id')
  })

  it('documents that cross-card denial remains RLS authority (no app-layer bypass)', () => {
    // updateCrmCampaign only filters by campaign id + deleted_at; ownership is RLS.
    // This test locks the query shape so we do not add a silent service-role bypass.
    const source = updateCrmCampaign.toString()
    expect(source).toContain('digital_card_campaigns')
    expect(source).not.toContain('createSupabaseAdminClient')
    expect(source).not.toContain('service_role')
  })
})
