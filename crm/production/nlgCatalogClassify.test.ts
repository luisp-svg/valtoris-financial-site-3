import { describe, expect, it } from 'vitest'
import { classifyNlgProductName } from './nlgCatalogClassify'

describe('NLG catalog classification', () => {
  it('keeps LSW term products and Flexlife II', () => {
    expect(classifyNlgProductName('LSW ART & Term 10')).toBe('KEEP')
    expect(classifyNlgProductName('LSW ART & Term 15')).toBe('KEEP')
    expect(classifyNlgProductName('LSW Term 20')).toBe('KEEP')
    expect(classifyNlgProductName('LSW Term 30')).toBe('KEEP')
    expect(classifyNlgProductName('Flexlife II')).toBe('KEEP')
    expect(classifyNlgProductName('IUL Flex II')).toBe('KEEP')
  })

  it('deactivates obsolete term and IUL Flex names without deleting them', () => {
    expect(classifyNlgProductName('Term 15')).toBe('DEACTIVATE')
    expect(classifyNlgProductName('Term 20')).toBe('DEACTIVATE')
    expect(classifyNlgProductName('Term 25')).toBe('DEACTIVATE')
    expect(classifyNlgProductName('Term 30')).toBe('DEACTIVATE')
    expect(classifyNlgProductName('IUL Flex')).toBe('DEACTIVATE')
    expect(classifyNlgProductName('IUL Flex Life')).toBe('DEACTIVATE')
    expect(classifyNlgProductName('IUL - Permanent')).toBe('DEACTIVATE')
  })

  it('reviews unmatched NLG names instead of guessing', () => {
    expect(classifyNlgProductName('IUL')).toBe('REVIEW')
    expect(classifyNlgProductName('Basic Secure')).toBe('REVIEW')
    expect(classifyNlgProductName('RapidProtect')).toBe('REVIEW')
  })
})
