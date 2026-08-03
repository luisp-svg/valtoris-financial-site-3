import { describe, expect, it } from 'vitest'
import { emptyConsentSnapshot, normalizeConsentSnapshot } from './consent'
import { fullConsentSnapshotFixture } from './testFixtures'

describe('emptyConsentSnapshot', () => {
  it('defaults every boolean to false and every timestamp/version to null', () => {
    expect(emptyConsentSnapshot()).toEqual({
      assessmentStorageAcknowledged: false,
      contactPermission: false,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      privacyAcknowledged: false,
      consentVersion: null,
      consentedAt: null,
    })
  })
})

describe('normalizeConsentSnapshot', () => {
  it('returns an empty snapshot for missing/malformed input', () => {
    expect(normalizeConsentSnapshot(undefined)).toEqual(emptyConsentSnapshot())
    expect(normalizeConsentSnapshot(null)).toEqual(emptyConsentSnapshot())
    expect(normalizeConsentSnapshot('yes')).toEqual(emptyConsentSnapshot())
    expect(normalizeConsentSnapshot(42)).toEqual(emptyConsentSnapshot())
    expect(normalizeConsentSnapshot([])).toEqual(emptyConsentSnapshot())
  })

  it('passes through a fully explicit consent snapshot', () => {
    const fixture = fullConsentSnapshotFixture()
    expect(normalizeConsentSnapshot(fixture)).toEqual(fixture)
  })

  it('never infers true from the presence of contact fields', () => {
    const result = normalizeConsentSnapshot({
      email: 'someone@example.com',
      phone: '555-000-1111',
    })
    expect(result.contactPermission).toBe(false)
    expect(result.emailMarketingConsent).toBe(false)
    expect(result.smsMarketingConsent).toBe(false)
  })

  it('treats truthy-but-non-boolean values as false (only literal true counts)', () => {
    const result = normalizeConsentSnapshot({
      assessmentStorageAcknowledged: 'true',
      contactPermission: 1,
      privacyAcknowledged: 'yes',
    })
    expect(result.assessmentStorageAcknowledged).toBe(false)
    expect(result.contactPermission).toBe(false)
    expect(result.privacyAcknowledged).toBe(false)
  })

  it('trims and caps consentVersion/consentedAt length, dropping empty strings to null', () => {
    const result = normalizeConsentSnapshot({
      consentVersion: '  v1  ',
      consentedAt: '   ',
    })
    expect(result.consentVersion).toBe('v1')
    expect(result.consentedAt).toBeNull()
  })

  it('ignores unknown extra keys without throwing', () => {
    const result = normalizeConsentSnapshot({
      privacyAcknowledged: true,
      unexpectedKey: { nested: true },
    })
    expect(result.privacyAcknowledged).toBe(true)
  })
})
