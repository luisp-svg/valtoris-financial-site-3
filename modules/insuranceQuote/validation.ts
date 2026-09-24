import { activeFields, activeSections, CONTACT_FIELDS, isQuoteKind, QUOTE_CONSENT_VERSION } from './catalog.js'
import type { QuoteAnswers, QuoteField, QuoteKind } from './catalog.js'
export type QuoteContact = { firstName: string; lastName: string; email: string; phone: string; preferredContact: string }
export type QuoteSubmission = { version: 1; kind: QuoteKind; submissionId: string; formStartedAt: number; website: string; contact: QuoteContact; answers: QuoteAnswers; consent: { version: string; storage: true; contact: true; privacy: true } }
export type ValidationResult = { ok: true; value: QuoteSubmission } | { ok: false; error: string }
export function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function exactKeys(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).every(key => keys.includes(key)) }
export function fieldError(field: QuoteField, value: unknown): string | null {
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return field.required ? `${field.label} is required.` : null
  if (field.type === 'multi') {
    if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !field.options?.includes(item)) || new Set(value).size !== value.length) return `Check ${field.label}.`
    if (value.length > 1 && value.some(item => item === 'None' || item === 'Not sure')) return `Choose specific options or None / Not sure for ${field.label}.`
    return null
  }
  if (field.type === 'rows') {
    if (!Array.isArray(value) || value.length > 20) return `${field.label} must have at most 20 entries.`
    for (const row of value) {
      if (!record(row) || !exactKeys(row, field.fields!.map(item => item.id))) return `Check ${field.label}.`
      for (const child of field.fields!) { const error = fieldError(child, row[child.id]); if (error) return error }
    }
    return null
  }
  if (typeof value !== 'string' || value.length > (field.maxLength ?? 300) || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return `Check ${field.label}.`
  if (!value.trim()) return field.required ? `${field.label} is required.` : null
  if (field.type === 'select' && !field.options?.includes(value)) return `Choose an option for ${field.label}.`
  if (field.type === 'number' && (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > (field.max ?? 1000000000))) return `Enter a valid nonnegative amount for ${field.label}.`
  if (field.type === 'date') {
    const date = new Date(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '2100-12-31') return `Enter a valid date for ${field.label}.`
    if (field.id === 'birthDate' && date.getTime() > Date.now()) return 'Date of birth cannot be in the future.'
  }
  if (field.type === 'email' && (!/^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/.test(value) || value.length > 254)) return 'Enter a valid email address.'
  if (field.type === 'tel' && !/^\+?1?\d{10}$/.test(value.replace(/[\s().-]/g, ''))) return 'Enter a valid US phone number.'
  if (field.id === 'fein' && !/^\d{2}-?\d{7}$/.test(value)) return 'Enter a valid FEIN (XX-XXXXXXX), or leave it blank. Do not enter an SSN.'
  if (field.id === 'vin' && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(value)) return 'Enter a 17-character VIN, or leave it blank.'
  return null
}
export function validateQuote(body: unknown, now = Date.now()): ValidationResult {
  const fail = (error: string): ValidationResult => ({ ok: false, error })
  if (!record(body) || !exactKeys(body, ['version', 'kind', 'submissionId', 'formStartedAt', 'website', 'contact', 'answers', 'consent']) || body.version !== 1 || !isQuoteKind(body.kind)) return fail('Invalid quote request.')
  if (typeof body.submissionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submissionId)) return fail('Refresh the page and try again.')
  if (body.website !== '' || typeof body.formStartedAt !== 'number' || !Number.isFinite(body.formStartedAt) || now - body.formStartedAt < 2000 || now - body.formStartedAt > 86400000) return fail('Refresh the page and complete the form again.')
  if (!record(body.contact) || !exactKeys(body.contact, CONTACT_FIELDS.map(field => field.id))) return fail('Check your contact details.')
  for (const field of CONTACT_FIELDS) { const error = fieldError(field, body.contact[field.id]); if (error) return fail(error) }
  if (!record(body.answers)) return fail('Check your quote details.')
  const answers = body.answers as QuoteAnswers
  const fields = activeSections(body.kind, answers).flatMap(section => activeFields(section.fields, answers))
  if (!exactKeys(answers, fields.map(field => field.id))) return fail('The request contains fields that do not apply to the selected coverage.')
  for (const field of fields) { const error = fieldError(field, answers[field.id]); if (error) return fail(error) }
  if (!record(body.consent) || !exactKeys(body.consent, ['version', 'storage', 'contact', 'privacy']) || body.consent.version !== QUOTE_CONSENT_VERSION || body.consent.storage !== true || body.consent.contact !== true || body.consent.privacy !== true) return fail('Please review and acknowledge the privacy and contact permissions.')
  return { ok: true, value: body as unknown as QuoteSubmission }
}
