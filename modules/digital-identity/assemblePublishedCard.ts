/**
 * Assemble allowlisted public card DTOs from advisor + card publish JSON.
 * Pure functions — no I/O, no admin client, no CRM side effects.
 */

import { LETS_CONNECT_CTA_LABEL, V1_IDENTITY_SURFACE_KIND } from './constants.js'
import { createDefaultAdvisorCardCtas } from './cta.js'
import { resolvePublicCompany, resolvePublicDesignation } from './publicDesignation.js'
import type {
  IdentityCtaConfigItem,
  IdentityCtaKey,
  IdentitySocialLink,
  IdentitySurfacePublicDto,
} from './types.js'
import { buildPublicCardPath, normalizePublicHref } from './urls.js'

const MAX_SAFE_TEXT = 500

const CTA_KEYS: readonly IdentityCtaKey[] = [
  'lets_connect',
  'save_contact',
  'book_appointment',
  'family_report_card',
  'business_report_card',
  'protection_gap',
  'credit_assessment',
] as const

const DEFAULT_CTA_LABELS: Record<IdentityCtaKey, string> = {
  lets_connect: LETS_CONNECT_CTA_LABEL,
  save_contact: 'Save Contact',
  book_appointment: 'Book Appointment',
  family_report_card: 'Family Financial Report Card',
  business_report_card: 'Business Financial Report Card',
  protection_gap: 'Protection Gap',
  credit_assessment: 'Future Credit Assessment',
}

export type AdvisorProfilePublicSource = {
  displayName: string
  email: string | null
  phone: string | null
  photoUrl: string | null
  bio: string | null
  calendlyUrl: string | null
}

export type DigitalCardPublicSource = {
  publicKey: string
  slug: string
  status: string
  themeKey: string
  publishProfile: unknown
  ctaConfig: unknown
  deletedAt: string | null
}

const INTERNAL_RESPONSE_KEYS = [
  'id',
  'advisorProfileId',
  'advisorId',
  'advisor_profile_id',
  'userId',
  'user_id',
  'householdId',
  'publish_profile',
  'publishProfile',
  'cta_config',
  'ctaConfig',
  'acceptsNewLeads',
  'isActive',
  'role',
] as const

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readTrimmedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function readBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === true) return true
  if (value === false) return false
  return defaultValue
}

function overrideString(
  override: unknown,
  fallback: string | null,
  max: number,
): string | null {
  const fromOverride = readTrimmedString(override, max)
  if (fromOverride !== null) return fromOverride
  return fallback === null ? null : fallback.trim().slice(0, max) || null
}

function normalizeSocialLinks(value: unknown): IdentitySocialLink[] {
  if (!Array.isArray(value)) return []
  const out: IdentitySocialLink[] = []
  for (const item of value.slice(0, 20)) {
    const record = asRecord(item)
    const key = readTrimmedString(record.key, 40)
    const label = readTrimmedString(record.label, 80)
    const url = normalizePublicHref(record.url)
    if (!key || !label || !url) continue
    out.push({ key, label, url })
  }
  return out
}

function normalizeSpecialties(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value.slice(0, 30)) {
    const text = readTrimmedString(item, 80)
    if (text) out.push(text)
  }
  return out
}

/**
 * Normalize stored cta_config JSON into enabled public CTA items.
 * Always forces primary label to Let's Connect and credit_assessment disabled.
 */
export function normalizePublicCtaItems(raw: unknown, calendlyUrl: string | null): IdentityCtaConfigItem[] {
  const defaults = createDefaultAdvisorCardCtas({ calendlyUrl })
  const defaultByKey = new Map(defaults.items.map((item) => [item.key, item]))
  const record = asRecord(raw)
  const rawItems = Array.isArray(record.items) ? record.items : []
  const byKey = new Map<IdentityCtaKey, IdentityCtaConfigItem>()

  for (const key of CTA_KEYS) {
    const fallback = defaultByKey.get(key)!
    byKey.set(key, { ...fallback })
  }

  for (const item of rawItems) {
    const row = asRecord(item)
    const keyRaw = readTrimmedString(row.key, 64)
    if (!keyRaw || !(CTA_KEYS as readonly string[]).includes(keyRaw)) continue
    const key = keyRaw as IdentityCtaKey
    const fallback = byKey.get(key)!
    const href = normalizePublicHref(row.href) ?? fallback.href ?? null
    const enabled = key === 'credit_assessment' ? false : readBoolean(row.enabled, fallback.enabled)
    const label =
      key === 'lets_connect'
        ? LETS_CONNECT_CTA_LABEL
        : readTrimmedString(row.label, 80) ?? DEFAULT_CTA_LABELS[key]
    byKey.set(key, { key, label, enabled, href })
  }

  // Ensure book appointment reflects calendly when enabled without explicit false.
  const book = byKey.get('book_appointment')!
  if (book.enabled && !book.href && calendlyUrl) {
    byKey.set('book_appointment', {
      ...book,
      href: normalizePublicHref(calendlyUrl),
    })
  }

  byKey.set('lets_connect', {
    key: 'lets_connect',
    label: LETS_CONNECT_CTA_LABEL,
    enabled: true,
    href: null,
  })
  byKey.set('credit_assessment', {
    key: 'credit_assessment',
    label: DEFAULT_CTA_LABELS.credit_assessment,
    enabled: false,
    href: null,
  })

  return CTA_KEYS.map((key) => byKey.get(key)!).filter((item) => item.enabled)
}

