import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit } from '../../server/ingest/familyReportCard/abuse.js'
import {
  uploadRelationshipPhoto,
  type UploadRelationshipPhotoResult,
} from '../../server/ingest/digitalIdentity/index.js'

/**
 * POST /api/digital-identity/relationship-photo
 *
 * Optional Relationship Photo after successful Let's Connect.
 * Lead must already exist; failures never undo CRM capture.
 */

const MAX_BODY_BYTES = 7_500_000

export type RelationshipPhotoHandlerDeps = {
  upload?: (input: {
    uploadToken: string
    photoAcknowledgment: boolean
    image: Buffer
    source?: string | null
  }) => Promise<UploadRelationshipPhotoResult>
  checkRateLimit?: typeof checkRateLimit
}

function extractClientIp(req: VercelRequest): string {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].trim()
  }
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function resolveSameOriginAllowedOrigin(req: VercelRequest): string | null {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || !origin) return null
  const host = req.headers.host
  if (typeof host !== 'string' || !host) return null
  try {
    return new URL(origin).host === host ? origin : null
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function decodeBase64Image(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  const dataUrl = trimmed.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i)
  const raw = dataUrl ? dataUrl[2] : trimmed
  try {
    const buf = Buffer.from(raw, 'base64')
    return buf.length > 0 ? buf : null
  } catch {
    return null
  }
}

function parseJsonBody(body: unknown): {
  uploadToken: string
  photoAcknowledgment: boolean
  image: Buffer | null
  source: string | null
} | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  return {
    uploadToken: typeof record.uploadToken === 'string' ? record.uploadToken : '',
    photoAcknowledgment: record.photoAcknowledgment === true,
    image: decodeBase64Image(record.imageBase64 ?? record.image),
    source: typeof record.source === 'string' ? record.source : null,
  }
}

export async function handleDigitalIdentityRelationshipPhotoRequest(
  req: VercelRequest,
  res: VercelResponse,
  deps: RelationshipPhotoHandlerDeps = {},
): Promise<VercelResponse> {
  applyCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const contentType = req.headers['content-type']
  if (typeof contentType !== 'string' || !contentType.toLowerCase().includes('application/json')) {
    return res.status(400).json({
      ok: false,
      error: 'Content-Type must be application/json',
      code: 'invalid_content_type',
    })
  }

  const contentLengthHeader = req.headers['content-length']
  const contentLength =
    typeof contentLengthHeader === 'string' ? Number.parseInt(contentLengthHeader, 10) : NaN
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: 'Request body is too large' })
  }

  let approxBodySize = 0
  try {
    approxBodySize = JSON.stringify(req.body ?? null).length
  } catch {
    return res.status(400).json({ ok: false, error: 'Request body must be valid JSON' })
  }
  if (approxBodySize > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: 'Request body is too large' })
  }

  const rateLimitFn = deps.checkRateLimit ?? checkRateLimit
  const rateLimit = rateLimitFn(extractClientIp(req))
  if (!rateLimit.allowed) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' })
  }

  const parsed = parseJsonBody(req.body)
  if (!parsed || !parsed.image) {
    return res.status(400).json({
      ok: false,
      error: 'A photo and upload token are required.',
      code: 'invalid_body',
    })
  }

  const uploadFn = deps.upload ?? uploadRelationshipPhoto

  try {
    const result = await uploadFn({
      uploadToken: parsed.uploadToken,
      photoAcknowledgment: parsed.photoAcknowledgment,
      image: parsed.image,
      source: parsed.source ?? 'digital_identity_connect',
    })

    if (!result.ok) {
      console.error('digital-identity relationship-photo failed', { code: result.code })
      const status =
        result.code === 'too_large'
          ? 413
          : result.code === 'acknowledgment_required' ||
              result.code === 'empty' ||
              result.code === 'unsupported_type' ||
              result.code === 'dimensions_invalid' ||
              result.code === 'invalid_token' ||
              result.code === 'expired' ||
              result.code === 'consumed' ||
              result.code === 'revoked' ||
              result.code === 'invalid_source'
            ? 400
            : 500
      return res.status(status).json({
        ok: false,
        error: result.error,
        code: result.code,
      })
    }

    return res.status(201).json({ ok: true, saved: true })
  } catch {
    console.error('digital-identity relationship-photo threw', { code: 'unhandled_exception' })
    return res.status(500).json({
      ok: false,
      error: 'Unable to save photo. Your connection is still saved.',
      code: 'unhandled_exception',
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleDigitalIdentityRelationshipPhotoRequest(req, res)
}
