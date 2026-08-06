import { describe, expect, it } from 'vitest'
import {
  contactIdentityFingerprint,
  emptyContactFormValues,
  formatPhoneForDisplay,
  isSafeWebsite,
  validateContactForm,
} from './validation'

describe('isSafeWebsite', () => {
  it('allows http/https only', () => {
    expect(isSafeWebsite('https://example.com')).toBe(true)
    expect(isSafeWebsite('http://example.com/path')).toBe(true)
    expect(isSafeWebsite('javascript:alert(1)')).toBe(false)
    expect(isSafeWebsite('ftp://example.com')).toBe(false)
    expect(isSafeWebsite('example.com')).toBe(false)
    expect(isSafeWebsite('')).toBe(true)
  })
})

describe('formatPhoneForDisplay', () => {
  it('formats US numbers without claiming server authority', () => {
    expect(formatPhoneForDisplay('5551234567')).toBe('(555) 123-4567')
    expect(formatPhoneForDisplay('15551234567')).toBe('+1 (555) 123-4567')
  })
})

describe('validateContactForm', () => {
  it('requires first, last, and email or phone', () => {
    const errors = validateContactForm(emptyContactFormValues())
    expect(errors.first_name).toBeTruthy()
    expect(errors.last_name).toBeTruthy()
    expect(errors.email).toBeTruthy()
    expect(errors.phone).toBeTruthy()
  })

  it('enforces website and consent evidence when enabled', () => {
    const values = {
      ...emptyContactFormValues(),
      first_name: 'A',
      last_name: 'B',
      email: 'a@b.com',
      website: 'not-a-url',
      consentEnabled: true,
      contactPermission: true,
      privacyAcknowledged: true,
      evidenceDescription: '',
    }
    const errors = validateContactForm(values)
    expect(errors.website).toMatch(/http/)
    expect(errors.consent).toMatch(/evidence|Describe/i)
  })

  it('default consent off needs no evidence', () => {
    const values = {
      ...emptyContactFormValues(),
      first_name: 'A',
      last_name: 'B',
      email: 'a@b.com',
    }
    expect(validateContactForm(values)).toEqual({})
  })
})

describe('contactIdentityFingerprint', () => {
  it('changes when identity fields change (token invalidation contract)', () => {
    const a = {
      ...emptyContactFormValues(),
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'a@x.com',
    }
    const b = { ...a, email: 'b@x.com' }
    expect(contactIdentityFingerprint(a)).not.toBe(contactIdentityFingerprint(b))
  })
})