/**
 * Merge advisor_profiles (SoT) with digital_cards.publish_profile overrides.
 * Returns null when the card cannot be publicly resolved.
 */
export function assemblePublishedCardDto(input: {
  card: DigitalCardPublicSource
  advisor: AdvisorProfilePublicSource
  advisorIsActive: boolean
}): IdentitySurfacePublicDto | null {
  const { card, advisor, advisorIsActive } = input

  if (card.deletedAt) return null
  if (card.status !== 'published') return null
  if (!advisorIsActive) return null

  const overrides = asRecord(card.publishProfile)
  const displayName =
    readTrimmedString(overrides.displayName, 120) ??
    readTrimmedString(advisor.displayName, 120)
  if (!displayName) return null

  const phoneVisible = readBoolean(overrides.phoneVisible, true)
  const emailVisible = readBoolean(overrides.emailVisible, true)
  const phone = phoneVisible
    ? overrideString(overrides.phone, advisor.phone, 40)
    : null
  const email = emailVisible
    ? overrideString(overrides.email, advisor.email, 254)
    : null

  const calendlyUrl = normalizePublicHref(
    overrideString(overrides.calendlyUrl, advisor.calendlyUrl, MAX_SAFE_TEXT),
  )
  const headshotUrl =
    normalizePublicHref(
      overrideString(overrides.headshotUrl, advisor.photoUrl, MAX_SAFE_TEXT),
    ) ?? normalizePublicHref(advisor.photoUrl)
  const website = normalizePublicHref(overrides.website)
  const themeKey =
    readTrimmedString(overrides.themeKey, 64) ??
    readTrimmedString(card.themeKey, 64) ??
    'default'

  const ctas = normalizePublicCtaItems(card.ctaConfig, calendlyUrl)

  const dto: IdentitySurfacePublicDto = {
    publicKey: card.publicKey,
    slug: card.slug,
    kind: V1_IDENTITY_SURFACE_KIND,
    displayName,
    approvedTitle: resolvePublicDesignation(overrides.approvedTitle),
    approvedCompany: resolvePublicCompany(overrides.approvedCompany),
    headline: readTrimmedString(overrides.headline, 200),
    bio: overrideString(overrides.bio, advisor.bio, 2000),
    headshotUrl,
    phone,
    email,
    website,
    socialLinks: normalizeSocialLinks(overrides.socialLinks),
    specialties: normalizeSpecialties(overrides.specialties),
    calendlyUrl,
    themeKey,
    ctas,
    primaryConnectLabel: LETS_CONNECT_CTA_LABEL,
    cardUrl: buildPublicCardPath(card.publicKey),
  }

  assertAllowlistedDto(dto)
  return dto
}

function assertAllowlistedDto(dto: IdentitySurfacePublicDto): void {
  const record = dto as unknown as Record<string, unknown>
  for (const key of INTERNAL_RESPONSE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      throw new Error(`public DTO must not include internal field: ${key}`)
    }
  }
  if (dto.primaryConnectLabel !== LETS_CONNECT_CTA_LABEL) {
    throw new Error('primaryConnectLabel must be exactly Let\'s Connect')
  }
  if (dto.ctas.some((item) => item.key === 'credit_assessment' && item.enabled)) {
    throw new Error('credit_assessment CTA must remain disabled in public DTO')
  }
}

/** Test helper: ensure a response object has no internal UUID-shaped fields. */
export function responseContainsInternalIds(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const json = JSON.stringify(value)
  if (INTERNAL_RESPONSE_KEYS.some((key) => json.includes(`"${key}"`))) return true
  // UUID v4-ish — public keys are not UUID format; reject UUID property values.
  return /"(id|advisorProfileId|advisorId|userId|householdId)"\s*:\s*"[0-9a-f-]{36}"/i.test(
    json,
  )
}
