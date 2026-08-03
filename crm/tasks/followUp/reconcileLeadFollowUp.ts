/**
 * Authenticated reconciliation of lead follow-up automation state after a
 * successful manual (or already-existing) diagnostic task is linked.
 *
 * Uses direct leads UPDATE under existing RLS — not the service-role-only
 * update_public_family_task_automation_status RPC.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ReconcileLeadFollowUpResult =
  | { ok: true; updated: true; status: 'task_manually_created' | 'task_created' }
  | { ok: true; updated: false; reason: 'already_linked' | 'valid_automatic_present' }
  | { ok: false; error: string }

/**
 * Links a verified task to the lead and clears failed/pending automation noise.
 * Does not overwrite a different successful automatic task reference.
 */
export async function reconcileLeadFollowUpTaskState(
  supabase: SupabaseClient,
  input: {
    leadId: string
    taskId: string
    /** Prefer task_manually_created for source_type=manual. */
    status?: 'task_manually_created' | 'task_created'
  },
): Promise<ReconcileLeadFollowUpResult> {
  const status = input.status ?? 'task_manually_created'

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, lead_id, household_id, deleted_at, source_type')
    .eq('id', input.taskId)
    .maybeSingle()

  if (taskError) {
    return { ok: false, error: 'Unable to verify the follow-up task.' }
  }
  if (!task || task.deleted_at) {
    return { ok: false, error: 'Follow-up task was not found.' }
  }
  if (task.lead_id !== input.leadId) {
    return { ok: false, error: 'Follow-up task does not belong to this lead.' }
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select(
      'id, household_id, deleted_at, follow_up_task_automation_status, follow_up_task_id',
    )
    .eq('id', input.leadId)
    .maybeSingle()

  if (leadError || !lead || lead.deleted_at) {
    return { ok: false, error: 'Unable to update lead follow-up status.' }
  }
  if (lead.household_id !== task.household_id) {
    return { ok: false, error: 'Follow-up task household does not match the lead.' }
  }

  if (
    lead.follow_up_task_id === input.taskId &&
    (lead.follow_up_task_automation_status === 'task_manually_created' ||
      lead.follow_up_task_automation_status === 'task_created')
  ) {
    return { ok: true, updated: false, reason: 'already_linked' }
  }

  // Preserve a different successful automatic task reference.
  if (
    lead.follow_up_task_automation_status === 'task_created' &&
    typeof lead.follow_up_task_id === 'string' &&
    lead.follow_up_task_id !== input.taskId
  ) {
    return { ok: true, updated: false, reason: 'valid_automatic_present' }
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('leads')
    .update({
      follow_up_task_automation_status: status,
      follow_up_task_id: input.taskId,
      follow_up_task_automation_attempted_at: new Date().toISOString(),
      follow_up_task_automation_error_category: null,
    })
    .eq('id', input.leadId)
    .is('deleted_at', null)
    .select('id')

  if (updateError) {
    return { ok: false, error: 'Unable to update lead follow-up status.' }
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, error: 'Unable to update lead follow-up status.' }
  }

  return { ok: true, updated: true, status }
}
