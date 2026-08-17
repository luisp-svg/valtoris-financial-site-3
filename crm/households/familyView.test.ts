import { describe, expect, it } from 'vitest'
import {
  householdMemberFamilyMeta,
  sortHouseholdMembersForFamilyView,
} from './familyView'
import type { HouseholdMemberSummary, MemberRelationship } from './types'

function member(
  partial: Partial<HouseholdMemberSummary> &
    Pick<HouseholdMemberSummary, 'id' | 'first_name' | 'relationship' | 'is_primary_contact'>,
): HouseholdMemberSummary {
  return {
    household_id: 'hh1',
    last_name: 'Smith',
    email: null,
    phone: null,
    date_of_birth: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('household family presentation', () => {
  it('labels the operational primary contact as Primary and keeps relationship text', () => {
    expect(
      householdMemberFamilyMeta(
        member({
          id: '1',
          first_name: 'John',
          relationship: 'primary',
          is_primary_contact: true,
        }),
      ),
    ).toBe('Primary')
    expect(
      householdMemberFamilyMeta(
        member({
          id: '2',
          first_name: 'Jane',
          relationship: 'spouse',
          is_primary_contact: false,
        }),
      ),
    ).toBe('Spouse')
    expect(
      householdMemberFamilyMeta(
        member({
          id: '3',
          first_name: 'Michael',
          relationship: 'child',
          is_primary_contact: false,
        }),
      ),
    ).toBe('Child')
    expect(
      householdMemberFamilyMeta(
        member({
          id: '4',
          first_name: 'Robert',
          relationship: 'parent',
          is_primary_contact: false,
        }),
      ),
    ).toBe('Parent')
    expect(
      householdMemberFamilyMeta(
        member({
          id: '5',
          first_name: 'Alex',
          relationship: 'partner',
          is_primary_contact: false,
        }),
      ),
    ).toBe('Partner')
    expect(
      householdMemberFamilyMeta(
        member({
          id: '6',
          first_name: 'Sam',
          relationship: 'dependent',
          is_primary_contact: false,
        }),
      ),
    ).toBe('Dependent')
  })

  it('keeps one operational primary even when the relationship is spouse', () => {
    expect(
      householdMemberFamilyMeta(
        member({
          id: '2',
          first_name: 'Jane',
          relationship: 'spouse',
          is_primary_contact: true,
        }),
      ),
    ).toBe('Primary · Spouse')
  })

  it('sorts primary contact first, then spouse/partner, then children', () => {
    const sorted = sortHouseholdMembersForFamilyView([
      member({ id: 'c', first_name: 'Michael', relationship: 'child', is_primary_contact: false }),
      member({ id: 's', first_name: 'Jane', relationship: 'spouse', is_primary_contact: false }),
      member({ id: 'p', first_name: 'John', relationship: 'primary', is_primary_contact: true }),
      member({ id: 'k', first_name: 'Sarah', relationship: 'child', is_primary_contact: false }),
    ])
    expect(sorted.map((row) => row.first_name)).toEqual(['John', 'Jane', 'Michael', 'Sarah'])
  })

  it('only uses existing member_relationship values', () => {
    const allowed: MemberRelationship[] = [
      'primary',
      'spouse',
      'partner',
      'child',
      'dependent',
      'parent',
      'grandparent',
      'business_partner',
      'employee',
      'other',
    ]
    expect(allowed).not.toContain('sibling' as MemberRelationship)
  })
})
