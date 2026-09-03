import { isValidEmailFormat, normalizePhone } from '../../../crm/households/normalizeContact.js'
import {
  getMultiValue,
  getStringValue,
  isFieldRequired,
  isFieldVisible,
} from '../../../components/assessment/specialized/answers.js'
import type { SpecializedAnswerMap, SpecializedField } from '../../../components/assessment/specialized/types.js'
import { FORBIDDEN_HOME_BUYER_FIELD_TOKENS } from '../../../components/assessment/homeBuyer/constants.js'
import { HOME_BUYER_QUESTIONS } from '../../../components/assessment/homeBuyer/questions.js'
import {
  INITIAL_HOME_BUYER_DIAGNOSTIC,
  type HomeBuyerAssessmentAnswers,
  type HomeBuyerContactAnswers,
  type HomeBuyerDiagnosticAnswers,
} from '../../../components/assessment/homeBuyer/types.js'
import { diagnosticToAnswerMap } from '../../../components/assessment/homeBuyer/completeness.js'
import type { ValidationResult } from './validation.js'

const MAX_NAME_LENGTH = 100

const DIAGNOSTIC_KEYS = Object.keys(INITIAL_HOME_BUYER_DIAGNOSTIC)
const CONTACT_KEYS = ['firstName', 'lastName', 'email', 'phone'] as const
const ANSWERS_KEYS = ['diagnostic', 'contact'] as const
const MULTI_KEYS = new Set(['credit_risk_flags', 'documentation_ready'])

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
    return FORBIDDEN_HOME_BUYER_FIELD_TOKENS.some(
      (token) => normalized === token || normalized.includes(token),
    )
  })
}

function exactKeySet(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value)
  if (keys.length !== allowed.length) return false
  return allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function validateClosedString(value: unknown): value is string {
  return typeof value === 'string'
}

