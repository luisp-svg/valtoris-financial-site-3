import {
  isValidEmailFormat,
  normalizePhone,
} from '../../../crm/households/normalizeContact.js'
import {
  buildDigitalIdentityConsentSnapshot,
  rejectsTrustedAdvisorIds,
  validateDigitalIdentitySubmissionInput,
  validateRequiredDigitalIdentityConsent,
  type DigitalIdentitySubmissionInput,
  type IdentitySourceChannel,
} from '../../../modules/digital-identity/index.js'
import type { DigitalIdentityConnectRequest } from './types.js'

export type ValidationOk<T> = { ok: true; value: T }
export type ValidationErr = { ok: false; error: string; code: string }
export type ValidationResult<T> = ValidationOk<T> | ValidationErr

const MAX_JSON_LENGTH = 100_000
const MAX_SOURCE_PAGE_LENGTH = 500
const MAX_UTM_LENGTH = 200
const MAX_REFERRER_LENGTH = 1000
const MIN_FORM_FILL_TIME_MS = 2500

const SOURCE_CHANNELS = new Set<IdentitySourceChannel>([
  'link',
  'qr',
  'nfc',
  'share',
  'unknown',
])

const ALLOWED_TOP_LEVEL_KEYS = new Set<string>([
  'submissionId',
  'cardPublicKey',
  'cardSlug',
  'campaignCode',
  'eventCode',
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
  'title',
  'reasonForConnecting',
  'preferredFollowUpMethod',
  'note',
  'consent',
  'formStartedAt',
  'formSubmittedAt',
  'website',
  'companyUrl',
  'honeypot',
  'sourceChannel',
  'utm',
  'sourcePage',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmTerm',
  'utmContent',
  'referrer',
])

function fail(code: string, error: string): ValidationErr {
  return { ok: false, error, code }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalTrimmedString(
  value: unknown,
  maxLength: number,
): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) return { ok: false }
  return { ok: true, value: trimmed || null }
}

function validateHoneypotField(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string') return false
  return value.trim() === ''
}

/** Relative site paths only — must start with a single `/`, no protocol. */
function isAllowedSourcePage(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false
  if (value.includes('\\') || value.includes('\0')) return false
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false
  return value.length <= MAX_SOURCE_PAGE_LENGTH
}

function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function mapSubmissionReason(reason: string): ValidationErr {
  switch (reason) {
    case 'trusted_advisor_id_forbidden':
      return fail('trusted_id_forbidden', 'Submission rejected.')
    case 'invalid_submission_id':
      return fail('invalid_submission_id', 'submissionId must be a valid UUID.')
    case 'card_reference_required':
      return fail('card_reference_required', 'A valid card reference is required.')
    case 'name_required':
      return fail('invalid_name', 'First and last name are required.')
    case 'email_or_phone_required':
      return fail('contact_required', 'A valid email or phone number is required.')
    case 'honeypot_triggered':
      return fail('bot_suspected', 'Submission rejected.')
    case 'invalid_payload':
    default:
      return fail('invalid_body', 'Request body must be a JSON object.')
  }
}

function readNestedUtm(
  utm: unknown,
): Partial<Record<'utmSource' | 'utmMedium' | 'utmCampaign' | 'utmTerm' | 'utmContent', string | null>> {
  if (!isPlainObject(utm)) return {}
  const read = (key: string): string | null => {
    const value = utm[key]
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed || trimmed.length > MAX_UTM_LENGTH) return null
    return trimmed
  }
  return {
    utmSource: read('utmSource'),
    utmMedium: read('utmMedium'),
    utmCampaign: read('utmCampaign'),
    utmTerm: read('utmTerm'),
    utmContent: read('utmContent'),
  }
}

export type ValidationOptions = {
  /** Current time in ms since epoch. Overridable for deterministic tests. */
  now?: () => number
}

/**
 * Strict, allow-listed validation for the public Let's Connect ingest body.
 * Reuses modules/digital-identity submission + consent helpers; adds abuse
 * checks, contact format, source_page allowlist, and optional attribution.
 */
