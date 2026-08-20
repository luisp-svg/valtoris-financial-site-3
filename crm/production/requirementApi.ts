/**
 * Case requirement read/write API.
 * Reads: authenticated SELECT through RLS.
 * Writes: Migration 044 RPCs only — never table INSERT/UPDATE/DELETE.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isRequirementCode,
  isRequirementStatus,
  type RequirementCode,
  type RequirementStatus,
} from './requirementCatalog'
import { formatRequirementUserError, REQUIREMENT_GENERIC_ERROR } from './requirementErrors'
import type {
  RequirementCreateInput,
  RequirementHistoryRow,
  RequirementRow,
  RequirementTransitionInput,
  RequirementUpdateFields,
  RequirementUrgencyRow,
} from './requirementTypes'
import {
  blankToNull,
  buildRequirementUpdateFields,
  overdueRequirementCountsByApplicationId,
  requirementCalendarToday,
} from './requirementView'

export const REQUIREMENT_RPC = {
  create: 'create_policy_application_requirement',
  update: 'update_policy_application_requirement',
  transition: 'transition_policy_application_requirement_status',
  softDelete: 'soft_delete_policy_application_requirement',
} as const

export const APPROVED_REQUIREMENT_RPCS = [
  REQUIREMENT_RPC.create,
  REQUIREMENT_RPC.update,
  REQUIREMENT_RPC.transition,
  REQUIREMENT_RPC.softDelete,
] as const

const REQUIREMENT_SELECT = `
  id,
  application_id,
  requirement_code,
  custom_label,
  status,
  due_date,
  scheduled_for,
  completed_at,
  waived_at,
  created_at,
  updated_at
`

const HISTORY_SELECT = `
  id,
  requirement_id,
  from_status,
  to_status,
  reason,
  changed_at
`

const URGENCY_SELECT = 'application_id, status, due_date'
const URGENCY_BATCH_LIMIT = 5000

export type RequirementMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data) return null
  if (Array.isArray(data)) {
    const first = data[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }
  if (typeof data === 'object') return data as Record<string, unknown>
  return null
}

function mapRequirement(value: unknown): RequirementRow | null {
  const row = asRecord(value)
  if (!row?.id || typeof row.id !== 'string') return null
  if (typeof row.application_id !== 'string') return null
  if (!isRequirementCode(row.requirement_code)) return null
  if (!isRequirementStatus(row.status)) return null
  return {
    id: row.id,
    application_id: row.application_id,
    requirement_code: row.requirement_code,
    custom_label: typeof row.custom_label === 'string' ? row.custom_label : null,
    status: row.status,
    due_date: typeof row.due_date === 'string' ? row.due_date : null,
    scheduled_for: typeof row.scheduled_for === 'string' ? row.scheduled_for : null,
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    waived_at: typeof row.waived_at === 'string' ? row.waived_at : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
  }
}

function mapHistory(value: unknown): RequirementHistoryRow | null {
  const row = asRecord(value)
  if (!row?.id || typeof row.id !== 'string') return null
  if (typeof row.requirement_id !== 'string') return null
  if (!isRequirementStatus(row.to_status)) return null
  const fromStatus = row.from_status == null ? null : row.from_status
  if (fromStatus != null && !isRequirementStatus(fromStatus)) return null
  return {
    id: row.id,
    requirement_id: row.requirement_id,
    from_status: fromStatus,
    to_status: row.to_status,
    reason: typeof row.reason === 'string' ? row.reason : null,
    changed_at: typeof row.changed_at === 'string' ? row.changed_at : '',
  }
}

function mapUrgency(value: unknown): RequirementUrgencyRow | null {
  const row = asRecord(value)
  if (typeof row?.application_id !== 'string') return null
  if (!isRequirementStatus(row.status)) return null
  return {
    application_id: row.application_id,
    status: row.status,
    due_date: typeof row.due_date === 'string' ? row.due_date : null,
  }
}

function mutationFailure(err: unknown): RequirementMutationResult<never> {
  return { ok: false, message: formatRequirementUserError(err) }
}

function requirementFromRpc(data: unknown): RequirementRow | null {
  const row = asRecord(data)
  return mapRequirement(row?.requirement ?? row)
}

export async function fetchApplicationRequirements(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<RequirementRow[]> {
  if (!applicationId) return []
  const { data, error } = await supabase
    .from('policy_application_requirements')
    .select(REQUIREMENT_SELECT)
    .eq('application_id', applicationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRequirement).filter((row): row is RequirementRow => row != null)
}

export async function fetchApplicationRequirementHistory(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<RequirementHistoryRow[]> {
  if (!applicationId) return []
  const { data, error } = await supabase
    .from('policy_application_requirement_history')
    .select(HISTORY_SELECT)
    .eq('application_id', applicationId)
    .order('changed_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapHistory).filter((row): row is RequirementHistoryRow => row != null)
}

/**
 * Batched urgency read for already-loaded application IDs.
 * Authenticated SELECT + RLS only. Does not fetch labels, history, or PHI.
 */
