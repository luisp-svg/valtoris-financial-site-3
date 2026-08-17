export type CommissionMoneyParseFailure = 'blank' | 'zero' | 'invalid'

export type CommissionMoneyParseResult =
  | { ok: true; cents: number }
  | { ok: false; reason: CommissionMoneyParseFailure }

const DOLLAR_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/

/**
 * Parse a positive dollar magnitude into integer cents.
 * Does not use floating-point multiplication.
 */
export function parsePositiveDollarCents(raw: string): CommissionMoneyParseResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'blank' }
  const normalized = trimmed.replace(/^\$/, '').replace(/,/g, '').trim()
  if (!normalized) return { ok: false, reason: 'blank' }
  const match = normalized.match(DOLLAR_PATTERN)
  if (!match) return { ok: false, reason: 'invalid' }
  const dollars = Number.parseInt(match[1], 10)
  const frac = (match[2] ?? '').padEnd(2, '0')
  const cents = dollars * 100 + Number.parseInt(frac || '0', 10)
  if (!Number.isSafeInteger(cents) || cents < 0) return { ok: false, reason: 'invalid' }
  if (cents === 0) return { ok: false, reason: 'zero' }
  return { ok: true, cents }
}

export function centsToDollarInput(cents: number): string {
  const abs = Math.abs(Math.trunc(cents))
  const dollars = Math.trunc(abs / 100)
  const remainder = abs % 100
  return `${dollars}.${String(remainder).padStart(2, '0')}`
}

export type ManualCommissionEventType = 'paid' | 'adjustment' | 'chargeback' | 'recovery'
export type AdjustmentDirection = 'increase' | 'decrease'

export function signedCentsForManualEvent(options: {
  eventType: ManualCommissionEventType
  magnitudeCents: number
  adjustmentDirection?: AdjustmentDirection
}): number | null {
  const magnitude = Math.trunc(options.magnitudeCents)
  if (!Number.isSafeInteger(magnitude) || magnitude <= 0) return null
  if (options.eventType === 'paid' || options.eventType === 'recovery') return magnitude
  if (options.eventType === 'chargeback') return -magnitude
  if (options.eventType === 'adjustment') {
    return options.adjustmentDirection === 'decrease' ? -magnitude : magnitude
  }
  return null
}

export function applySourceSign(magnitudeCents: number, sourceAmountCents: number): number {
  const magnitude = Math.trunc(magnitudeCents)
  return sourceAmountCents < 0 ? -magnitude : magnitude
}
