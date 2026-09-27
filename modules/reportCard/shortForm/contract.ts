import { isValidEmailFormat, normalizePhone } from '../../../crm/households/normalizeContact.js'
import { US_STATES } from '../../../components/assessment/constants.js'
import { SHORT_CARDS, SHORT_FORM_FORMAT, type ShortQuestion } from './catalog.js'
import type { PublicReportCardAssessmentType } from '../publicIngestCatalog.js'

export type ShortDiagnostic = Record<string, string | string[]>
export type ShortAnswers = { format: typeof SHORT_FORM_FORMAT; assessmentType: PublicReportCardAssessmentType; diagnostic: ShortDiagnostic; contact: { fullName: string; email: string; phone: string } }
export function isShortForm(value: unknown): value is ShortAnswers {
  return !!value && typeof value === 'object' && (value as { format?: unknown }).format === SHORT_FORM_FORMAT
}
export function visibleQuestions(type: PublicReportCardAssessmentType, diagnostic: ShortDiagnostic): readonly ShortQuestion[] {
  return SHORT_CARDS[type].questions.filter(q => !q.when || diagnostic[q.when.field] !== q.when.not)
}
export function numericAnswer(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
export function validQuestion(q: ShortQuestion, value: unknown): boolean {
  if (q.kind === 'number') {
    if (value === 'unknown') return true
    const n = numericAnswer(value)
    return n !== null && n >= (['age','target_age','household_size'].includes(q.id) ? 1 : 0) && n <= (q.max ?? 1_000_000_000) && (!['age','target_age','household_size','children','dependents','inquiries'].includes(q.id) || Number.isInteger(n))
  }
  if (q.kind === 'state') return value === 'unknown' || US_STATES.some(s => s.value === value)
  const allowed = q.options?.map(o => o.value) ?? []
  if (q.kind === 'select') return typeof value === 'string' && allowed.includes(value)
  if (!Array.isArray(value) || !value.length || value.some(v => typeof v !== 'string' || !allowed.includes(v))) return false
  return new Set(value).size === value.length && !(value.length > 1 && value.some(v => v === 'none' || v === 'unknown'))
}
export function validShortContact(contact: ShortAnswers['contact']): boolean {
  const names = contact.fullName.trim().split(/\s+/)
  return names.length >= 2 && names[0].length <= 100 && names.slice(1).join(' ').length <= 100 &&
    contact.email.length <= 254 && isValidEmailFormat(contact.email.trim()) &&
    (!contact.phone.trim() || normalizePhone(contact.phone) !== null)
}
export function validateShortAnswers(type: PublicReportCardAssessmentType, raw: unknown): ShortAnswers | null {
  if (!isShortForm(raw) || raw.assessmentType !== type || Object.keys(raw).some(k => !['format','assessmentType','diagnostic','contact'].includes(k))) return null
  if (!raw.diagnostic || typeof raw.diagnostic !== 'object' || Array.isArray(raw.diagnostic)) return null
  if (!raw.contact || typeof raw.contact !== 'object' || Array.isArray(raw.contact) || Object.keys(raw.contact).some(k => !['fullName','email','phone'].includes(k))) return null
  if (!['fullName','email','phone'].every(k => typeof raw.contact[k as keyof ShortAnswers['contact']] === 'string') || !validShortContact(raw.contact)) return null
  const visible = visibleQuestions(type, raw.diagnostic)
  if (Object.keys(raw.diagnostic).some(k => !visible.some(q => q.id === k)) || visible.some(q => !validQuestion(q, raw.diagnostic[q.id]))) return null
  if (type === 'retirement' && raw.diagnostic.retired === 'no') {
    const age = numericAnswer(raw.diagnostic.age), target = numericAnswer(raw.diagnostic.target_age)
    if (age !== null && target !== null && target < age) return null
  }
  return { format: SHORT_FORM_FORMAT, assessmentType: type, diagnostic: Object.fromEntries(visible.map(q => [q.id, raw.diagnostic[q.id]])), contact: { fullName: raw.contact.fullName.trim(), email: raw.contact.email.trim(), phone: raw.contact.phone.trim() } }
}
export function updateShortAnswer(type: PublicReportCardAssessmentType, diagnostic: ShortDiagnostic, id: string, value: string | string[]): ShortDiagnostic {
  const next = { ...diagnostic, [id]: value }
  return Object.fromEntries(visibleQuestions(type, next).filter(q => next[q.id] !== undefined).map(q => [q.id, next[q.id]]))
}
