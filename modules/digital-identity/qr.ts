/**
 * Digital Identity QR Platform contracts — pure helpers only.
 * Actual raster/vector rendering stays server-side (never import qrcode here).
 *
 * QR codes ALWAYS encode the durable public_key route:
 *   /c/k/{publicKey}
 * Never encode slug routes — slugs may change.
 */

import { buildAbsolutePublicCardUrl } from './vcard'
import { buildPublicCardPath } from './urls'

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

/** Durable path only — never builds `/c/{slug}`. */
export function buildQrDestinationPath(publicKey: string): string {
  return buildPublicCardPath(publicKey.trim())
}

/**
 * Absolute QR destination URL from request origin + public key.
 * Refuses slug-based paths.
 */
export function buildQrDestinationUrl(
  origin: string,
  publicKey: string,
): string | null {
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

/** Assert destination never uses a slug route. */
export function isKeyBasedQrDestination(urlOrPath: string): boolean {
  try {
    if (urlOrPath.startsWith('/')) {
      return /^\/c\/k\/[^/]+$/.test(urlOrPath)
    }
    const parsed = new URL(urlOrPath)
    return /^\/c\/k\/[^/]+$/.test(parsed.pathname)
  } catch {
    return false
  }
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
