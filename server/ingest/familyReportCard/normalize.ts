import { normalizeEmail, normalizePhone } from '../../../crm/households/normalizeContact.js'
import type { BusinessAssessmentAnswers } from '../../../components/assessment/business/types.js'
import type { RetirementAssessmentAnswers } from '../../../components/assessment/retirement/types.js'
import type { DemoAssessmentAnswers } from '../../../components/assessment/types.js'
import type { CalculatorAnswers } from '../../../components/calculator/types.js'
import type { PublicReportCardAssessmentType } from '../../../modules/reportCard/publicIngestCatalog.js'
import type { PublicReportCardAnswers } from './types.js'

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

function fromContactFields(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
  age?: string
  state?: string
  maritalStatus?: string
  numberOfChildren?: string
}): NormalizedSubmittedContact {
  const submitted: SubmittedContactSnapshot = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    age: (input.age ?? '').trim(),
    state: (input.state ?? '').trim(),
    maritalStatus: (input.maritalStatus ?? '').trim(),
    numberOfChildren: (input.numberOfChildren ?? '').trim(),
  }
  return {
    firstName: submitted.firstName,
    lastName: submitted.lastName,
    displayName: buildDisplayName(submitted.firstName, submitted.lastName),
    normalizedEmail: normalizeEmail(submitted.email),
    normalizedPhone: normalizePhone(submitted.phone),
    submitted,
  }
}

/** Normalizes `answers.family` into the shape used for matching + CRM writes. */
export function normalizeSubmittedContact(answers: DemoAssessmentAnswers): NormalizedSubmittedContact {
  return fromContactFields(submittedContactSnapshot(answers))
}

export function normalizeBusinessContact(answers: BusinessAssessmentAnswers): NormalizedSubmittedContact {
  return fromContactFields(answers.owner)
}

export function normalizeRetirementContact(
  answers: RetirementAssessmentAnswers,
): NormalizedSubmittedContact {
  return fromContactFields({
    firstName: answers.household.firstName,
    lastName: answers.household.lastName,
    email: answers.household.email,
    phone: answers.household.phone,
    age: answers.household.currentAge,
    state: answers.household.state,
    maritalStatus: answers.household.maritalStatus,
  })
}

export function normalizeProtectionContact(answers: CalculatorAnswers): NormalizedSubmittedContact {
  return fromContactFields(answers.family)
}

export function normalizePublicReportCardContact(
  assessmentType: PublicReportCardAssessmentType,
  answers: PublicReportCardAnswers,
): NormalizedSubmittedContact {
  switch (assessmentType) {
    case 'family':
      return normalizeSubmittedContact(answers as DemoAssessmentAnswers)
    case 'business':
      return normalizeBusinessContact(answers as BusinessAssessmentAnswers)
    case 'retirement':
      return normalizeRetirementContact(answers as RetirementAssessmentAnswers)
    case 'protection':
      return normalizeProtectionContact(answers as CalculatorAnswers)
  }
}
