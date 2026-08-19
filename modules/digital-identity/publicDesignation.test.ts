import { describe, expect, it } from 'vitest'
import { VALTORIS_PUBLIC_COMPANY, VALTORIS_PUBLIC_DESIGNATION } from './constants'
import { resolvePublicCompany, resolvePublicDesignation } from './publicDesignation'

describe('resolvePublicDesignation', () => {
  it('uses Financial Strategist as the generic Valtoris designation', () => {
    expect(VALTORIS_PUBLIC_DESIGNATION).toBe('Financial Strategist')
    expect(resolvePublicDesignation(null)).toBe('Financial Strategist')
    expect(resolvePublicDesignation('')).toBe('Financial Strategist')
    expect(resolvePublicDesignation('Financial Advisor')).toBe('Financial Strategist')
    expect(resolvePublicDesignation(' financial advisor ')).toBe('Financial Strategist')
  })

  it('does not display Financial Advisor as the generic public designation', () => {
    expect(resolvePublicDesignation(undefined)).not.toBe('Financial Advisor')
    expect(resolvePublicDesignation('Financial Advisor')).not.toBe('Financial Advisor')
  })

  it('preserves custom public titles', () => {
    expect(resolvePublicDesignation('Managing Partner')).toBe('Managing Partner')
  })
})

describe('resolvePublicCompany', () => {
  it('defaults to Valtoris Financial', () => {
    expect(resolvePublicCompany(null)).toBe(VALTORIS_PUBLIC_COMPANY)
    expect(resolvePublicCompany('Valtoris Financial')).toBe('Valtoris Financial')
  })
})
