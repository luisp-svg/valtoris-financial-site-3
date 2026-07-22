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
  it('omits partner and dependent for create', () => {
    const values = getRelationshipSelectOptions().map((o) => o.value)
    expect(values).not.toContain('partner')
    expect(values).not.toContain('dependent')
    expect(values).toContain('parent')
    expect(values).toContain('business_partner')
  })

  it('includes legacy value only while editing that member', () => {
    expect(getRelationshipSelectOptions('partner').map((o) => o.value)).toContain('partner')
    expect(getRelationshipSelectOptions('dependent').map((o) => o.value)).toContain('dependent')
    expect(getRelationshipSelectOptions('spouse').map((o) => o.value)).not.toContain('partner')
  })
})
