import { isValidEmailFormat, normalizePhone } from '../../../crm/households/normalizeContact.js'
import {
  isFamilyComplete,
  isFinancialComplete,
  isGoalsComplete,
  isProtectionBaseComplete,
  type DemoAssessmentAnswers,
  type FamilyAnswers,
  type FinancialAnswers,
  type GoalsAnswers,
  type ProtectionAnswers,
} from '../../../components/assessment/types.js'
import { normalizeConsentSnapshot } from './consent.js'
import type { ConsentSnapshot, FamilyReportCardIngestRequest } from './types.js'

export type ValidationOk<T> = { ok: true; value: T }
export type ValidationErr = { ok: false; error: string; code: string }
export type ValidationResult<T> = ValidationOk<T> | ValidationErr

const MAX_JSON_LENGTH = 100_000
const MAX_SOURCE_PAGE_LENGTH = 500
const MAX_UTM_LENGTH = 200
const MAX_REFERRER_LENGTH = 1000
const MAX_GRADE_LENGTH = 4
const MAX_NAME_LENGTH = 100
const MIN_FORM_FILL_TIME_MS = 1500

// Strict UUID v4 (version nibble "4", variant nibble in 8/9/a/b).
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_TOP_LEVEL_KEYS = new Set<string>([
  'submissionId',
  'assessmentType',
  'assessmentVersion',
  'answers',
  'sourcePage',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmTerm',
  'utmContent',
  'referrer',
  'clientReportedScore',
  'clientReportedGrade',
  'consent',
  'submittedAt',
  'website',
  'companyUrl',
  'formStartedAt',
  'honeypot',
])

function fail(code: string, error: string): ValidationErr {
  return { ok: false, error, code }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyTrimmedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
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

function validateFamilyAnswersShape(value: unknown): value is FamilyAnswers {
  if (!isPlainObject(value)) return false
  const keys: (keyof FamilyAnswers)[] = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'age',
    'state',
    'maritalStatus',
    'numberOfChildren',
  ]
  return keys.every((key) => typeof value[key] === 'string')
}

function validateFinancialAnswersShape(value: unknown): value is FinancialAnswers {
  if (!isPlainObject(value)) return false
  const keys: (keyof FinancialAnswers)[] = [
    'householdIncome',
    'monthlyHousingPayment',
    'totalDebt',
    'emergencyFundMonths',
    'monthlyCashFlow',
    'retirementContribution',
  ]
  return keys.every((key) => typeof value[key] === 'string')
}

function validateProtectionAnswersShape(value: unknown): value is ProtectionAnswers {
  if (!isPlainObject(value)) return false
  const keys: (keyof ProtectionAnswers)[] = [
    'currentLifeInsurance',
    'hasDisabilityProtection',
    'hasWill',
    'hasTrust',
    'beneficiariesReviewed',
    'guardianDocumented',
  ]
  return keys.every((key) => typeof value[key] === 'string')
}

function validateGoalsAnswersShape(value: unknown): value is GoalsAnswers {
  if (!isPlainObject(value)) return false
  return Array.isArray(value.selected) && value.selected.every((item) => typeof item === 'string')
}

function validateAnswers(value: unknown): ValidationResult<DemoAssessmentAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_answers', 'answers must be an object.')
  }

  const { family, financial, protection, goals } = value

  if (!validateFamilyAnswersShape(family)) {
    return fail('invalid_answers_family', 'answers.family is missing required fields.')
  }
  if (!validateFinancialAnswersShape(financial)) {
    return fail('invalid_answers_financial', 'answers.financial is missing required fields.')
  }
  if (!validateProtectionAnswersShape(protection)) {
    return fail('invalid_answers_protection', 'answers.protection is missing required fields.')
  }
  if (!validateGoalsAnswersShape(goals)) {
    return fail('invalid_answers_goals', 'answers.goals is missing required fields.')
  }

  if (family.firstName.trim().length > MAX_NAME_LENGTH || family.lastName.trim().length > MAX_NAME_LENGTH) {
    return fail('invalid_name', 'First/last name exceeds the maximum allowed length.')
  }

  if (!isFamilyComplete(family)) {
    return fail('incomplete_family_answers', 'All family questions must be answered.')
  }
  if (!isFinancialComplete(financial)) {
    return fail('incomplete_financial_answers', 'All financial questions must be answered.')
  }
  if (!isProtectionBaseComplete(protection)) {
    return fail('incomplete_protection_answers', 'All protection questions must be answered.')
  }
  if (!isGoalsComplete(goals)) {
    return fail('incomplete_goals_answers', 'At least one goal must be selected.')
  }

  if (!isValidEmailFormat(family.email) || family.email.trim() === '') {
    return fail('invalid_email', 'A valid email address is required.')
  }

  if (normalizePhone(family.phone) === null) {
    return fail('invalid_phone', 'A valid phone number is required.')
  }

  return {
    ok: true,
    value: {
      family,
      financial,
      protection,
      goals: { selected: [...goals.selected] },
    },
  }
}

