import { describe, expect, it } from 'vitest'
import { isValidMemberDateOfBirth } from './memberDob'

describe('household member date of birth', () => {
  it('accepts a real past date and rejects invalid or future values', () => {
    expect(isValidMemberDateOfBirth('1980-01-15')).toBe(true)
    expect(isValidMemberDateOfBirth('not-a-date')).toBe(false)
    expect(isValidMemberDateOfBirth('2026-02-31')).toBe(false)
    expect(isValidMemberDateOfBirth('2999-01-01')).toBe(false)
  })
})
