import type { CrmHouseholdDetail, HouseholdPolicySummary } from '../../../households/types'
import type { HouseholdFinancialProgressInput } from '../../types'
import { LTC_RELEVANT_ADULT_RELATIONSHIPS } from './constants'
import { policiesOfKind, sumCoverageAmount } from './classifyPolicy'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? value : null
  }
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  if (cleaned === '') return null
  const parsed = Number.parseFloat(cleaned)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function nestedString(
  answers: Record<string, unknown> | null,
  section: string,
  field: string,
): string | null {
  const sectionRecord = asRecord(answers?.[section])
  return asString(sectionRecord?.[field])
}

function nestedAmount(
  answers: Record<string, unknown> | null,
  section: string,
  field: string,
): number | null {
  const sectionRecord = asRecord(answers?.[section])
  return parseAmount(sectionRecord?.[field])
}

function yesNoFromString(value: string | null): 'yes' | 'no' | null {
  if (value == null) return null
  const normalized = value.toLowerCase()
  if (normalized === 'yes' || normalized === 'y' || normalized === 'true') return 'yes'
  if (normalized === 'no' || normalized === 'n' || normalized === 'false') return 'no'
  return null
}

/**
 * Reads a previously recorded / calculated protection need.
 *
 * Path taken (methodology hardening): the Family Protection Gap Calculator in
 * `components/calculator/calculations.ts` cannot be safely reused here — it
 * requires full CalculatorAnswers (housing, debt, education, final expenses,
 * replacement years) that are not present on HouseholdFinancialProgressInput.
 * A second income×5×dependent formula is intentionally NOT introduced.
 * Adequacy scoring therefore requires an existing recorded need value.
 */
export function resolveRecordedProtectionNeed(
  assessments: HouseholdFinancialProgressInput['assessments'],
): number | null {
  const sources = [
    assessments?.family?.derived_metrics,
    assessments?.protection?.derived_metrics,
    assessments?.retirement?.derived_metrics,
    assessments?.family?.answers,
    assessments?.protection?.answers,
  ]

  const keys = [
    'protectionNeed',
    'protection_need',
    'lifeInsuranceNeed',
    'estimatedProtectionNeed',
    'recommendedProtectionNeed',
    'totalNeed',
  ] as const

  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const direct = parseAmount(source[key])
      if (direct != null && direct > 0) return direct
    }
    const nestedProtection = asRecord(source.protection)
    if (nestedProtection) {
      for (const key of keys) {
        const nested = parseAmount(nestedProtection[key])
        if (nested != null && nested > 0) return nested
      }
      const nestedNeed = parseAmount(nestedProtection.need)
      if (nestedNeed != null && nestedNeed > 0) return nestedNeed
    }
    const nestedMetrics = asRecord(source.derived_metrics)
    if (nestedMetrics) {
      for (const key of keys) {
        const nested = parseAmount(nestedMetrics[key])
        if (nested != null && nested > 0) return nested
      }
    }
  }

  return null
}

