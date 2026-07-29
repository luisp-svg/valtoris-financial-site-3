import { describe, expect, it } from 'vitest'
import {
  centsOrZeroForTotal,
  formatCentsCurrency,
  formatCentsForInput,
  parseMoneyToCents,
  parseNonNegativePercent,
  sumKnownCents,
} from './onboardingMoney'

describe('onboardingMoney', () => {
  it('parses en-US money text into integer cents', () => {
    expect(parseMoneyToCents('1,234.56')).toEqual({ cents: 123456, error: null })
    expect(parseMoneyToCents('0')).toEqual({ cents: 0, error: null })
    expect(parseMoneyToCents('')).toEqual({ cents: null, error: null })
  })

  it('rejects negative amounts without coercing to zero', () => {
    expect(parseMoneyToCents('-10')).toEqual({
      cents: null,
      error: 'Amount cannot be negative.',
    })
  })

  it('formats cents for input and currency display', () => {
    expect(formatCentsForInput(null)).toBe('')
    expect(formatCentsForInput(0)).toBe('0')
    expect(formatCentsForInput(123456)).toBe('1,234.56')
    expect(formatCentsCurrency(250)).toBe('$2.50')
    expect(formatCentsCurrency(null)).toBe('—')
  })

  it('sums known cents and treats blank as zero only for display totals', () => {
    expect(sumKnownCents([100, null, 0, 50])).toBe(150)
    expect(centsOrZeroForTotal(null)).toBe(0)
    expect(centsOrZeroForTotal(0)).toBe(0)
  })

  it('parses percentage points and rejects invalid rates', () => {
    expect(parseNonNegativePercent('4.5')).toEqual({ percent: 4.5, error: null })
    expect(parseNonNegativePercent('-1')).toEqual({
      percent: null,
      error: 'Rate cannot be negative.',
    })
    expect(parseNonNegativePercent('150').error).toBeTruthy()
  })
})
