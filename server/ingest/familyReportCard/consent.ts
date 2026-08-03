import type { ConsentSnapshot } from './types'

/**
 * Every consent flag defaults to `false` and every timestamp/version defaults
 * to `null`. Consent must always be explicit — never inferred from the
 * presence of contact fields like email/phone.
 */
export function emptyConsentSnapshot(): ConsentSnapshot {
  return {
    assessmentStorageAcknowledged: false,
    contactPermission: false,
    emailMarketingConsent: false,
    smsMarketingConsent: false,
    privacyAcknowledged: false,
    consentVersion: null,
    consentedAt: null,
  }
}

function readStrictBoolean(value: unknown): boolean {
  return value === true
}

function readNullableTrimmedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

/**
 * Normalizes an arbitrary (untrusted) consent payload into a safe snapshot.
 * Never throws — unrecognized/malformed input degrades to `emptyConsentSnapshot()`
 * on a per-field basis so a single bad key cannot silently promote another
 * field to `true`.
 */
export function normalizeConsentSnapshot(input: unknown): ConsentSnapshot {
  const base = emptyConsentSnapshot()

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return base
  }

  const record = input as Record<string, unknown>

  return {
    assessmentStorageAcknowledged: readStrictBoolean(record.assessmentStorageAcknowledged),
    contactPermission: readStrictBoolean(record.contactPermission),
    emailMarketingConsent: readStrictBoolean(record.emailMarketingConsent),
    smsMarketingConsent: readStrictBoolean(record.smsMarketingConsent),
    privacyAcknowledged: readStrictBoolean(record.privacyAcknowledged),
    consentVersion: readNullableTrimmedString(record.consentVersion, 64),
    consentedAt: readNullableTrimmedString(record.consentedAt, 64),
  }
}
