/**
 * Let’s Connect / relationship submission contracts — pure validation only.
 * Browser must not supply trusted advisor UUIDs.
 */

import { isValidIdentityPublicKey, normalizeIdentitySlug } from './slug'
import type {
  DigitalIdentityConsentState,
  DigitalIdentitySubmissionInput,
  PreferredFollowUpMethod,
} from './types'

const FORBIDDEN_TRUSTED_KEYS = [
  'advisorId',
  'advisorProfileId',
  'advisor_profile_id',
  'originalAdvisorId',
  'assignedAdvisorId',
  'householdId',
  'userId',
  'user_id',
] as const

const FOLLOW_UP_METHODS: readonly PreferredFollowUpMethod[] = [
  'email',
  'phone',
  'either',
  'none',
]

export type SubmissionValidationResult =
  | { ok: true; submission: DigitalIdentitySubmissionInput }
  | { ok: false; reason: string }

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function readTrimmed(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

/**
 * Rejects payloads that attempt to set trusted advisor/household IDs from the browser.
 */
export function rejectsTrustedAdvisorIds(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const record = input as Record<string, unknown>
  return FORBIDDEN_TRUSTED_KEYS.some((key) => {
    const value = record[key]
    return value !== undefined && value !== null && value !== ''
  })
}

/**
 * Normalize/validate an untrusted Let’s Connect payload (no I/O, no CRM writes).
 */
export function validateDigitalIdentitySubmissionInput(
  input: unknown,
): SubmissionValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, reason: 'invalid_payload' }
  }

  if (rejectsTrustedAdvisorIds(input)) {
    return { ok: false, reason: 'trusted_advisor_id_forbidden' }
  }

  const record = input as Record<string, unknown>
  const submissionId = readTrimmed(record.submissionId, 64)
  if (!isUuidV4(submissionId)) {
    return { ok: false, reason: 'invalid_submission_id' }
  }

  const cardPublicKeyRaw = readTrimmed(record.cardPublicKey, 64)
  const cardSlugRaw = readTrimmed(record.cardSlug, 64)
  const cardPublicKey = cardPublicKeyRaw && isValidIdentityPublicKey(cardPublicKeyRaw)
    ? cardPublicKeyRaw
    : undefined
  const cardSlug = cardSlugRaw ? normalizeIdentitySlug(cardSlugRaw) ?? undefined : undefined

  if (!cardPublicKey && !cardSlug) {
    return { ok: false, reason: 'card_reference_required' }
  }

  const firstName = readTrimmed(record.firstName, 80)
  const lastName = readTrimmed(record.lastName, 80)
  if (!firstName || !lastName) {
    return { ok: false, reason: 'name_required' }
  }

  const email = readTrimmed(record.email, 254).toLowerCase()
  const phone = readTrimmed(record.phone, 32)
  if (!email && !phone) {
    return { ok: false, reason: 'email_or_phone_required' }
  }

  const website = typeof record.website === 'string' ? record.website : ''
  const companyUrl = typeof record.companyUrl === 'string' ? record.companyUrl : ''
  if (website.trim() || companyUrl.trim()) {
    return { ok: false, reason: 'honeypot_triggered' }
  }

  const consentRaw = record.consent
  const consent: DigitalIdentityConsentState = {
    privacyAcknowledged:
      !!consentRaw &&
      typeof consentRaw === 'object' &&
      !Array.isArray(consentRaw) &&
      (consentRaw as Record<string, unknown>).privacyAcknowledged === true,
    contactPermission:
      !!consentRaw &&
      typeof consentRaw === 'object' &&
      !Array.isArray(consentRaw) &&
      (consentRaw as Record<string, unknown>).contactPermission === true,
    emailMarketingConsent:
      !!consentRaw &&
      typeof consentRaw === 'object' &&
      !Array.isArray(consentRaw) &&
      (consentRaw as Record<string, unknown>).emailMarketingConsent === true,
    smsMarketingConsent:
      !!consentRaw &&
      typeof consentRaw === 'object' &&
      !Array.isArray(consentRaw) &&
      (consentRaw as Record<string, unknown>).smsMarketingConsent === true,
  }

  const preferredRaw = readTrimmed(record.preferredFollowUpMethod, 16)
  const preferredFollowUpMethod = (FOLLOW_UP_METHODS as readonly string[]).includes(preferredRaw)
    ? (preferredRaw as PreferredFollowUpMethod)
    : null

  // Preferred follow-up is not consent — never promote contactPermission from it.
  return {
    ok: true,
    submission: {
      submissionId,
      cardPublicKey,
      cardSlug,
      campaignCode: readTrimmed(record.campaignCode, 64) || null,
      eventCode: readTrimmed(record.eventCode, 64) || null,
      firstName,
      lastName,
      email,
      phone,
      company: readTrimmed(record.company, 120) || null,
      title: readTrimmed(record.title, 120) || null,
      reasonForConnecting: readTrimmed(record.reasonForConnecting, 280) || null,
      preferredFollowUpMethod,
      note: readTrimmed(record.note, 1000) || null,
      consent,
      formStartedAt: readTrimmed(record.formStartedAt, 64) || null,
      formSubmittedAt: readTrimmed(record.formSubmittedAt, 64) || null,
      website: '',
      companyUrl: '',
      sourceChannel: null,
      utm: null,
    },
  }
}

/** Contact exchange does not create Cases. */
export function contactExchangeCreatesCase(): false {
  return false
}

/** Views/downloads/clicks do not create households — only validated submissions may. */
export function viewOrDownloadCreatesHousehold(): false {
  return false
}
