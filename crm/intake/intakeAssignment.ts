import type { SupabaseClient } from '@supabase/supabase-js'
import { formatIntakeError } from './intakeApi'

export const INTAKE_ASSIGN_HOUSEHOLD_RPC = 'assign_household'

export type IntakeAssignErrorCode = 'not_authorized' | 'invalid_advisor' | 'unknown'

export type IntakeAssignFailure = {
  ok: false
  code: IntakeAssignErrorCode
  message: string
}

export type IntakeAssignSuccess = {
  ok: true
  householdId: string
  assignedAdvisorId: string
}

export type IntakeAssignResponse = IntakeAssignSuccess | IntakeAssignFailure

const ASSIGN_ERROR_MESSAGES: Record<IntakeAssignErrorCode, string> = {
  not_authorized: 'You do not have permission to assign this household.',
  invalid_advisor: 'That advisor could not be assigned.',
  unknown: 'Unable to assign this household. Please try again.',
}

function rpcText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }
  if (error instanceof Error) return error.message
  return ''
}

export function mapAssignHouseholdRpcError(error: unknown): IntakeAssignFailure {
  const raw = rpcText(error)
  const lower = raw.toLowerCase()

  if (
    lower.includes('only owners can assign') ||
    lower.includes('not authenticated') ||
    lower.includes('not authorized') ||
    lower.includes('permission denied') ||
    raw.includes('42501')
  ) {
    return { ok: false, code: 'not_authorized', message: ASSIGN_ERROR_MESSAGES.not_authorized }
  }

  if (lower.includes('advisor not found') || lower.includes('inactive')) {
    return { ok: false, code: 'invalid_advisor', message: ASSIGN_ERROR_MESSAGES.invalid_advisor }
  }

  return { ok: false, code: 'unknown', message: ASSIGN_ERROR_MESSAGES.unknown }
}

/**
 * Authenticated browser wrapper for assign_household.
 * Owner-only on the server. Does not update households/leads/opportunities
 * or insert Activity from the browser — the existing RPC does that.
 */
export async function assignIntakeHousehold(
  supabase: SupabaseClient,
  input: { householdId: string; advisorId: string },
): Promise<IntakeAssignResponse> {
  if (!input.householdId || !input.advisorId) {
    return {
      ok: false,
      code: 'invalid_advisor',
      message: ASSIGN_ERROR_MESSAGES.invalid_advisor,
    }
  }

  const { data, error } = await supabase.rpc(INTAKE_ASSIGN_HOUSEHOLD_RPC, {
    p_household_id: input.householdId,
    p_advisor_id: input.advisorId,
    p_reason: 'manual',
  })

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[crm/intake]', formatIntakeError('assign household', error))
    }
    return mapAssignHouseholdRpcError(error)
  }

  const row = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null
  const householdId = typeof row?.id === 'string' ? row.id : input.householdId
  const assignedAdvisorId =
    typeof row?.assigned_advisor_id === 'string' ? row.assigned_advisor_id : input.advisorId

  if (!householdId || !assignedAdvisorId) {
    return { ok: false, code: 'unknown', message: ASSIGN_ERROR_MESSAGES.unknown }
  }

  return { ok: true, householdId, assignedAdvisorId }
}
