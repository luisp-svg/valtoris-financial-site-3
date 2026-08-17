import { getMemberDisplayName, getRelationshipLabel } from './householdsApi'
import type { HouseholdMemberSummary, MemberRelationship } from './types'

const RELATIONSHIP_ORDER: Record<MemberRelationship, number> = {
  primary: 0,
  spouse: 1,
  partner: 2,
  child: 3,
  dependent: 4,
  parent: 5,
  grandparent: 6,
  business_partner: 7,
  employee: 8,
  other: 9,
}

export function compareHouseholdMembersForFamilyView(
  a: HouseholdMemberSummary,
  b: HouseholdMemberSummary,
): number {
  if (a.is_primary_contact !== b.is_primary_contact) {
    return a.is_primary_contact ? -1 : 1
  }
  const orderA = RELATIONSHIP_ORDER[a.relationship] ?? 50
  const orderB = RELATIONSHIP_ORDER[b.relationship] ?? 50
  if (orderA !== orderB) return orderA - orderB
  return getMemberDisplayName(a).localeCompare(getMemberDisplayName(b))
}

export function sortHouseholdMembersForFamilyView(
  members: readonly HouseholdMemberSummary[],
): HouseholdMemberSummary[] {
  return [...members].sort(compareHouseholdMembersForFamilyView)
}

/**
 * Household relationship line. `is_primary_contact` is the operational Primary.
 * `relationship = primary` is Self/Primary as a family label, not a second primary.
 */
export function householdMemberFamilyLabels(member: HouseholdMemberSummary): {
  primary: boolean
  relationshipLabel: string
} {
  return {
    primary: member.is_primary_contact,
    relationshipLabel: getRelationshipLabel(member.relationship),
  }
}

export function householdMemberFamilyMeta(member: HouseholdMemberSummary): string {
  const { primary, relationshipLabel } = householdMemberFamilyLabels(member)
  if (primary && member.relationship === 'primary') return 'Primary'
  if (primary) return `Primary · ${relationshipLabel}`
  return relationshipLabel
}