function ageFromDateOfBirth(dateOfBirth: string, asOfIso: string): number | null {
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`)
  const asOf = new Date(asOfIso)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(asOf.getTime())) return null

  let age = asOf.getUTCFullYear() - birth.getUTCFullYear()
  const monthDelta = asOf.getUTCMonth() - birth.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < birth.getUTCDate())) {
    age -= 1
  }
  return age >= 0 ? age : null
}

function parseAgeYears(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }
  if (typeof value !== 'string') return null
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

/**
 * Collects ages for relevant adults (primary / spouse / partner).
 * Uses member date_of_birth first, then assessment age fields.
 */
export function resolveRelevantAdultAges(
  household: CrmHouseholdDetail,
  assessments: HouseholdFinancialProgressInput['assessments'],
  asOfIso: string,
): number[] {
  const ages: number[] = []
  const relevantMembers = household.members.filter((member) =>
    (LTC_RELEVANT_ADULT_RELATIONSHIPS as readonly string[]).includes(member.relationship),
  )

  for (const member of relevantMembers) {
    if (!member.date_of_birth) continue
    const age = ageFromDateOfBirth(member.date_of_birth, asOfIso)
    if (age != null) ages.push(age)
  }

  if (ages.length > 0) return ages

  const familyAnswers =
    assessments?.family?.answers ?? assessments?.protection?.answers ?? null
  const retirementAnswers = assessments?.retirement?.answers ?? null

  const familyAge = parseAgeYears(nestedString(familyAnswers, 'family', 'age'))
  if (familyAge != null) ages.push(familyAge)

  const retirementAge = parseAgeYears(
    nestedString(retirementAnswers, 'household', 'currentAge'),
  )
  if (retirementAge != null) ages.push(retirementAge)

  const spouseAge = parseAgeYears(nestedString(retirementAnswers, 'household', 'spouseAge'))
  if (spouseAge != null) ages.push(spouseAge)

  return ages
}

export type ProtectionSignals = {
  policiesProvided: boolean
  policies: HouseholdPolicySummary[]
  lifeCoverageAmount: number | null
  hasLifeCoverageSignal: boolean
  hasDisabilityPolicy: boolean
  hasCriticalIllnessPolicy: boolean
  hasLongTermCarePolicy: boolean
  disabilityAnswer: 'yes' | 'no' | null
  beneficiariesReviewed: 'yes' | 'no' | null
  longTermCarePlan: string | null
  lifePolicyCount: number
  lifePoliciesWithBeneficiaryData: number
  lifePoliciesMissingBeneficiary: number
  /**
   * Recorded/calculated protection need from assessment derived_metrics or answers.
   * Null when unavailable — do not invent a second need methodology.
   */
  recordedProtectionNeed: number | null
  relevantAdultAges: number[]
  asOf: string
}

function pickFamilyAnswers(
  assessments: HouseholdFinancialProgressInput['assessments'],
): Record<string, unknown> | null {
  return assessments?.family?.answers ?? assessments?.protection?.answers ?? null
}

function pickRetirementAnswers(
  assessments: HouseholdFinancialProgressInput['assessments'],
): Record<string, unknown> | null {
  return assessments?.retirement?.answers ?? null
}

function resolveLifeCoverage(
  policies: readonly HouseholdPolicySummary[],
  familyAnswers: Record<string, unknown> | null,
): { amount: number | null; hasSignal: boolean } {
  const lifePolicies = policiesOfKind(policies, 'life')
  const fromPolicies = sumCoverageAmount(lifePolicies)
  if (lifePolicies.length > 0) {
    return { amount: fromPolicies, hasSignal: true }
  }

  const fromAssessment = nestedAmount(familyAnswers, 'protection', 'currentLifeInsurance')
  if (fromAssessment != null) {
    return { amount: fromAssessment, hasSignal: true }
  }

  return { amount: null, hasSignal: false }
}

function resolveBeneficiariesReviewed(
  familyAnswers: Record<string, unknown> | null,
  retirementAnswers: Record<string, unknown> | null,
): 'yes' | 'no' | null {
  const fromFamily = yesNoFromString(
    nestedString(familyAnswers, 'protection', 'beneficiariesReviewed'),
  )
  if (fromFamily) return fromFamily

  return yesNoFromString(nestedString(retirementAnswers, 'estate', 'beneficiariesReviewed'))
}

export function extractProtectionSignals(
  input: HouseholdFinancialProgressInput,
): ProtectionSignals {
  const policiesProvided = input.policies !== undefined
  const policies = input.policies ?? []
  const familyAnswers = pickFamilyAnswers(input.assessments)
  const retirementAnswers = pickRetirementAnswers(input.assessments)
  const asOf = input.asOf ?? new Date().toISOString()

  const life = resolveLifeCoverage(policies, familyAnswers)
  const lifePolicies = policiesOfKind(policies, 'life')
  const lifePoliciesMissingBeneficiary = lifePolicies.filter((policy) => !policy.beneficiary).length
  const lifePoliciesWithBeneficiaryData = lifePolicies.length - lifePoliciesMissingBeneficiary

  return {
    policiesProvided,
    policies,
    lifeCoverageAmount: life.amount,
    hasLifeCoverageSignal: life.hasSignal,
    hasDisabilityPolicy: policiesOfKind(policies, 'disability').length > 0,
    hasCriticalIllnessPolicy: policiesOfKind(policies, 'critical_illness').length > 0,
    hasLongTermCarePolicy: policiesOfKind(policies, 'long_term_care').length > 0,
    disabilityAnswer: yesNoFromString(
      nestedString(familyAnswers, 'protection', 'hasDisabilityProtection'),
    ),
    beneficiariesReviewed: resolveBeneficiariesReviewed(familyAnswers, retirementAnswers),
    longTermCarePlan: nestedString(retirementAnswers, 'healthcare', 'longTermCarePlan'),
    lifePolicyCount: lifePolicies.length,
    lifePoliciesWithBeneficiaryData,
    lifePoliciesMissingBeneficiary,
    recordedProtectionNeed: resolveRecordedProtectionNeed(input.assessments),
    relevantAdultAges: resolveRelevantAdultAges(input.household, input.assessments, asOf),
    asOf,
  }
}
