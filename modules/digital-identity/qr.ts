/**
 * Digital Identity QR Platform contracts — pure helpers only.
 * Actual raster/vector rendering stays server-side (never import qrcode here).
 *
 * QR destinations are allowlisted:
 *   /c/k/{publicKey}  (existing Digital Identity card)
 *   the six Report Card landings with card={publicKey}
 * Never encode slug routes — slugs may change. Never encode arbitrary URLs.
 */

import {
  buildCampaignQrDestinationPath,
  buildCampaignQrDestinationUrl,
  buildReportCardSharePath,
  isReportCardShareType,
  isShareableCardPublicKey,
  REPORT_CARD_SHARE_LANDINGS,
  REPORT_CARD_SHARE_TYPES,
  type CampaignAttributionQuery,
} from './campaignUrls.js'
import { buildAbsolutePublicCardUrl } from './vcard.js'
import { buildPublicCardPath } from './urls.js'

export const PUBLIC_CARD_QR_FORMATS = ['svg', 'png', 'png-hires'] as const

export type PublicCardQrFormat = (typeof PUBLIC_CARD_QR_FORMATS)[number]

/** Future format — typed for forward compatibility; not served yet. */
export type PublicCardQrFormatFuture = 'pdf'

export type PublicCardQrRenderSpec = {
  format: PublicCardQrFormat
  contentType: string
  extension: 'svg' | 'png'
  /** Pixel width for raster formats; null for SVG. */
  width: number | null
  errorCorrectionLevel: 'H'
  /** Quiet-zone modules (standard quiet zone included). */
  margin: number
  color: {
    dark: '#000000'
    light: '#ffffff'
  }
}

const FORMAT_SET = new Set<string>(PUBLIC_CARD_QR_FORMATS)

/**
 * Parse API format query. Defaults to svg when empty.
 * Rejects unknown values (including pdf until implemented).
 */
export function parsePublicCardQrFormat(value: unknown): PublicCardQrFormat | null {
  if (value == null || value === '') return 'svg'
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!FORMAT_SET.has(normalized)) return null
  return normalized as PublicCardQrFormat
}

/** Durable path only — never builds `/c/{slug}`. Optional campaign attribution query. */
export function buildQrDestinationPath(
  publicKey: string,
  attribution: CampaignAttributionQuery = {},
): string {
  const hasAttribution = Boolean(
    attribution.campaignCode ||
      attribution.eventCode ||
      attribution.sourceChannel ||
      attribution.utmSource ||
      attribution.utmMedium ||
      attribution.utmCampaign ||
      attribution.utmTerm ||
      attribution.utmContent,
  )
  if (hasAttribution) {
    return buildCampaignQrDestinationPath(publicKey, attribution)
  }
  return buildPublicCardPath(publicKey.trim())
}

/**
 * Absolute QR destination URL from request origin + public key.
 * Refuses slug-based paths. Optional campaign/event codes allowed as query only.
 */
export function buildQrDestinationUrl(
  origin: string,
  publicKey: string,
  attribution: CampaignAttributionQuery = {},
): string | null {
  const hasAttribution = Boolean(
    attribution.campaignCode ||
      attribution.eventCode ||
      attribution.sourceChannel ||
      attribution.utmSource ||
      attribution.utmMedium ||
      attribution.utmCampaign ||
      attribution.utmTerm ||
      attribution.utmContent,
  )
  if (hasAttribution) {
    return buildCampaignQrDestinationUrl(origin, publicKey, attribution)
  }
  const path = buildQrDestinationPath(publicKey)
  if (!path.startsWith('/c/k/')) return null
  if (path.includes('/c/') && !path.startsWith('/c/k/')) return null
  return buildAbsolutePublicCardUrl(origin, path)
}

export function getQrRenderSpec(format: PublicCardQrFormat): PublicCardQrRenderSpec {
  const base = {
    errorCorrectionLevel: 'H' as const,
    margin: 4,
    color: {
      dark: '#000000' as const,
      light: '#ffffff' as const,
    },
  }

  switch (format) {
    case 'svg':
      return {
        ...base,
        format: 'svg',
        contentType: 'image/svg+xml; charset=utf-8',
        extension: 'svg',
        width: null,
      }
    case 'png':
      return {
        ...base,
        format: 'png',
        contentType: 'image/png',
        extension: 'png',
        width: 512,
      }
    case 'png-hires':
      return {
        ...base,
        format: 'png-hires',
        contentType: 'image/png',
        extension: 'png',
        width: 2048,
      }
  }
}

/**
 * Safe download filename.
 * Example: "Luis Perez" + svg → "Luis-Perez-QR.svg"
 */
export function sanitizeQrFilename(
  displayName: string,
  format: PublicCardQrFormat,
): string {
  const base = displayName
    .normalize('NFKD')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 72)
  const safe = base.length > 0 ? base : 'advisor'
  const extension = getQrRenderSpec(format).extension
  const suffix = format === 'png-hires' ? 'QR-Print' : 'QR'
  return `${safe}-${suffix}.${extension}`
}

