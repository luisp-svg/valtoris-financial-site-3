import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  generatePublishedCardQr,
  type GeneratePublishedCardQrResult,
} from '../../../server/digitalIdentity/generatePublishedCardQr'

/**
 * GET /api/digital-identity/card/qr?key=...&format=svg|png|png-hires
 *
 * QR Platform download for published digital cards.
 * - Destination always /c/k/{publicKey} (never slug)
 * - Service-role lookup server-side only
 * - No analytics / campaign / CRM side effects
 */

type GenerateFn = (input: {
  key: string
  format?: string | null
  origin: string
  campaignCode?: string | null
  eventCode?: string | null
}) => Promise<GeneratePublishedCardQrResult>

export type DigitalIdentityQrHandlerDeps = {
  generate?: GenerateFn
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

export async function handleDigitalIdentityQrRequest(
  req: VercelRequest,
  res: VercelResponse,
  deps: DigitalIdentityQrHandlerDeps = {},
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
  const format = readQueryParam(req.query.format).trim()
  const campaignCode = readQueryParam(req.query.c || req.query.campaignCode).trim()
  const eventCode = readQueryParam(req.query.e || req.query.eventCode).trim()

  // QR Platform is key-only — slug addressing is rejected (slugs may change).
  if (slug) {
    return res.status(400).json({ ok: false, code: 'invalid_request' })
  }
  if (!key) {
    return res.status(400).json({ ok: false, code: 'invalid_request' })
  }

  const origin = resolveRequestOrigin(req)
  if (!origin) {
    return res.status(500).json({ ok: false, code: 'server_error' })
  }

  const generate = deps.generate ?? ((input) => generatePublishedCardQr(input))

  let result: GeneratePublishedCardQrResult
  try {
    result = await generate({
      key,
      format: format || undefined,
      origin,
      campaignCode: campaignCode || null,
      eventCode: eventCode || null,
    })
  } catch {
    result = { status: 'server_error' }
  }

  if (result.status === 'invalid_request') {
    return res.status(400).json({ ok: false, code: 'invalid_request' })
  }
  if (result.status === 'unavailable') {
    return res.status(404).json({ ok: false, code: 'unavailable' })
  }
  if (result.status !== 'found') {
    return res.status(500).json({ ok: false, code: 'server_error' })
  }

  res.setHeader('Content-Type', result.contentType)
  res.setHeader('Content-Disposition', contentDisposition(result.filename))
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Valtoris-QR-Destination', result.destinationUrl)
  return res.status(200).send(result.body)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleDigitalIdentityQrRequest(req, res)
}
