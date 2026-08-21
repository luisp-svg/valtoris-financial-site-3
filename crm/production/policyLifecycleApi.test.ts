import { describe, expect, it, vi } from 'vitest'
import {
  APPROVED_POLICY_LIFECYCLE_RPCS,
  POLICY_LIFECYCLE_RPC,
  recordPolicyPostPlacementOutcome,
  recordPostPlacementOutcomeRpcArgs,
} from './policyLifecycleApi'
import { POLICY_LIFECYCLE_DATE_OUTCOME_ERROR } from './policyLifecycleErrors'

function rpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never
}

const canceledArgs = {
  p_application_id: 'app-1',
  p_status: 'canceled' as const,
  p_reason: 'Client requested early termination',
  p_terminated_on: '2026-06-01' as string | null,
}

describe('post-placement lifecycle API', () => {
  it('reuses only the Migration 045 owner RPC', () => {
    expect(POLICY_LIFECYCLE_RPC).toBe('record_policy_post_placement_outcome')
    expect(APPROVED_POLICY_LIFECYCLE_RPCS).toEqual(['record_policy_post_placement_outcome'])
  })

  it('maps canceled args including optional date', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        application_id: 'app-1',
        policy_id: 'pol-1',
        status: 'canceled',
      },
      error: null,
    })
    const result = await recordPolicyPostPlacementOutcome(rpcClient(rpc), canceledArgs)
    expect(rpc).toHaveBeenCalledWith(
      'record_policy_post_placement_outcome',
      recordPostPlacementOutcomeRpcArgs(canceledArgs),
    )
    expect(result).toEqual({
      ok: true,
      applicationId: 'app-1',
      policyId: 'pol-1',
      status: 'canceled',
    })
  })

  it('maps surrendered with a null termination date', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, application_id: 'app-2', policy_id: 'pol-2', status: 'surrendered' },
      error: null,
    })
    const result = await recordPolicyPostPlacementOutcome(rpcClient(rpc), {
      p_application_id: 'app-2',
      p_status: 'surrendered',
      p_reason: 'Client surrendered the contract',
      p_terminated_on: null,
    })
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_status: 'surrendered',
      p_terminated_on: null,
    })
    expect(result.ok).toBe(true)
  })

  it('surfaces server date/outcome validation without leaking postgres', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'CRM_PP:invalid_payload' },
    })
    const result = await recordPolicyPostPlacementOutcome(rpcClient(rpc), canceledArgs)
    expect(result).toEqual({
      ok: false,
      code: 'invalid_payload',
      message: POLICY_LIFECYCLE_DATE_OUTCOME_ERROR,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).not.toMatch(/postgres|42501|permission denied/i)
  })
})
