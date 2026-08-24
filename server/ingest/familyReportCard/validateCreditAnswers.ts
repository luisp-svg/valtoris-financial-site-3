import { isValidEmailFormat, normalizePhone } from '../../../crm/households/normalizeContact.js'
import {
  getMultiValue,
  getStringValue,
  isFieldRequired,
  isFieldVisible,
} from '../../../components/assessment/specialized/answers.js'
import type { SpecializedAnswerMap, SpecializedField } from '../../../components/assessment/specialized/types.js'
import { FORBIDDEN_CREDIT_FIELD_TOKENS } from '../../../components/assessment/credit/constants.js'
import { CREDIT_QUESTIONS } from '../../../components/assessment/credit/questions.js'
import {
  INITIAL_CREDIT_DIAGNOSTIC,
  type CreditAssessmentAnswers,
  type CreditContactAnswers,
  type CreditDiagnosticAnswers,
} from '../../../components/assessment/credit/types.js'
import type { ValidationResult } from './validation.js'

const MAX_NAME_LENGTH = 100

const DIAGNOSTIC_KEYS = Object.keys(INITIAL_CREDIT_DIAGNOSTIC)
const CONTACT_KEYS = ['firstName', 'lastName', 'email', 'phone'] as const
const ANSWERS_KEYS = ['diagnostic', 'contact'] as const

function fail(code: string, error: string): ValidationResult<never> {
  return { ok: false, error, code }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectKeys(value: unknown, into: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into)
    return
  }
  if (!isPlainObject(value)) return
  for (const [key, child] of Object.entries(value)) {
    into.push(key)
    collectKeys(child, into)
  }
}

function hasForbiddenField(value: unknown): boolean {
  const keys: string[] = []
  collectKeys(value, keys)
  return keys.some((key) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, '_')
    return FORBIDDEN_CREDIT_FIELD_TOKENS.some(
      (token) => normalized === token || normalized.includes(token),
    )
  })
}

function exactKeySet(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value)
  if (keys.length !== allowed.length) return false
  return allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function asDiagnosticMap(diagnostic: CreditDiagnosticAnswers): SpecializedAnswerMap {
  return {
    credit_goal: diagnostic.credit_goal,
    self_reported_score: diagnostic.self_reported_score,
    last_reviewed: diagnostic.last_reviewed,
    inaccuracy_belief: diagnostic.inaccuracy_belief,
    late_recent: diagnostic.late_recent,
    payment_consistency: diagnostic.payment_consistency,
    negative_items: diagnostic.negative_items,
    utilization: diagnostic.utilization,
    open_revolving: diagnostic.open_revolving,
    oldest_account: diagnostic.oldest_account,
    hard_inquiries: diagnostic.hard_inquiries,
    new_accounts: diagnostic.new_accounts,
    minimums: diagnostic.minimums,
    current_status: diagnostic.current_status,
    urgency: diagnostic.urgency,
    prior_actions: diagnostic.prior_actions,
  }
}

function validateClosedString(value: unknown): value is string {
  return typeof value === 'string'
}

function validateMultiArray(value: unknown): { ok: true; values: string[] } | { ok: false; code: string } {
  if (!Array.isArray(value)) return { ok: false, code: 'malformed_credit_multi' }
  if (value.some((item) => typeof item !== 'string' || item.trim() === '' || item !== item.trim())) {
    return { ok: false, code: 'malformed_credit_multi' }
  }
  if (value.some((item) => item.includes(' ') && !/^[a-z0-9_]+$/.test(item))) {
    return { ok: false, code: 'malformed_credit_multi' }
  }
  if (value.some((item) => !/^[a-z0-9_]+$/.test(item))) {
    return { ok: false, code: 'invalid_credit_enum' }
  }
  if (new Set(value).size !== value.length) return { ok: false, code: 'malformed_credit_multi' }
  return { ok: true, values: value }
}

function optionValues(field: SpecializedField): Set<string> {
  if (field.input === 'short_text') return new Set()
  return new Set(field.options.map((option) => option.value))
}

function fieldHasValue(field: SpecializedField, values: SpecializedAnswerMap): boolean {
  if (field.input === 'multi') return getMultiValue(values, field.id).length > 0
  return getStringValue(values, field.id).trim() !== ''
}

