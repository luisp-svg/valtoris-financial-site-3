import { isContactCategory } from './categoryLabels'
import type { ContactFormField, ContactFormValues } from './types'

const LIMITS = {
  first_name: 100,
  last_name: 100,
  company: 200,
  job_title: 200,
  website: 500,
  city: 100,
  state: 50,
  how_we_met: 500,
  note: 5000,
  follow_up_task_title: 200,
  evidenceDescription: 500,
} as const

export function isSafeWebsite(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Display-oriented phone formatting; server remains authoritative for storage. */
export function formatPhoneForDisplay(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return value.trim()
}

export function emptyContactFormValues(): ContactFormValues {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    job_title: '',
    website: '',
    city: '',
    state: '',
    contact_category: 'potential_client',
    how_we_met: '',
    note: '',
    follow_up_task_title: '',
    follow_up_due_date: '',
    assigned_advisor_id: '',
    consentEnabled: false,
    privacyAcknowledged: false,
    contactPermission: false,
    emailMarketingConsent: false,
    smsMarketingConsent: false,
    evidenceDescription: '',
  }
}

export function validateContactForm(
  values: ContactFormValues,
  options?: { requireCategory?: boolean },
): Partial<Record<ContactFormField, string>> {
  const errors: Partial<Record<ContactFormField, string>> = {}
  const first = values.first_name.trim()
  const last = values.last_name.trim()
  if (!first) errors.first_name = 'First name is required.'
  else if (first.length > LIMITS.first_name) errors.first_name = 'First name is too long.'
  if (!last) errors.last_name = 'Last name is required.'
  else if (last.length > LIMITS.last_name) errors.last_name = 'Last name is too long.'

  const email = values.email.trim()
  const phone = values.phone.trim()
  if (!email && !phone) {
    errors.email = 'Enter an email or mobile phone.'
    errors.phone = 'Enter an email or mobile phone.'
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (values.website.trim() && !isSafeWebsite(values.website)) {
    errors.website = 'Website must start with http:// or https://.'
  }
  if (values.company.trim().length > LIMITS.company) errors.company = 'Company is too long.'
  if (values.job_title.trim().length > LIMITS.job_title) errors.job_title = 'Job title is too long.'
  if (values.city.trim().length > LIMITS.city) errors.city = 'City is too long.'
  if (values.state.trim().length > LIMITS.state) errors.state = 'State is too long.'
  if (values.how_we_met.trim().length > LIMITS.how_we_met) {
    errors.how_we_met = 'How we met is too long.'
  }
  if (values.note.trim().length > LIMITS.note) errors.note = 'Note is too long.'
  if (values.follow_up_task_title.trim().length > LIMITS.follow_up_task_title) {
    errors.follow_up_task_title = 'Task title is too long.'
  }
  const hasTaskTitle = Boolean(values.follow_up_task_title.trim())
  const hasDue = Boolean(values.follow_up_due_date.trim())
  if (hasTaskTitle !== hasDue) {
    errors.follow_up_due_date = 'Provide both a follow-up title and due date, or leave both blank.'
  }
  if ((options?.requireCategory ?? true) && !isContactCategory(values.contact_category)) {
    errors.contact_category = 'Select a category.'
  }

  if (values.consentEnabled) {
    const channel =
      values.contactPermission || values.emailMarketingConsent || values.smsMarketingConsent
    if (!channel) {
      errors.consent = 'Select at least one approved contact channel.'
    } else if (!values.privacyAcknowledged) {
      errors.consent = 'Confirm privacy acknowledgment before recording consent.'
    } else if (!values.evidenceDescription.trim()) {
      errors.consent = 'Describe how consent was obtained.'
    } else if (values.evidenceDescription.trim().length > LIMITS.evidenceDescription) {
      errors.consent = 'Evidence description is too long.'
    }
  }

  return errors
}

/** Fields that identify the person for duplicate-token binding. */
export function contactIdentityFingerprint(values: ContactFormValues): string {
  return [
    values.first_name.trim().toLowerCase(),
    values.last_name.trim().toLowerCase(),
    values.email.trim().toLowerCase(),
    values.phone.replace(/\D/g, ''),
    values.company.trim().toLowerCase(),
  ].join('|')
}
