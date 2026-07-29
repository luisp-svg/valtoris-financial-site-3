/** Integer cents — null means missing/unknown; 0 means explicit zero. */
export type MoneyCents = number | null

const MONEY_DIGIT_RE = /^\d+$/

/** Parse UI money text (digits / commas / optional decimals) into integer cents. */
export function parseMoneyToCents(raw: string | null | undefined): {
  cents: MoneyCents
  error: string | null
} {
  if (raw == null) return { cents: null, error: null }
  const trimmed = raw.trim()
  if (trimmed === '') return { cents: null, error: null }

  const normalized = trimmed.replace(/\$/g, '').replace(/,/g, '').trim()
  if (normalized === '') return { cents: null, error: null }

  if (normalized.startsWith('-')) {
    return { cents: null, error: 'Amount cannot be negative.' }
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized) && !MONEY_DIGIT_RE.test(normalized)) {
    return { cents: null, error: 'Enter a valid dollar amount.' }
  }

  const [whole, fraction = ''] = normalized.split('.')
  const cents =
    Number.parseInt(whole || '0', 10) * 100 +
    Number.parseInt((fraction + '00').slice(0, 2), 10)

  if (!Number.isFinite(cents) || cents < 0) {
    return { cents: null, error: 'Enter a valid dollar amount.' }
  }

  return { cents, error: null }
}

/** Format integer cents for en-US display (no $ prefix). */
export function formatCentsForInput(cents: MoneyCents): string {
  if (cents == null) return ''
  const dollars = Math.floor(cents / 100)
  const rem = Math.abs(cents % 100)
  if (rem === 0) return dollars.toLocaleString('en-US')
  return `${dollars.toLocaleString('en-US')}.${String(rem).padStart(2, '0')}`
}

export function formatCentsCurrency(cents: MoneyCents): string {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

export function sumKnownCents(values: readonly MoneyCents[]): number {
  let total = 0
  for (const value of values) {
    if (value != null) total += value
  }
  return total
}

/** Treat null as 0 for display totals only — does not mutate stored answers. */
export function centsOrZeroForTotal(cents: MoneyCents): number {
  return cents ?? 0
}

export function parseNonNegativePercent(raw: string | null | undefined): {
  percent: number | null
  error: string | null
} {
  if (raw == null) return { percent: null, error: null }
  const trimmed = raw.trim()
  if (trimmed === '') return { percent: null, error: null }
  if (trimmed.startsWith('-')) {
    return { percent: null, error: 'Rate cannot be negative.' }
  }
  const normalized = trimmed.replace(/%/g, '').trim()
  if (!/^\d+(\.\d{1,4})?$/.test(normalized)) {
    return { percent: null, error: 'Enter a valid percentage.' }
  }
  const percent = Number.parseFloat(normalized)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { percent: null, error: 'Enter a percentage between 0 and 100.' }
  }
  return { percent, error: null }
}

export function formatPercentForInput(percent: number | null): string {
  if (percent == null) return ''
  return String(percent)
}

export function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