/**
 * Future-ready PDF hook — placeholder only (Phase 6).
 * Not exposed by the download API yet.
 */
export function buildQrPdfPlaceholder(): {
  status: 'not_implemented'
  format: 'pdf'
  message: 'PDF QR export is not available yet.'
} {
  return {
    status: 'not_implemented',
    format: 'pdf',
    message: 'PDF QR export is not available yet.',
  }
}

/** Assert destination never uses a slug route (query string allowed on /c/k/...). */
export function isKeyBasedQrDestination(urlOrPath: string): boolean {
  try {
    if (urlOrPath.startsWith('/')) {
      const pathOnly = urlOrPath.split(/[?#]/)[0] || ''
      return /^\/c\/k\/[^/]+$/.test(pathOnly)
    }
    const parsed = new URL(urlOrPath)
    return /^\/c\/k\/[^/]+$/.test(parsed.pathname)
  } catch {
    return false
  }
}

const ALLOWED_QR_QUERY_KEYS = new Set([
  'card',
  'c',
  'e',
  'src',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
])

function parseDestination(urlOrPath: string): URL | null {
  try {
    if (urlOrPath.startsWith('/') && !urlOrPath.startsWith('//')) {
      return new URL(urlOrPath, 'https://valtoris.local')
    }
    return new URL(urlOrPath)
  } catch {
    return null
  }
}

function reportCardTypeForLanding(pathname: string): string | null {
  for (const type of REPORT_CARD_SHARE_TYPES) {
    if (REPORT_CARD_SHARE_LANDINGS[type] === pathname) return type
  }
  return null
}

/**
 * Strict QR destination allowlist. Existing /c/k/{publicKey} stays valid.
 * Report Card destinations must be one of the six landings with card={publicKey}.
 * Arbitrary hosts, assessment/results paths, UUIDs, and extra query keys fail.
 */
export function isAllowedQrDestination(
  urlOrPath: string,
  publicKey: string,
  options: { origin?: string | null } = {},
): boolean {
  if (isKeyBasedQrDestination(urlOrPath)) return true
  if (!isShareableCardPublicKey(publicKey)) return false

  const parsed = parseDestination(urlOrPath)
  if (!parsed) return false
  if (!urlOrPath.startsWith('/') || urlOrPath.startsWith('//')) {
    const trusted = options.origin?.trim()
    if (!trusted) return false
    try {
      if (parsed.origin !== new URL(trusted).origin) return false
    } catch {
      return false
    }
  }

  const type = reportCardTypeForLanding(parsed.pathname)
  if (!type || !isReportCardShareType(type)) return false

  const card = parsed.searchParams.get('card')
  if (card !== publicKey.trim()) return false

  for (const key of parsed.searchParams.keys()) {
    if (!ALLOWED_QR_QUERY_KEYS.has(key)) return false
  }

  const expected = buildReportCardSharePath(publicKey, type, {
    campaignCode: parsed.searchParams.get('c'),
    eventCode: parsed.searchParams.get('e'),
    sourceChannel: parsed.searchParams.get('src'),
    utmSource: parsed.searchParams.get('utm_source'),
    utmMedium: parsed.searchParams.get('utm_medium'),
    utmCampaign: parsed.searchParams.get('utm_campaign'),
    utmTerm: parsed.searchParams.get('utm_term'),
    utmContent: parsed.searchParams.get('utm_content'),
  })
  if (!expected) return false

  const expectedUrl = parseDestination(expected)
  if (!expectedUrl) return false
  if (expectedUrl.pathname !== parsed.pathname) return false
  const expectedKeys = [...expectedUrl.searchParams.keys()].sort()
  const actualKeys = [...parsed.searchParams.keys()].sort()
  if (expectedKeys.join('|') !== actualKeys.join('|')) return false
  return expectedKeys.every((key) => expectedUrl.searchParams.get(key) === parsed.searchParams.get(key))
}

export function buildReportCardShareQrDestinationUrl(
  origin: string,
  publicKey: string,
  reportCardType: unknown,
  attribution: CampaignAttributionQuery = {},
): string | null {
  const path = buildReportCardSharePath(publicKey, reportCardType, attribution)
  if (!path) return null
  const absolute = buildAbsolutePublicCardUrl(origin, path)
  if (!absolute || !isAllowedQrDestination(absolute, publicKey, { origin })) return null
  return absolute
}

export function qrGenerationSideEffects(): {
  writesAnalytics: false
  createsLead: false
  createsHousehold: false
  createsTask: false
  createsActivity: false
  createsCase: false
  tracksCampaign: false
  tracksEvent: false
} {
  return {
    writesAnalytics: false,
    createsLead: false,
    createsHousehold: false,
    createsTask: false,
    createsActivity: false,
    createsCase: false,
    tracksCampaign: false,
    tracksEvent: false,
  }
}
