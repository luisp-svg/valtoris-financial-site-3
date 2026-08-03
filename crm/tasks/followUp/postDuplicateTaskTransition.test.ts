import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { orchestratePostDuplicateResolutionTask } from './postDuplicateTaskTransition'
import { createPublicFamilyFollowUpTask } from './followUpTaskRpc'

describe('postDuplicateTaskTransition', () => {
  it('creates review_initial_diagnostic with duplicate_resolution source', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        already_exists: false,
        needs_manual_review: false,
        task_id: 'task-1',
        workflow_type: 'review_initial_diagnostic',
      },
      error: null,
    })
    const outcome = await orchestratePostDuplicateResolutionTask(
      { rpc } as unknown as SupabaseClient,
      { assessmentId: 'assess-1' },
    )
    expect(outcome.status).toBe('task_created')
    expect(rpc).toHaveBeenCalledWith(
      'create_public_family_follow_up_task',
      expect.objectContaining({
        p_assessment_id: 'assess-1',
        p_workflow_type: 'review_initial_diagnostic',
        p_creation_source: 'duplicate_resolution',
      }),
    )
  })

  it('returns failed without throwing when assessment missing', async () => {
    const outcome = await orchestratePostDuplicateResolutionTask(
      { rpc: vi.fn() } as unknown as SupabaseClient,
      { assessmentId: null },
    )
    expect(outcome.status).toBe('task_failed')
    expect(outcome.errorCategory).toBe('missing_assessment')
  })
})

describe('createPublicFamilyFollowUpTask', () => {
  it('maps soft-deleted needs_manual_review safely', async () => {
    const result = await createPublicFamilyFollowUpTask(
      {
        rpc: vi.fn().mockResolvedValue({
          data: {
            ok: true,
            already_exists: false,
            needs_manual_review: true,
            task_id: null,
            workflow_type: 'review_initial_diagnostic',
          },
          error: null,
        }),
      } as unknown as SupabaseClient,
      {
        assessmentId: 'assess-1',
        workflowType: 'review_initial_diagnostic',
      },
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.needsManualReview).toBe(true)
  })
})
