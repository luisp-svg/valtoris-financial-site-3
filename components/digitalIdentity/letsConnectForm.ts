/**
 * Pure helpers for the Let's Connect modal form.
 * No I/O — browser adapter is submitLetsConnect.
 */

import {
  INITIAL_DIGITAL_IDENTITY_CONSENT_STATE,
  applyPhoneChangeToDigitalIdentityConsent,
  buildDigitalIdentityConsentSnapshot,
  hasRequiredDigitalIdentityConsent,
  type DigitalIdentityConsentState,
  type PreferredFollowUpMethod,
} from '../../modules/digital-identity'

export const LETS_CONNECT_REASON_OPTIONS = [
  'Family financial planning',
  'Business planning',
  'Insurance',
  'Credit improvement',
  'Business funding',
  'Networking',
  'Other',
] as const

export type LetsConnectReasonOption = (typeof LETS_CONNECT_REASON_OPTIONS)[number]

export const LETS_CONNECT_FOLLOW_UP_OPTIONS: readonly {
  value: PreferredFollowUpMethod
  label: string
}[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'either', label: 'Either' },
  { value: 'none', label: 'No preference' },
]

export type LetsConnectFormValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  title: string
  reasonForConnecting: LetsConnectReasonOption | ''
  note: string
  preferredFollowUpMethod: PreferredFollowUpMethod | ''
  consent: DigitalIdentityConsentState
  /** Honeypot — must remain empty. */
  website: string
  companyUrl: string
}

export function createEmptyLetsConnectFormValues(): LetsConnectFormValues {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    reasonForConnecting: '',
    note: '',
    preferredFollowUpMethod: '',
    consent: { ...INITIAL_DIGITAL_IDENTITY_CONSENT_STATE },
    website: '',
    companyUrl: '',
  }
}

export function defaultLetsConnectConsent(): DigitalIdentityConsentState {
  return { ...INITIAL_DIGITAL_IDENTITY_CONSENT_STATE }
}

export function isValidLetsConnectReason(
  value: string,
): value is LetsConnectReasonOption {
  return (LETS_CONNECT_REASON_OPTIONS as readonly string[]).includes(value)
}

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** UUID v4 for Let's Connect submissionId (idempotency key). */
export function createLetsConnectSubmissionId(
  randomUuid: () => string = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    const bytes = new Uint8Array(16)
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes)
    } else {
      for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  },
): string {
  const id = randomUuid()
  if (!UUID_V4_RE.test(id)) {
    throw new Error('Failed to generate a valid UUID v4 submission id')
  }
  return id
}

export type LetsConnectClientValidation = {
  ok: boolean
  errors: {
    firstName?: string
    lastName?: string
    contact?: string
    privacy?: string
  }
}

/**
 * Lightweight client checks for UX. Server enforces the real contract
 * (including min fill time). UI should allow natural fill.
 */
export function validateLetsConnectFormClient(
  values: LetsConnectFormValues,
): LetsConnectClientValidation {
  const errors: LetsConnectClientValidation['errors'] = {}
  if (!values.firstName.trim()) errors.firstName = 'First name is required.'
  if (!values.lastName.trim()) errors.lastName = 'Last name is required.'
  if (!values.email.trim() && !values.phone.trim()) {
    errors.contact = 'Please provide an email or phone number.'
  }
  if (!hasRequiredDigitalIdentityConsent(values.consent)) {
    errors.privacy = 'Please acknowledge the privacy notice to continue.'
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

export function applyPhoneToLetsConnectConsent(
  consent: DigitalIdentityConsentState,
  phone: string,
): DigitalIdentityConsentState {
  return applyPhoneChangeToDigitalIdentityConsent(consent, phone)
}

export function buildLetsConnectSubmitBody(input: {
  values: LetsConnectFormValues
  cardPublicKey: string
  submissionId: string
  formStartedAt: string
  formSubmittedAt: string
  sourcePage?: string | null
  campaignCode?: string | null
  eventCode?: string | null
}): Record<string, unknown> {
  const { values } = input
  const phone = values.phone.trim()
  const consentSnapshot = buildDigitalIdentityConsentSnapshot({
    consent: values.consent,
    phone,
    nowIso: input.formSubmittedAt,
  })

  return {
    submissionId: input.submissionId,
    cardPublicKey: input.cardPublicKey,
    campaignCode: input.campaignCode ?? null,
    eventCode: input.eventCode ?? null,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone,
    company: values.company.trim() || null,
    title: values.title.trim() || null,
    reasonForConnecting: values.reasonForConnecting || null,
    note: values.note.trim() || null,
    preferredFollowUpMethod: values.preferredFollowUpMethod || null,
    consent: {
      privacyAcknowledged: consentSnapshot.privacyAcknowledged,
      contactPermission: consentSnapshot.contactPermission,
      emailMarketingConsent: consentSnapshot.emailMarketingConsent,
      smsMarketingConsent: consentSnapshot.smsMarketingConsent,
    },
    formStartedAt: input.formStartedAt,
    formSubmittedAt: input.formSubmittedAt,
    website: values.website,
    companyUrl: values.companyUrl,
    sourcePage: input.sourcePage ?? null,
  }
}

export function letsConnectModalCopy() {
  return {
    title: "Let's Connect",
    subtitle: "Great meeting you. Let's stay connected.",
    supporting:
      "I'll save your information so we can easily reconnect and continue the conversation.",
    reasonLabel: 'What would you like to stay connected about?',
    successTitle: "We're connected.",
    successSaveContact: 'Save Contact',
    successFamilyAssessment: 'Start Family Financial Report Card',
    successAddPhoto: 'Add a photo from where we met',
    successDone: 'Done',
  } as const
}
