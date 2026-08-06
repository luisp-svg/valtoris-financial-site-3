import { isContactCategory } from './categoryLabels'
import type { ContactFormValues } from './types'

function trimOrOmit(value: string): string | undefined {
  const t = value.trim()
  return t ? t : undefined
}

export type BuildCreatePayloadOptions = {
  /** Owner may include assigned_advisor_id; advisors must never send it. */
  includeAssignedAdvisor: boolean
}

/**
 * Centralized create payload builder. Never includes consentedAt or consent_snapshot.
 */
export function buildQuickAddCreatePayload(
  values: ContactFormValues,
  options: BuildCreatePayloadOptions,
): Record<string, unknown> {
  if (!isContactCategory(values.contact_category)) {
    throw new Error('QUICK_ADD:invalid_category')
  }

  const payload: Record<string, unknown> = {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    contact_category: values.contact_category,
  }

  const email = trimOrOmit(values.email)
  const phone = trimOrOmit(values.phone)
  if (email) payload.email = email
  if (phone) payload.phone = phone

  const company = trimOrOmit(values.company)
  const jobTitle = trimOrOmit(values.job_title)
  const website = trimOrOmit(values.website)
  const city = trimOrOmit(values.city)
  const state = trimOrOmit(values.state)
  const howWeMet = trimOrOmit(values.how_we_met)
  const note = trimOrOmit(values.note)
  const taskTitle = trimOrOmit(values.follow_up_task_title)
  const due = trimOrOmit(values.follow_up_due_date)

  if (company) payload.company = company
  if (jobTitle) payload.job_title = jobTitle
  if (website) payload.website = website
  if (city) payload.city = city
  if (state) payload.state = state
  if (howWeMet) payload.how_we_met = howWeMet
  if (note) payload.note = note
  if (taskTitle) payload.follow_up_task_title = taskTitle
  if (due) payload.follow_up_due_date = due

  if (options.includeAssignedAdvisor) {
    const advisor = trimOrOmit(values.assigned_advisor_id)
    if (advisor) payload.assigned_advisor_id = advisor
  }

  if (values.consentEnabled) {
    payload.consent = {
      privacyAcknowledged: values.privacyAcknowledged === true,
      contactPermission: values.contactPermission === true,
      emailMarketingConsent: values.emailMarketingConsent === true,
      smsMarketingConsent: values.smsMarketingConsent === true,
      evidenceDescription: values.evidenceDescription.trim(),
    }
  }

  // Hard guard — never fabricate browser consent timestamps.
  if ('consentedAt' in payload || 'consent_snapshot' in payload) {
    throw new Error('QUICK_ADD:invalid_consent')
  }

  return payload
}

export type BuildUpdatePayloadOptions = {
  mode?: 'update' | 'update_separate'
  createToken?: string | null
}

/**
 * Centralized update payload. Never includes assignment, lifecycle, consent, or created_by.
 */
export function buildManualContactUpdatePayload(
  values: ContactFormValues,
  options: BuildUpdatePayloadOptions = {},
): Record<string, unknown> {
  if (!isContactCategory(values.contact_category)) {
    throw new Error('QUICK_ADD:invalid_category')
  }

  const payload: Record<string, unknown> = {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    contact_category: values.contact_category,
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    company: values.company.trim() || null,
    job_title: values.job_title.trim() || null,
    website: values.website.trim() || null,
    city: values.city.trim() || null,
    state: values.state.trim() || null,
    how_we_met: values.how_we_met.trim() || null,
  }

  if (options.mode === 'update_separate') {
    payload.mode = 'update_separate'
    if (!options.createToken) throw new Error('QUICK_ADD:invalid_token')
    payload.create_token = options.createToken
  }

  for (const forbidden of [
    'consent',
    'consent_snapshot',
    'consentedAt',
    'assigned_advisor_id',
    'created_by_user_id',
    'status',
    'lead_type',
    'note',
    'follow_up_task_title',
  ]) {
    if (forbidden in payload && forbidden !== 'mode' && forbidden !== 'create_token') {
      // only strip if somehow present
    }
  }
  delete (payload as { consent?: unknown }).consent
  delete (payload as { consent_snapshot?: unknown }).consent_snapshot
  delete (payload as { consentedAt?: unknown }).consentedAt
  delete (payload as { assigned_advisor_id?: unknown }).assigned_advisor_id

  return payload
}

export function buildDuplicatePreviewPayload(
  values: ContactFormValues,
  operation: 'create' | 'update',
  leadId?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    operation,
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
  }
  const email = trimOrOmit(values.email)
  const phone = trimOrOmit(values.phone)
  const company = trimOrOmit(values.company)
  if (email) payload.email = email
  if (phone) payload.phone = phone
  if (company) payload.company = company
  if (operation === 'update') {
    if (!leadId) throw new Error('QUICK_ADD:not_found')
    payload.lead_id = leadId
  }
  return payload
}
