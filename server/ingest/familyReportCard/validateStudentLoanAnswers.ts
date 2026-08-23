import { isValidEmailFormat, normalizePhone } from '../../../crm/households/normalizeContact.js'
import {
  getMultiValue,
  getStringValue,
  isFieldRequired,
  isFieldVisible,
} from '../../../components/assessment/specialized/answers.js'
import type { SpecializedAnswerMap, SpecializedField } from '../../../components/assessment/specialized/types.js'
import { FORBIDDEN_STUDENT_LOAN_FIELD_TOKENS, STUDENT_LOAN_SERVICER_MAX_LENGTH } from '../../../components/assessment/studentLoan/constants.js'
import { STUDENT_LOAN_QUESTIONS } from '../../../components/assessment/studentLoan/questions.js'
import {
  INITIAL_STUDENT_LOAN_DIAGNOSTIC,
  type StudentLoanAssessmentAnswers,
  type StudentLoanContactAnswers,
  type StudentLoanDiagnosticAnswers,
} from '../../../components/assessment/studentLoan/types.js'
import type { ValidationResult } from './validation.js'

const MAX_NAME_LENGTH = 100

const DIAGNOSTIC_KEYS = Object.keys(INITIAL_STUDENT_LOAN_DIAGNOSTIC)
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
    return FORBIDDEN_STUDENT_LOAN_FIELD_TOKENS.some(
      (token) => normalized === token || normalized.includes(token),
    )
  })
}

function exactKeySet(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value)
  if (keys.length !== allowed.length) return false
  return allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function asDiagnosticMap(diagnostic: StudentLoanDiagnosticAnswers): SpecializedAnswerMap {
  return {
    loan_types: diagnostic.loan_types,
    total_balance: diagnostic.total_balance,
    loan_status: diagnostic.loan_status,
    servicer_mode: diagnostic.servicer_mode,
    servicer_name: diagnostic.servicer_name,
    knows_plan: diagnostic.knows_plan,
    current_plan: diagnostic.current_plan,
    income: diagnostic.income,
    household_size: diagnostic.household_size,
    employment_type: diagnostic.employment_type,
    employment_tenure: diagnostic.employment_tenure,
    payment_recent: diagnostic.payment_recent,
    payment_paused: diagnostic.payment_paused,
    previous_actions: diagnostic.previous_actions,
    primary_goal: diagnostic.primary_goal,
    urgency: diagnostic.urgency,
  }
}

function validateClosedString(value: unknown): value is string {
  return typeof value === 'string'
}

