import { describe, expect, it } from 'vitest'
import { defaultWritingAllocations } from './applicationView'
import {
  applicationNumberMode,
  allocationsEqual,
  availableEditIntents,
  buildUpdatePayload,
  canReplaceAllocations,
  canReplaceParticipants,
  canShowProductionEditAction,
  formatPartialSaveMessage,
  isIncompleteDraft,
  neverJumpsDraftToUnderwriting,
  recoveryTransitionPlan,
  validateApplicationEdit,
  type ApplicationEditDraft,
  type ApplicationEditOriginal,
} from './applicationEditView'
import type { ProductionAllocation, ProductionParticipant } from './types'

function original(over: Partial<ApplicationEditOriginal> = {}): ApplicationEditOriginal {
  return {
    carrierId: 'c1',
    productId: 'p1',
    productLine: 'life_term',
    state: 'TX',
    premiumMode: 'annual',
    plannedPremium: '1200',
    faceAmount: '',
    initialDeposit: '',
    submissionDate: '',
    nextFollowUpDate: '',
    applicationNumber: '',
    policyNumber: '',
    participants: [
      { household_member_id: 'm1', role: 'primary_client' },
      { household_member_id: 'm1', role: 'insured' },
      { household_member_id: 'm1', role: 'owner' },
    ],
    allocations: defaultWritingAllocations('adv1'),
    ...over,
  }
}

function draftFrom(base: ApplicationEditOriginal, over: Partial<ApplicationEditDraft> = {}): ApplicationEditDraft {
  const roleMembers = {
    primary_client: 'm1',
    insured: 'm1',
    owner: 'm1',
  }
  return {
    carrierId: base.carrierId,
    productId: base.productId,
    productLine: base.productLine,
    state: base.state,
    premiumMode: base.premiumMode,
    plannedPremium: base.plannedPremium,
    faceAmount: base.faceAmount,
    initialDeposit: base.initialDeposit,
    submissionDate: base.submissionDate,
    nextFollowUpDate: base.nextFollowUpDate,
    applicationNumber: base.applicationNumber,
    policyNumber: base.policyNumber,
    applicationNumberReason: '',
    participantReason: '',
    allocationReason: '',
    roleMembers,
    allocations: base.allocations.map((row) => ({ ...row })),
    ...over,
  }
}

