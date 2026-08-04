/**
 * SERVER ONLY — resolve a published digital card for Let's Connect ingest.
 * Returns trusted advisor_profile_id for original_advisor_id attribution.
 * Do NOT import from browser/Vite client packages.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isValidIdentityPublicKey,
  normalizeIdentitySlug,
} from '../../../modules/digital-identity'

export type ResolveCardForIngestInput = {
  publicKey?: string | null
  slug?: string | null
}

export type ResolveCardForIngestSuccess = {
  ok: true
  advisorProfileId: string
  advisorSlug: string | null
  advisorDisplayName: string | null
  cardPublicKey: string
  cardSlug: string
}

export type ResolveCardForIngestError = {
  ok: false
  code: 'card_not_found' | 'invalid_card_reference' | 'lookup_failed'
  error: string
}

export type ResolveCardForIngestResult =
  | ResolveCardForIngestSuccess
  | ResolveCardForIngestError

type AdvisorJoinRow = {
  id: string
  slug: string | null
  display_name: string | null
  is_active: boolean | null
  deleted_at: string | null
}

type DigitalCardRow = {
  public_key: string
  slug: string
  status: string
  deleted_at: string | null
  advisor_profile_id: string
  advisor_profiles: AdvisorJoinRow | AdvisorJoinRow[] | null
}

const CARD_SELECT = `
  public_key,
  slug,
  status,
  deleted_at,
  advisor_profile_id,
  advisor_profiles!inner (
    id,
    slug,
    display_name,
    is_active,
    deleted_at
  )
`

function unwrapAdvisor(
  value: DigitalCardRow['advisor_profiles'],
): AdvisorJoinRow | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function mapRow(row: DigitalCardRow | null): ResolveCardForIngestResult {
  if (!row || row.status !== 'published' || row.deleted_at != null) {
    return { ok: false, code: 'card_not_found', error: 'This advisor card is not available.' }
  }

  const advisor = unwrapAdvisor(row.advisor_profiles)
  if (!advisor || advisor.is_active !== true || advisor.deleted_at != null) {
    return { ok: false, code: 'card_not_found', error: 'This advisor card is not available.' }
  }

  const advisorProfileId =
    typeof row.advisor_profile_id === 'string' && row.advisor_profile_id
      ? row.advisor_profile_id
      : advisor.id

  if (!advisorProfileId) {
    return { ok: false, code: 'card_not_found', error: 'This advisor card is not available.' }
  }

  return {
    ok: true,
    advisorProfileId,
    advisorSlug: typeof advisor.slug === 'string' ? advisor.slug : null,
    advisorDisplayName:
      typeof advisor.display_name === 'string' ? advisor.display_name : null,
    cardPublicKey: row.public_key,
    cardSlug: row.slug,
  }
}

async function fetchPublishedCardForIngest(
  admin: SupabaseClient,
  column: 'public_key' | 'slug',
  value: string,
): Promise<ResolveCardForIngestResult> {
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
    return { ok: false, code: 'lookup_failed', error: 'Unable to save submission' }
  }

  return mapRow((data as DigitalCardRow | null) ?? null)
}

/**
 * Resolve published card + trusted advisor attribution for CRM ingest.
 * Prefers publicKey when both identifiers are present.
 */
export async function resolveCardForIngest(
  admin: SupabaseClient,
  input: ResolveCardForIngestInput,
): Promise<ResolveCardForIngestResult> {
  const keyRaw = typeof input.publicKey === 'string' ? input.publicKey.trim() : ''
  const slugRaw = typeof input.slug === 'string' ? input.slug.trim() : ''

  const publicKey = keyRaw && isValidIdentityPublicKey(keyRaw) ? keyRaw : null
  const slug = slugRaw ? normalizeIdentitySlug(slugRaw) : null

  if (!publicKey && !slug) {
    return {
      ok: false,
      code: 'invalid_card_reference',
      error: 'A valid card reference is required.',
    }
  }

  try {
    if (publicKey) {
      return await fetchPublishedCardForIngest(admin, 'public_key', publicKey)
    }
    return await fetchPublishedCardForIngest(admin, 'slug', slug!)
  } catch {
    return { ok: false, code: 'lookup_failed', error: 'Unable to save submission' }
  }
}
