/**
 * CRM Digital Identity card provisioning via authenticated Supabase (RLS authority).
 * No service-role / admin client. Public key generation is application-side.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildConfiguredSocialLinks,
  buildPublicCardPath,
  createDefaultAdvisorCardCtas,
  generateIdentityPublicKey,
  isValidIdentityPublicKey,
  isValidIdentitySlug,
  mergePublishProfileSocialLinks,
  normalizePublicHref,
  normalizePublicHttpsUrl,
  socialDraftsFromPublishProfile,
  VALTORIS_PUBLIC_COMPANY,
  VALTORIS_PUBLIC_DESIGNATION,
  type PublicSocialDrafts,
} from '../../modules/digital-identity'

export type OwnAdvisorIdentity = {
  id: string
  displayName: string
  slug: string
  email: string | null
  phone: string | null
  photoUrl: string | null
  calendlyUrl: string | null
}

export type OwnDigitalCard = {
  id: string
  publicKey: string
  slug: string
  status: 'draft' | 'published' | 'disabled'
  displayName: string
  cardPath: string
  socialDrafts: PublicSocialDrafts
}

export type LoadOwnDigitalCardResult =
  | { ok: true; identity: OwnAdvisorIdentity; card: OwnDigitalCard | null }
  | { ok: true; identity: null; card: null }
  | { ok: false; message: string }

const CARD_SELECT = 'id, public_key, slug, status, deleted_at, publish_profile'
const IDENTITY_SELECT = 'id, display_name, slug, email, phone, photo_url, calendly_url, user_id'

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function mapIdentity(row: Record<string, unknown>): OwnAdvisorIdentity | null {
  if (typeof row.id !== 'string' || !row.id) return null
  if (typeof row.display_name !== 'string' || !row.display_name.trim()) return null
  if (typeof row.slug !== 'string' || !isValidIdentitySlug(row.slug)) return null
  return {
    id: row.id,
    displayName: row.display_name.trim(),
    slug: row.slug,
    email: typeof row.email === 'string' && row.email.trim() ? row.email.trim() : null,
    phone: typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : null,
    photoUrl: typeof row.photo_url === 'string' && row.photo_url.trim() ? row.photo_url.trim() : null,
    calendlyUrl:
      typeof row.calendly_url === 'string' && row.calendly_url.trim()
        ? row.calendly_url.trim()
        : null,
  }
}

function mapCard(
  row: Record<string, unknown>,
  displayName: string,
): OwnDigitalCard | null {
  if (typeof row.id !== 'string' || !row.id) return null
  if (typeof row.public_key !== 'string' || !isValidIdentityPublicKey(row.public_key)) return null
  if (typeof row.slug !== 'string' || !isValidIdentitySlug(row.slug)) return null
  const status = row.status
  if (status !== 'draft' && status !== 'published' && status !== 'disabled') return null
  if (row.deleted_at) return null
  return {
    id: row.id,
    publicKey: row.public_key,
    slug: row.slug,
    status,
    displayName,
    cardPath: buildPublicCardPath(row.public_key),
    socialDrafts: socialDraftsFromPublishProfile(row.publish_profile),
  }
}

/** Approved public overrides only — live name/phone/email/photo still resolve from advisor_profiles. */
export function defaultCardPublishProfile(): Record<string, unknown> {
  return {
    approvedTitle: VALTORIS_PUBLIC_DESIGNATION,
    approvedCompany: VALTORIS_PUBLIC_COMPANY,
    phoneVisible: true,
    emailVisible: true,
  }
}

function isUsablePublicPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10
}

export type UpdateOwnAdvisorPublicProfileInput = {
  phone: string
  photoUrl: string
}

/**
 * Updates live advisor_profiles phone/photo only.
 * Never writes digital_cards — public_key and QR stay unchanged.
 */
