import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit } from '../../server/ingest/familyReportCard/abuse.js'
import {
  ingestDigitalIdentityConnect,
  type DigitalIdentityConnectResult,
} from '../../server/ingest/digitalIdentity/index.js'

/**
 * POST /api/digital-identity/connect
 *
 * Public Let's Connect → CRM ingest endpoint. Validates, resolves the published
 * card server-side, matches identity, and persists via service-role RPC.
 * Follow-up task automation is best-effort and never blocks a successful CRM response.
 */

const MAX_BODY_BYTES = 100_000

const VALIDATION_ERROR_CODES = new Set([
  'invalid_body',
  'unknown_field',
  'trusted_id_forbidden',
  'bot_suspected',
  'submission_too_fast',
  'invalid_form_started_at',
  'invalid_form_submitted_at',
  'invalid_submission_id',
  'card_reference_required',
  'invalid_name',
  'contact_required',
  'invalid_email',
  'invalid_phone',
  'invalid_source_page',
  'invalid_utm',
  'invalid_referrer',
  'invalid_source_channel',
  'invalid_consent',
  'unserializable_body',
  'card_not_found',
  'invalid_card_reference',
])

export type DigitalIdentityConnectHandlerDeps = {
  ingest?: (body: unknown) => Promise<DigitalIdentityConnectResult>
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
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim()
  }

  return req.socket?.remoteAddress ?? 'unknown'
}

/** Extracts submissionId only if it is a plain string — never logs full request bodies. */
function safeSubmissionIdForLogging(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const value = (body as Record<string, unknown>).submissionId
  return typeof value === 'string' && value.length <= 64 ? value : null
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export async function handleDigitalIdentityConnectRequest(
  req: VercelRequest,
  res: VercelResponse,
  deps: DigitalIdentityConnectHandlerDeps = {},
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
    return res.status(400).json({ ok: false, error: 'Content-Type must be application/json' })
  }

  const contentLengthHeader = req.headers['content-length']
  const contentLength =
    typeof contentLengthHeader === 'string' ? Number.parseInt(contentLengthHeader, 10) : NaN
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: 'Request body is too large' })
  }

  const body = req.body

  let approxBodySize = 0
  try {
    approxBodySize = JSON.stringify(body ?? null).length
  } catch {
    return res.status(400).json({ ok: false, error: 'Request body must be valid JSON' })
  }
  if (approxBodySize > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: 'Request body is too large' })
  }

  const clientIp = extractClientIp(req)
  const rateLimitFn = deps.checkRateLimit ?? checkRateLimit
  const rateLimit = rateLimitFn(clientIp)
  if (!rateLimit.allowed) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' })
  }

  const ingestFn = deps.ingest ?? ingestDigitalIdentityConnect

  try {
    const result = await ingestFn(body)

    if (!result.ok) {
      console.error('digital-identity connect ingest failed', {
        submissionId: safeSubmissionIdForLogging(body),
        code: result.code,
      })

      if (result.code === 'payload_too_large') {
        return res.status(413).json({ ok: false, error: 'Request body is too large' })
      }
      if (VALIDATION_ERROR_CODES.has(result.code)) {
        return res.status(400).json({ ok: false, error: result.error, code: result.code })
      }
      return res.status(500).json({ ok: false, error: 'Unable to save submission' })
    }

    const statusCode = result.created ? 201 : 200
    return res.status(statusCode).json(result)
  } catch {
    console.error('digital-identity connect ingest threw unexpectedly', {
      submissionId: safeSubmissionIdForLogging(body),
      code: 'unhandled_exception',
    })
    return res.status(500).json({ ok: false, error: 'Unable to save submission' })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleDigitalIdentityConnectRequest(req, res)
}
