/**
 * Server-side orchestration for Digital Identity follow-up task automation.
 * Invoked after successful CRM ingest; failures never fail the public response.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  categorizeTaskAutomationError,
  sanitizeTaskErrorCategory,
} from '../../../crm/tasks/followUp/followUpTaskRpc.js'
import { DIGITAL_IDENTITY_TASK_WORKFLOWS } from '../../../modules/digital-identity/index.js'

export type DigitalIdentityTaskWorkflow =
  (typeof DIGITAL_IDENTITY_TASK_WORKFLOWS)[number]

export type TaskAutomationOutcome = {
  status: 'task_created' | 'task_not_required' | 'task_failed' | 'skipped'
  taskId: string | null
  errorCategory: string | null
  needsManualReview: boolean
}

export { categorizeTaskAutomationError, sanitizeTaskErrorCategory }

export function workflowForDigitalIdentityMatchStatus(
  matchStatus: string,
): DigitalIdentityTaskWorkflow | null {
  if (matchStatus === 'possible_match') {
    return 'resolve_digital_identity_duplicate'
  }
  if (matchStatus === 'new_prospect' || matchStatus === 'exact_trusted_match') {
    return 'review_digital_identity_lead'
  }
  return null
}

async function markAutomationFailed(
  admin: SupabaseClient,
  leadId: string,
  errorCategory: string,
): Promise<void> {
  const nowIso = new Date().toISOString()
  try {
    await admin
      .from('leads')
      .update({
        follow_up_task_automation_status: 'task_failed',
        follow_up_task_automation_attempted_at: nowIso,
        follow_up_task_automation_error_category: sanitizeTaskErrorCategory(errorCategory),
        updated_at: nowIso,
      })
      .eq('id', leadId)
  } catch {
    // Best-effort bookkeeping only.
  }
}

/**
 * After successful CRM ingest: create DI follow-up task.
 * Never throws. Never fails the public Let's Connect response.
 * Skips idempotent replays (`created: false`).
 */
export async function orchestrateDigitalIdentityFollowUpTask(
  admin: SupabaseClient,
  input: {
    leadId: string
    matchStatus: string
    created: boolean
  },
): Promise<TaskAutomationOutcome> {
  try {
    if (!input.created) {
      return {
        status: 'skipped',
        taskId: null,
        errorCategory: null,
        needsManualReview: false,
      }
    }

    if (!input.leadId) {
      return {
        status: 'task_failed',
        taskId: null,
        errorCategory: 'validation_error',
        needsManualReview: true,
      }
    }

    const workflow = workflowForDigitalIdentityMatchStatus(input.matchStatus)
    if (!workflow) {
      return {
        status: 'task_not_required',
        taskId: null,
        errorCategory: null,
        needsManualReview: false,
      }
    }

    const { data, error } = await admin.rpc('create_digital_identity_follow_up_task', {
      p_lead_id: input.leadId,
      p_workflow_type: workflow,
      p_creation_source: 'digital_identity_ingest',
    })

    if (error) {
      const category = categorizeTaskAutomationError(error.message)
      await markAutomationFailed(admin, input.leadId, category)
      return {
        status: 'task_failed',
        taskId: null,
        errorCategory: category,
        needsManualReview: true,
      }
    }

    if (!data || typeof data !== 'object') {
      await markAutomationFailed(admin, input.leadId, 'rpc_error')
      return {
        status: 'task_failed',
        taskId: null,
        errorCategory: 'rpc_error',
        needsManualReview: true,
      }
    }

    const row = data as Record<string, unknown>
    if (row.ok !== true) {
      await markAutomationFailed(admin, input.leadId, 'rpc_error')
      return {
        status: 'task_failed',
        taskId: null,
        errorCategory: 'rpc_error',
        needsManualReview: true,
      }
    }

    if (row.needs_manual_review === true) {
      return {
        status: 'task_failed',
        taskId: null,
        errorCategory: 'soft_deleted_task_exists',
        needsManualReview: true,
      }
    }

    return {
      status: 'task_created',
      taskId: typeof row.task_id === 'string' ? row.task_id : null,
      errorCategory: null,
      needsManualReview: false,
    }
  } catch {
    try {
      if (input.leadId && input.created) {
        await markAutomationFailed(admin, input.leadId, 'rpc_error')
      }
    } catch {
      // Intentionally swallowed.
    }
    return {
      status: 'task_failed',
      taskId: null,
      errorCategory: 'rpc_error',
      needsManualReview: true,
    }
  }
}
