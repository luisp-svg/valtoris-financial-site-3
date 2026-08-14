import { describe, expect, it } from 'vitest'
import {
  buildParticipantPayload,
  canSubmitApplicationForm,
  catchUpTransitionPlan,
  catalogReadyForApplications,
  defaultWritingAllocations,
  dollarsToCents,
  neverJumpsDraftToUnderwriting,
  participantPayloadOmitsInsuredForFia,
  requiredParticipantRoles,
  splitWritingEvenly,
  transitionReasonForStage,
  validateApplicationDraft,
  writingBpsTotals,
} from './applicationView'
import type { ApplicationDraftInput } from './applicationView'

function lifeDraft(over: Partial<ApplicationDraftInput> = {}): ApplicationDraftInput {
  return {
    householdId: 'hh1',
    carrierId: 'c1',
    productId: 'p1',
    productLine: 'life_term',
    state: 'TX',
    targetStage: 'in_underwriting',
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

describe('application entry view helpers', () => {
  it('requires Life vs FIA fields and participants', () => {
    expect(requiredParticipantRoles('life_term')).toEqual(['primary_client', 'insured', 'owner'])
    expect(requiredParticipantRoles('fia')).toEqual(['primary_client', 'annuitant', 'owner'])
    const life = validateApplicationDraft(lifeDraft({ plannedPremium: '', premiumMode: '' }))
    expect(life.fieldErrors.plannedPremium).toBeTruthy()
    expect(life.fieldErrors.premiumMode).toBeTruthy()
    const fia = validateApplicationDraft(
      lifeDraft({
        productLine: 'fia',
        plannedPremium: '',
        premiumMode: '',
        initialDeposit: '25000',
        roleMembers: { primary_client: 'm1', annuitant: 'm1', owner: 'm1' },
      }),
    )
    expect(fia.invalid).toBe(false)
    expect(fia.fieldErrors.plannedPremium).toBeUndefined()
  })

  it('lets one household member hold multiple Life roles and omits insured for FIA', () => {
    const lifeRows = buildParticipantPayload({
      productLine: 'life_permanent',
      roleMembers: { primary_client: 'm1', insured: 'm1', owner: 'm1' },
    })
    expect(lifeRows).toHaveLength(3)
    expect(new Set(lifeRows.map((row) => row.household_member_id))).toEqual(new Set(['m1']))
    const fiaRows = buildParticipantPayload({
      productLine: 'fia',
      roleMembers: { primary_client: 'm1', annuitant: 'm1', owner: 'm2', insured: 'm1' },
    })
    expect(fiaRows.some((row) => row.role === 'insured')).toBe(false)
    expect(participantPayloadOmitsInsuredForFia('fia', fiaRows)).toBe(true)
  })

  it('requires writing allocation totals of 10000/10000', () => {
    expect(writingBpsTotals(defaultWritingAllocations('a1')).valid).toBe(true)
    expect(writingBpsTotals(splitWritingEvenly(['a1', 'a2'])).valid).toBe(true)
    expect(writingBpsTotals([{ commission_bps: 6000, production_credit_bps: 10000 }]).valid).toBe(
      false,
    )
    const invalid = validateApplicationDraft(
      lifeDraft({ allocations: defaultWritingAllocations('a1').map((row) => ({ ...row, commission_bps: 1 })) }),
    )
    expect(invalid.fieldErrors.allocations).toMatch(/10,000/)
  })

  it('walks the legal catch-up sequence and never jumps draft to in_underwriting', () => {
    expect(catchUpTransitionPlan('draft')).toEqual([])
    expect(catchUpTransitionPlan('submitted')).toEqual(['submitted'])
    expect(catchUpTransitionPlan('in_underwriting')).toEqual(['submitted', 'in_underwriting'])
    expect(neverJumpsDraftToUnderwriting(catchUpTransitionPlan('in_underwriting'))).toBe(true)
    expect(transitionReasonForStage('submitted')).toMatch(/submitted/)
    expect(transitionReasonForStage('in_underwriting')).toMatch(/underwriting/)
  })

  it('blocks submit while pending and converts dollars to cents', () => {
    expect(canSubmitApplicationForm({ submitting: true, invalid: false })).toBe(false)
    expect(canSubmitApplicationForm({ submitting: false, invalid: true })).toBe(false)
    expect(canSubmitApplicationForm({ submitting: false, invalid: false })).toBe(true)
    expect(dollarsToCents('12.34')).toBe(1234)
    expect(dollarsToCents('')).toBeNull()
  })

  it('requires catalog setup before applications', () => {
    expect(catalogReadyForApplications({ activeCarrierCount: 0, activeProductCount: 0 })).toBe(false)
    expect(catalogReadyForApplications({ activeCarrierCount: 1, activeProductCount: 1 })).toBe(true)
  })
})