function validateDiagnosticObject(
  value: unknown,
): ValidationResult<CreditDiagnosticAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_credit_answers', 'answers.diagnostic must be an object.')
  }
  if (!exactKeySet(value, DIAGNOSTIC_KEYS)) {
    return fail('unknown_credit_field', 'answers.diagnostic has unknown or missing keys.')
  }

  const negativeItems = validateMultiArray(value.negative_items)
  if (!negativeItems.ok) {
    return fail(negativeItems.code, 'answers.diagnostic.negative_items is invalid.')
  }
  const priorActions = validateMultiArray(value.prior_actions)
  if (!priorActions.ok) {
    return fail(priorActions.code, 'answers.diagnostic.prior_actions is invalid.')
  }

  const stringKeys = DIAGNOSTIC_KEYS.filter((key) => key !== 'negative_items' && key !== 'prior_actions')
  for (const key of stringKeys) {
    if (!validateClosedString(value[key])) {
      return fail('invalid_credit_answers', `answers.diagnostic.${key} must be a string.`)
    }
  }

  const diagnostic: CreditDiagnosticAnswers = {
    credit_goal: value.credit_goal as string,
    self_reported_score: value.self_reported_score as string,
    last_reviewed: value.last_reviewed as string,
    inaccuracy_belief: value.inaccuracy_belief as string,
    late_recent: value.late_recent as string,
    payment_consistency: value.payment_consistency as string,
    negative_items: negativeItems.values,
    utilization: value.utilization as string,
    open_revolving: value.open_revolving as string,
    oldest_account: value.oldest_account as string,
    hard_inquiries: value.hard_inquiries as string,
    new_accounts: value.new_accounts as string,
    minimums: value.minimums as string,
    current_status: value.current_status as string,
    urgency: value.urgency as string,
    prior_actions: priorActions.values,
  }

  const values = asDiagnosticMap(diagnostic)

  for (const question of CREDIT_QUESTIONS) {
    for (const field of question.fields) {
      const visible = isFieldVisible(field, values)
      const present = fieldHasValue(field, values)

      if (!visible && present) {
        return fail(
          'credit_hidden_follow_up',
          `Hidden Credit field ${field.id} must not be present.`,
        )
      }

      if (!visible) continue

      if (field.input === 'multi') {
        const selected = getMultiValue(values, field.id)
        const allowed = optionValues(field)
        if (selected.some((item) => !allowed.has(item))) {
          return fail('invalid_credit_enum', `Invalid value for ${field.id}.`)
        }
        const exclusive = field.exclusiveValues ?? []
        const exclusiveSelected = selected.filter((item) => exclusive.includes(item))
        if (exclusiveSelected.length > 0 && selected.length > exclusiveSelected.length) {
          return fail('credit_exclusive_conflict', `Exclusive option conflict in ${field.id}.`)
        }
        if (exclusiveSelected.length > 1) {
          return fail('credit_exclusive_conflict', `Exclusive option conflict in ${field.id}.`)
        }
        if (isFieldRequired(field) && selected.length === 0) {
          return fail('incomplete_credit_answers', 'All Credit questions must be answered.')
        }
        continue
      }

      if (field.input === 'single') {
        const current = getStringValue(values, field.id)
        if (isFieldRequired(field) && current.trim() === '') {
          return fail('incomplete_credit_answers', 'All Credit questions must be answered.')
        }
        if (current.trim() !== '' && !optionValues(field).has(current)) {
          return fail('invalid_credit_enum', `Invalid value for ${field.id}.`)
        }
        continue
      }

      const text = getStringValue(values, field.id).trim()
      if (isFieldRequired(field) && text === '') {
        return fail('incomplete_credit_answers', 'All Credit questions must be answered.')
      }
    }
  }

  return { ok: true, value: diagnostic }
}

function validateContactObject(value: unknown): ValidationResult<CreditContactAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_credit_answers', 'answers.contact must be an object.')
  }
  if (!exactKeySet(value, CONTACT_KEYS)) {
    return fail('unknown_credit_field', 'answers.contact has unknown or missing keys.')
  }
  for (const key of CONTACT_KEYS) {
    if (typeof value[key] !== 'string') {
      return fail('invalid_credit_answers', `answers.contact.${key} must be a string.`)
    }
  }

  const contact: CreditContactAnswers = {
    firstName: value.firstName as string,
    lastName: value.lastName as string,
    email: value.email as string,
    phone: value.phone as string,
  }

  if (contact.firstName.trim().length === 0 || contact.lastName.trim().length === 0) {
    return fail('incomplete_credit_answers', 'First and last name are required.')
  }
  if (contact.firstName.trim().length > MAX_NAME_LENGTH || contact.lastName.trim().length > MAX_NAME_LENGTH) {
    return fail('invalid_name', 'First/last name exceeds the maximum allowed length.')
  }
  if (!isValidEmailFormat(contact.email) || contact.email.trim() === '') {
    return fail('invalid_email', 'A valid email address is required.')
  }
  if (normalizePhone(contact.phone) === null) {
    return fail('invalid_phone', 'A valid phone number is required.')
  }

  return { ok: true, value: contact }
}

/**
 * Strict server-side Credit answer contract.
 * Rejects unknown keys, invalid enums, hidden follow-up leakage, exclusive
 * conflicts, and forbidden identity/credential fields.
 * Does not silently normalize invalid conditional combinations.
 */
export function validateCreditAnswers(
  value: unknown,
): ValidationResult<CreditAssessmentAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_credit_answers', 'answers must be an object.')
  }
  if (hasForbiddenField(value)) {
    return fail('forbidden_credit_field', 'Credit answers include a forbidden field.')
  }
  if (!exactKeySet(value, ANSWERS_KEYS)) {
    return fail('unknown_credit_field', 'answers has unknown or missing keys.')
  }

  const diagnosticResult = validateDiagnosticObject(value.diagnostic)
  if (!diagnosticResult.ok) return diagnosticResult

  const contactResult = validateContactObject(value.contact)
  if (!contactResult.ok) return contactResult

  return {
    ok: true,
    value: {
      diagnostic: diagnosticResult.value,
      contact: contactResult.value,
    },
  }
}
