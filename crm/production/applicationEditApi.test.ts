import { describe, expect, it, vi } from 'vitest'
import {
  APPROVED_EDIT_RPCS,
  correctPolicyApplicationNumber,
  saveProductionApplicationEdit,
  setPolicyApplicationNumber,
  updatePolicyApplication,
} from './applicationApi'
import { defaultWritingAllocations } from './applicationView'
import type { ApplicationEditDraft, ApplicationEditOriginal } from './applicationEditView'

function rpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never
}

const original: ApplicationEditOriginal = {
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
  participants: [
    { household_member_id: 'm1', role: 'primary_client' },
    { household_member_id: 'm1', role: 'insured' },
    { household_member_id: 'm1', role: 'owner' },
  ],
  allocations: defaultWritingAllocations('adv1'),
}

function draft(over: Partial<ApplicationEditDraft> = {}): ApplicationEditDraft {
  return {
    carrierId: original.carrierId,
    productId: original.productId,
    productLine: original.productLine,
    state: original.state,
    premiumMode: original.premiumMode,
    plannedPremium: original.plannedPremium,
    faceAmount: original.faceAmount,
    initialDeposit: original.initialDeposit,
    submissionDate: original.submissionDate,
    nextFollowUpDate: original.nextFollowUpDate,
    applicationNumber: original.applicationNumber,
    applicationNumberReason: '',
    participantReason: '',
    allocationReason: '',
    roleMembers: { primary_client: 'm1', insured: 'm1', owner: 'm1' },
    allocations: original.allocations.map((row) => ({ ...row })),
    ...over,
  }
}

describe('application edit RPC mapping', () => {
  it('maps update, set number, and correct number argument names', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, application_id: 'app1' }, error: null })
    const client = rpcClient(rpc)
    await updatePolicyApplication(client, 'app1', { state: 'TX' })
    expect(rpc).toHaveBeenCalledWith('update_policy_application', {
      p_id: 'app1',
      p_payload: { state: 'TX' },
    })
    await setPolicyApplicationNumber(client, 'app1', 'A-9')
    expect(rpc).toHaveBeenCalledWith('set_policy_application_number', {
      p_application_id: 'app1',
      p_application_number: 'A-9',
    })
    await correctPolicyApplicationNumber(client, 'app1', 'A-10', 'Carrier reissued the number.')
    expect(rpc).toHaveBeenCalledWith('correct_policy_application_number', {
      p_application_id: 'app1',
      p_application_number: 'A-10',
      p_reason: 'Carrier reissued the number.',
    })
  })

  it('saves fields then participants and reports partial save without rollback', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { application_id: 'app1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'CRM_PP:invalid_participants' } })
    const result = await saveProductionApplicationEdit(rpcClient(rpc), {
      applicationId: 'app1',
      stage: 'draft',
      isOwner: true,
      original,
      draft: draft({
        plannedPremium: '1300',
        roleMembers: { primary_client: 'm2', insured: 'm2', owner: 'm2' },
      }),
      intent: 'save',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.phase).toBe('participants')
      expect(result.saved).toEqual(['fields'])
      expect(result.message).toMatch(/participants/)
      expect(result.message).toMatch(/Nothing was rolled back/)
      expect(result.message).not.toMatch(/CRM_PP|SQLSTATE/)
    }
    expect(rpc.mock.calls.map((call) => call[0])).toEqual([
      'update_policy_application',
      'set_policy_application_participants',
    ])
  })

  it('uses legal catch-up transitions from draft and only approved edit RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { application_id: 'app1' }, error: null })
    await saveProductionApplicationEdit(rpcClient(rpc), {
      applicationId: 'app1',
      stage: 'draft',
      isOwner: true,
      original,
      draft: draft(),
      intent: 'in_underwriting',
    })
    const names = rpc.mock.calls.map((call) => call[0])
    expect(names).toEqual([
      'transition_policy_application_stage',
      'transition_policy_application_stage',
    ])
    expect(rpc.mock.calls[0][1].p_to_stage).toBe('submitted')
    expect(rpc.mock.calls[1][1].p_to_stage).toBe('in_underwriting')
    expect([...APPROVED_EDIT_RPCS]).toEqual([
      'update_policy_application',
      'set_policy_application_participants',
      'set_policy_application_allocations',
      'transition_policy_application_stage',
      'set_policy_application_number',
      'correct_policy_application_number',
    ])
  })
})
