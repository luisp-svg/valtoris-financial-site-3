import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit } from '../server/ingest/familyReportCard/abuse.js'
import { ingestPublicReportCard } from '../server/ingest/familyReportCard/ingestFamilyReportCard.js'

/**
 * POST /api/ingest-family-report-card
 *
 * Unified public Report Card → CRM ingest endpoint (Family URL preserved).
 * Accepts assessmentType family | business | retirement | protection.
 * Family submissions remain compatible. Validates, scores/derives results
 * server-side, and persists via the service-role-only Supabase RPC.
 */

const MAX_BODY_BYTES = 100_000

const VALIDATION_ERROR_CODES = new Set([
  'invalid_body',
  'unknown_field',
  'bot_suspected',
  'submission_too_fast',
  'invalid_form_started_at',
  'invalid_submission_id',
  'invalid_assessment_type',
  'invalid_assessment_version',
  'invalid_answers',
  'invalid_answers_family',
  'invalid_answers_financial',
  'invalid_answers_protection',
  'invalid_answers_goals',
  'invalid_name',
  'incomplete_family_answers',
  'incomplete_financial_answers',
  'incomplete_protection_answers',
  'incomplete_goals_answers',
  'invalid_email',
  'invalid_phone',
  'invalid_source_page',
  'invalid_utm',
  'invalid_referrer',
  'invalid_client_score',
  'invalid_client_grade',
  'invalid_consent',
  'invalid_submitted_at',
  'unserializable_body',
  'invalid_card_reference',
  'trusted_advisor_id_forbidden',
  'invalid_answers_owner',
  'invalid_answers_business',
  'incomplete_business_answers',
  'incomplete_retirement_answers',
])

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  const contentLength = typeof contentLengthHeader === 'string' ? Number.parseInt(contentLengthHeader, 10) : NaN
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
  const rateLimit = checkRateLimit(clientIp)
  if (!rateLimit.allowed) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' })
  }

  try {
    const result = await ingestPublicReportCard(body)

    if (!result.ok) {
      console.error('family-report-card ingest failed', {
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
    console.error('family-report-card ingest threw unexpectedly', {
      submissionId: safeSubmissionIdForLogging(body),
      code: 'unhandled_exception',
    })
    return res.status(500).json({ ok: false, error: 'Unable to save submission' })
  }
}
