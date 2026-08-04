import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildAbsolutePublicCardUrl,
  buildVCardFromPublicDto,
} from '../../../modules/digital-identity/index.js'
import {
  lookupPublishedCard,
  type PublicCardLookupResult,
} from '../../../server/digitalIdentity/index.js'

/**
 * GET /api/digital-identity/card/vcard?key=...
 * GET /api/digital-identity/card/vcard?slug=...
 *
 * Smart vCard download for published digital cards.
 * - Reuses server public lookup (no DTO assembly duplication)
 * - Service-role stays server-only
 * - Download-only: no analytics / lead / CRM side effects
 */

type LookupFn = (
  query: { key: string } | { slug: string },
) => Promise<PublicCardLookupResult>

export type DigitalIdentityVCardHandlerDeps = {
  lookup?: LookupFn
}

function resolveSameOriginAllowedOrigin(req: VercelRequest): string | null {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || !origin) return null

  const host = req.headers.host
  if (typeof host !== 'string' || !host) return null

  try {
    const originHost = new URL(origin).host
    return originHost === host ? origin : null
  } catch {
    return null
  }
}

function applyCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const allowedOrigin = resolveSameOriginAllowedOrigin(req)
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function applySafeCacheHeaders(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Pragma', 'no-cache')
}

function readQueryParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

function readHeader(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

/**
 * Build a public origin for absolute card URLs in the vCard.
 * Prefer forwarded proto on Vercel; default to https.
 */
export function resolveRequestOrigin(req: VercelRequest): string | null {
  const host = readHeader(req.headers.host).trim()
  if (!host) return null

  const forwarded = readHeader(req.headers['x-forwarded-proto']).split(',')[0]?.trim()
  const protocol = forwarded === 'http' ? 'http' : 'https'
  return `${protocol}://${host}`
}

function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}

export async function handleDigitalIdentityVCardRequest(
  req: VercelRequest,
  res: VercelResponse,
  deps: DigitalIdentityVCardHandlerDeps = {},
): Promise<VercelResponse> {
  applyCorsHeaders(req, res)
  applySafeCacheHeaders(res)

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ ok: false, code: 'method_not_allowed' })
  }

  const key = readQueryParam(req.query.key).trim()
  const slug = readQueryParam(req.query.slug).trim()
  const lookup = deps.lookup ?? lookupPublishedCard

  let result: PublicCardLookupResult
  try {
    if (key && slug) {
      result = { status: 'invalid_request', reason: 'both_key_and_slug' }
    } else if (key) {
      result = await lookup({ key })
    } else if (slug) {
      result = await lookup({ slug })
    } else {
      result = { status: 'invalid_request', reason: 'missing_lookup_identifier' }
    }
  } catch {
    result = { status: 'server_error' }
  }

  if (result.status === 'invalid_request') {
    return res.status(400).json({ ok: false, code: 'invalid_request' })
  }

  if (result.status === 'server_error') {
    return res.status(500).json({ ok: false, code: 'server_error' })
  }

  if (result.status !== 'found') {
    return res.status(404).json({ ok: false, code: 'unavailable' })
  }

  const origin = resolveRequestOrigin(req)
  if (!origin) {
    return res.status(500).json({ ok: false, code: 'server_error' })
  }

  const absoluteCardUrl = buildAbsolutePublicCardUrl(origin, result.card.cardUrl)
  if (!absoluteCardUrl) {
    return res.status(500).json({ ok: false, code: 'server_error' })
  }

  try {
    const vcard = buildVCardFromPublicDto(result.card, {
      absoluteCardUrl,
      origin,
    })

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
    res.setHeader('Content-Disposition', contentDisposition(vcard.filename))
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(200).send(vcard.body)
  } catch {
    return res.status(500).json({ ok: false, code: 'server_error' })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleDigitalIdentityVCardRequest(req, res)
}
