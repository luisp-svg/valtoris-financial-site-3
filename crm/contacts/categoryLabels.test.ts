import { describe, expect, it } from 'vitest'
import { CONTACT_CATEGORY_OPTIONS, contactCategoryLabel } from './categoryLabels'

describe('contact category labels', () => {
  it('uses approved friendly labels', () => {
    expect(contactCategoryLabel('potential_client')).toBe('Potential client')
    expect(contactCategoryLabel('referral_partner')).toBe('Referral partner')
    expect(contactCategoryLabel('professional_partner')).toBe('Professional partner')
    expect(contactCategoryLabel('vendor')).toBe('Vendor')
    expect(contactCategoryLabel('other')).toBe('Other')
    expect(CONTACT_CATEGORY_OPTIONS.map((o) => o.label).join(' ')).not.toMatch(/prospect/i)
  })
})
