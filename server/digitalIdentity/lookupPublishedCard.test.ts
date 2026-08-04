import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  lookupPublishedCard,
  lookupPublishedCardByPublicKey,
  lookupPublishedCardBySlug,
  publicCardLookupSideEffects,
} from './lookupPublishedCard'

function makeAdmin(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result)
  const isDeletedAdvisor = vi.fn(() => ({ maybeSingle }))
  const eqAdvisorActive = vi.fn(() => ({ is: isDeletedAdvisor }))
  const isDeletedCard = vi.fn(() => ({ eq: eqAdvisorActive }))
  const eqStatus = vi.fn(() => ({ is: isDeletedCard }))
  const eqLookup = vi.fn(() => ({ eq: eqStatus }))
  const select = vi.fn(() => ({ eq: eqLookup }))
  const from = vi.fn(() => ({ select }))

  return {
    admin: { from } as unknown as SupabaseClient,
    from,
    eqLookup,
    maybeSingle,
  }
}

const publishedRow = {
  public_key: 'pk_test_public_key01',
  slug: 'jane-advisor',
  status: 'published',
  theme_key: 'default',
  publish_profile: { approvedTitle: 'Advisor' },
  cta_config: {},
  deleted_at: null,
  advisor_profiles: {
    display_name: 'Jane Advisor',
    email: 'jane@example.com',
    phone: '555-0100',
    photo_url: 'https://cdn.example.com/jane.jpg',
    bio: 'Bio',
    calendly_url: 'https://calendly.com/valtoris/jane',
    is_active: true,
    deleted_at: null,
    accepts_new_leads: false,
  },
}

describe('lookupPublishedCard', () => {
  it('returns found for a valid published card by public_key', async () => {
    const { admin } = makeAdmin({ data: publishedRow, error: null })
    const result = await lookupPublishedCardByPublicKey('pk_test_public_key01', { admin })
    expect(result.status).toBe('found')
    if (result.status === 'found') {
      expect(result.card.displayName).toBe('Jane Advisor')
      expect(result.card.primaryConnectLabel).toBe("Let's Connect")
      expect(JSON.stringify(result.card)).not.toMatch(/advisor_profile_id|user_id|"id":/)
    }
  })

  it('returns found for a valid published card by slug (normalized)', async () => {
    const { admin, eqLookup } = makeAdmin({ data: publishedRow, error: null })
    const result = await lookupPublishedCardBySlug(' Jane Advisor ', { admin })
    expect(result.status).toBe('found')
    expect(eqLookup).toHaveBeenCalledWith('slug', 'jane-advisor')
  })

  it('rejects malformed key and slug as invalid_request', async () => {
    const { admin, from } = makeAdmin({ data: null, error: null })
    expect(await lookupPublishedCardByPublicKey('short', { admin })).toEqual({
      status: 'invalid_request',
      reason: 'invalid_public_key',
    })
    expect(await lookupPublishedCardBySlug('!!!', { admin })).toEqual({
      status: 'invalid_request',
      reason: 'invalid_slug',
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects both key and slug or neither', async () => {
    expect(await lookupPublishedCard({ key: 'pk_test_public_key01', slug: 'jane' } as never)).toEqual(
      {
        status: 'invalid_request',
        reason: 'both_key_and_slug',
      },
    )
    expect(await lookupPublishedCard({} as never)).toEqual({
      status: 'invalid_request',
      reason: 'missing_lookup_identifier',
    })
  })

  it('returns unavailable for unknown cards without leaking details', async () => {
    const { admin } = makeAdmin({ data: null, error: null })
    const result = await lookupPublishedCardByPublicKey('pk_test_public_key99', { admin })
    expect(result).toEqual({ status: 'unavailable' })
  })

  it('returns unavailable when advisor is inactive even if a row is returned', async () => {
    const { admin } = makeAdmin({
      data: {
        ...publishedRow,
        advisor_profiles: { ...publishedRow.advisor_profiles, is_active: false },
      },
      error: null,
    })
    expect(await lookupPublishedCardByPublicKey('pk_test_public_key01', { admin })).toEqual({
      status: 'unavailable',
    })
  })

  it('maps database errors to server_error without raw details', async () => {
    const { admin } = makeAdmin({
      data: null,
      error: { message: 'permission denied for table digital_cards', code: '42501' },
    })
    const result = await lookupPublishedCardByPublicKey('pk_test_public_key01', { admin })
    expect(result).toEqual({ status: 'server_error' })
    expect(JSON.stringify(result)).not.toContain('permission denied')
  })

  it('documents zero CRM/analytics side effects', () => {
    expect(publicCardLookupSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      createsTask: false,
      createsActivity: false,
      createsCase: false,
    })
  })
})
