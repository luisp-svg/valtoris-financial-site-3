import { describe, expect, it } from 'vitest'
import { INITIAL_DIGITAL_IDENTITY_CONSENT_STATE } from '../../modules/digital-identity'
import {
  applyPhoneToLetsConnectConsent,
  buildLetsConnectSubmitBody,
  createEmptyLetsConnectFormValues,
  createLetsConnectSubmissionId,
  defaultLetsConnectConsent,
  isValidLetsConnectReason,
  LETS_CONNECT_FOLLOW_UP_OPTIONS,
  LETS_CONNECT_REASON_OPTIONS,
  letsConnectModalCopy,
  validateLetsConnectFormClient,
} from './letsConnectForm'

describe('letsConnectForm helpers', () => {
  it('exposes the product reason options in order', () => {
    expect(LETS_CONNECT_REASON_OPTIONS).toEqual([
      'Family financial planning',
      'Business planning',
      'Insurance',
      'Credit improvement',
      'Business funding',
      'Networking',
      'Other',
    ])
    expect(isValidLetsConnectReason('Networking')).toBe(true)
    expect(isValidLetsConnectReason('Selfie scan')).toBe(false)
  })

  it('defaults consent with required privacy unchecked and marketing off', () => {
    expect(defaultLetsConnectConsent()).toEqual(INITIAL_DIGITAL_IDENTITY_CONSENT_STATE)
    expect(createEmptyLetsConnectFormValues().consent).toEqual({
      privacyAcknowledged: false,
      contactPermission: false,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
    })
  })

  it('lists preferred follow-up methods separately from consent', () => {
    expect(LETS_CONNECT_FOLLOW_UP_OPTIONS.map((o) => o.value)).toEqual([
      'email',
      'phone',
      'either',
      'none',
    ])
    const copy = letsConnectModalCopy()
    expect(copy.title).toBe("Let's Connect")
    expect(copy.successTitle).toBe("We're connected.")
  })

  it('generates a UUID v4 submission id', () => {
    const id = createLetsConnectSubmissionId(
      () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    )
    expect(id).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  it('requires name, email or phone, and privacy acknowledgment client-side', () => {
    const empty = validateLetsConnectFormClient(createEmptyLetsConnectFormValues())
    expect(empty.ok).toBe(false)
    expect(empty.errors.firstName).toBeTruthy()
    expect(empty.errors.contact).toBeTruthy()
    expect(empty.errors.privacy).toBeTruthy()

    const valid = validateLetsConnectFormClient({
      ...createEmptyLetsConnectFormValues(),
      firstName: 'Jamie',
      lastName: 'Rivera',
      email: 'jamie@example.com',
      consent: {
        ...INITIAL_DIGITAL_IDENTITY_CONSENT_STATE,
        privacyAcknowledged: true,
      },
    })
    expect(valid.ok).toBe(true)
  })

  it('clears SMS marketing consent when phone is removed', () => {
    const cleared = applyPhoneToLetsConnectConsent(
      {
        privacyAcknowledged: true,
        contactPermission: true,
        emailMarketingConsent: false,
        smsMarketingConsent: true,
      },
      '',
    )
    expect(cleared.smsMarketingConsent).toBe(false)
  })

  it('builds a submit body without treating preferred follow-up as consent', () => {
    const body = buildLetsConnectSubmitBody({
      values: {
        ...createEmptyLetsConnectFormValues(),
        firstName: 'Jamie',
        lastName: 'Rivera',
        email: 'jamie@example.com',
        phone: '555-0100',
        company: 'Acme',
        title: 'Owner',
        reasonForConnecting: 'Networking',
        note: 'Met at event',
        preferredFollowUpMethod: 'email',
        consent: {
          privacyAcknowledged: true,
          contactPermission: false,
          emailMarketingConsent: false,
          smsMarketingConsent: false,
        },
      },
      cardPublicKey: 'pk_live_abcdefghijklmnop',
      submissionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      formStartedAt: '2026-08-03T12:00:00.000Z',
      formSubmittedAt: '2026-08-03T12:00:05.000Z',
      sourcePage: '/c/k/pk_live_abcdefghijklmnop',
    })

    expect(body.cardPublicKey).toBe('pk_live_abcdefghijklmnop')
    expect(body.reasonForConnecting).toBe('Networking')
    expect(body.preferredFollowUpMethod).toBe('email')
    expect(body.consent).toEqual({
      privacyAcknowledged: true,
      contactPermission: false,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
    })
    expect(body).not.toHaveProperty('advisorId')
    expect(body).not.toHaveProperty('householdId')
  })
})
