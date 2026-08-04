/**
 * SERVER ONLY — published digital card lookup via service-role admin client.
 * Never import from browser/Vite client code.
 *
 * No analytics writes. No lead/household/task/activity/Case side effects.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../lib/supabase/admin'
import {
  assemblePublishedCardDto,
  isValidIdentityPublicKey,
  normalizeIdentitySlug,
} from '../../modules/digital-identity'
import type { PublicCardLookupQuery, PublicCardLookupResult } from './types'

type AdvisorJoinRow = {
  display_name: string | null
  email: string | null
  phone: string | null
  photo_url: string | null
  bio: string | null
  calendly_url: string | null
  is_active: boolean | null
  deleted_at: string | null
  accepts_new_leads?: boolean | null
}

type DigitalCardRow = {
  public_key: string
  slug: string
  status: string
  theme_key: string | null
  publish_profile: unknown
  cta_config: unknown
  deleted_at: string | null
  advisor_profiles: AdvisorJoinRow | AdvisorJoinRow[] | null
}

const CARD_SELECT = `
  public_key,
  slug,
  status,
  theme_key,
  publish_profile,
  cta_config,
  deleted_at,
  advisor_profiles!inner (
    display_name,
    email,
    phone,
    photo_url,
    bio,
    calendly_url,
    is_active,
    deleted_at,
    accepts_new_leads
  )
`

export type LookupPublishedCardDeps = {
  admin?: SupabaseClient
}

function unwrapAdvisor(
  value: DigitalCardRow['advisor_profiles'],
): AdvisorJoinRow | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function mapRowToResult(row: DigitalCardRow | null): PublicCardLookupResult {
  if (!row) return { status: 'unavailable' }

  const advisor = unwrapAdvisor(row.advisor_profiles)
  if (!advisor) return { status: 'unavailable' }

  // accepts_new_leads does not hide the card — only future ingest policy differs.
  void advisor.accepts_new_leads

  const advisorIsActive = advisor.is_active === true && advisor.deleted_at == null
  const card = assemblePublishedCardDto({
    card: {
      publicKey: row.public_key,
      slug: row.slug,
      status: row.status,
      themeKey: row.theme_key ?? 'default',
      publishProfile: row.publish_profile,
      ctaConfig: row.cta_config,
      deletedAt: row.deleted_at,
    },
    advisor: {
      displayName: advisor.display_name ?? '',
      email: advisor.email,
      phone: advisor.phone,
      photoUrl: advisor.photo_url,
      bio: advisor.bio,
      calendlyUrl: advisor.calendly_url,
    },
    advisorIsActive,
  })

  if (!card) return { status: 'unavailable' }
  return { status: 'found', card }
}

async function fetchPublishedCard(
  admin: SupabaseClient,
  column: 'public_key' | 'slug',
  value: string,
): Promise<PublicCardLookupResult> {
  const { data, error } = await admin
    .from('digital_cards')
    .select(CARD_SELECT)
    .eq(column, value)
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('advisor_profiles.is_active', true)
    .is('advisor_profiles.deleted_at', null)
    .maybeSingle()

  if (error) {
    return { status: 'server_error' }
  }

  return mapRowToResult((data as DigitalCardRow | null) ?? null)
}

export async function lookupPublishedCardByPublicKey(
  publicKey: string,
  deps: LookupPublishedCardDeps = {},
): Promise<PublicCardLookupResult> {
  const trimmed = typeof publicKey === 'string' ? publicKey.trim() : ''
  if (!isValidIdentityPublicKey(trimmed)) {
    return { status: 'invalid_request', reason: 'invalid_public_key' }
  }

  try {
    const admin = deps.admin ?? createSupabaseAdminClient()
    return await fetchPublishedCard(admin, 'public_key', trimmed)
  } catch {
    return { status: 'server_error' }
  }
}

export async function lookupPublishedCardBySlug(
  slug: string,
  deps: LookupPublishedCardDeps = {},
): Promise<PublicCardLookupResult> {
  const normalized = typeof slug === 'string' ? normalizeIdentitySlug(slug) : null
  if (!normalized) {
    return { status: 'invalid_request', reason: 'invalid_slug' }
  }

  try {
    const admin = deps.admin ?? createSupabaseAdminClient()
    return await fetchPublishedCard(admin, 'slug', normalized)
  } catch {
    return { status: 'server_error' }
  }
}

/**
 * Resolve a public query with exactly one identifier.
 */
export async function lookupPublishedCard(
  query: PublicCardLookupQuery,
  deps: LookupPublishedCardDeps = {},
): Promise<PublicCardLookupResult> {
  const hasKey = typeof query.key === 'string' && query.key.trim().length > 0
  const hasSlug = typeof query.slug === 'string' && query.slug.trim().length > 0

  if (hasKey && hasSlug) {
    return { status: 'invalid_request', reason: 'both_key_and_slug' }
  }
  if (!hasKey && !hasSlug) {
    return { status: 'invalid_request', reason: 'missing_lookup_identifier' }
  }

  if (hasKey) {
    return lookupPublishedCardByPublicKey(query.key!, deps)
  }
  return lookupPublishedCardBySlug(query.slug!, deps)
}

/** Documented no-op — public reads never write analytics or CRM entities. */
export function publicCardLookupSideEffects(): {
  writesAnalytics: false
  createsLead: false
  createsHousehold: false
  createsTask: false
  createsActivity: false
  createsCase: false
} {
  return {
    writesAnalytics: false,
    createsLead: false,
    createsHousehold: false,
    createsTask: false,
    createsActivity: false,
    createsCase: false,
  }
}
