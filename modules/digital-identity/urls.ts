/**
 * Safe URL normalization for public Digital Identity DTOs.
 */

const MAX_URL_LENGTH = 500

/**
 * Accepts https URLs or site-relative paths starting with a single `/`.
 * Rejects javascript:, data:, http:, protocol-relative, and other schemes.
 */
export function normalizePublicHref(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    if (trimmed.includes('\\') || trimmed.includes('\0')) return null
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

/** Durable public card path used by future /c pages (not a live route in this phase). */
export function buildPublicCardPath(publicKey: string): string {
  return `/c/k/${publicKey}`
}
