/**
 * Client/server-safe RPC wrappers for public Family follow-up tasks.
 * Does not import admin clients or service-role secrets.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type CreateFollowUpTaskResult =
  | {
      ok: true
      taskId: string | null
      alreadyExists: boolean
      needsManualReview: boolean
      workflowType: string
    }
  | { ok: false; errorCategory: string }

const SAFE_ERROR_CATEGORIES = new Set([
  'rpc_error',
  'validation_error',
  'missing_assessment',
  'workflow_not_allowed',
  'soft_deleted_task_exists',
  'timeout',
  'unknown',
])

export function categorizeTaskAutomationError(message: string | null | undefined): string {
  const raw = typeof message === 'string' ? message.toLowerCase() : ''
  if (raw.includes('soft_deleted')) return 'soft_deleted_task_exists'
  if (raw.includes('workflow_not_allowed')) return 'workflow_not_allowed'
  if (
    raw.includes('invalid_assessment') ||
    raw.includes('invalid_household') ||
    raw.includes('invalid_lead')
  ) {
    return 'validation_error'
  }
  if (raw.includes('not_authorized')) return 'validation_error'
  if (raw.includes('timeout')) return 'timeout'
  return 'rpc_error'
}

export function sanitizeTaskErrorCategory(value: string | null | undefined): string {
  const cleaned = (value ?? 'rpc_error').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 64)
  if (!cleaned) return 'rpc_error'
  if (SAFE_ERROR_CATEGORIES.has(cleaned)) return cleaned
  return 'rpc_error'
}

export async function createPublicFamilyFollowUpTask(
  client: SupabaseClient,
  input: {
    assessmentId: string
    workflowType: string
    creationSource?: 'public_family_ingest' | 'duplicate_resolution' | 'system' | 'manual'
  },
): Promise<CreateFollowUpTaskResult> {
  const { data, error } = await client.rpc('create_public_family_follow_up_task', {
    p_assessment_id: input.assessmentId,
    p_workflow_type: input.workflowType,
    p_creation_source: input.creationSource ?? 'system',
  })

  if (error) {
    return { ok: false, errorCategory: categorizeTaskAutomationError(error.message) }
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, errorCategory: 'rpc_error' }
  }

  const row = data as Record<string, unknown>
  if (row.ok !== true) {
    return { ok: false, errorCategory: 'rpc_error' }
  }

  return {
    ok: true,
    taskId: typeof row.task_id === 'string' ? row.task_id : null,
    alreadyExists: row.already_exists === true,
    needsManualReview: row.needs_manual_review === true,
    workflowType: typeof row.workflow_type === 'string' ? row.workflow_type : input.workflowType,
  }
}

export async function markFollowUpTaskAutomationStatus(
  admin: SupabaseClient,
  input: {
    leadId: string
    status:
      | 'task_created'
      | 'task_not_required'
      | 'task_pending'
      | 'task_failed'
      | 'task_manually_created'
    taskId?: string | null
    errorCategory?: string | null
  },
): Promise<{ ok: true } | { ok: false; errorCategory: string }> {
  const { error } = await admin.rpc('update_public_family_task_automation_status', {
    p_lead_id: input.leadId,
    p_status: input.status,
    p_task_id: input.taskId ?? null,
    p_error_category: input.errorCategory
      ? sanitizeTaskErrorCategory(input.errorCategory)
      : null,
  })
  if (error) {
    return { ok: false, errorCategory: sanitizeTaskErrorCategory(error.message) }
  }
  return { ok: true }
}
