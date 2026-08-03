import { describe, expect, it } from 'vitest'
import {
  applyPhoneChangeToConsent,
  buildFamilyConsentSnapshot,
  FAMILY_CONSENT_VERSION,
  hasRequiredFamilyConsent,
  INITIAL_FAMILY_CONSENT_STATE,
  validateRequiredFamilyConsent,
} from './familyConsent'

describe('family consent helpers', () => {
  it('starts with no boxes checked', () => {
    expect(INITIAL_FAMILY_CONSENT_STATE).toEqual({
      assessmentStorageAcknowledged: false,
      contactPermission: false,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      privacyAcknowledged: false,
    })
  })

  it('requires storage and privacy acknowledgments only', () => {
    expect(hasRequiredFamilyConsent(INITIAL_FAMILY_CONSENT_STATE)).toBe(false)
    expect(
      hasRequiredFamilyConsent({
        ...INITIAL_FAMILY_CONSENT_STATE,
        assessmentStorageAcknowledged: true,
        privacyAcknowledged: true,
      }),
    ).toBe(true)
    expect(
      validateRequiredFamilyConsent({
        ...INITIAL_FAMILY_CONSENT_STATE,
        contactPermission: true,
        emailMarketingConsent: true,
        smsMarketingConsent: true,
      }).missing,
    ).toEqual(['assessmentStorageAcknowledged', 'privacyAcknowledged'])
  })

  it('keeps marketing and contact optional for results', () => {
    const snapshot = buildFamilyConsentSnapshot({
      consent: {
        assessmentStorageAcknowledged: true,
        contactPermission: false,
        emailMarketingConsent: false,
        smsMarketingConsent: false,
        privacyAcknowledged: true,
      },
      phone: '555-111-2222',
      nowIso: '2026-07-28T20:00:00.000Z',
    })
    expect(snapshot.contactPermission).toBe(false)
    expect(snapshot.emailMarketingConsent).toBe(false)
    expect(snapshot.smsMarketingConsent).toBe(false)
    expect(snapshot.consentVersion).toBe(FAMILY_CONSENT_VERSION)
    expect(snapshot.consentedAt).toBe('2026-07-28T20:00:00.000Z')
  })

  it('does not enable SMS consent merely because a phone is present', () => {
    const snapshot = buildFamilyConsentSnapshot({
      consent: {
        ...INITIAL_FAMILY_CONSENT_STATE,
        assessmentStorageAcknowledged: true,
        privacyAcknowledged: true,
        smsMarketingConsent: false,
      },
      phone: '555-111-2222',
      nowIso: '2026-07-28T20:00:00.000Z',
    })
    expect(snapshot.smsMarketingConsent).toBe(false)
  })

  it('forces SMS consent false when phone is missing even if checked', () => {
    const snapshot = buildFamilyConsentSnapshot({
      consent: {
        ...INITIAL_FAMILY_CONSENT_STATE,
        assessmentStorageAcknowledged: true,
        privacyAcknowledged: true,
        smsMarketingConsent: true,
      },
      phone: '   ',
      nowIso: '2026-07-28T20:00:00.000Z',
    })
    expect(snapshot.smsMarketingConsent).toBe(false)
  })

  it('resets SMS consent when phone is removed', () => {
    const withSms = {
      ...INITIAL_FAMILY_CONSENT_STATE,
      smsMarketingConsent: true,
    }
    expect(applyPhoneChangeToConsent(withSms, '').smsMarketingConsent).toBe(false)
    expect(applyPhoneChangeToConsent(withSms, '555-000-1111').smsMarketingConsent).toBe(true)
  })

  it('transmits false values explicitly in the snapshot', () => {
    const snapshot = buildFamilyConsentSnapshot({
      consent: {
        assessmentStorageAcknowledged: true,
        contactPermission: false,
        emailMarketingConsent: false,
        smsMarketingConsent: false,
        privacyAcknowledged: true,
      },
      phone: '555-111-2222',
      nowIso: '2026-07-28T20:00:00.000Z',
    })
    expect(Object.values(snapshot).filter((value) => value === undefined)).toHaveLength(0)
    expect(snapshot.contactPermission).toBe(false)
    expect(snapshot.emailMarketingConsent).toBe(false)
    expect(snapshot.smsMarketingConsent).toBe(false)
  })
})