describe('production application edit helpers', () => {
  it('shows edit for owner and advisor on recoverable stages only', () => {
    expect(canShowProductionEditAction({ role: 'owner', stage: 'draft', deletedAt: null })).toBe(true)
    expect(canShowProductionEditAction({ role: 'advisor', stage: 'submitted', deletedAt: null })).toBe(true)
    expect(canShowProductionEditAction({ role: 'owner', stage: 'issued', deletedAt: null })).toBe(false)
    expect(canShowProductionEditAction({ role: 'owner', stage: 'draft', deletedAt: '2026-01-01' })).toBe(false)
  })

  it('locks catalog after submission and participants/allocations for advisors after submit', () => {
    expect(canReplaceParticipants({ stage: 'draft', isOwner: false })).toBe(true)
    expect(canReplaceParticipants({ stage: 'submitted', isOwner: false })).toBe(false)
    expect(canReplaceParticipants({ stage: 'submitted', isOwner: true })).toBe(true)
    expect(canReplaceAllocations({ stage: 'in_underwriting', isOwner: false })).toBe(false)
    expect(applicationNumberMode({ stage: 'draft', applicationNumber: null, isOwner: true })).toBe(
      'locked_pre_submit',
    )
    expect(applicationNumberMode({ stage: 'submitted', applicationNumber: null, isOwner: false })).toBe('set')
    expect(
      applicationNumberMode({ stage: 'submitted', applicationNumber: 'A-1', isOwner: true }),
    ).toBe('correct')
    expect(
      applicationNumberMode({ stage: 'submitted', applicationNumber: 'A-1', isOwner: false }),
    ).toBe('locked_set')
  })

  it('requires Life vs FIA participants and omits FIA insured', () => {
    const life = original()
    const missing = validateApplicationEdit({
      stage: 'draft',
      isOwner: true,
      original: life,
      draft: draftFrom(life, { roleMembers: { primary_client: 'm1', owner: 'm1' } }),
      intent: 'submitted',
    })
    expect(missing.fieldErrors.participants).toBeTruthy()
    const fiaBase = original({
      productLine: 'fia',
      plannedPremium: '',
      initialDeposit: '25000',
      participants: [
        { household_member_id: 'm1', role: 'primary_client' },
        { household_member_id: 'm1', role: 'annuitant' },
        { household_member_id: 'm1', role: 'owner' },
      ],
    })
    const fia = validateApplicationEdit({
      stage: 'draft',
      isOwner: true,
      original: fiaBase,
      draft: draftFrom(fiaBase, {
        productLine: 'fia',
        initialDeposit: '25000',
        plannedPremium: '',
        roleMembers: { primary_client: 'm1', annuitant: 'm1', owner: 'm1', insured: 'm1' },
      }),
      intent: 'save',
    })
    expect(fia.fieldErrors.participants).toBeUndefined()
  })

  it('requires writing totals of 10000/10000 and preserves unchanged allocations', () => {
    const base = original()
    expect(allocationsEqual(base.allocations, base.allocations)).toBe(true)
    const bad = validateApplicationEdit({
      stage: 'draft',
      isOwner: true,
      original: base,
      draft: draftFrom(base, {
        allocations: [
          {
            recipient_type: 'advisor',
            advisor_id: 'adv1',
            allocation_role: 'writing',
            commission_bps: 1,
            production_credit_bps: 10000,
          },
        ],
      }),
      intent: 'save',
    })
    expect(bad.fieldErrors.allocations).toBeTruthy()
  })

  it('walks legal recovery transitions and never jumps draft to in_underwriting', () => {
    expect(recoveryTransitionPlan('draft', 'submitted')).toEqual(['submitted'])
    const catchUp = recoveryTransitionPlan('draft', 'in_underwriting')
    expect(catchUp).toEqual(['submitted', 'in_underwriting'])
    expect(neverJumpsDraftToUnderwriting('draft', catchUp)).toBe(true)
    expect(neverJumpsDraftToUnderwriting('draft', ['in_underwriting'])).toBe(false)
    expect(recoveryTransitionPlan('submitted', 'in_underwriting')).toEqual(['in_underwriting'])
    expect(availableEditIntents('in_underwriting')).toEqual(['save'])
  })

  it('omits locked catalog keys from update payload after submission', () => {
    const base = original()
    const payload = buildUpdatePayload({
      stage: 'submitted',
      original: base,
      draft: draftFrom(base, { state: 'CA', plannedPremium: '1500' }),
    })
    expect(payload).not.toHaveProperty('state')
    expect(payload).not.toHaveProperty('carrier_id')
    expect(payload?.submitted_premium_cents).toBe(150000)
  })

  it('includes policy number on submitted update payloads only', () => {
    const base = original()
    const draftPayload = buildUpdatePayload({
      stage: 'draft',
      original: base,
      draft: draftFrom(base, { policyNumber: 'POL-1' }),
    })
    expect(draftPayload).toBeNull()
    const submitted = buildUpdatePayload({
      stage: 'submitted',
      original: base,
      draft: draftFrom(base, { policyNumber: 'POL-1' }),
    })
    expect(submitted?.policy_number).toBe('POL-1')
  })

  it('flags incomplete drafts and maps partial-save copy without claiming rollback', () => {
    const participants: ProductionParticipant[] = [
      {
        id: '1',
        role: 'primary_client',
        household_member_id: 'm1',
        effective_to: null,
        member: null,
      },
    ]
    const allocations: ProductionAllocation[] = []
    expect(
      isIncompleteDraft({
        production_stage: 'draft',
        product_line: 'life_term',
        participants,
        allocations,
      }),
    ).toBe(true)
    const message = formatPartialSaveMessage(['fields'], 'participants')
    expect(message).toMatch(/Saved: application fields/)
    expect(message).toMatch(/participants was not saved/)
    expect(message).toMatch(/Nothing was rolled back/)
  })

  it('requires an owner reason to correct an assigned application number', () => {
    const base = original({ applicationNumber: 'A-1' })
    const result = validateApplicationEdit({
      stage: 'submitted',
      isOwner: true,
      original: base,
      draft: draftFrom(base, { applicationNumber: 'A-2' }),
      intent: 'save',
    })
    expect(result.fieldErrors.applicationNumberReason).toBeTruthy()
  })
})