export async function fetchRequirementUrgencyByApplicationIds(
  supabase: SupabaseClient,
  applicationIds: readonly string[],
): Promise<RequirementUrgencyRow[]> {
  const ids = [...new Set(applicationIds.filter(Boolean))]
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('policy_application_requirements')
    .select(URGENCY_SELECT)
    .in('application_id', ids)
    .is('deleted_at', null)
    .limit(URGENCY_BATCH_LIMIT)
  if (error) throw error
  return (data ?? []).map(mapUrgency).filter((row): row is RequirementUrgencyRow => row != null)
}

export async function fetchOverdueRequirementCountsByApplicationIds(
  supabase: SupabaseClient,
  applicationIds: readonly string[],
  today: string = requirementCalendarToday(),
): Promise<Map<string, number>> {
  const rows = await fetchRequirementUrgencyByApplicationIds(supabase, applicationIds)
  return overdueRequirementCountsByApplicationId(rows, today)
}

export async function createPolicyApplicationRequirement(
  supabase: SupabaseClient,
  input: RequirementCreateInput,
): Promise<RequirementMutationResult<RequirementRow>> {
  const { data, error } = await supabase.rpc(REQUIREMENT_RPC.create, {
    p_application_id: input.applicationId,
    p_code: input.code,
    p_custom_label: blankToNull(input.customLabel),
    p_due_date: blankToNull(input.dueDate),
    p_scheduled_for: blankToNull(input.scheduledFor),
  })
  if (error) return mutationFailure(error)
  const row = requirementFromRpc(data)
  if (!row) return { ok: false, message: REQUIREMENT_GENERIC_ERROR }
  return { ok: true, data: row }
}

export async function updatePolicyApplicationRequirement(
  supabase: SupabaseClient,
  id: string,
  fields: RequirementUpdateFields,
): Promise<RequirementMutationResult<RequirementRow>> {
  const pFields = buildRequirementUpdateFields(fields)
  const { data, error } = await supabase.rpc(REQUIREMENT_RPC.update, {
    p_id: id,
    p_fields: pFields,
  })
  if (error) return mutationFailure(error)
  const row = requirementFromRpc(data)
  if (!row) return { ok: false, message: REQUIREMENT_GENERIC_ERROR }
  return { ok: true, data: row }
}

export async function transitionPolicyApplicationRequirementStatus(
  supabase: SupabaseClient,
  input: RequirementTransitionInput,
): Promise<RequirementMutationResult<RequirementRow>> {
  const { data, error } = await supabase.rpc(REQUIREMENT_RPC.transition, {
    p_id: input.id,
    p_to_status: input.toStatus,
    p_scheduled_for: blankToNull(input.scheduledFor),
    p_reason: blankToNull(input.reason),
  })
  if (error) return mutationFailure(error)
  const row = requirementFromRpc(data)
  if (!row) return { ok: false, message: REQUIREMENT_GENERIC_ERROR }
  return { ok: true, data: row }
}

export async function softDeletePolicyApplicationRequirement(
  supabase: SupabaseClient,
  id: string,
): Promise<RequirementMutationResult<RequirementRow>> {
  const { data, error } = await supabase.rpc(REQUIREMENT_RPC.softDelete, {
    p_id: id,
  })
  if (error) return mutationFailure(error)
  const row = requirementFromRpc(data)
  if (!row) return { ok: false, message: REQUIREMENT_GENERIC_ERROR }
  return { ok: true, data: row }
}

export type { RequirementCode, RequirementStatus }