function validateMultiArray(value: unknown): { ok: true; values: string[] } | { ok: false; code: string } {
  if (!Array.isArray(value)) return { ok: false, code: 'malformed_home_buyer_multi' }
  if (value.some((item) => typeof item !== 'string' || item.trim() === '' || item !== item.trim())) {
    return { ok: false, code: 'malformed_home_buyer_multi' }
  }
  if (value.some((item) => item.includes(' ') && !/^[a-z0-9_]+$/.test(item))) {
    return { ok: false, code: 'malformed_home_buyer_multi' }
  }
  if (value.some((item) => !/^[a-z0-9_]+$/.test(item))) {
    return { ok: false, code: 'invalid_home_buyer_enum' }
  }
  if (new Set(value).size !== value.length) return { ok: false, code: 'malformed_home_buyer_multi' }
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
): ValidationResult<HomeBuyerDiagnosticAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_home_buyer_answers', 'answers.diagnostic must be an object.')
  }
  if (!exactKeySet(value, DIAGNOSTIC_KEYS)) {
    return fail('unknown_home_buyer_field', 'answers.diagnostic has unknown or missing keys.')
  }

  const creditRisk = validateMultiArray(value.credit_risk_flags)
  if (!creditRisk.ok) {
    return fail(creditRisk.code, 'answers.diagnostic.credit_risk_flags is invalid.')
  }
  const documentation = validateMultiArray(value.documentation_ready)
  if (!documentation.ok) {
    return fail(documentation.code, 'answers.diagnostic.documentation_ready is invalid.')
  }

  const stringKeys = DIAGNOSTIC_KEYS.filter((key) => !MULTI_KEYS.has(key))
  for (const key of stringKeys) {
    if (!validateClosedString(value[key])) {
      return fail('invalid_home_buyer_answers', `answers.diagnostic.${key} must be a string.`)
    }
  }

  const diagnostic: HomeBuyerDiagnosticAnswers = {
    self_reported_score_range: value.self_reported_score_range as string,
    last_reviewed: value.last_reviewed as string,
    credit_risk_flags: creditRisk.values,
    household_income_band: value.household_income_band as string,
    employment_income_type: value.employment_income_type as string,
    tenure_stability: value.tenure_stability as string,
    monthly_debt_burden: value.monthly_debt_burden as string,
    estimated_dti_readiness: value.estimated_dti_readiness as string,
    liquid_savings_band: value.liquid_savings_band as string,
    emergency_reserve_months: value.emergency_reserve_months as string,
    housing_cost_burden: value.housing_cost_burden as string,
    cash_flow_cushion: value.cash_flow_cushion as string,
    down_payment_saved_pct: value.down_payment_saved_pct as string,
    gift_assistance_availability: value.gift_assistance_availability as string,
    documentation_ready: documentation.values,
    buyer_history: value.buyer_history as string,
    intended_occupancy: value.intended_occupancy as string,
    current_housing: value.current_housing as string,
    target_timing: value.target_timing as string,
    readiness_confidence: value.readiness_confidence as string,
  }

  const values = diagnosticToAnswerMap(diagnostic)

  for (const question of HOME_BUYER_QUESTIONS) {
    for (const field of question.fields) {
      const visible = isFieldVisible(field, values)
      const present = fieldHasValue(field, values)

      if (!visible && present) {
        return fail(
          'home_buyer_hidden_follow_up',
          `Hidden Home Buyer field ${field.id} must not be present.`,
        )
      }

      if (!visible) continue

      if (field.input === 'multi') {
        const selected = getMultiValue(values, field.id)
        const allowed = optionValues(field)
        if (selected.some((item) => !allowed.has(item))) {
          return fail('invalid_home_buyer_enum', `Invalid value for ${field.id}.`)
        }
        const exclusive = field.exclusiveValues ?? []
        const exclusiveSelected = selected.filter((item) => exclusive.includes(item))
        if (exclusiveSelected.length > 0 && selected.length > exclusiveSelected.length) {
          return fail('home_buyer_exclusive_conflict', `Exclusive option conflict in ${field.id}.`)
        }
        if (exclusiveSelected.length > 1) {
          return fail('home_buyer_exclusive_conflict', `Exclusive option conflict in ${field.id}.`)
        }
        if (isFieldRequired(field) && selected.length === 0) {
          return fail('incomplete_home_buyer_answers', 'All Home Buyer questions must be answered.')
        }
        continue
      }

      if (field.input === 'single') {
        const current = getStringValue(values, field.id)
        if (isFieldRequired(field) && current.trim() === '') {
          return fail('incomplete_home_buyer_answers', 'All Home Buyer questions must be answered.')
        }
        if (current.trim() !== '' && !optionValues(field).has(current)) {
          return fail('invalid_home_buyer_enum', `Invalid value for ${field.id}.`)
        }
        continue
      }

      const text = getStringValue(values, field.id).trim()
      if (isFieldRequired(field) && text === '') {
        return fail('incomplete_home_buyer_answers', 'All Home Buyer questions must be answered.')
      }
    }
  }

  return { ok: true, value: diagnostic }
}

function validateContactObject(value: unknown): ValidationResult<HomeBuyerContactAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_home_buyer_answers', 'answers.contact must be an object.')
  }
  if (!exactKeySet(value, CONTACT_KEYS)) {
    return fail('unknown_home_buyer_field', 'answers.contact has unknown or missing keys.')
  }
  for (const key of CONTACT_KEYS) {
    if (typeof value[key] !== 'string') {
      return fail('invalid_home_buyer_answers', `answers.contact.${key} must be a string.`)
    }
  }

  const contact: HomeBuyerContactAnswers = {
    firstName: value.firstName as string,
    lastName: value.lastName as string,
    email: value.email as string,
    phone: value.phone as string,
  }

  if (contact.firstName.trim().length === 0 || contact.lastName.trim().length === 0) {
    return fail('incomplete_home_buyer_answers', 'First and last name are required.')
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
 * Strict server-side Home Buyer answer contract.
 * Rejects unknown keys, invalid enums, exclusive conflicts, and forbidden
 * identity/credential/upload fields. Credit answers stay self-reported.
 */
export function validateHomeBuyerAnswers(
  value: unknown,
): ValidationResult<HomeBuyerAssessmentAnswers> {
  if (!isPlainObject(value)) {
    return fail('invalid_home_buyer_answers', 'answers must be an object.')
  }
  if (hasForbiddenField(value)) {
    return fail('forbidden_home_buyer_field', 'Home Buyer answers include a forbidden field.')
  }
  if (!exactKeySet(value, ANSWERS_KEYS)) {
    return fail('unknown_home_buyer_field', 'answers has unknown or missing keys.')
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
