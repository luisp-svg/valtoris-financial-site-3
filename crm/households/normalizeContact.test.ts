import { describe, expect, it } from 'vitest'
import { isValidEmailFormat, normalizeEmail, normalizePhone } from './normalizeContact'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com')
  })

  it('returns null for empty input', () => {
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('   ')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('formats 10-digit US numbers as +1E.164', () => {
    expect(normalizePhone('(512) 555-0100')).toBe('+15125550100')
  })

  it('keeps leading 1 eleven-digit numbers as +1…', () => {
    expect(normalizePhone('1-512-555-0100')).toBe('+15125550100')
  })

  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('abc')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe('isValidEmailFormat', () => {
  it('allows empty values', () => {
    expect(isValidEmailFormat('')).toBe(true)
    expect(isValidEmailFormat('  ')).toBe(true)
  })

  it('accepts simple valid emails', () => {
    expect(isValidEmailFormat('ada@example.com')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(isValidEmailFormat('not-an-email')).toBe(false)
    expect(isValidEmailFormat('a@b')).toBe(false)
  })
})
