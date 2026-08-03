/**
 * Simple per-IP rate limiter for the public Family Report Card ingest endpoint.
 *
 * IMPORTANT — this is per-instance only. Vercel serverless functions can run
 * across many isolated instances/regions with no shared memory, so this is a
 * best-effort abuse deterrent, not a hard global guarantee. For a stronger
 * guarantee, back this with a shared store (e.g. Redis/Upstash) in a later
 * phase.
 *
 * State is kept in a process-local `Map` only — nothing here is persisted to
 * disk or a database, and it is cleared whenever the instance recycles.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 10

type RateLimitEntry = {
  count: number
  windowStart: number
}

// Ephemeral, per-instance only. Raw IPs are kept in memory for this simple
// Phase 2 limiter; they are never written to a database or log sink here.
const requestLog = new Map<string, RateLimitEntry>()

export function checkRateLimit(ip: string, now: number = Date.now()): { allowed: boolean } {
  const key = ip.trim() || 'unknown'
  const existing = requestLog.get(key)

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    requestLog.set(key, { count: 1, windowStart: now })
    return { allowed: true }
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false }
  }

  existing.count += 1
  return { allowed: true }
}

/**
 * Optional truncated, non-reversible fingerprint for safe logging.
 * Not cryptographically secure — only intended to correlate log lines
 * without printing a raw IP address.
 */
export function hashIp(ip: string): string {
  let hash = 0
  for (let i = 0; i < ip.length; i += 1) {
    hash = (hash * 31 + ip.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36).padStart(6, '0').slice(0, 12)
}

/** Test-only helper to reset in-memory state between test cases. */
export function _resetRateLimitStateForTests(): void {
  requestLog.clear()
}
