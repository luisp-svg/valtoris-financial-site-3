import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  defaultCardPublishProfile,
  digitalCardApiSideEffects,
  loadOwnDigitalCard,
  publishOwnDigitalCard,
} from './cardsApi'
import { buildPublicCardPath, isValidIdentityPublicKey } from '../../modules/digital-identity'

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
