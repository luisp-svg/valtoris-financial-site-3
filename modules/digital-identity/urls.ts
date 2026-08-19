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

/**
 * Booking and social links must be absolute https.
 * Rejects site-relative paths plus javascript:, data:, http:, and //.
 */
export function normalizePublicHttpsUrl(value: unknown): string | null {
  const href = normalizePublicHref(value)
  if (!href || !href.startsWith('https://')) return null
  return href
}

/** Durable public card path (canonical address for QR/NFC). */
export function buildPublicCardPath(publicKey: string): string {
  return `/c/k/${publicKey}`
}

/** Human-readable public card path by slug. */
export function buildPublicCardSlugPath(slug: string): string {
  return `/c/${slug}`
}