function validateMultiArray(value: unknown): { ok: true; values: string[] } | { ok: false; code: string } {
  if (!Array.isArray(value)) return { ok: false, code: 'malformed_student_loan_multi' }
  if (value.some((item) => typeof item !== 'string' || item.trim() === '' || item !== item.trim())) {
    return { ok: false, code: 'malformed_student_loan_multi' }
  }
  if (value.some((item) => item.includes(' ') && !/^[a-z0-9_]+$/.test(item))) {
    return { ok: false, code: 'malformed_student_loan_multi' }
  }
  if (value.some((item) => !/^[a-z0-9_]+$/.test(item))) {
    return { ok: false, code: 'invalid_student_loan_enum' }
  }
  if (new Set(value).size !== value.length) return { ok: false, code: 'malformed_student_loan_multi' }
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
): ValidationResult<StudentLoanDiagnosticAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_student_loan_answers', 'answers.diagnostic must be an object.')
  }
  if (!exactKeySet(value, DIAGNOSTIC_KEYS)) {
    return fail('unknown_student_loan_field', 'answers.diagnostic has unknown or missing keys.')
  }

  const loanTypes = validateMultiArray(value.loan_types)
  if (!loanTypes.ok) {
    return fail(loanTypes.code, 'answers.diagnostic.loan_types is invalid.')
  }
  const previousActions = validateMultiArray(value.previous_actions)
  if (!previousActions.ok) {
    return fail(previousActions.code, 'answers.diagnostic.previous_actions is invalid.')
  }

  const stringKeys = DIAGNOSTIC_KEYS.filter((key) => key !== 'loan_types' && key !== 'previous_actions')
  for (const key of stringKeys) {
    if (!validateClosedString(value[key])) {
      return fail('invalid_student_loan_answers', `answers.diagnostic.${key} must be a string.`)
    }
  }

  const diagnostic: StudentLoanDiagnosticAnswers = {
    loan_types: loanTypes.values,
    total_balance: value.total_balance as string,
    loan_status: value.loan_status as string,
    servicer_mode: value.servicer_mode as string,
    servicer_name: value.servicer_name as string,
    knows_plan: value.knows_plan as string,
    current_plan: value.current_plan as string,
    income: value.income as string,
    household_size: value.household_size as string,
    employment_type: value.employment_type as string,
    employment_tenure: value.employment_tenure as string,
    payment_recent: value.payment_recent as string,
    payment_paused: value.payment_paused as string,
    previous_actions: previousActions.values,
    primary_goal: value.primary_goal as string,
    urgency: value.urgency as string,
  }

  const values = asDiagnosticMap(diagnostic)

  for (const question of STUDENT_LOAN_QUESTIONS) {
    for (const field of question.fields) {
      const visible = isFieldVisible(field, values)
      const present = fieldHasValue(field, values)

      if (!visible && present) {
        return fail(
          'student_loan_hidden_follow_up',
          `Hidden Student Loan field ${field.id} must not be present.`,
        )
      }

      if (field.input === 'short_text') {
        const text = getStringValue(values, field.id)
        if (text.length > (field.maxLength ?? STUDENT_LOAN_SERVICER_MAX_LENGTH)) {
          return fail('student_loan_servicer_too_long', 'Servicer name exceeds the maximum length.')
        }
      }

      if (!visible) continue

      if (field.input === 'multi') {
        const selected = getMultiValue(values, field.id)
        const allowed = optionValues(field)
        if (selected.some((item) => !allowed.has(item))) {
          return fail('invalid_student_loan_enum', `Invalid value for ${field.id}.`)
        }
        const exclusive = field.exclusiveValues ?? []
        const exclusiveSelected = selected.filter((item) => exclusive.includes(item))
        if (exclusiveSelected.length > 0 && selected.length > exclusiveSelected.length) {
          return fail(
            'student_loan_exclusive_conflict',
            `Exclusive option conflict in ${field.id}.`,
          )
        }
        if (exclusiveSelected.length > 1) {
          return fail(
            'student_loan_exclusive_conflict',
            `Exclusive option conflict in ${field.id}.`,
          )
        }
        if (isFieldRequired(field) && selected.length === 0) {
          return fail('incomplete_student_loan_answers', 'All Student Loan questions must be answered.')
        }
        continue
      }

      if (field.input === 'single') {
        const current = getStringValue(values, field.id)
        if (isFieldRequired(field) && current.trim() === '') {
          return fail('incomplete_student_loan_answers', 'All Student Loan questions must be answered.')
        }
        if (current.trim() !== '' && !optionValues(field).has(current)) {
          return fail('invalid_student_loan_enum', `Invalid value for ${field.id}.`)
        }
        continue
      }

      const text = getStringValue(values, field.id).trim()
      if (isFieldRequired(field) && text === '') {
        return fail('incomplete_student_loan_answers', 'All Student Loan questions must be answered.')
      }
    }
  }

  return { ok: true, value: diagnostic }
}

function validateContactObject(value: unknown): ValidationResult<StudentLoanContactAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_student_loan_answers', 'answers.contact must be an object.')
  }
  if (!exactKeySet(value, CONTACT_KEYS)) {
    return fail('unknown_student_loan_field', 'answers.contact has unknown or missing keys.')
  }
  for (const key of CONTACT_KEYS) {
    if (typeof value[key] !== 'string') {
      return fail('invalid_student_loan_answers', `answers.contact.${key} must be a string.`)
    }
  }

  const contact: StudentLoanContactAnswers = {
    firstName: value.firstName as string,
    lastName: value.lastName as string,
    email: value.email as string,
    phone: value.phone as string,
  }

  if (contact.firstName.trim().length === 0 || contact.lastName.trim().length === 0) {
    return fail('incomplete_student_loan_answers', 'First and last name are required.')
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
 * Strict server-side Student Loan answer contract.
 * Rejects unknown keys, invalid enums, hidden follow-up leakage, and forbidden fields.
 * Does not silently normalize invalid conditional combinations.
 */
export function validateStudentLoanAnswers(
  value: unknown,
): ValidationResult<StudentLoanAssessmentAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_student_loan_answers', 'answers must be an object.')
  }
  if (hasForbiddenField(value)) {
    return fail('forbidden_student_loan_field', 'Student Loan answers include a forbidden field.')
  }
  if (!exactKeySet(value, ANSWERS_KEYS)) {
    return fail('unknown_student_loan_field', 'answers has unknown or missing keys.')
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