function validateConsent(value: unknown): ValidationResult<ConsentSnapshot> {
  // Missing/partial consent normalizes to all-false / null — never inferred true
  // from contact fields. The public Family UI requires storage + privacy acknowledgments
  // before POST; this server path still accepts a missing object for defensive parsing.
  if (value === undefined || value === null) {
    return { ok: true, value: normalizeConsentSnapshot(null) }
  }
  if (!isPlainObject(value)) {
    return fail('invalid_consent', 'consent must be an object.')
  }
  return { ok: true, value: normalizeConsentSnapshot(value) }
}

export type ValidationOptions = {
  /** Current time in ms since epoch. Overridable for deterministic tests. */
  now?: () => number
}

/**
 * Strict, allow-listed validation for the public Family Report Card ingest
 * request body. No schema library is used (matches the rest of the project) —
 * every field is checked explicitly and unknown top-level keys are rejected.
 */
export function validateFamilyReportCardIngestRequest(
  rawBody: unknown,
  options: ValidationOptions = {},
): ValidationResult<FamilyReportCardIngestRequest> {
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

  if (rawBody.formStartedAt !== undefined) {
    if (typeof rawBody.formStartedAt !== 'number' || !Number.isFinite(rawBody.formStartedAt)) {
      return fail('invalid_form_started_at', 'formStartedAt must be a timestamp in ms.')
    }
    const elapsed = now() - rawBody.formStartedAt
    if (elapsed >= 0 && elapsed < MIN_FORM_FILL_TIME_MS) {
      return fail('submission_too_fast', 'Submission rejected.')
    }
  }

  if (!isNonEmptyTrimmedString(rawBody.submissionId, 64)) {
    return fail('invalid_submission_id', 'submissionId must be a valid UUID.')
  }
  const submissionId = rawBody.submissionId.trim()
  if (!UUID_V4_RE.test(submissionId)) {
    return fail('invalid_submission_id', 'submissionId must be a valid UUID.')
  }

  if (rawBody.assessmentType !== undefined && rawBody.assessmentType !== 'family') {
    return fail('invalid_assessment_type', 'assessmentType must be "family" when provided.')
  }

  if (typeof rawBody.assessmentVersion !== 'number' || !Number.isFinite(rawBody.assessmentVersion) || rawBody.assessmentVersion < 1) {
    return fail('invalid_assessment_version', 'assessmentVersion must be a positive number.')
  }

  const answersResult = validateAnswers(rawBody.answers)
  if (!answersResult.ok) return answersResult

  const sourcePageResult = optionalTrimmedString(rawBody.sourcePage, MAX_SOURCE_PAGE_LENGTH)
  if (!sourcePageResult.ok) return fail('invalid_source_page', 'sourcePage is invalid.')

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

  let clientReportedScore: number | null = null
  if (rawBody.clientReportedScore !== undefined) {
    if (
      typeof rawBody.clientReportedScore !== 'number' ||
      !Number.isFinite(rawBody.clientReportedScore) ||
      rawBody.clientReportedScore < 0 ||
      rawBody.clientReportedScore > 100
    ) {
      return fail('invalid_client_score', 'clientReportedScore must be a number between 0 and 100.')
    }
    clientReportedScore = rawBody.clientReportedScore
  }

  const clientGradeResult = optionalTrimmedString(rawBody.clientReportedGrade, MAX_GRADE_LENGTH)
  if (!clientGradeResult.ok) return fail('invalid_client_grade', 'clientReportedGrade is invalid.')

  const consentResult = validateConsent(rawBody.consent)
  if (!consentResult.ok) return consentResult

  let submittedAt: string | null = null
  if (rawBody.submittedAt !== undefined && rawBody.submittedAt !== null) {
    if (typeof rawBody.submittedAt !== 'string' || Number.isNaN(Date.parse(rawBody.submittedAt))) {
      return fail('invalid_submitted_at', 'submittedAt must be a valid ISO timestamp.')
    }
    submittedAt = rawBody.submittedAt
  }

  return {
    ok: true,
    value: {
      submissionId,
      assessmentType: 'family',
      assessmentVersion: rawBody.assessmentVersion,
      answers: answersResult.value,
      sourcePage: sourcePageResult.value,
      utmSource: utmSourceResult.value,
      utmMedium: utmMediumResult.value,
      utmCampaign: utmCampaignResult.value,
      utmTerm: utmTermResult.value,
      utmContent: utmContentResult.value,
      referrer: referrerResult.value,
      clientReportedScore,
      clientReportedGrade: clientGradeResult.value,
      consent: consentResult.value,
      submittedAt,
    },
  }
}
