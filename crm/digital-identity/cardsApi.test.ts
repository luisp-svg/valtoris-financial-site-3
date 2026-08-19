import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  defaultCardPublishProfile,
  digitalCardApiSideEffects,
  loadOwnDigitalCard,
  publishOwnDigitalCard,
  updateOwnAdvisorPublicProfile,
} from './cardsApi'
import {
  buildPublicCardPath,
  isValidIdentityPublicKey,
  VALTORIS_PUBLIC_DESIGNATION,
} from '../../modules/digital-identity'

const ROOT = join(import.meta.dirname, '../..')

function mockFrom(handlers: Record<string, (table: string) => unknown>) {
  return {
    from: vi.fn((table: string) => handlers[table]?.(table)),
  } as unknown as SupabaseClient
}

describe('cardsApi', () => {
  it('loads own identity without a card', async () => {
    const supabase = mockFrom({
      advisor_profiles: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'adv-1',
                    display_name: 'Luis Perez',
                    slug: 'luis-dev',
                    email: 'luis@example.com',
                    phone: '5125550100',
                    photo_url: null,
                    calendly_url: null,
                    user_id: 'user-1',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      digital_cards: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    })

    const result = await loadOwnDigitalCard(supabase, 'user-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.identity?.slug).toBe('luis-dev')
    expect(result.card).toBeNull()
  })

  it('maps a published card to the durable public_key path', async () => {
    const supabase = mockFrom({
      advisor_profiles: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'adv-1',
                    display_name: 'Luis Perez',
                    slug: 'luis-dev',
                    email: 'luis@example.com',
                    phone: null,
                    photo_url: null,
                    calendly_url: null,
                    user_id: 'user-1',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      digital_cards: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'card-1',
                  public_key: 'pk_live_abcdefghijklmnop',
                  slug: 'luis-dev',
                  status: 'published',
                  deleted_at: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    })

    const result = await loadOwnDigitalCard(supabase, 'user-1')
    expect(result.ok).toBe(true)
    if (!result.ok || !result.card) return
    expect(result.card.cardPath).toBe(buildPublicCardPath('pk_live_abcdefghijklmnop'))
    expect(result.card.cardPath).toBe('/c/k/pk_live_abcdefghijklmnop')
    expect(result.card.cardPath).not.toContain('luis-dev')
    expect(result.card).not.toHaveProperty('advisorProfileId')
  })

  it('returns no identity when the user has no advisor_profiles row', async () => {
    const supabase = mockFrom({
      advisor_profiles: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    })
    const result = await loadOwnDigitalCard(supabase, 'user-1')
    expect(result).toEqual({ ok: true, identity: null, card: null })
  })

  it('publishes a new card with advisor slug and generated public key', async () => {
    const inserted: Record<string, unknown>[] = []
    const supabase = mockFrom({
      advisor_profiles: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'adv-1',
                    display_name: 'Luis Perez',
                    slug: 'luis-dev',
                    email: 'luis@example.com',
                    phone: '5125550100',
                    photo_url: null,
                    calendly_url: 'https://calendly.com/luis',
                    user_id: 'user-1',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      digital_cards: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
        insert: (row: Record<string, unknown>) => {
          inserted.push(row)
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: 'card-new',
                  public_key: row.public_key,
                  slug: row.slug,
                  status: row.status,
                  deleted_at: null,
                },
                error: null,
              }),
            }),
          }
        },
      }),
    })

    const result = await publishOwnDigitalCard(supabase, 'user-1', '2026-08-19T00:00:00.000Z')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(inserted).toHaveLength(1)
    expect(inserted[0]?.advisor_profile_id).toBe('adv-1')
    expect(inserted[0]?.slug).toBe('luis-dev')
    expect(inserted[0]?.status).toBe('published')
    expect(isValidIdentityPublicKey(String(inserted[0]?.public_key))).toBe(true)
    expect(result.card.cardPath.startsWith('/c/k/')).toBe(true)
    expect(result.card.cardPath).not.toMatch(/^\/c\/[^k]/)
    expect(inserted[0]?.publish_profile).toEqual(defaultCardPublishProfile())
    expect(JSON.stringify(inserted[0])).not.toMatch(/role|commission|license/)
  })

  it('re-publishes a draft without rotating the public key', async () => {
    const updates: Record<string, unknown>[] = []
    const supabase = mockFrom({
      advisor_profiles: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'adv-1',
                    display_name: 'Luis Perez',
                    slug: 'luis-dev',
                    email: 'luis@example.com',
                    phone: null,
                    photo_url: null,
                    calendly_url: null,
                    user_id: 'user-1',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      digital_cards: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'card-1',
                  public_key: 'pk_live_abcdefghijklmnop',
                  slug: 'luis-dev',
                  status: 'draft',
                  deleted_at: null,
                },
                error: null,
              }),
            }),
          }),
        }),
        update: (row: Record<string, unknown>) => {
          updates.push(row)
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: {
                      id: 'card-1',
                      public_key: 'pk_live_abcdefghijklmnop',
                      slug: 'luis-dev',
                      status: 'published',
                      deleted_at: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        },
      }),
    })

    const result = await publishOwnDigitalCard(supabase, 'user-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(updates[0]).not.toHaveProperty('public_key')
    expect(result.card.publicKey).toBe('pk_live_abcdefghijklmnop')
    expect(result.card.cardPath).toBe('/c/k/pk_live_abcdefghijklmnop')
  })

  it('uses Financial Strategist as the default public designation', () => {
    expect(defaultCardPublishProfile().approvedTitle).toBe(VALTORIS_PUBLIC_DESIGNATION)
    expect(defaultCardPublishProfile().approvedTitle).toBe('Financial Strategist')
    expect(defaultCardPublishProfile().approvedTitle).not.toBe('Financial Advisor')
  })

  it('updates phone and photo on advisor_profiles without touching digital_cards or public_key', async () => {
    const captured: Record<string, unknown>[] = []
    const from = vi.fn((table: string) => {
      if (table === 'advisor_profiles') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'adv-1',
                      display_name: 'Luis Perez',
                      slug: 'luis-dev',
                      email: 'luis@example.com',
                      phone: null,
                      photo_url: null,
                      calendly_url: null,
                      user_id: 'user-1',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: (row: Record<string, unknown>) => {
            captured.push(row)
            return {
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    select: () => ({
                      single: async () => ({
                        data: {
                          id: 'adv-1',
                          display_name: 'Luis Perez',
                          slug: 'luis-dev',
                          email: 'luis@example.com',
                          phone: row.phone,
                          photo_url: row.photo_url,
                          calendly_url: null,
                          user_id: 'user-1',
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }
          },
        }
      }
      if (table === 'digital_cards') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'card-1',
                    public_key: 'pk_live_abcdefghijklmnop',
                    slug: 'luis-dev',
                    status: 'published',
                    deleted_at: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return undefined
    })
    const supabase = { from } as unknown as SupabaseClient

    const result = await updateOwnAdvisorPublicProfile(supabase, 'user-1', {
      phone: '512-555-0100',
      photoUrl: 'https://cdn.example.com/luis.jpg',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(captured).toEqual([
      { phone: '512-555-0100', photo_url: 'https://cdn.example.com/luis.jpg' },
    ])
    expect(captured[0]).not.toHaveProperty('public_key')
    expect(from.mock.calls.some((call) => call[0] === 'digital_cards' && true)).toBe(true)
    const digitalCardCalls = from.mock.calls.filter((call) => call[0] === 'digital_cards')
    expect(digitalCardCalls.length).toBe(1)
    expect(result.identity.phone).toBe('512-555-0100')
    expect(result.identity.photoUrl).toBe('https://cdn.example.com/luis.jpg')

    const relative = await updateOwnAdvisorPublicProfile(supabase, 'user-1', {
      phone: '512-555-0100',
      photoUrl: '/images/advisors/luis-perez.png',
    })
    expect(relative.ok).toBe(true)
    if (!relative.ok) return
    expect(captured[1]).toEqual({
      phone: '512-555-0100',
      photo_url: '/images/advisors/luis-perez.png',
    })
    expect(relative.identity.photoUrl).toBe('/images/advisors/luis-perez.png')
    expect(from.mock.calls.filter((call) => call[0] === 'digital_cards').length).toBe(2)
    expect(captured.every((row) => !Object.prototype.hasOwnProperty.call(row, 'public_key'))).toBe(true)
  })

  it('rejects javascript photo URLs before writing', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'advisor_profiles') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: 'adv-1',
                      display_name: 'Luis Perez',
                      slug: 'luis-dev',
                      email: 'luis@example.com',
                      phone: null,
                      photo_url: null,
                      calendly_url: null,
                      user_id: 'user-1',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: () => {
            throw new Error('update should not run')
          },
        }
      }
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'card-1',
                  public_key: 'pk_live_abcdefghijklmnop',
                  slug: 'luis-dev',
                  status: 'published',
                  deleted_at: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      }
    })
    const supabase = { from } as unknown as SupabaseClient
    const result = await updateOwnAdvisorPublicProfile(supabase, 'user-1', {
      phone: '',
      photoUrl: 'javascript:alert(1)',
    })
    expect(result.ok).toBe(false)
  })

  it('does not import a service-role browser client', () => {
    const source = readFileSync(join(ROOT, 'crm/digital-identity/cardsApi.ts'), 'utf8')
    const panel = readFileSync(
      join(ROOT, 'crm/digital-identity/AdvisorDigitalCardPanel.tsx'),
      'utf8',
    )
    for (const src of [source, panel]) {
      expect(src).not.toMatch(/createSupabaseAdminClient|SERVICE_ROLE|service_role/)
      expect(src).not.toMatch(/from\('activities'\)\.insert/)
    }
    expect(digitalCardApiSideEffects()).toEqual({
      importsAdminClient: false,
      writesActivities: false,
      usesServiceRole: false,
    })
  })
})
