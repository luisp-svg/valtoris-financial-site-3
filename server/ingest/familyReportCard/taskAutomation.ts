/**
 * Server-side orchestration for public Family follow-up task automation.
 * Invoked after successful CRM ingest; failures never fail the public response.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createPublicFamilyFollowUpTask,
  markFollowUpTaskAutomationStatus,
} from '../../../crm/tasks/followUp/followUpTaskRpc'
import {
  workflowForMatchStatus,
  type PublicFamilyMatchStatus,
} from '../../../crm/tasks/followUp/workflowTypes'

export type TaskAutomationOutcome = {
  status: 'task_created' | 'task_not_required' | 'task_failed' | 'task_pending' | 'skipped'
  taskId: string | null
  errorCategory: string | null
  needsManualReview: boolean
}

export {
  categorizeTaskAutomationError,
  sanitizeTaskErrorCategory,
} from '../../../crm/tasks/followUp/followUpTaskRpc'

export function workflowForIngestMatchStatus(
  matchStatus: string,
): ReturnType<typeof workflowForMatchStatus> | null {
  if (
    matchStatus !== 'new_prospect' &&
    matchStatus !== 'exact_trusted_match' &&
    matchStatus !== 'possible_match'
  ) {
    return null
  }
  return workflowForMatchStatus(matchStatus as PublicFamilyMatchStatus)
}

export { createPublicFamilyFollowUpTask, markFollowUpTaskAutomationStatus }

/**
 * After successful CRM ingest: mark pending → create task → record outcome.
 * Never throws. Never fails the public diagnostic response.
 */
export async function orchestrateIngestFollowUpTask(
  admin: SupabaseClient,
  input: {
    leadId: string
    assessmentId: string | null
    matchStatus: string
  },
): Promise<TaskAutomationOutcome> {
  if (!input.assessmentId) {
    await markFollowUpTaskAutomationStatus(admin, {
      leadId: input.leadId,
      status: 'task_failed',
      errorCategory: 'missing_assessment',
    })
    return {
      status: 'task_failed',
      taskId: null,
      errorCategory: 'missing_assessment',
      needsManualReview: true,
    }
  }

  const workflow = workflowForIngestMatchStatus(input.matchStatus)
  if (!workflow) {
    await markFollowUpTaskAutomationStatus(admin, {
      leadId: input.leadId,
      status: 'task_not_required',
    })
    return {
      status: 'task_not_required',
      taskId: null,
      errorCategory: null,
      needsManualReview: false,
    }
  }

  await markFollowUpTaskAutomationStatus(admin, {
    leadId: input.leadId,
    status: 'task_pending',
  })

  try {
    const created = await createPublicFamilyFollowUpTask(admin, {
      assessmentId: input.assessmentId,
      workflowType: workflow,
      creationSource: 'public_family_ingest',
    })

    if (!created.ok) {
      await markFollowUpTaskAutomationStatus(admin, {
        leadId: input.leadId,
        status: 'task_failed',
        errorCategory: created.errorCategory,
      })
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
    await markFollowUpTaskAutomationStatus(admin, {
      leadId: input.leadId,
      status: 'task_failed',
      errorCategory: 'rpc_error',
    })
    return {
      status: 'task_failed',
      taskId: null,
      errorCategory: 'rpc_error',
      needsManualReview: true,
    }
  }
}

/**
 * After successful duplicate resolution: create/retrieve diagnostic review task.
 * Resolution remains authoritative even if this fails.
 * Prefer `crm/tasks/followUp/postDuplicateTaskTransition` for browser CRM paths.
 */
export { orchestratePostDuplicateResolutionTask } from '../../../crm/tasks/followUp/postDuplicateTaskTransition'
