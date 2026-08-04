import { normalizeEmail, normalizePhone } from '../../../crm/households/normalizeContact.js'
import type { DemoAssessmentAnswers } from '../../../components/assessment/types.js'

/** Original submitted strings, preserved verbatim (trimmed) for audit/history. */
export type SubmittedContactSnapshot = {
  firstName: string
  lastName: string
  email: string
  phone: string
  age: string
  state: string
  maritalStatus: string
  numberOfChildren: string
}

export type NormalizedSubmittedContact = {
  firstName: string
  lastName: string
  displayName: string
  normalizedEmail: string | null
  normalizedPhone: string | null
  submitted: SubmittedContactSnapshot
}

export function submittedContactSnapshot(answers: DemoAssessmentAnswers): SubmittedContactSnapshot {
  return {
    firstName: answers.family.firstName.trim(),
    lastName: answers.family.lastName.trim(),
    email: answers.family.email.trim(),
    phone: answers.family.phone.trim(),
    age: answers.family.age.trim(),
    state: answers.family.state.trim(),
    maritalStatus: answers.family.maritalStatus.trim(),
    numberOfChildren: answers.family.numberOfChildren.trim(),
  }
}

export function buildDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim()
}

/** Normalizes `answers.family` into the shape used for matching + CRM writes. */
export function normalizeSubmittedContact(answers: DemoAssessmentAnswers): NormalizedSubmittedContact {
  const submitted = submittedContactSnapshot(answers)

  return {
    firstName: submitted.firstName,
    lastName: submitted.lastName,
    displayName: buildDisplayName(submitted.firstName, submitted.lastName),
    normalizedEmail: normalizeEmail(submitted.email),
    normalizedPhone: normalizePhone(submitted.phone),
    submitted,
  }
}
