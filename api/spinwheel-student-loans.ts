import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  connectStudentLoanUser,
  SpinwheelRequestError,
  verifyAndFetchStudentLoans,
} from '../server/spinwheel/studentLoan.js'

const MAX_BODY_BYTES = 2_000
const attempts = new Map<string, { count: number; resetAt: number }>()

function applyPrivateHeaders(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

function sameOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  if (typeof origin !== 'string' || typeof host !== 'string') return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function clientIp(req: VercelRequest): string {
  const value = req.headers['x-forwarded-for']
  if (typeof value === 'string') return value.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (attempts.size > 2_000) {
    for (const [storedKey, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(storedKey)
    }
    if (attempts.size > 2_000) attempts.clear()
  }
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === allowed.length && allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function validPhone(value: unknown): value is string {
  return typeof value === 'string' && /^\+1[2-9]\d{9}$/.test(value)
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed <= new Date()
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && parsed <= Date.now() + 60_000 && parsed >= Date.now() - 86_400_000
}

function sendError(res: VercelResponse, status: number, code: string, message: string, retryable = false) {
  return res.status(status).json({ ok: false, error: { code, message, retryable } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyPrivateHeaders(res)
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.')
  }
  if (!sameOrigin(req)) return sendError(res, 403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.')
  const contentType = req.headers['content-type']
  if (typeof contentType !== 'string' || !contentType.toLowerCase().includes('application/json')) {
    return sendError(res, 400, 'INVALID_CONTENT_TYPE', 'Content-Type must be application/json.')
  }
  let size = 0
  try {
    size = JSON.stringify(req.body ?? null).length
  } catch {
    return sendError(res, 400, 'INVALID_BODY', 'Request body must be valid JSON.')
  }
  if (size > MAX_BODY_BYTES) return sendError(res, 413, 'BODY_TOO_LARGE', 'Request body is too large.')
  if (!isObject(req.body) || typeof req.body.action !== 'string') {
    return sendError(res, 400, 'INVALID_BODY', 'Request body is invalid.')
  }

  const ipKey = hash(clientIp(req))
  if (!allow(`ip:${ipKey}`, 20, 10 * 60_000)) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.', true)
  }

  try {
    if (req.body.action === 'connect') {
      if (!exactKeys(req.body, ['action', 'phoneNumber', 'dateOfBirth', 'consentTimestamp'])) {
        return sendError(res, 400, 'INVALID_BODY', 'Connection request is invalid.')
      }
      if (!validPhone(req.body.phoneNumber)) {
        return sendError(res, 400, 'INVALID_PHONE', 'Enter a valid U.S. mobile number.')
      }
      if (!validDate(req.body.dateOfBirth)) {
        return sendError(res, 400, 'INVALID_DATE', 'Enter a valid date of birth.')
      }
      if (!validTimestamp(req.body.consentTimestamp)) {
        return sendError(res, 400, 'INVALID_CONSENT', 'Please review and accept the authorization again.')
      }
      const phoneKey = hash(req.body.phoneNumber)
      if (!allow(`phone:${phoneKey}`, 3, 10 * 60_000)) {
        return sendError(res, 429, 'RATE_LIMITED', 'Too many codes requested. Please wait before trying again.', true)
      }
      const data = await connectStudentLoanUser({
        phoneNumber: req.body.phoneNumber,
        dateOfBirth: req.body.dateOfBirth,
        consentTimestamp: req.body.consentTimestamp,
      })
      return res.status(201).json({ ok: true, action: 'connect', data })
    }

    if (req.body.action === 'verify') {
      if (!exactKeys(req.body, ['action', 'userId', 'code'])) {
        return sendError(res, 400, 'INVALID_BODY', 'Verification request is invalid.')
      }
      if (typeof req.body.userId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(req.body.userId)) {
        return sendError(res, 400, 'INVALID_USER', 'Start a new secure connection.')
      }
      if (typeof req.body.code !== 'string' || !/^\d{6}$/.test(req.body.code)) {
        return sendError(res, 400, 'INVALID_CODE', 'Enter the 6-digit verification code.')
      }
      const data = await verifyAndFetchStudentLoans({ userId: req.body.userId, code: req.body.code })
      return res.status(200).json({ ok: true, action: 'verify', data })
    }

    return sendError(res, 400, 'INVALID_ACTION', 'Request action is invalid.')
  } catch (error) {
    if (error instanceof SpinwheelRequestError) {
      const normalized = error.normalized
      const status = normalized.httpStatus >= 400 && normalized.httpStatus < 600
        ? normalized.httpStatus
        : 502
      return sendError(res, status, normalized.code, normalized.message, normalized.retryable)
    }
    return sendError(res, 503, 'SPINWHEEL_UNAVAILABLE', 'Secure loan connection is temporarily unavailable.', true)
  }
}