export function validateDigitalIdentityConnectRequest(
  rawBody: unknown,
  options: ValidationOptions = {},
): ValidationResult<DigitalIdentityConnectRequest> {
  const now = options.now ?? (() => Date.now())

  let approxSize = 0
  try {
    approxSize = JSON.stringify(rawBody ?? null).length
  } catch {
    return fail('unserializable_body', 'Request body could not be serialized.')
  }
  if (approxSize > MAX_JSON_LENGTH) {
    return fail('payload_too_large', 'Request body is too large.')
  }

  if (!isPlainObject(rawBody)) {
    return fail('invalid_body', 'Request body must be a JSON object.')
  }

  if (rejectsTrustedAdvisorIds(rawBody)) {
    return fail('trusted_id_forbidden', 'Submission rejected.')
  }

  for (const key of Object.keys(rawBody)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return fail('unknown_field', `Unrecognized field: ${key}`)
    }
  }

  if (!validateHoneypotField(rawBody.website)) {
    return fail('bot_suspected', 'Submission rejected.')
  }
  if (!validateHoneypotField(rawBody.companyUrl)) {
    return fail('bot_suspected', 'Submission rejected.')
  }
  if (!validateHoneypotField(rawBody.honeypot)) {
    return fail('bot_suspected', 'Submission rejected.')
  }

  const submissionResult = validateDigitalIdentitySubmissionInput(rawBody)
  if (!submissionResult.ok) {
    return mapSubmissionReason(submissionResult.reason)
  }

  const submission: DigitalIdentitySubmissionInput = submissionResult.submission

  const consentCheck = validateRequiredDigitalIdentityConsent(submission.consent)
  if (!consentCheck.ok) {
    return fail('invalid_consent', 'Privacy acknowledgment is required.')
  }

  if (submission.email && !isValidEmailFormat(submission.email)) {
    return fail('invalid_email', 'A valid email address is required.')
  }

  if (submission.phone && normalizePhone(submission.phone) === null) {
    return fail('invalid_phone', 'A valid phone number is required.')
  }

  if (!submission.email && !submission.phone) {
    return fail('contact_required', 'A valid email or phone number is required.')
  }

  const formStartedAt = submission.formStartedAt
  const formSubmittedAt = submission.formSubmittedAt
  const startedMs = parseTimestampMs(formStartedAt)
  const submittedMs = parseTimestampMs(formSubmittedAt) ?? now()

  if (formStartedAt && startedMs === null) {
    return fail('invalid_form_started_at', 'formStartedAt must be a valid ISO timestamp.')
  }
  if (formSubmittedAt && parseTimestampMs(formSubmittedAt) === null) {
    return fail('invalid_form_submitted_at', 'formSubmittedAt must be a valid ISO timestamp.')
  }

  if (startedMs !== null) {
    const elapsed = submittedMs - startedMs
    if (elapsed >= 0 && elapsed < MIN_FORM_FILL_TIME_MS) {
      return fail('submission_too_fast', 'Submission rejected.')
    }
  }

  const sourcePageResult = optionalTrimmedString(rawBody.sourcePage, MAX_SOURCE_PAGE_LENGTH)
  if (!sourcePageResult.ok) return fail('invalid_source_page', 'sourcePage is invalid.')
  if (sourcePageResult.value && !isAllowedSourcePage(sourcePageResult.value)) {
    return fail('invalid_source_page', 'sourcePage must be a relative path.')
  }

  const nestedUtm = readNestedUtm(rawBody.utm)

  const utmSourceResult = optionalTrimmedString(rawBody.utmSource, MAX_UTM_LENGTH)
  if (!utmSourceResult.ok) return fail('invalid_utm', 'utmSource is invalid.')
  const utmMediumResult = optionalTrimmedString(rawBody.utmMedium, MAX_UTM_LENGTH)
  if (!utmMediumResult.ok) return fail('invalid_utm', 'utmMedium is invalid.')
  const utmCampaignResult = optionalTrimmedString(rawBody.utmCampaign, MAX_UTM_LENGTH)
  if (!utmCampaignResult.ok) return fail('invalid_utm', 'utmCampaign is invalid.')
  const utmTermResult = optionalTrimmedString(rawBody.utmTerm, MAX_UTM_LENGTH)
  if (!utmTermResult.ok) return fail('invalid_utm', 'utmTerm is invalid.')
  const utmContentResult = optionalTrimmedString(rawBody.utmContent, MAX_UTM_LENGTH)
  if (!utmContentResult.ok) return fail('invalid_utm', 'utmContent is invalid.')

  const referrerResult = optionalTrimmedString(rawBody.referrer, MAX_REFERRER_LENGTH)
  if (!referrerResult.ok) return fail('invalid_referrer', 'referrer is invalid.')

  let sourceChannel: IdentitySourceChannel | null = null
  if (rawBody.sourceChannel !== undefined && rawBody.sourceChannel !== null) {
    if (typeof rawBody.sourceChannel !== 'string' || !SOURCE_CHANNELS.has(rawBody.sourceChannel as IdentitySourceChannel)) {
      return fail('invalid_source_channel', 'sourceChannel is invalid.')
    }
    sourceChannel = rawBody.sourceChannel as IdentitySourceChannel
  }

  const nowIso =
    formSubmittedAt && parseTimestampMs(formSubmittedAt) !== null
      ? formSubmittedAt
      : new Date(now()).toISOString()

  const consentSnapshot = buildDigitalIdentityConsentSnapshot({
    consent: submission.consent,
    phone: submission.phone,
    nowIso,
  })

  return {
    ok: true,
    value: {
      submissionId: submission.submissionId,
      cardPublicKey: submission.cardPublicKey ?? null,
      cardSlug: submission.cardSlug ?? null,
      campaignCode: submission.campaignCode ?? null,
      eventCode: submission.eventCode ?? null,
      firstName: submission.firstName,
      lastName: submission.lastName,
      email: submission.email,
      phone: submission.phone,
      company: submission.company ?? null,
      title: submission.title ?? null,
      reasonForConnecting: submission.reasonForConnecting ?? null,
      preferredFollowUpMethod: submission.preferredFollowUpMethod ?? null,
      note: submission.note ?? null,
      consentSnapshot,
      formStartedAt: formStartedAt ?? null,
      formSubmittedAt: formSubmittedAt ?? null,
      sourcePage: sourcePageResult.value,
      sourceChannel,
      utmSource: utmSourceResult.value ?? nestedUtm.utmSource ?? null,
      utmMedium: utmMediumResult.value ?? nestedUtm.utmMedium ?? null,
      utmCampaign: utmCampaignResult.value ?? nestedUtm.utmCampaign ?? null,
      utmTerm: utmTermResult.value ?? nestedUtm.utmTerm ?? null,
      utmContent: utmContentResult.value ?? nestedUtm.utmContent ?? null,
      referrer: referrerResult.value,
    },
  }
}
