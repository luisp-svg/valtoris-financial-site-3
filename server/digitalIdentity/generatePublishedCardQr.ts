/**
 * SERVER ONLY — generate QR assets for published digital cards.
 * Never import from browser/Vite client code.
 *
 * Destination is always /c/k/{publicKey} (never slug).
 * No analytics / campaign / CRM side effects.
 */

import QRCode from 'qrcode'
import {
  buildQrDestinationUrl,
  getQrRenderSpec,
  isKeyBasedQrDestination,
  parsePublicCardQrFormat,
  sanitizeQrFilename,
  type PublicCardQrFormat,
} from '../../modules/digital-identity'
import { isValidIdentityPublicKey } from '../../modules/digital-identity'
import {
  lookupPublishedCardByPublicKey,
  type LookupPublishedCardDeps,
} from './lookupPublishedCard'
import type { PublicCardLookupResult } from './types'

export type GeneratePublishedCardQrQuery = {
  key: string
  format?: string | null
  /** Required to absolutize the QR destination URL. */
  origin: string
}

export type GeneratePublishedCardQrSuccess = {
  status: 'found'
  format: PublicCardQrFormat
  contentType: string
  filename: string
  destinationUrl: string
  /** SVG string or PNG Buffer. */
  body: string | Buffer
}

export type GeneratePublishedCardQrResult =
  | GeneratePublishedCardQrSuccess
  | { status: 'invalid_request'; reason: string }
  | { status: 'unavailable' }
  | { status: 'server_error' }

export type QrCodeRenderer = {
  toString: (
    text: string,
    options: QRCode.QRCodeToStringOptions,
  ) => Promise<string>
  toBuffer: (
    text: string,
    options: QRCode.QRCodeToBufferOptions,
  ) => Promise<Buffer>
}

export type GeneratePublishedCardQrDeps = LookupPublishedCardDeps & {
  lookupByKey?: (
    publicKey: string,
    deps?: LookupPublishedCardDeps,
  ) => Promise<PublicCardLookupResult>
  qrcode?: QrCodeRenderer
}

export async function generatePublishedCardQr(
  query: GeneratePublishedCardQrQuery,
  deps: GeneratePublishedCardQrDeps = {},
): Promise<GeneratePublishedCardQrResult> {
  const key = typeof query.key === 'string' ? query.key.trim() : ''
  if (!key || !isValidIdentityPublicKey(key)) {
    return { status: 'invalid_request', reason: 'invalid_public_key' }
  }

  const format = parsePublicCardQrFormat(query.format)
  if (!format) {
    return { status: 'invalid_request', reason: 'invalid_format' }
  }

  const origin = query.origin.trim()
  if (!origin) {
    return { status: 'invalid_request', reason: 'missing_origin' }
  }

  const destinationUrl = buildQrDestinationUrl(origin, key)
  if (!destinationUrl || !isKeyBasedQrDestination(destinationUrl)) {
    return { status: 'invalid_request', reason: 'invalid_destination' }
  }

  // Defense: never encode a slug path even if helpers regress.
  if (destinationUrl.includes('/c/') && !destinationUrl.includes('/c/k/')) {
    return { status: 'server_error' }
  }

  const lookupByKey = deps.lookupByKey ?? lookupPublishedCardByPublicKey
  let lookup: PublicCardLookupResult
  try {
    lookup = await lookupByKey(key, { admin: deps.admin })
  } catch {
    return { status: 'server_error' }
  }

  if (lookup.status === 'invalid_request') {
    return { status: 'invalid_request', reason: lookup.reason ?? 'invalid_public_key' }
  }
  if (lookup.status === 'server_error') return { status: 'server_error' }
  if (lookup.status !== 'found') return { status: 'unavailable' }

  // Prefer durable key from the published card record (not request echo alone).
  const canonicalUrl = buildQrDestinationUrl(origin, lookup.card.publicKey)
  if (!canonicalUrl || !isKeyBasedQrDestination(canonicalUrl)) {
    return { status: 'server_error' }
  }

  const spec = getQrRenderSpec(format)
  const filename = sanitizeQrFilename(lookup.card.displayName, format)
  const renderer = deps.qrcode ?? QRCode

  try {
    if (format === 'svg') {
      const body = await renderer.toString(canonicalUrl, {
        type: 'svg',
        errorCorrectionLevel: spec.errorCorrectionLevel,
        margin: spec.margin,
        color: {
          dark: spec.color.dark,
          light: spec.color.light,
        },
      })
      if (!body.includes('<svg')) return { status: 'server_error' }
      return {
        status: 'found',
        format,
        contentType: spec.contentType,
        filename,
        destinationUrl: canonicalUrl,
        body,
      }
    }

    const body = await renderer.toBuffer(canonicalUrl, {
      type: 'png',
      errorCorrectionLevel: spec.errorCorrectionLevel,
      margin: spec.margin,
      width: spec.width ?? 512,
      color: {
        dark: spec.color.dark,
        light: spec.color.light,
      },
    })

    if (!Buffer.isBuffer(body) || body.length < 32) {
      return { status: 'server_error' }
    }

    return {
      status: 'found',
      format,
      contentType: spec.contentType,
      filename,
      destinationUrl: canonicalUrl,
      body,
    }
  } catch {
    return { status: 'server_error' }
  }
}

export function publishedCardQrSideEffects(): {
  writesAnalytics: false
  createsLead: false
  createsHousehold: false
  tracksCampaign: false
  tracksEvent: false
} {
  return {
    writesAnalytics: false,
    createsLead: false,
    createsHousehold: false,
    tracksCampaign: false,
    tracksEvent: false,
  }
}
