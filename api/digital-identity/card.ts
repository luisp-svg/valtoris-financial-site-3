import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  lookupPublishedCard,
  type PublicCardLookupResult,
} from '../../server/digitalIdentity'

/**
 * GET /api/digital-identity/card?key=...
 * GET /api/digital-identity/card?slug=...
 *
 * Controlled public read for published digital cards.
 * - No anon table SELECT
 * - Service-role lookup server-side only
 * - Allowlisted DTO only
 * - No analytics / lead / CRM side effects
 */

type LookupFn = (
  query: { key: string } | { slug: string },
) => Promise<PublicCardLookupResult>

export type DigitalIdentityCardHandlerDeps = {
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
  // Publish/disable can change; avoid serving stale private/draft cards.
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Pragma', 'no-cache')
}

function readQueryParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

export async function handleDigitalIdentityCardRequest(
  req: VercelRequest,
  res: VercelResponse,
  deps: DigitalIdentityCardHandlerDeps = {},
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

  if (result.status === 'found') {
    return res.status(200).json({ ok: true, card: result.card })
  }

  if (result.status === 'invalid_request') {
    return res.status(400).json({ ok: false, code: 'invalid_request' })
  }

  if (result.status === 'server_error') {
    return res.status(500).json({ ok: false, code: 'server_error' })
  }

  // unavailable: missing, draft, disabled, deleted, inactive advisor — identical response
  return res.status(404).json({ ok: false, code: 'unavailable' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleDigitalIdentityCardRequest(req, res)
}
