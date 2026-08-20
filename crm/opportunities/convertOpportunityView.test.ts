import { describe, expect, it } from 'vitest'
import { defaultWritingAllocations } from '../production/applicationView'
import {
  carriersForConversion,
  conversionProductLinesForVertical,
  opportunityAllowsCreateCase,
  productsForConversion,
  suggestedWritingAllocations,
  validateConversionDraft,
} from './convertOpportunityView'

const ALLOC = defaultWritingAllocations('adv-1')

describe('opportunity case conversion eligibility', () => {
  it('allows Life and Retirement, and open/on_hold/won only', () => {
    expect(conversionProductLinesForVertical('life')).toEqual(['life_term', 'life_permanent'])
    expect(conversionProductLinesForVertical('retirement')).toEqual(['fia'])
    expect(conversionProductLinesForVertical('pc')).toEqual([])
    expect(conversionProductLinesForVertical('wills_trusts')).toEqual([])
    expect(
      opportunityAllowsCreateCase({ status: 'open', service_vertical: { code: 'life' } }),
    ).toBe(true)
    expect(
      opportunityAllowsCreateCase({ status: 'on_hold', service_vertical: { code: 'retirement' } }),
    ).toBe(true)
    expect(
      opportunityAllowsCreateCase({ status: 'won', service_vertical: { code: 'life' } }),
    ).toBe(true)
    expect(
      opportunityAllowsCreateCase({ status: 'lost', service_vertical: { code: 'life' } }),
    ).toBe(false)
    expect(
      opportunityAllowsCreateCase({ status: 'open', service_vertical: { code: 'pc' } }),
    ).toBe(false)
  })

  it('prefills assigned advisor only when that writing profile is still eligible', () => {
    const advisors = [{ id: 'adv-1', display_name: 'A', states_licensed: ['TX'] }]
    expect(suggestedWritingAllocations('adv-1', advisors)).toEqual(ALLOC)
    expect(suggestedWritingAllocations('adv-gone', advisors)).toEqual([])
    expect(suggestedWritingAllocations(null, advisors)).toEqual([])
  })

  it('filters products to the Opportunity vertical and does not assume a household member', () => {
    const products = [
      { id: 'p-term', carrier_id: 'c1', name: 'Term', product_line: 'life_term' as const },
      { id: 'p-fia', carrier_id: 'c1', name: 'FIA', product_line: 'fia' as const },
    ]
    const carriers = [{ id: 'c1', name: 'NLG', code: 'NLG' }]
    expect(productsForConversion(products, 'c1', 'life').map((row) => row.id)).toEqual(['p-term'])
    expect(productsForConversion(products, 'c1', 'retirement').map((row) => row.id)).toEqual(['p-fia'])
    expect(carriersForConversion(carriers, products, 'life').map((row) => row.id)).toEqual(['c1'])
    const missingInsured = validateConversionDraft({
      verticalCode: 'life',
      carrierId: 'c1',
      productId: 'p-term',
      productLine: 'life_term',
      state: 'TX',
      plannedPremium: '',
      premiumMode: '',
      faceAmount: '',
      initialDeposit: '',
      roleMembers: { primary_client: 'm1', owner: 'm1' },
      allocations: ALLOC,
      householdMemberIds: ['m1'],
    })
    expect(missingInsured.invalid).toBe(true)
    expect(missingInsured.fieldErrors.participants).toBeTruthy()
  })

  it('rejects a participant from another household', () => {
    const result = validateConversionDraft({
      verticalCode: 'life',
      carrierId: 'c1',
      productId: 'p-term',
      productLine: 'life_term',
      state: 'TX',
      plannedPremium: '',
      premiumMode: '',
      faceAmount: '',
      initialDeposit: '',
      roleMembers: { primary_client: 'm1', insured: 'm-other', owner: 'm1' },
      allocations: ALLOC,
      householdMemberIds: ['m1'],
    })
    expect(result.invalid).toBe(true)
    expect(result.fieldErrors.participants).toMatch(/household/)
  })
})
