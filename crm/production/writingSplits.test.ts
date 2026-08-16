import { describe, expect, it } from 'vitest'
import { defaultWritingAllocations, productsForCarrier, validateApplicationDraft } from './applicationView'
import type { ApplicationDraftInput } from './applicationView'
import type { ProductionEntryProductOption } from './types'
import {
  allocationPayloadHasForbiddenKeys,
  allocationsFromPercentSplit,
  advisorLicensingWarning,
  parseWritingPercentInput,
  toWritingAllocationRpcPayload,
  writingBpsToPercent,
  writingPercentToBps,
  writingSplitError,
  writingSplitSummary,
} from './writingSplits'

const products: ProductionEntryProductOption[] = [
  { id: 'p-term', carrier_id: 'c1', name: 'Term 20', product_line: 'life_term' },
  { id: 'p-perm', carrier_id: 'c1', name: 'IUL', product_line: 'life_permanent' },
  { id: 'p-fia', carrier_id: 'c2', name: 'FIA Plus', product_line: 'fia' },
]

function lifeDraft(over: Partial<ApplicationDraftInput> = {}): ApplicationDraftInput {
  return {
    householdId: 'hh1',
    carrierId: 'c1',
    productId: 'p-term',
    productLine: 'life_term',
    state: 'TX',
    targetStage: 'draft',
    premiumMode: 'annual',
    plannedPremium: '1200',
    faceAmount: '',
    initialDeposit: '',
    applicationNumber: '',
    submissionDate: '',
    roleMembers: { primary_client: 'm1', insured: 'm1', owner: 'm1' },
    allocations: defaultWritingAllocations('adv1'),
    ...over,
  }
}

describe('UI-2 writing splits', () => {
  it('filters products to the selected carrier', () => {
    expect(productsForCarrier(products, 'c1').map((row) => row.id)).toEqual(['p-term', 'p-perm'])
    expect(productsForCarrier(products, 'c2').map((row) => row.id)).toEqual(['p-fia'])
    expect(productsForCarrier(products, '')).toEqual([])
  })

  it('clears an invalid product when the carrier no longer owns it', () => {
    const stillValid = productsForCarrier(products, 'c2').some((row) => row.id === 'p-term')
    expect(stillValid).toBe(false)
  })

  it('converts 75/25 and 50/50 splits to backend bps without normalizing', () => {
    const split7525 = allocationsFromPercentSplit(['a', 'b'], [75, 25])
    expect(split7525[0]).toMatchObject({
      recipient_type: 'advisor',
      allocation_role: 'writing',
      commission_bps: 7500,
      production_credit_bps: 7500,
    })
    expect(split7525[1]).toMatchObject({ commission_bps: 2500, production_credit_bps: 2500 })
    expect(writingPercentToBps(50)).toBe(5000)
    expect(writingBpsToPercent(5000)).toBe(50)
    const fifty = allocationsFromPercentSplit(['a', 'b'], [50, 50])
    expect(fifty.map((row) => row.commission_bps)).toEqual([5000, 5000])
    expect(writingSplitError(split7525)).toBeUndefined()
    expect(writingSplitError(fifty)).toBeUndefined()
  })

  it('defaults one writer to 100% and shows remaining', () => {
    const one = defaultWritingAllocations('adv1')
    expect(one[0].commission_bps).toBe(10000)
    expect(writingSplitSummary(one)).toMatchObject({ allocatedPercent: 100, remainingPercent: 0 })
    expect(writingSplitError(one)).toBeUndefined()
  })

  it('blocks save when the total is below or above 100%', () => {
    const below = validateApplicationDraft(
      lifeDraft({ allocations: allocationsFromPercentSplit(['a', 'b'], [60, 20]) }),
    )
    expect(below.fieldErrors.allocations).toBe('Writing allocations must total 100%.')
    const above = validateApplicationDraft(
      lifeDraft({ allocations: allocationsFromPercentSplit(['a', 'b'], [80, 30]) }),
    )
    expect(above.fieldErrors.allocations).toBe('Writing allocations must total 100%.')
    expect(writingSplitSummary(allocationsFromPercentSplit(['a'], [80])).remainingPercent).toBe(20)
  })

  it('blocks duplicate advisors and zero or negative splits', () => {
    const duplicate = validateApplicationDraft(
      lifeDraft({
        allocations: allocationsFromPercentSplit(['adv1', 'adv1'], [50, 50]),
      }),
    )
    expect(duplicate.fieldErrors.allocations).toMatch(/only once/)
    const zero = validateApplicationDraft(
      lifeDraft({ allocations: allocationsFromPercentSplit(['adv1', 'adv2'], [100, 0]) }),
    )
    expect(zero.fieldErrors.allocations).toMatch(/0%/)
    const negative = writingSplitError(allocationsFromPercentSplit(['adv1'], [-10]))
    expect(negative).toMatch(/negative/)
    expect(parseWritingPercentInput('-5')).toBe(-5)
  })

  it('strips writing_contract_level and compensation rate from the RPC payload', () => {
    const dirty = [
      {
        ...defaultWritingAllocations('adv1')[0],
        writing_contract_level: 'FA',
        compensation_rate: '0.12',
        compensation_schedule_id: 'sched-1',
      },
    ]
    const payload = toWritingAllocationRpcPayload(dirty as never)
    expect(payload).toEqual([
      {
        recipient_type: 'advisor',
        advisor_id: 'adv1',
        allocation_role: 'writing',
        commission_bps: 10000,
        production_credit_bps: 10000,
      },
    ])
    expect(JSON.stringify(payload)).not.toContain('writing_contract_level')
    expect(JSON.stringify(payload)).not.toContain('compensation_rate')
    expect(allocationPayloadHasForbiddenKeys(payload)).toBe(false)
    expect(allocationPayloadHasForbiddenKeys(dirty)).toBe(true)
  })

  it('warns on licensing without blocking save', () => {
    const warning = advisorLicensingWarning(
      { id: 'adv1', display_name: 'Alex Advisor', states_licensed: ['FL'] },
      'TX',
    )
    expect(warning).toMatch(/not listed as licensed in TX/)
    const draft = validateApplicationDraft(lifeDraft({ state: 'TX' }))
    expect(draft.invalid).toBe(false)
  })
})