export async function updateOwnAdvisorPublicProfile(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateOwnAdvisorPublicProfileInput,
): Promise<{ ok: true; identity: OwnAdvisorIdentity } | { ok: false; message: string }> {
  const loaded = await loadOwnDigitalCard(supabase, userId)
  if (!loaded.ok) return loaded
  if (!loaded.identity) {
    return {
      ok: false,
      message: 'An advisor identity is required before public profile fields can be updated.',
    }
  }

  const phoneRaw = typeof input.phone === 'string' ? input.phone.trim() : ''
  const photoRaw = typeof input.photoUrl === 'string' ? input.photoUrl.trim() : ''

  if (phoneRaw && !isUsablePublicPhone(phoneRaw)) {
    return { ok: false, message: 'Enter a valid phone number including area code, or leave it blank.' }
  }
  if (photoRaw && !normalizePublicHref(photoRaw)) {
    return {
      ok: false,
      message: 'Photo must be an https URL or a site-relative path. javascript: and other schemes are not allowed.',
    }
  }

  const { data, error } = await supabase
    .from('advisor_profiles')
    .update({
      phone: phoneRaw || null,
      photo_url: photoRaw ? normalizePublicHref(photoRaw) : null,
    })
    .eq('id', loaded.identity.id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select(IDENTITY_SELECT)
    .single()

  if (error || !data) return { ok: false, message: 'Unable to update public profile.' }
  const identity = mapIdentity(asRecord(data))
  if (!identity) return { ok: false, message: 'Unable to update public profile.' }
  return { ok: true, identity }
}

export type UpdateOwnAdvisorPublicLinksInput = {
  calendlyUrl: string
  socialDrafts: PublicSocialDrafts
}

/**
 * Updates advisor_profiles.calendly_url and digital_cards.publish_profile.socialLinks.
 * Merges socialLinks only — never rotates public_key or rewrites cta_config / unrelated profile keys.
 */
export async function updateOwnAdvisorPublicLinks(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateOwnAdvisorPublicLinksInput,
): Promise<
  | { ok: true; identity: OwnAdvisorIdentity; card: OwnDigitalCard | null }
  | { ok: false; message: string }
> {
  const loaded = await loadOwnDigitalCard(supabase, userId)
  if (!loaded.ok) return loaded
  if (!loaded.identity) {
    return {
      ok: false,
      message: 'An advisor identity is required before public links can be updated.',
    }
  }

  const calendlyRaw = typeof input.calendlyUrl === 'string' ? input.calendlyUrl.trim() : ''
  let calendlyUrl: string | null = null
  if (calendlyRaw) {
    calendlyUrl = normalizePublicHttpsUrl(calendlyRaw)
    if (!calendlyUrl) {
      return {
        ok: false,
        message:
          'Booking URL must be https. javascript:, data:, http:, and other schemes are not allowed.',
      }
    }
  }

  const socials = buildConfiguredSocialLinks(input.socialDrafts)
  if (!socials.ok) return socials
  if (!loaded.card && socials.links.length > 0) {
    return {
      ok: false,
      message: 'Create and publish your digital card before saving social links.',
    }
  }

  const { data: identityRow, error: identityError } = await supabase
    .from('advisor_profiles')
    .update({ calendly_url: calendlyUrl })
    .eq('id', loaded.identity.id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select(IDENTITY_SELECT)
    .single()

  if (identityError || !identityRow) {
    return { ok: false, message: 'Unable to update public booking URL.' }
  }
  const identity = mapIdentity(asRecord(identityRow))
  if (!identity) return { ok: false, message: 'Unable to update public booking URL.' }

  if (!loaded.card) return { ok: true, identity, card: null }

  const { data: currentRow, error: currentError } = await supabase
    .from('digital_cards')
    .select(CARD_SELECT)
    .eq('id', loaded.card.id)
    .eq('advisor_profile_id', identity.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (currentError || !currentRow) return { ok: false, message: 'Unable to update social links.' }
  const current = asRecord(currentRow)
  if (current.public_key !== loaded.card.publicKey) {
    return { ok: false, message: 'Unable to update social links.' }
  }

  const publishProfile = mergePublishProfileSocialLinks(current.publish_profile, socials.links)
  const { data: cardRow, error: cardError } = await supabase
    .from('digital_cards')
    .update({ publish_profile: publishProfile })
    .eq('id', loaded.card.id)
    .eq('advisor_profile_id', identity.id)
    .select(CARD_SELECT)
    .single()

  if (cardError || !cardRow) return { ok: false, message: 'Unable to update social links.' }
  const card = mapCard(asRecord(cardRow), identity.displayName)
  if (!card) return { ok: false, message: 'Unable to update social links.' }
  if (card.publicKey !== loaded.card.publicKey) {
    return { ok: false, message: 'Unable to update social links.' }
  }
  return { ok: true, identity, card }
}

export async function loadOwnDigitalCard(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoadOwnDigitalCardResult> {
  if (!userId.trim()) return { ok: false, message: 'Unable to load digital card.' }

  const { data: identityRow, error: identityError } = await supabase
    .from('advisor_profiles')
    .select(IDENTITY_SELECT)
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (identityError) return { ok: false, message: 'Unable to load advisor identity.' }
  if (!identityRow) return { ok: true, identity: null, card: null }

  const identity = mapIdentity(asRecord(identityRow))
  if (!identity) return { ok: false, message: 'Unable to load advisor identity.' }

  const { data: cardRow, error: cardError } = await supabase
    .from('digital_cards')
    .select(CARD_SELECT)
    .eq('advisor_profile_id', identity.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (cardError) return { ok: false, message: 'Unable to load digital card.' }
  if (!cardRow) return { ok: true, identity, card: null }

  const card = mapCard(asRecord(cardRow), identity.displayName)
  if (!card) return { ok: false, message: 'Unable to load digital card.' }
  return { ok: true, identity, card }
}

export async function publishOwnDigitalCard(
  supabase: SupabaseClient,
  userId: string,
  nowIso: string = new Date().toISOString(),
): Promise<{ ok: true; card: OwnDigitalCard } | { ok: false; message: string }> {
  const loaded = await loadOwnDigitalCard(supabase, userId)
  if (!loaded.ok) return loaded
  if (!loaded.identity) {
    return {
      ok: false,
      message: 'An advisor identity is required before a digital card can be published.',
    }
  }

  const identity = loaded.identity

  if (loaded.card) {
    if (loaded.card.status === 'published') return { ok: true, card: loaded.card }

    const { data, error } = await supabase
      .from('digital_cards')
      .update({
        status: 'published',
        published_at: nowIso,
        disabled_at: null,
      })
      .eq('id', loaded.card.id)
      .eq('advisor_profile_id', identity.id)
      .select(CARD_SELECT)
      .single()

    if (error || !data) return { ok: false, message: 'Unable to publish digital card.' }
    const card = mapCard(asRecord(data), identity.displayName)
    if (!card) return { ok: false, message: 'Unable to publish digital card.' }
    return { ok: true, card }
  }

  const publicKey = generateIdentityPublicKey()
  const { data, error } = await supabase
    .from('digital_cards')
    .insert({
      advisor_profile_id: identity.id,
      public_key: publicKey,
      slug: identity.slug,
      status: 'published',
      theme_key: 'default',
      publish_profile: defaultCardPublishProfile(),
      cta_config: createDefaultAdvisorCardCtas({ calendlyUrl: identity.calendlyUrl }),
      published_at: nowIso,
    })
    .select(CARD_SELECT)
    .single()

  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { ok: false, message: 'A digital card already exists for this advisor.' }
    }
    return { ok: false, message: 'Unable to publish digital card.' }
  }

  const card = mapCard(asRecord(data), identity.displayName)
  if (!card) return { ok: false, message: 'Unable to publish digital card.' }
  return { ok: true, card }
}

export function digitalCardApiSideEffects(): {
  importsAdminClient: false
  writesActivities: false
  usesServiceRole: false
} {
  return {
    importsAdminClient: false,
    writesActivities: false,
    usesServiceRole: false,
  }
}
