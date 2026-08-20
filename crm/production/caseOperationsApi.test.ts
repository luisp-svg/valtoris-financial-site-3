import { describe, expect, it, vi } from 'vitest'
import { saveCaseOperations, updatePolicyApplication } from './applicationApi'

function rpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never
}

describe('Case Operations mutation wrapper', () => {
  it('sends only sanitized Case Operations keys through update_policy_application', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, application_id: 'app1' }, error: null })
    const result = await saveCaseOperations(rpcClient(rpc), 'app1', {
      next_follow_up_date: '2026-09-01',
      notes: 'Call underwriter',
      is_replacement: true,
      delivery_status: 'with_agent',
      production_stage: 'issued',
      submitted_premium_cents: 5000,
      writing_receivable_expected: false,
    } as Parameters<typeof saveCaseOperations>[2])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.unchanged).toBe(false)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('update_policy_application', {
      p_id: 'app1',
      p_payload: {
        next_follow_up_date: '2026-09-01',
        notes: 'Call underwriter',
        is_replacement: true,
        delivery_status: 'with_agent',
      },
    })
    const payload = rpc.mock.calls[0]?.[1]?.p_payload as Record<string, unknown>
    expect(payload).not.toHaveProperty('production_stage')
    expect(payload).not.toHaveProperty('submitted_premium_cents')
    expect(payload).not.toHaveProperty('writing_receivable_expected')
    expect(payload).not.toHaveProperty('policy_number')
  })

  it('skips the RPC when the sanitized patch is empty', async () => {
    const rpc = vi.fn()
    const result = await saveCaseOperations(rpcClient(rpc), 'app1', {})
    expect(result).toEqual({ ok: true, data: { applicationId: 'app1', unchanged: true } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('still uses the existing update helper argument names', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, application_id: 'app1' }, error: null })
    await updatePolicyApplication(rpcClient(rpc), 'app1', { notes: 'Keep' })
    expect(rpc).toHaveBeenCalledWith('update_policy_application', {
      p_id: 'app1',
      p_payload: { notes: 'Keep' },
    })
  })
})
