/**
 * Slug normalization for Digital Identity human URLs.
 * Matches advisor_profiles slug charset: lowercase kebab-case.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeIdentitySlug(input: string): string | null {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')

  if (!normalized || !SLUG_PATTERN.test(normalized)) return null
  if (normalized.length > 64) return null
  return normalized
}

export function isValidIdentitySlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && value.length > 0 && value.length <= 64
}

/**
 * Opaque public keys are URL-safe base32/hex-like tokens (not UUIDs required).
 * Validation only — generation happens in a future migration/API phase.
 */
export function isValidIdentityPublicKey(value: string): boolean {
  return /^[a-zA-Z0-9_-]{16,64}$/.test(value)
}
