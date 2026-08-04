import { describe, expect, it } from 'vitest'
import {
  DIGITAL_IDENTITY_CONSENT_VERSION,
  INITIAL_DIGITAL_IDENTITY_CONSENT_STATE,
  applyPhoneChangeToDigitalIdentityConsent,
  buildDigitalIdentityConsentSnapshot,
  emptyDigitalIdentityConsentSnapshot,
  hasRequiredDigitalIdentityConsent,
  normalizeDigitalIdentityConsentSnapshot,
  validateRequiredDigitalIdentityConsent,
} from './index'

describe('digital-identity consent defaults', () => {
  it('defaults every optional flag to false', () => {
    expect(INITIAL_DIGITAL_IDENTITY_CONSENT_STATE).toEqual({
      privacyAcknowledged: false,
      contactPermission: false,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
    })
    expect(emptyDigitalIdentityConsentSnapshot()).toEqual({
      privacyAcknowledged: false,
      contactPermission: false,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      consentVersion: null,
      consentedAt: null,
    })
  })
})

describe('normalizeDigitalIdentityConsentSnapshot', () => {
  it('never infers contact or marketing permission from email/phone fields', () => {
    const result = normalizeDigitalIdentityConsentSnapshot({
      email: 'a@example.com',
      phone: '5551112222',
      preferredFollowUpMethod: 'phone',
    })
    expect(result.contactPermission).toBe(false)
    expect(result.emailMarketingConsent).toBe(false)
    expect(result.smsMarketingConsent).toBe(false)
    expect(result.privacyAcknowledged).toBe(false)
  })

  it('treats only literal true as consent', () => {
    const result = normalizeDigitalIdentityConsentSnapshot({
      privacyAcknowledged: 'true',
      contactPermission: 1,
      emailMarketingConsent: 'yes',
    })
    expect(result.privacyAcknowledged).toBe(false)
    expect(result.contactPermission).toBe(false)
    expect(result.emailMarketingConsent).toBe(false)
  })
})

describe('buildDigitalIdentityConsentSnapshot', () => {
  it('sets consentedAt only when privacy acknowledgment is satisfied', () => {
    const denied = buildDigitalIdentityConsentSnapshot({
      consent: INITIAL_DIGITAL_IDENTITY_CONSENT_STATE,
      phone: '5551112222',
      nowIso: '2026-08-03T12:00:00.000Z',
    })
    expect(denied.consentedAt).toBeNull()
    expect(denied.consentVersion).toBe(DIGITAL_IDENTITY_CONSENT_VERSION)

    const ok = buildDigitalIdentityConsentSnapshot({
      consent: { ...INITIAL_DIGITAL_IDENTITY_CONSENT_STATE, privacyAcknowledged: true },
      phone: '5551112222',
      nowIso: '2026-08-03T12:00:00.000Z',
    })
    expect(ok.consentedAt).toBe('2026-08-03T12:00:00.000Z')
    expect(hasRequiredDigitalIdentityConsent(ok)).toBe(true)
    expect(validateRequiredDigitalIdentityConsent(ok).ok).toBe(true)
  })

  it('forces SMS marketing false when phone is missing', () => {
    const result = buildDigitalIdentityConsentSnapshot({
      consent: {
        privacyAcknowledged: true,
        contactPermission: true,
        emailMarketingConsent: false,
        smsMarketingConsent: true,
      },
      phone: '   ',
      nowIso: '2026-08-03T12:00:00.000Z',
    })
    expect(result.smsMarketingConsent).toBe(false)
  })

  it('clears SMS consent when phone is removed', () => {
    const next = applyPhoneChangeToDigitalIdentityConsent(
      {
        privacyAcknowledged: true,
        contactPermission: true,
        emailMarketingConsent: false,
        smsMarketingConsent: true,
      },
      '',
    )
    expect(next.smsMarketingConsent).toBe(false)
  })
})
