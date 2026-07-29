import type { CrmHouseholdDetail, HouseholdMemberSummary } from '../types'
import type { HouseholdOnboardingAnswers } from './onboardingFormTypes'

/** Whole-number age from ISO date-of-birth (YYYY-MM-DD), or null when unknown. */
export function ageFromDateOfBirth(dob: string | null | undefined, now = new Date()): number | null {
  if (!dob) return null
  const birth = new Date(`${dob}T00:00:00.000Z`)
  if (Number.isNaN(birth.getTime())) return null
  let age = now.getUTCFullYear() - birth.getUTCFullYear()
  const m = now.getUTCMonth() - birth.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1
  return age >= 0 && age < 130 ? age : null
}

export function getPrimaryMember(
  household: CrmHouseholdDetail,
): HouseholdMemberSummary | null {
  return household.members.find((m) => m.is_primary_contact) ?? household.members[0] ?? null
}

export function getPrimaryMemberAge(
  household: CrmHouseholdDetail,
  now = new Date(),
): number | null {
  return ageFromDateOfBirth(getPrimaryMember(household)?.date_of_birth, now)
}

export function hasMinorHouseholdMembers(
  household: CrmHouseholdDetail,
  now = new Date(),
): boolean {
  return household.members.some((member) => {
    const age = ageFromDateOfBirth(member.date_of_birth, now)
    if (age != null) return age < 18
    return member.relationship === 'child' || member.relationship === 'dependent'
  })
}

export function overviewReportsDependents(answers: HouseholdOnboardingAnswers): boolean {
  return answers.overview.dependentsCount != null && answers.overview.dependentsCount > 0
}

export function householdHasIncomeDependentsContext(
  answers: HouseholdOnboardingAnswers,
  household: CrmHouseholdDetail,
): boolean {
  return overviewReportsDependents(answers) || hasMinorHouseholdMembers(household)
}

export function hasBusinessOwnershipAsset(answers: HouseholdOnboardingAnswers): boolean {
  return answers.assets.items.some((item) => item.category === 'business_ownership')
}

export function hasRetirementAccountAsset(answers: HouseholdOnboardingAnswers): boolean {
  return answers.assets.items.some((item) => item.category === 'retirement_account')
}

export function countKnownRetirementAssetBalances(
  answers: HouseholdOnboardingAnswers,
): { count: number; knownBalanceCents: number } {
  let count = 0
  let knownBalanceCents = 0
  for (const item of answers.assets.items) {
    if (item.category !== 'retirement_account') continue
    count += 1
    if (item.balanceCents != null) knownBalanceCents += item.balanceCents
  }
  return { count, knownBalanceCents }
}

/** ISO calendar date YYYY-MM-DD validation (not a timestamp). */
export function isValidIsoDateOnly(value: string | null | undefined): boolean {
  if (value == null || value === '') return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map((part) => Number.parseInt(part, 10))
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}
