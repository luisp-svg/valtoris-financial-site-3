/**
 * Family Report Card consent contract (browser).
 * Server remains authoritative for normalization.
 */

export const FAMILY_CONSENT_VERSION = 'family-report-card-consent-v1'

export type FamilyConsentState = {
  assessmentStorageAcknowledged: boolean
  contactPermission: boolean
  emailMarketingConsent: boolean
  smsMarketingConsent: boolean
  privacyAcknowledged: boolean
}

export type FamilyConsentSnapshot = FamilyConsentState & {
  consentVersion: string
  consentedAt: string | null
}

export const INITIAL_FAMILY_CONSENT_STATE: FamilyConsentState = {
  assessmentStorageAcknowledged: false,
  contactPermission: false,
  emailMarketingConsent: false,
  smsMarketingConsent: false,
  privacyAcknowledged: false,
}

export type FamilyConsentField = keyof FamilyConsentState

export function hasRequiredFamilyConsent(consent: FamilyConsentState): boolean {
  return consent.assessmentStorageAcknowledged === true && consent.privacyAcknowledged === true
}

export type FamilyConsentValidation = {
  ok: boolean
  missing: Array<'assessmentStorageAcknowledged' | 'privacyAcknowledged'>
}

export function validateRequiredFamilyConsent(consent: FamilyConsentState): FamilyConsentValidation {
  const missing: FamilyConsentValidation['missing'] = []
  if (!consent.assessmentStorageAcknowledged) missing.push('assessmentStorageAcknowledged')
  if (!consent.privacyAcknowledged) missing.push('privacyAcknowledged')
  return { ok: missing.length === 0, missing }
}

/**
 * Builds the API consent snapshot. Optional marketing/contact flags stay false
 * unless explicitly checked. SMS is forced false when no phone is present.
 */
export function buildFamilyConsentSnapshot(input: {
  consent: FamilyConsentState
  phone: string
  nowIso?: string
  consentVersion?: string
}): FamilyConsentSnapshot {
  const phonePresent = input.phone.trim().length > 0
  const requiredOk = hasRequiredFamilyConsent(input.consent)
  return {
    assessmentStorageAcknowledged: input.consent.assessmentStorageAcknowledged === true,
    contactPermission: input.consent.contactPermission === true,
    emailMarketingConsent: input.consent.emailMarketingConsent === true,
    smsMarketingConsent: phonePresent && input.consent.smsMarketingConsent === true,
    privacyAcknowledged: input.consent.privacyAcknowledged === true,
    consentVersion: input.consentVersion ?? FAMILY_CONSENT_VERSION,
    consentedAt: requiredOk ? (input.nowIso ?? new Date().toISOString()) : null,
  }
}

/** When phone is cleared, SMS marketing consent must reset to false. */
export function applyPhoneChangeToConsent(
  consent: FamilyConsentState,
  phone: string,
): FamilyConsentState {
  if (phone.trim().length > 0) return consent
  if (!consent.smsMarketingConsent) return consent
  return { ...consent, smsMarketingConsent: false }
}
