import { describe, expect, it } from 'vitest'
import {
  passwordToggleAriaLabel,
  validateNewPassword,
} from './passwordPolicy'

const STRONG = 'CorrectHorse!9x'

describe('validateNewPassword', () => {
  it('accepts a strong matching password', () => {
    expect(validateNewPassword(STRONG, STRONG)).toEqual({ ok: true })
  })

  it('rejects passwords shorter than 12', () => {
    const result = validateNewPassword('Abcd123!xyz', 'Abcd123!xyz')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toContain('too_short')
      expect(result.message).toMatch(/12/)
    }
  })

  it('rejects missing uppercase', () => {
    const result = validateNewPassword('correcthorse!9', 'correcthorse!9')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues).toContain('missing_uppercase')
  })

  it('rejects missing lowercase', () => {
    const result = validateNewPassword('CORRECTHORSE!9', 'CORRECTHORSE!9')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues).toContain('missing_lowercase')
  })

  it('rejects missing number', () => {
    const result = validateNewPassword('CorrectHorse!!', 'CorrectHorse!!')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues).toContain('missing_number')
  })

  it('rejects missing symbol', () => {
    const result = validateNewPassword('CorrectHorse99', 'CorrectHorse99')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues).toContain('missing_symbol')
  })

  it('rejects mismatched confirmation', () => {
    const result = validateNewPassword(STRONG, `${STRONG}x`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toContain('mismatch')
      expect(result.message).toMatch(/do not match/i)
    }
  })

  it('does not silently trim the submitted password', () => {
    const withSpaces = '  CorrectHorse!9  '
    const result = validateNewPassword(withSpaces, withSpaces)
    // Leading/trailing spaces are part of the value; policy may still pass length/classes.
    expect(result.ok).toBe(true)
    const mismatchedTrim = validateNewPassword(withSpaces, withSpaces.trim())
    expect(mismatchedTrim.ok).toBe(false)
  })
})

describe('passwordToggleAriaLabel', () => {
  it('provides accessible show/hide names for mobile controls', () => {
    expect(passwordToggleAriaLabel('password', false)).toBe('Show new password')
    expect(passwordToggleAriaLabel('password', true)).toBe('Hide new password')
    expect(passwordToggleAriaLabel('confirmation', false)).toBe('Show password confirmation')
    expect(passwordToggleAriaLabel('confirmation', true)).toBe('Hide password confirmation')
  })
})
