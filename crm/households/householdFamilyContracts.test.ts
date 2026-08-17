import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MEMBER_RELATIONSHIP_CREATE_OPTIONS } from './householdsApi'

const here = dirname(fileURLToPath(import.meta.url))
const form = readFileSync(join(here, 'HouseholdMemberFormPanel.tsx'), 'utf8')
const table = readFileSync(join(here, 'HouseholdMembersTable.tsx'), 'utf8')
const tab = readFileSync(join(here, 'ClientWorkspace/tabs/HouseholdTab.tsx'), 'utf8')
const familyList = readFileSync(join(here, 'HouseholdFamilyList.tsx'), 'utf8')
const familyView = readFileSync(join(here, 'familyView.ts'), 'utf8')
const types = readFileSync(join(here, 'types.ts'), 'utf8')

describe('Phase B.5 household family contracts', () => {
  it('presents family members with relationship, primary, DOB, and age', () => {
    expect(tab).toContain('HouseholdFamilyList')
    expect(familyList).toContain('householdMemberFamilyMeta')
    expect(familyList).toContain('formatMemberAge')
    expect(familyList).toContain('date_of_birth')
    expect(table).toContain('is_primary_contact')
    expect(table).toContain('Primary contact')
  })

  it('edits only existing relationship enum values and does not add Sibling', () => {
    expect(form).toContain('getRelationshipSelectOptions')
    expect(MEMBER_RELATIONSHIP_CREATE_OPTIONS.map((option) => option.value)).toEqual([
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
    ])
    expect(types).not.toContain("'sibling'")
    expect(form).not.toContain('sibling')
    expect(familyView).not.toContain('sibling')
  })

  it('does not introduce household merge, person identity, or policy-role inference', () => {
    expect(tab).not.toMatch(/merge household|link existing household|move member/i)
    expect(form).not.toMatch(/owner|insured|annuitant|payor|beneficiary/i)
    expect(familyView).not.toMatch(/owner|insured|beneficiary/)
    expect(familyList).not.toMatch(/policy_participant|beneficiary/)
    expect(tab).not.toContain('canonical person')
    expect(form).not.toContain('from(\'policies\')')
    expect(form).not.toContain('policy_participants')
  })
})
