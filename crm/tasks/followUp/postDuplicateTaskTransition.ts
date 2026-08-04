/**
 * Post-duplicate-resolution follow-up task transition (migration 022).
 * Safe for authenticated CRM clients — no service-role imports.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createPublicFamilyFollowUpTask } from './followUpTaskRpc.js'

export type PostDuplicateTaskOutcome = {
  status: 'task_created' | 'task_failed'
  taskId: string | null
  errorCategory: string | null
  needsManualReview: boolean
}

/**
 * After successful duplicate resolution: create/retrieve diagnostic review task.
 * Resolution remains authoritative even if this fails.
 */
export async function orchestratePostDuplicateResolutionTask(
  client: SupabaseClient,
  input: {
    assessmentId: string | null
  },
): Promise<PostDuplicateTaskOutcome> {
  if (!input.assessmentId) {
    return {
      status: 'task_failed',
      taskId: null,
      errorCategory: 'missing_assessment',
      needsManualReview: true,
    }
  }

  try {
    const created = await createPublicFamilyFollowUpTask(client, {
      assessmentId: input.assessmentId,
      workflowType: 'review_initial_diagnostic',
      creationSource: 'duplicate_resolution',
    })

    if (!created.ok) {
      return {
        status: 'task_failed',
        taskId: null,
        errorCategory: created.errorCategory,
        needsManualReview: true,
      }
    }

    if (created.needsManualReview) {
      return {
        status: 'task_failed',
        taskId: null,
        errorCategory: 'soft_deleted_task_exists',
        needsManualReview: true,
      }
    }

    return {
      status: 'task_created',
      taskId: created.taskId,
      errorCategory: null,
      needsManualReview: false,
    }
  } catch {
    return {
      status: 'task_failed',
      taskId: null,
      errorCategory: 'rpc_error',
      needsManualReview: true,
    }
  }
}
