import { describe, expect, it, vi } from 'vitest'
import {
  APPROVED_APPLICATION_RPCS,
  buildCreatePayload,
  createPolicyApplication,
  setPolicyApplicationAllocations,
  setPolicyApplicationParticipants,
  submitProductionApplication,
  transitionPolicyApplicationStage,
} from './applicationApi'
import { APPLICATION_PARTIAL_FAILURE } from './applicationErrors'
import { defaultWritingAllocations } from './applicationView'

function rpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never
}

const lifeInput = {
  householdId: 'hh1',
  carrierId: 'c1',
  productId: 'p1',
  productLine: 'life_term' as const,
  state: 'tx',
  targetStage: 'in_underwriting' as const,
  premiumMode: 'annual',
  plannedPremium: '1200',
  faceAmount: '500000',
  initialDeposit: '999',
  applicationNumber: '',
  submissionDate: '2026-01-15',
  participants: [
    { household_member_id: 'm1', role: 'primary_client' as const },
    { household_member_id: 'm1', role: 'insured' as const },
    { household_member_id: 'm1', role: 'owner' as const },
  ],
  allocations: defaultWritingAllocations('adv1'),
}

describe('application API RPC mapping', () => {
  it('maps create_policy_application Life payload without FIA deposit', () => {
    const payload = buildCreatePayload(lifeInput)
    expect(payload).toMatchObject({
      household_id: 'hh1',
      carrier_id: 'c1',
      product_id: 'p1',
      product_line: 'life_term',
      state: 'TX',
      submitted_premium_cents: 120000,
      premium_mode: 'annual',
      face_amount_cents: 50000000,
      submission_date: '2026-01-15',
    })
    expect(payload).not.toHaveProperty('annuity_deposit_cents')
    expect(payload).not.toHaveProperty('participants')
    expect(payload).not.toHaveProperty('allocations')
  })

  it('maps FIA create payload without insured money fields', () => {
    const payload = buildCreatePayload({
      ...lifeInput,
      productLine: 'fia',
      initialDeposit: '25000',
      plannedPremium: '1',
      faceAmount: '1',
    })
    expect(payload.annuity_deposit_cents).toBe(2500000)
    expect(payload).not.toHaveProperty('submitted_premium_cents')
    expect(payload).not.toHaveProperty('face_amount_cents')
  })

  it('maps the four approved RPC argument names', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, application_id: 'app1' }, error: null })
    const client = rpcClient(rpc)
    await createPolicyApplication(client, { household_id: 'hh1' })
    expect(rpc).toHaveBeenCalledWith('create_policy_application', { p_payload: { household_id: 'hh1' } })
    await setPolicyApplicationParticipants(client, 'app1', lifeInput.participants)
    expect(rpc).toHaveBeenCalledWith('set_policy_application_participants', {
      p_application_id: 'app1',
      p_participants: lifeInput.participants,
      p_reason: null,
    })
    await setPolicyApplicationAllocations(client, 'app1', lifeInput.allocations)
    expect(rpc).toHaveBeenCalledWith('set_policy_application_allocations', {
      p_application_id: 'app1',
      p_allocations: lifeInput.allocations,
      p_reason: null,
    })
    await transitionPolicyApplicationStage(client, {
      applicationId: 'app1',
      toStage: 'submitted',
      reason: 'reason',
      fields: { submission_date: '2026-01-15' },
    })
    expect(rpc).toHaveBeenCalledWith('transition_policy_application_stage', {
      p_application_id: 'app1',
      p_to_stage: 'submitted',
      p_disposition: null,
      p_delivery_status: null,
      p_reason: 'reason',
      p_fields: { submission_date: '2026-01-15' },
    })
  })

  it('runs draft then submitted then in_underwriting and keeps a draft after later failure', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { application_id: 'app1' }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, participant_count: 3 }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, allocation_count: 1 }, error: null })
      .mockResolvedValueOnce({ data: { ok: true, application_id: 'app1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'CRM_PP:invalid_transition' } })
    const result = await submitProductionApplication(rpcClient(rpc), lifeInput)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.phase).toBe('transition')
      expect(result.applicationId).toBe('app1')
      expect(result.recovery).toBe(true)
      expect(result.message).toBe(APPLICATION_PARTIAL_FAILURE)
    }
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'create_policy_application',
      'set_policy_application_participants',
      'set_policy_application_allocations',
      'transition_policy_application_stage',
      'transition_policy_application_stage',
    ])
    expect(rpc.mock.calls[3][1].p_to_stage).toBe('submitted')
    expect(rpc.mock.calls[4][1].p_to_stage).toBe('in_underwriting')
  })

  it('returns safe copy for CRM_PP create failures without leaking postgres', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'CRM_PP:duplicate_application_number', details: 'SQLSTATE 23505' },
    })
    const result = await createPolicyApplication(rpcClient(rpc), { household_id: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/application number/i)
      expect(result.message).not.toMatch(/SQLSTATE|23505|CRM_PP/)
    }
  })

  it('only exposes the four approved application RPCs', () => {
    expect([...APPROVED_APPLICATION_RPCS]).toEqual([
      'create_policy_application',
      'set_policy_application_participants',
      'set_policy_application_allocations',
      'transition_policy_application_stage',
    ])
  })
})
