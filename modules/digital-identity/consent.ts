/**
 * Digital Identity consent contract — digital-identity-consent-v1.
 * Pure normalization/validation only. No persistence or network I/O.
 */

import { DIGITAL_IDENTITY_CONSENT_VERSION } from './constants.js'
import type {
  DigitalIdentityConsentSnapshot,
  DigitalIdentityConsentState,
} from './types.js'

export const INITIAL_DIGITAL_IDENTITY_CONSENT_STATE: DigitalIdentityConsentState = {
  privacyAcknowledged: false,
  contactPermission: false,
  emailMarketingConsent: false,
  smsMarketingConsent: false,
}

/**
 * Empty snapshot — every optional flag false; timestamps/version null.
 * Consent is never inferred from email/phone presence.
 */
export function emptyDigitalIdentityConsentSnapshot(): DigitalIdentityConsentSnapshot {
  return {
    ...INITIAL_DIGITAL_IDENTITY_CONSENT_STATE,
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
 * Normalizes untrusted consent input. Only literal `true` counts.
 * Malformed input degrades field-by-field to false/null.
 */
export function normalizeDigitalIdentityConsentSnapshot(
  input: unknown,
): DigitalIdentityConsentSnapshot {
  const base = emptyDigitalIdentityConsentSnapshot()
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return base
  }

  const record = input as Record<string, unknown>
  const version = readNullableTrimmedString(record.consentVersion, 64)

  return {
    privacyAcknowledged: readStrictBoolean(record.privacyAcknowledged),
    contactPermission: readStrictBoolean(record.contactPermission),
    emailMarketingConsent: readStrictBoolean(record.emailMarketingConsent),
    smsMarketingConsent: readStrictBoolean(record.smsMarketingConsent),
    // Unknown versions are dropped — callers must use build* for authoritative version.
    consentVersion: version === DIGITAL_IDENTITY_CONSENT_VERSION ? version : null,
    consentedAt: readNullableTrimmedString(record.consentedAt, 64),
  }
}

export function hasRequiredDigitalIdentityConsent(
  consent: DigitalIdentityConsentState,
): boolean {
  return consent.privacyAcknowledged === true
}

export type DigitalIdentityConsentValidation = {
  ok: boolean
  missing: Array<'privacyAcknowledged'>
}

export function validateRequiredDigitalIdentityConsent(
  consent: DigitalIdentityConsentState,
): DigitalIdentityConsentValidation {
  const missing: DigitalIdentityConsentValidation['missing'] = []
  if (consent.privacyAcknowledged !== true) missing.push('privacyAcknowledged')
  return { ok: missing.length === 0, missing }
}

/**
 * Builds a storable snapshot after form submission intent.
 * - consentedAt set only when required privacy acknowledgment is satisfied
 * - SMS marketing forced false when phone is absent
 * - preferred follow-up method is NOT accepted as consent (not on this type)
 * - viewing / vCard / opening Let’s Connect are not represented here
 */
export function buildDigitalIdentityConsentSnapshot(input: {
  consent: DigitalIdentityConsentState
  phone: string
  nowIso?: string
  consentVersion?: string
}): DigitalIdentityConsentSnapshot {
  const phonePresent = input.phone.trim().length > 0
  const requiredOk = hasRequiredDigitalIdentityConsent(input.consent)

  return {
    privacyAcknowledged: input.consent.privacyAcknowledged === true,
    contactPermission: input.consent.contactPermission === true,
    emailMarketingConsent: input.consent.emailMarketingConsent === true,
    smsMarketingConsent: phonePresent && input.consent.smsMarketingConsent === true,
    consentVersion: DIGITAL_IDENTITY_CONSENT_VERSION,
    consentedAt: requiredOk ? (input.nowIso ?? new Date().toISOString()) : null,
  }
}

/** When phone is cleared, SMS marketing consent must reset to false. */
export function applyPhoneChangeToDigitalIdentityConsent(
  consent: DigitalIdentityConsentState,
  phone: string,
): DigitalIdentityConsentState {
  if (phone.trim().length > 0) return consent
  if (!consent.smsMarketingConsent) return consent
  return { ...consent, smsMarketingConsent: false }
}
