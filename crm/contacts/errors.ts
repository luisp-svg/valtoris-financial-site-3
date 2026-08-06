import type { ContactFormField, SafeContactError } from './types'

const CODE_MAP: Record<string, { message: string; field?: ContactFormField }> = {
  'QUICK_ADD:not_authenticated': {
    message: 'Please sign in again to continue.',
  },
  'QUICK_ADD:not_authorized': {
    message: 'You do not have permission to manage contacts.',
  },
  'QUICK_ADD:invalid_payload': {
    message: 'Some contact fields are invalid. Please review and try again.',
    field: 'form',
  },
  'QUICK_ADD:invalid_name': {
    message: 'Enter a valid first and last name (up to 100 characters each).',
    field: 'first_name',
  },
  'QUICK_ADD:contact_required': {
    message: 'Enter an email address or mobile phone number.',
    field: 'email',
  },
  'QUICK_ADD:invalid_website': {
    message: 'Website must be a valid http:// or https:// URL.',
    field: 'website',
  },
  'QUICK_ADD:invalid_category': {
    message: 'Select a contact category.',
    field: 'contact_category',
  },
  'QUICK_ADD:invalid_field': {
    message: 'One or more fields are too long or invalid.',
    field: 'form',
  },
  'QUICK_ADD:invalid_due_date': {
    message: 'Follow-up needs both a task title and a valid due date.',
    field: 'follow_up_due_date',
  },
  'QUICK_ADD:invalid_advisor': {
    message: 'Select a valid active advisor.',
    field: 'assigned_advisor_id',
  },
  'QUICK_ADD:assignment_spoof': {
    message: 'Advisors can only assign contacts to themselves.',
    field: 'assigned_advisor_id',
  },
  'QUICK_ADD:invalid_consent': {
    message:
      'Consent requires approved channels, privacy acknowledgment, and a short evidence description.',
    field: 'consent',
  },
  'QUICK_ADD:invalid_token': {
    message: 'The duplicate confirmation expired or no longer matches. Please check duplicates again.',
    field: 'form',
  },
  'QUICK_ADD:invalid_mode': {
    message: 'Unable to complete that action. Please try again.',
    field: 'form',
  },
  'QUICK_ADD:manual_contact_rpc_required': {
    message: 'This contact can only be changed through the Contacts workflow.',
    field: 'form',
  },
  'QUICK_ADD:not_found': {
    message: 'That contact could not be found or is no longer available.',
  },
}

const CODE_PATTERN = /QUICK_ADD:[a-z0-9_]+/i

export function extractQuickAddCode(source: unknown): string | null {
  const text =
    typeof source === 'string'
      ? source
      : source && typeof source === 'object'
        ? [
            (source as { message?: string }).message,
            (source as { details?: string }).details,
            (source as { hint?: string }).hint,
            JSON.stringify(source),
          ]
            .filter(Boolean)
            .join(' ')
        : ''
  const match = text.match(CODE_PATTERN)
  return match ? match[0].toUpperCase().replace('QUICK_ADD:', 'QUICK_ADD:') : null
}

/** Normalize extracted code casing to canonical QUICK_ADD:* keys. */
function normalizeCode(code: string): string {
  const body = code.replace(/^QUICK_ADD:/i, '')
  return `QUICK_ADD:${body.toLowerCase()}`
}

export function mapQuickAddError(source: unknown): SafeContactError {
  const raw = extractQuickAddCode(source)
  if (raw) {
    const code = normalizeCode(raw)
    const mapped = CODE_MAP[code]
    if (mapped) return { code, message: mapped.message, field: mapped.field }
  }
  return {
    code: 'QUICK_ADD:unknown',
    message: 'Something went wrong while saving this contact. Please try again.',
    field: 'form',
  }
}

export function isCollisionResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const row = data as { ok?: unknown; reason?: unknown }
  return row.ok === false && row.reason === 'collision'
}
