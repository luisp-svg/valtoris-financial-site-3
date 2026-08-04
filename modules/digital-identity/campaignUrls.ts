/**
 * Pure URL helpers for Digital Identity campaign / event attribution links.
 * Public destinations always use /c/k/{publicKey} — never slug, never campaign UUID.
 */

import { buildAbsolutePublicCardUrl } from './vcard'
import { buildPublicCardPath } from './urls'
import type { IdentitySourceChannel } from './types'

const CODE_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
const MAX_UTM = 200
const ALLOWED_SRC = new Set<IdentitySourceChannel>([
  'link',
  'qr',
  'nfc',
  'share',
  'unknown',
])

export type CampaignAttributionQuery = {
  campaignCode?: string | null
  eventCode?: string | null
  sourceChannel?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmTerm?: string | null
  utmContent?: string | null
}

export type NormalizedCampaignAttribution = {
  campaignCode: string | null
  eventCode: string | null
  sourceChannel: IdentitySourceChannel | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function normalizeCode(value: unknown): string | null {
  const clipped = clip(value, 64)
  if (!clipped || !CODE_RE.test(clipped)) return null
  return clipped
}

function normalizeSourceChannel(value: unknown): IdentitySourceChannel | null {
  const clipped = clip(value, 32)?.toLowerCase()
  if (!clipped) return null
  if (!ALLOWED_SRC.has(clipped as IdentitySourceChannel)) return null
  return clipped as IdentitySourceChannel
}

/** Normalize and allowlist attribution query fields. */
export function normalizeCampaignAttributionQuery(
  input: CampaignAttributionQuery | URLSearchParams | Record<string, string | null | undefined>,
): NormalizedCampaignAttribution {
  const read = (key: string, alt?: string): unknown => {
    if (input instanceof URLSearchParams) {
      return input.get(key) ?? (alt ? input.get(alt) : null)
    }
    const record = input as Record<string, unknown>
    return record[key] ?? (alt ? record[alt] : null)
  }

  return {
    campaignCode: normalizeCode(read('campaignCode', 'c')),
    eventCode: normalizeCode(read('eventCode', 'e')),
    sourceChannel: normalizeSourceChannel(read('sourceChannel', 'src')),
    utmSource: clip(read('utmSource', 'utm_source'), MAX_UTM),
    utmMedium: clip(read('utmMedium', 'utm_medium'), MAX_UTM),
    utmCampaign: clip(read('utmCampaign', 'utm_campaign'), MAX_UTM),
    utmTerm: clip(read('utmTerm', 'utm_term'), MAX_UTM),
    utmContent: clip(read('utmContent', 'utm_content'), MAX_UTM),
  }
}

/** Parse attribution from a location search string or URLSearchParams. */
export function parseCampaignAttributionFromSearch(
  search: string | URLSearchParams,
): NormalizedCampaignAttribution {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search
  return normalizeCampaignAttributionQuery(params)
}

/** Build allowlisted query string; omits empty values. Never includes campaign UUID. */
export function buildCampaignAttributionSearchParams(
  attribution: CampaignAttributionQuery,
): URLSearchParams {
  const normalized = normalizeCampaignAttributionQuery(attribution)
  const params = new URLSearchParams()
  if (normalized.campaignCode) params.set('c', normalized.campaignCode)
  if (normalized.eventCode) params.set('e', normalized.eventCode)
  if (normalized.sourceChannel) params.set('src', normalized.sourceChannel)
  if (normalized.utmSource) params.set('utm_source', normalized.utmSource)
  if (normalized.utmMedium) params.set('utm_medium', normalized.utmMedium)
  if (normalized.utmCampaign) params.set('utm_campaign', normalized.utmCampaign)
  if (normalized.utmTerm) params.set('utm_term', normalized.utmTerm)
  if (normalized.utmContent) params.set('utm_content', normalized.utmContent)
  return params
}

export function buildPublicCardPathWithAttribution(
  publicKey: string,
  attribution: CampaignAttributionQuery = {},
): string {
  const base = buildPublicCardPath(publicKey.trim())
  const params = buildCampaignAttributionSearchParams(attribution)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function buildDefaultCardLink(publicKey: string): string {
  return buildPublicCardPathWithAttribution(publicKey)
}

export function buildCampaignLink(
  publicKey: string,
  campaignCode: string,
  extras: Omit<CampaignAttributionQuery, 'campaignCode'> = {},
): string {
  return buildPublicCardPathWithAttribution(publicKey, {
    ...extras,
    campaignCode,
    sourceChannel: extras.sourceChannel ?? 'link',
  })
}

export function buildEventLink(
  publicKey: string,
  campaignCode: string,
  eventCode: string,
  extras: Omit<CampaignAttributionQuery, 'campaignCode' | 'eventCode'> = {},
): string {
  return buildPublicCardPathWithAttribution(publicKey, {
    ...extras,
    campaignCode,
    eventCode,
    sourceChannel: extras.sourceChannel ?? 'link',
  })
}

export function buildShareLink(
  publicKey: string,
  attribution: CampaignAttributionQuery = {},
): string {
  return buildPublicCardPathWithAttribution(publicKey, {
    ...attribution,
    sourceChannel: attribution.sourceChannel ?? 'share',
  })
}

/** QR destination path — public_key only, src defaults to qr. */
export function buildCampaignQrDestinationPath(
  publicKey: string,
  attribution: CampaignAttributionQuery = {},
): string {
  return buildPublicCardPathWithAttribution(publicKey, {
    ...attribution,
    sourceChannel: attribution.sourceChannel ?? 'qr',
  })
}

export function buildCampaignQrDestinationUrl(
  origin: string,
  publicKey: string,
  attribution: CampaignAttributionQuery = {},
): string | null {
  const path = buildCampaignQrDestinationPath(publicKey, attribution)
  if (!path.startsWith('/c/k/')) return null
  return buildAbsolutePublicCardUrl(origin, path)
}

/** Referrer host only — never full URL with path/query. */
export function extractReferrerHost(referrer: string | null | undefined): string | null {
  if (!referrer || typeof referrer !== 'string') return null
  const trimmed = referrer.trim()
  if (!trimmed) return null
  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`)
    const host = url.hostname.toLowerCase()
    return host.slice(0, 253) || null
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').split(/[/?#]/)[0]?.slice(0, 253) || null
  }
}
