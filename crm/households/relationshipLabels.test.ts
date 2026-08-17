import { describe, expect, it } from 'vitest'
import { getRelationshipLabel, getRelationshipSelectOptions } from './householdsApi'

describe('getRelationshipLabel', () => {
  it('maps CRM-6 labels including Self for primary', () => {
    expect(getRelationshipLabel('primary')).toBe('Self')
    expect(getRelationshipLabel('spouse')).toBe('Spouse')
    expect(getRelationshipLabel('child')).toBe('Child')
    expect(getRelationshipLabel('parent')).toBe('Parent')
    expect(getRelationshipLabel('grandparent')).toBe('Grandparent')
    expect(getRelationshipLabel('business_partner')).toBe('Business Partner')
    expect(getRelationshipLabel('employee')).toBe('Employee')
    expect(getRelationshipLabel('other')).toBe('Other')
  })

  it('keeps readable labels for legacy partner and dependent', () => {
    expect(getRelationshipLabel('partner')).toBe('Partner')
    expect(getRelationshipLabel('dependent')).toBe('Dependent')
  })
})

describe('getRelationshipSelectOptions', () => {
  it('exposes partner and dependent from the existing enum on create and edit', () => {
    const values = getRelationshipSelectOptions().map((o) => o.value)
    expect(values).toContain('partner')
    expect(values).toContain('dependent')
    expect(values).toContain('parent')
    expect(values).toContain('business_partner')
    expect(values).not.toContain('sibling')
    expect(values).toEqual([
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
  })

  it('does not invent extra enum values when editing a current member', () => {
    expect(getRelationshipSelectOptions('partner').map((o) => o.value)).toContain('partner')
    expect(getRelationshipSelectOptions('dependent').map((o) => o.value)).toContain('dependent')
    expect(getRelationshipSelectOptions('spouse').map((o) => o.label)).toContain('Primary/Self')
  })
})
