import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  orchestrateDigitalIdentityFollowUpTask,
  workflowForDigitalIdentityMatchStatus,
} from './taskAutomation'

function makeAdmin(
  rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>,
) {
  const updateEq = vi.fn(async () => ({ data: null, error: null }))
  return {
    rpc: vi.fn(rpcImpl),
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: updateEq })),
    })),
    _updateEq: updateEq,
  } as unknown as SupabaseClient & { _updateEq: ReturnType<typeof vi.fn> }
}

describe('digital identity taskAutomation', () => {
  it('maps match statuses to DI workflows', () => {
    expect(workflowForDigitalIdentityMatchStatus('new_prospect')).toBe(
      'review_digital_identity_lead',
    )
    expect(workflowForDigitalIdentityMatchStatus('exact_trusted_match')).toBe(
      'review_digital_identity_lead',
    )
    expect(workflowForDigitalIdentityMatchStatus('possible_match')).toBe(
      'resolve_digital_identity_duplicate',
    )
    expect(workflowForDigitalIdentityMatchStatus('other')).toBeNull()
  })

  it('skips automation on idempotent replay (created:false)', async () => {
    const admin = makeAdmin(async () => {
      throw new Error('should not call rpc')
    })
    const outcome = await orchestrateDigitalIdentityFollowUpTask(admin, {
      leadId: 'lead-1',
      matchStatus: 'new_prospect',
      created: false,
    })
    expect(outcome.status).toBe('skipped')
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it('creates review task for new prospect', async () => {
    const admin = makeAdmin(async (fn, args) => {
      expect(fn).toBe('create_digital_identity_follow_up_task')
      expect(args.p_workflow_type).toBe('review_digital_identity_lead')
      expect(args.p_creation_source).toBe('digital_identity_ingest')
      return {
        data: {
          ok: true,
          already_exists: false,
          needs_manual_review: false,
          task_id: 'task-1',
          workflow_type: 'review_digital_identity_lead',
        },
        error: null,
      }
    })

    const outcome = await orchestrateDigitalIdentityFollowUpTask(admin, {
      leadId: 'lead-1',
      matchStatus: 'new_prospect',
      created: true,
    })
    expect(outcome.status).toBe('task_created')
    expect(outcome.taskId).toBe('task-1')
  })

  it('uses resolve workflow for possible matches', async () => {
    const admin = makeAdmin(async (_fn, args) => {
      expect(args.p_workflow_type).toBe('resolve_digital_identity_duplicate')
      return {
        data: {
          ok: true,
          already_exists: false,
          needs_manual_review: false,
          task_id: 'task-dup',
        },
        error: null,
      }
    })

    const outcome = await orchestrateDigitalIdentityFollowUpTask(admin, {
      leadId: 'lead-1',
      matchStatus: 'possible_match',
      created: true,
    })
    expect(outcome.status).toBe('task_created')
  })

  it('marks lead failed via direct update when create RPC errors', async () => {
    const admin = makeAdmin(async () => ({
      data: null,
      error: { message: 'CRM_TASK:invalid_lead' },
    }))

    const outcome = await orchestrateDigitalIdentityFollowUpTask(admin, {
      leadId: 'lead-1',
      matchStatus: 'exact_trusted_match',
      created: true,
    })
    expect(outcome.status).toBe('task_failed')
    expect(outcome.needsManualReview).toBe(true)
    expect(admin.from).toHaveBeenCalledWith('leads')
  })

  it('never throws when RPC throws', async () => {
    const admin = makeAdmin(async () => {
      throw new Error('boom')
    })
    const outcome = await orchestrateDigitalIdentityFollowUpTask(admin, {
      leadId: 'lead-1',
      matchStatus: 'new_prospect',
      created: true,
    })
    expect(outcome.status).toBe('task_failed')
  })
})
