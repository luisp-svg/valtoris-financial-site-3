import { describe, expect, it, vi } from 'vitest'
import {
  APPROVED_REQUIREMENT_RPCS,
  REQUIREMENT_RPC,
  createPolicyApplicationRequirement,
  fetchApplicationRequirements,
  fetchOverdueRequirementCountsByApplicationIds,
  softDeletePolicyApplicationRequirement,
  transitionPolicyApplicationRequirementStatus,
  updatePolicyApplicationRequirement,
} from './requirementApi'

const requirement = {
  id: 'r1',
  application_id: 'a1',
  requirement_code: 'signature',
  custom_label: null,
  status: 'open',
  due_date: null,
  scheduled_for: null,
  completed_at: null,
  waived_at: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

function rpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never
}

describe('requirement API RPC mapping', () => {
  it('exposes only the approved 044 RPCs', () => {
    expect(APPROVED_REQUIREMENT_RPCS).toEqual([
      'create_policy_application_requirement',
      'update_policy_application_requirement',
      'transition_policy_application_requirement_status',
      'soft_delete_policy_application_requirement',
    ])
  })

  it('maps create, update, transition, and owner delete to exact RPC contracts', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, requirement }, error: null })
    const client = rpcClient(rpc)

    await createPolicyApplicationRequirement(client, {
      applicationId: 'a1',
      code: 'signature',
      dueDate: '2026-09-01',
    })
    expect(rpc).toHaveBeenCalledWith(REQUIREMENT_RPC.create, {
      p_application_id: 'a1',
      p_code: 'signature',
      p_custom_label: null,
      p_due_date: '2026-09-01',
      p_scheduled_for: null,
    })

    await updatePolicyApplicationRequirement(client, 'r1', { due_date: '2026-09-02' })
    expect(rpc).toHaveBeenCalledWith(REQUIREMENT_RPC.update, {
      p_id: 'r1',
      p_fields: { due_date: '2026-09-02' },
    })

    await transitionPolicyApplicationRequirementStatus(client, {
      id: 'r1',
      toStatus: 'scheduled',
      scheduledFor: '2026-10-01',
    })
    expect(rpc).toHaveBeenCalledWith(REQUIREMENT_RPC.transition, {
      p_id: 'r1',
      p_to_status: 'scheduled',
      p_scheduled_for: '2026-10-01',
      p_reason: null,
    })

    await softDeletePolicyApplicationRequirement(client, 'r1')
    expect(rpc).toHaveBeenCalledWith(REQUIREMENT_RPC.softDelete, { p_id: 'r1' })
  })

  it('does not send status through the update RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, requirement }, error: null })
    await updatePolicyApplicationRequirement(rpcClient(rpc), 'r1', {
      scheduled_for: '2026-11-02',
    })
    const payload = rpc.mock.calls[0][1] as { p_fields: Record<string, unknown> }
    expect(Object.keys(payload.p_fields)).toEqual(['scheduled_for'])
    expect(payload.p_fields).not.toHaveProperty('status')
    expect(payload.p_fields).not.toHaveProperty('requirement_code')
  })

  it('reads live rows through SELECT and excludes deleted_at', async () => {
    const from = vi.fn().mockReturnValue({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: async () => ({ data: [requirement], error: null }),
          }),
        }),
      }),
    })
    const client = { from } as never
    const rows = await fetchApplicationRequirements(client, 'a1')
    expect(rows).toHaveLength(1)
    expect(from).toHaveBeenCalledWith('policy_application_requirements')
  })

  it('batches urgency reads for loaded application IDs without labels or DML', async () => {
    const from = vi.fn().mockReturnValue({
      select: (columns: string) => {
        expect(columns).toBe('application_id, status, due_date')
        expect(columns).not.toContain('custom_label')
        return {
          in: () => ({
            is: () => ({
              limit: async () => ({
                data: [
                  { application_id: 'a1', status: 'open', due_date: '2026-08-19' },
                  { application_id: 'a1', status: 'complete', due_date: '2026-08-01' },
                ],
                error: null,
              }),
            }),
          }),
        }
      },
    })
    const counts = await fetchOverdueRequirementCountsByApplicationIds(
      { from } as never,
      ['a1', 'a2'],
      '2026-08-20',
    )
    expect(from).toHaveBeenCalledWith('policy_application_requirements')
    expect(counts.get('a1')).toBe(1)
    expect(counts.get('a2')).toBeUndefined()
    expect(await fetchOverdueRequirementCountsByApplicationIds({ from } as never, [])).toEqual(
      new Map(),
    )
    expect(from).toHaveBeenCalledTimes(1)
  })
})
