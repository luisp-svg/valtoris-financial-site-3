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

const PUBLIC_KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const PUBLIC_KEY_PREFIX = 'pk_'
const PUBLIC_KEY_RANDOM_LEN = 20

/**
 * Opaque public keys are URL-safe tokens (not UUIDs).
 * Generated in application code — no database default / migration required.
 */
export function isValidIdentityPublicKey(value: string): boolean {
  return /^[a-zA-Z0-9_-]{16,64}$/.test(value)
}

function randomPublicKeyBody(length: number): string {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += PUBLIC_KEY_ALPHABET[bytes[i]! % PUBLIC_KEY_ALPHABET.length]
  }
  return out
}

/**
 * Durable QR/NFC public key. Stable for the life of the card row.
 * Format: pk_ + 20 URL-safe alphanumerics (23 chars, within 16–64).
 */
export function generateIdentityPublicKey(): string {
  const key = `${PUBLIC_KEY_PREFIX}${randomPublicKeyBody(PUBLIC_KEY_RANDOM_LEN)}`
  if (!isValidIdentityPublicKey(key)) {
    throw new Error('Failed to generate a valid identity public key')
  }
  return key
}
