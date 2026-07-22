/**
 * Contact normalization aligned with household/lead DB conventions:
 * - normalized_email: lower(trim(email))
 * - normalized_phone: US-first E.164 (+1XXXXXXXXXX) when possible
 */

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null
  return trimmed.toLowerCase()
}

/**
 * Best-effort US-first phone normalization for duplicate matching.
 * Returns null when input is empty after stripping non-digits.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (trimmed.startsWith('+') && digits.length >= 8) return `+${digits}`
  if (digits.length > 11) return `+${digits}`
  return digits
}

/** Lightweight format check for optional email fields (empty is valid). */
export function isValidEmailFormat(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  // Practical CRM validation — not a full RFC parser.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}
