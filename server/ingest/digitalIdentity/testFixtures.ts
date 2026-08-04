/** Shared fixtures for Digital Identity / Let's Connect ingest tests. */

export const VALID_SUBMISSION_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
export const VALID_CARD_PUBLIC_KEY = 'pk_test_public_key01'

export function validConnectRequestBodyFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    submissionId: VALID_SUBMISSION_ID,
    cardPublicKey: VALID_CARD_PUBLIC_KEY,
    firstName: 'Alex',
    lastName: 'Rivera',
    email: 'alex.rivera@example.com',
    phone: '5551234567',
    company: 'Acme Co',
    title: 'Founder',
    reasonForConnecting: 'Would like to connect',
    preferredFollowUpMethod: 'email',
    note: 'Met at the event',
    consent: {
      privacyAcknowledged: true,
      contactPermission: true,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
    },
    formStartedAt: '2026-08-03T18:00:00.000Z',
    formSubmittedAt: '2026-08-03T18:00:05.000Z',
    sourcePage: '/c/k/pk_test_public_key01',
    website: '',
    companyUrl: '',
    utmSource: 'qr',
    referrer: 'https://example.com/landing',
    ...overrides,
  }
}

export function matchCandidateFixture(
  overrides: Partial<{
    householdId: string
    displayName: string | null
    normalizedEmail: string | null
    normalizedPhone: string | null
    firstName: string | null
    lastName: string | null
  }> = {},
) {
  return {
    householdId: 'hh-existing-1',
    displayName: 'Alex Rivera',
    normalizedEmail: 'alex.rivera@example.com',
    normalizedPhone: '+15551234567',
    firstName: 'Alex',
    lastName: 'Rivera',
    source: 'member' as const,
    memberId: 'member-1',
    ...overrides,
  }
}

export function resolveCardSuccessFixture(
  overrides: Partial<{
    digitalCardId: string
    advisorProfileId: string
    advisorSlug: string | null
    advisorDisplayName: string | null
    cardPublicKey: string
    cardSlug: string
  }> = {},
) {
  return {
    ok: true as const,
    digitalCardId: '22222222-2222-4222-8222-222222222222',
    advisorProfileId: '11111111-1111-4111-8111-111111111111',
    advisorSlug: 'jane-advisor',
    advisorDisplayName: 'Jane Advisor',
    cardPublicKey: VALID_CARD_PUBLIC_KEY,
    cardSlug: 'jane-advisor',
    ...overrides,
  }
}
