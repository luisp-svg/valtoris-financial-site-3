export type SignedCentsParseFailure = 'blank' | 'invalid'

export type SignedCentsParseResult =
  | { ok: true; cents: number }
  | { ok: false; reason: SignedCentsParseFailure }

const MAGNITUDE_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/

/**
 * Parse a signed dollar amount into integer cents without floating-point math.
 * Accepts optional $ and thousands commas. Does not infer sign from parentheses
 * beyond a leading minus.
 */
export function parseSignedDollarCents(raw: string): SignedCentsParseResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'blank' }
  let normalized = trimmed.replace(/,/g, '').trim()
  if (normalized.startsWith('$')) normalized = normalized.slice(1).trim()
  else if (normalized.endsWith('$')) normalized = normalized.slice(0, -1).trim()
  if (normalized.startsWith('$')) normalized = normalized.slice(1).trim()
  if (!normalized) return { ok: false, reason: 'blank' }

  let negative = false
  if (normalized.startsWith('-')) {
    negative = true
    normalized = normalized.slice(1).trim()
    if (normalized.startsWith('$')) normalized = normalized.slice(1).trim()
  } else if (normalized.startsWith('+')) {
    normalized = normalized.slice(1).trim()
    if (normalized.startsWith('$')) normalized = normalized.slice(1).trim()
  }
  if (!normalized) return { ok: false, reason: 'blank' }

  const match = normalized.match(MAGNITUDE_PATTERN)
  if (!match) return { ok: false, reason: 'invalid' }
  const dollars = Number.parseInt(match[1], 10)
  const frac = (match[2] ?? '').padEnd(2, '0')
  const magnitude = dollars * 100 + Number.parseInt(frac || '0', 10)
  if (!Number.isSafeInteger(magnitude) || magnitude < 0) return { ok: false, reason: 'invalid' }
  const cents = negative ? -magnitude : magnitude
  if (!Number.isSafeInteger(cents)) return { ok: false, reason: 'invalid' }
  return { ok: true, cents }
}

export type RateParseResult =
  | { ok: true; value: number | null }
  | { ok: false; reason: 'invalid' }

/**
 * Preserve source rate facts. Strips a trailing % but does not convert percent
 * to a posting amount or reapply it to Income.
 */
export function parseSourceRate(raw: string): RateParseResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  const stripped = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed
  if (!stripped) return { ok: true, value: null }
  if (!/^-?\d+(?:\.\d+)?$/.test(stripped)) return { ok: false, reason: 'invalid' }
  const value = Number(stripped)
  if (!Number.isFinite(value)) return { ok: false, reason: 'invalid' }
  return { ok: true, value }
}

export type BoolParseResult =
  | { ok: true; value: boolean }
  | { ok: false; reason: 'invalid' }

export function parseChargebackVisual(raw: string): BoolParseResult {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return { ok: true, value: false }
  if (trimmed === 'true' || trimmed === 'yes' || trimmed === '1') return { ok: true, value: true }
  if (trimmed === 'false' || trimmed === 'no' || trimmed === '0') return { ok: true, value: false }
  return { ok: false, reason: 'invalid' }
}

export type DateParseResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: 'invalid' }

export function parseImportDate(raw: string): DateParseResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { ok: false, reason: 'invalid' }
  const [year, month, day] = trimmed.split('-').map((part) => Number.parseInt(part, 10))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, value: trimmed }
}

export function parseOptionalPage(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (!/^\d+$/.test(trimmed)) return { ok: false }
  const value = Number.parseInt(trimmed, 10)
  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false }
  return { ok: true, value }
}

export function parseOrdinal(raw: string): { ok: true; value: number } | { ok: false; reason: 'blank' | 'invalid' } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'blank' }
  if (!/^\d+$/.test(trimmed)) return { ok: false, reason: 'invalid' }
  const value = Number.parseInt(trimmed, 10)
  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false, reason: 'invalid' }
  return { ok: true, value }
}
