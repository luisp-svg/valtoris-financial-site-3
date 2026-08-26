import { describe, expect, it } from 'vitest'
import { defaultWritingAllocations } from '../production/applicationView'
import {
  carriersForConversion,
  conversionProductLinesForVertical,
  formatCaseCreatedStageLabel,
  formatOpportunityApplicationHandoffLabel,
  opportunityAllowsCreateCase,
  pickLiveLinkedApplication,
  productsForConversion,
  slimLiveCasesByOpportunityId,
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
    expect(conversionProductLinesForVertical('credit_repair')).toEqual([])
    expect(conversionProductLinesForVertical('student_loans')).toEqual([])
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
    expect(
      opportunityAllowsCreateCase({ status: 'open', service_vertical: { code: 'credit_repair' } }),
    ).toBe(false)
    expect(
      opportunityAllowsCreateCase({ status: 'won', service_vertical: { code: 'student_loans' } }),
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

describe('live Case linkage helpers', () => {
  it('keeps unlinked embeds as null and ignores soft-deleted rows', () => {
    expect(pickLiveLinkedApplication(null)).toBeNull()
    expect(pickLiveLinkedApplication([])).toBeNull()
    expect(
      pickLiveLinkedApplication([
        { id: 'app-del', production_stage: 'submitted', deleted_at: '2026-08-01T00:00:00.000Z' },
      ]),
    ).toBeNull()
  })

  it('selects the live row from a left embed that also contains deleted Cases', () => {
    expect(
      pickLiveLinkedApplication([
        { id: 'app-del', production_stage: 'submitted', deleted_at: '2026-08-01T00:00:00.000Z' },
        { id: 'app-live', production_stage: 'draft', deleted_at: null },
      ]),
    ).toEqual({ id: 'app-live', production_stage: 'draft' })
    expect(
      pickLiveLinkedApplication({ id: 'app-one', production_stage: 'in_underwriting', deleted_at: null }),
    ).toEqual({ id: 'app-one', production_stage: 'in_underwriting' })
  })

  it('maps household applications onto opportunity IDs without keeping extra fields', () => {
    const live = slimLiveCasesByOpportunityId([
      {
        id: 'app-1',
        opportunity_id: 'opp-1',
        production_stage: 'draft',
        deleted_at: null,
      },
      {
        id: 'app-deleted',
        opportunity_id: 'opp-2',
        production_stage: 'submitted',
        deleted_at: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 'app-orphan',
        opportunity_id: null,
        production_stage: 'draft',
        deleted_at: null,
      },
    ])
    expect(live.get('opp-1')).toEqual({ applicationId: 'app-1', productionStage: 'draft' })
    expect(live.get('opp-2')).toBeUndefined()
    expect(live.size).toBe(1)
    expect(formatCaseCreatedStageLabel('draft')).toBe('Application Draft')
    expect(formatCaseCreatedStageLabel(null)).toBeNull()
  })
})

describe('Opportunity application handoff labels', () => {
  it('labels draft and pre_submitted as Application Started, never Case Active', () => {
    expect(formatOpportunityApplicationHandoffLabel('draft')).toBe('Application Started')
    expect(formatOpportunityApplicationHandoffLabel('pre_submitted')).toBe('Application Started')
    expect(formatOpportunityApplicationHandoffLabel('draft')).not.toBe('Case Active')
    expect(formatOpportunityApplicationHandoffLabel('pre_submitted')).not.toBe('Case Active')
  })

  it('labels submitted+ as Case Active', () => {
    expect(formatOpportunityApplicationHandoffLabel('submitted')).toBe('Case Active')
    expect(formatOpportunityApplicationHandoffLabel('in_underwriting')).toBe('Case Active')
    expect(formatOpportunityApplicationHandoffLabel('in_force')).toBe('Case Active')
  })

  it('uses Application Linked when stage is missing instead of inventing Case Active', () => {
    expect(formatOpportunityApplicationHandoffLabel(null)).toBe('Application Linked')
    expect(formatOpportunityApplicationHandoffLabel('')).toBe('Application Linked')
  })
})
