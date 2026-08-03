import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  categorizeTaskAutomationError,
  orchestrateIngestFollowUpTask,
  sanitizeTaskErrorCategory,
  workflowForIngestMatchStatus,
} from './taskAutomation'

function makeAdmin(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc: vi.fn(rpcImpl) } as unknown as SupabaseClient
}

describe('taskAutomation helpers', () => {
  it('maps match statuses to the two approved workflows', () => {
    expect(workflowForIngestMatchStatus('new_prospect')).toBe('review_initial_diagnostic')
    expect(workflowForIngestMatchStatus('exact_trusted_match')).toBe('review_initial_diagnostic')
    expect(workflowForIngestMatchStatus('possible_match')).toBe('resolve_possible_duplicate')
    expect(workflowForIngestMatchStatus('other')).toBeNull()
  })

  it('sanitizes error categories', () => {
    expect(sanitizeTaskErrorCategory('rpc_error')).toBe('rpc_error')
    expect(sanitizeTaskErrorCategory('SELECT * FROM secrets')).toBe('rpc_error')
    expect(categorizeTaskAutomationError('CRM_TASK:soft_deleted_task_exists')).toBe(
      'soft_deleted_task_exists',
    )
  })

  it('creates review task for new prospect and does not throw on failure', async () => {
    const admin = makeAdmin(async (fn) => {
      if (fn === 'update_public_family_task_automation_status') {
        return { data: null, error: null }
      }
      if (fn === 'create_public_family_follow_up_task') {
        return {
          data: {
            ok: true,
            already_exists: false,
            needs_manual_review: false,
            task_id: 'task-1',
            workflow_type: 'review_initial_diagnostic',
          },
          error: null,
        }
      }
      throw new Error(`Unexpected ${fn}`)
    })

    const outcome = await orchestrateIngestFollowUpTask(admin, {
      leadId: 'lead-1',
      assessmentId: 'assess-1',
      matchStatus: 'new_prospect',
    })
    expect(outcome.status).toBe('task_created')
    expect(outcome.taskId).toBe('task-1')
  })

  it('records task_failed when create RPC errors', async () => {
    const calls: string[] = []
    const admin = makeAdmin(async (fn) => {
      calls.push(fn)
      if (fn === 'update_public_family_task_automation_status') {
        return { data: null, error: null }
      }
      if (fn === 'create_public_family_follow_up_task') {
        return { data: null, error: { message: 'CRM_TASK:invalid_assessment' } }
      }
      throw new Error(`Unexpected ${fn}`)
    })

    const outcome = await orchestrateIngestFollowUpTask(admin, {
      leadId: 'lead-1',
      assessmentId: 'assess-1',
      matchStatus: 'exact_trusted_match',
    })
    expect(outcome.status).toBe('task_failed')
    expect(outcome.errorCategory).toBe('validation_error')
    expect(calls).toContain('update_public_family_task_automation_status')
    const failCall = (admin.rpc as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'update_public_family_task_automation_status' && c[1].p_status === 'task_failed',
    )
    expect(failCall).toBeDefined()
  })

  it('uses resolve workflow for possible matches', async () => {
    const admin = makeAdmin(async (fn, args) => {
      if (fn === 'update_public_family_task_automation_status') {
        return { data: null, error: null }
      }
      if (fn === 'create_public_family_follow_up_task') {
        expect(args.p_workflow_type).toBe('resolve_possible_duplicate')
        return {
          data: {
            ok: true,
            already_exists: false,
            needs_manual_review: false,
            task_id: 'task-dup',
            workflow_type: 'resolve_possible_duplicate',
          },
          error: null,
        }
      }
      throw new Error(`Unexpected ${fn}`)
    })

    const outcome = await orchestrateIngestFollowUpTask(admin, {
      leadId: 'lead-1',
      assessmentId: 'assess-1',
      matchStatus: 'possible_match',
    })
    expect(outcome.status).toBe('task_created')
    expect(outcome.taskId).toBe('task-dup')
  })
})
