import { describe, expect, it } from 'vitest'
import { validConnectRequestBodyFixture } from './testFixtures'
import { validateDigitalIdentityConnectRequest } from './validation'

const NOW_MS = Date.parse('2026-08-03T18:00:05.000Z')

describe('validateDigitalIdentityConnectRequest', () => {
  it('accepts a valid Lets Connect body', () => {
    const result = validateDigitalIdentityConnectRequest(validConnectRequestBodyFixture(), {
      now: () => NOW_MS,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.submissionId).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
      expect(result.value.consentSnapshot.privacyAcknowledged).toBe(true)
      expect(result.value.consentSnapshot.consentVersion).toBe('digital-identity-consent-v1')
      expect(result.value.sourcePage).toBe('/c/k/pk_test_public_key01')
    }
  })

  it('rejects missing privacy consent', () => {
    const result = validateDigitalIdentityConnectRequest(
      validConnectRequestBodyFixture({
        consent: {
          privacyAcknowledged: false,
          contactPermission: true,
          emailMarketingConsent: false,
          smsMarketingConsent: false,
        },
      }),
      { now: () => NOW_MS },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_consent')
  })

  it('rejects honeypot fills', () => {
    const result = validateDigitalIdentityConnectRequest(
      validConnectRequestBodyFixture({ website: 'http://spam.example' }),
      { now: () => NOW_MS },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('bot_suspected')
  })

  it('rejects submissions that are too fast', () => {
    const result = validateDigitalIdentityConnectRequest(
      validConnectRequestBodyFixture({
        formStartedAt: '2026-08-03T18:00:04.000Z',
        formSubmittedAt: '2026-08-03T18:00:05.000Z',
      }),
      { now: () => NOW_MS },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('submission_too_fast')
  })

  it('rejects trusted advisor/household ids from the browser', () => {
    const result = validateDigitalIdentityConnectRequest(
      validConnectRequestBodyFixture({
        advisorProfileId: '11111111-1111-4111-8111-111111111111',
      }),
      { now: () => NOW_MS },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['trusted_id_forbidden', 'unknown_field']).toContain(result.code)
    }
  })

  it('rejects absolute sourcePage URLs', () => {
    const result = validateDigitalIdentityConnectRequest(
      validConnectRequestBodyFixture({ sourcePage: 'https://evil.example/phish' }),
      { now: () => NOW_MS },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_source_page')
  })

  it('rejects invalid email format when email is provided', () => {
    const result = validateDigitalIdentityConnectRequest(
      validConnectRequestBodyFixture({ email: 'not-an-email', phone: '' }),
      { now: () => NOW_MS },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['invalid_email', 'contact_required']).toContain(result.code)
    }
  })

  it('rejects unknown top-level fields', () => {
    const result = validateDigitalIdentityConnectRequest(
      validConnectRequestBodyFixture({ secretToken: 'abc' }),
      { now: () => NOW_MS },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unknown_field')
  })
})
