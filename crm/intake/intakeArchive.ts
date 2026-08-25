import type { SupabaseClient } from '@supabase/supabase-js'
import { formatIntakeError } from './intakeApi'
import type {
  IntakeArchiveErrorCode,
  IntakeArchiveFailure,
  IntakeArchiveReason,
  IntakeArchiveResponse,
  IntakeArchiveSuccess,
} from './types'

export const INTAKE_ARCHIVE_RPC = 'archive_intake_lead'

export const INTAKE_ARCHIVE_REASONS = [
  'dismissed',
  'not_a_fit',
  'spam',
  'test_or_accidental',
] as const satisfies readonly IntakeArchiveReason[]

const ARCHIVE_ERROR_MESSAGES: Record<IntakeArchiveErrorCode, string> = {
  not_authenticated: 'You must be signed in to archive this Intake.',
  invalid_reason: 'Unable to archive this Intake. Please refresh and try again.',
  not_authorized: 'You do not have permission to archive this Intake.',
  already_archived: 'This Intake has already been archived.',
  not_intake_lead: 'This record is not eligible for Intake archive.',
  duplicate_review_pending: 'Resolve the possible duplicate before archiving this Intake.',
  unknown: 'Unable to archive this Intake. Please try again.',
}

export function isIntakeArchiveReason(value: unknown): value is IntakeArchiveReason {
  return (
    value === 'dismissed' ||
    value === 'not_a_fit' ||
    value === 'spam' ||
    value === 'test_or_accidental'
  )
}

export function mapIntakeArchiveRpcError(error: unknown): IntakeArchiveFailure {
  const raw =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : error instanceof Error
        ? error.message
        : ''

  const codeMatch = raw.match(/CRM_INTAKE:([a-z0-9_]+)/i)
  const parsed = (codeMatch?.[1]?.toLowerCase() ?? 'unknown') as IntakeArchiveErrorCode
  const code = parsed in ARCHIVE_ERROR_MESSAGES ? parsed : 'unknown'
  return { ok: false, code, message: ARCHIVE_ERROR_MESSAGES[code] }
}

function mapIntakeArchiveRpcPayload(value: unknown): IntakeArchiveSuccess | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.ok !== true) return null
  if (typeof row.lead_id !== 'string' || !row.lead_id) return null
  if (row.archived !== true) return null
  if (!isIntakeArchiveReason(row.reason)) return null
  return {
    ok: true,
    lead_id: row.lead_id,
    archived: true,
    reason: row.reason,
    follow_up_task_completed: row.follow_up_task_completed === true,
  }
}

/**
 * Authenticated browser wrapper for archive_intake_lead.
 * Server RPC remains authoritative. Does not update leads, tasks, or Activity.
 */
export async function archiveIntakeLead(
  supabase: SupabaseClient,
  input: { leadId: string; reason: IntakeArchiveReason },
): Promise<IntakeArchiveResponse> {
  if (!input.leadId || !isIntakeArchiveReason(input.reason)) {
    return {
      ok: false,
      code: 'invalid_reason',
      message: ARCHIVE_ERROR_MESSAGES.invalid_reason,
    }
  }

  const { data, error } = await supabase.rpc(INTAKE_ARCHIVE_RPC, {
    p_lead_id: input.leadId,
    p_reason: input.reason,
  })

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[crm/intake]', formatIntakeError('intake archive', error))
    }
    return mapIntakeArchiveRpcError(error)
  }

  const mapped = mapIntakeArchiveRpcPayload(data)
  if (!mapped) {
    return {
      ok: false,
      code: 'unknown',
      message: ARCHIVE_ERROR_MESSAGES.unknown,
    }
  }

  return mapped
}
