import { describe, expect, it } from 'vitest'
import { defaultWritingAllocations } from '../production/applicationView'
import { buildConvertOpportunityPayload, CONVERT_OPPORTUNITY_RPC } from './convertOpportunityApi'

describe('convertOpportunityApi payload', () => {
  it('omits household_id, historical flags, receivable, and dates', () => {
    const payload = buildConvertOpportunityPayload({
      carrierId: 'c1',
      productId: 'p1',
      productLine: 'life_term',
      state: 'tx',
      plannedPremium: '100',
      premiumMode: 'annual',
      faceAmount: '250000',
      roleMembers: {
        primary_client: 'm1',
        insured: 'm1',
        owner: 'm1',
      },
      allocations: defaultWritingAllocations('adv-1'),
    })
    expect(CONVERT_OPPORTUNITY_RPC).toBe('convert_opportunity_to_policy_application')
    expect(payload.household_id).toBeUndefined()
    expect(payload.opportunity_id).toBeUndefined()
    expect(payload.historical_entry).toBeUndefined()
    expect(payload.writing_receivable_expected).toBeUndefined()
    expect(payload.submission_date).toBeUndefined()
    expect(payload.state).toBe('TX')
    expect(payload.submitted_premium_cents).toBe(10000)
    expect(payload.face_amount_cents).toBe(25000000)
    expect(payload.participants).toEqual([
      { household_member_id: 'm1', role: 'primary_client' },
      { household_member_id: 'm1', role: 'insured' },
      { household_member_id: 'm1', role: 'owner' },
    ])
  })
})
