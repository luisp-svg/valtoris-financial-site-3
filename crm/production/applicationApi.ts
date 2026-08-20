/**
 * P1B-2B/2C application entry and edit API.
 * Reads: SELECT only (households, members, active catalog, advisors).
 * Writes: approved Migration 032 RPCs only — never table INSERT/UPDATE/UPSERT/DELETE.
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  APPLICATION_GENERIC_ERROR,
  applicationRecoveryCopy,
  formatApplicationUserError,
} from './applicationErrors'
import { formatStageTransitionUserError } from './stageTransitionErrors'
import {
  allocationsEqual,
  applicationNumberMode,
  buildUpdatePayload,
  formatPartialSaveMessage,
  participantsEqual,
  recoveryTransitionPlan,
  type ApplicationEditDraft,
  type ApplicationEditIntent,
  type ApplicationEditOriginal,
  type ApplicationEditPhase,
} from './applicationEditView'
import {
  buildParticipantPayload,
  catchUpTransitionPlan,
  dollarsToCents,
  isFiaProductLine,
  isLifeProductLine,
  isPremiumMode,
  transitionReasonForStage,
} from './applicationView'
import type {
  ProductionAdvisorOption,
  ProductionAllocationDraft,
  ProductionEntryMode,
  ProductionEntryProductOption,
  ProductionHouseholdOption,
  ProductionMemberOption,
  ProductionParticipantDraft,
  ProductionProductLine,
  ProductionStage,
} from './types'
import { PRODUCTION_PRODUCT_LINES } from './types'
import { toWritingAllocationRpcPayload } from './writingSplits'
import {
  CASE_OPERATIONS_PAYLOAD_KEYS,
  sanitizeCaseOperationsPatch,
  type CaseOperationsPatch,
} from './caseOperationsView'

const APPLICATION_RPC = {
  create: 'create_policy_application',
  update: 'update_policy_application',
  setParticipants: 'set_policy_application_participants',
  setAllocations: 'set_policy_application_allocations',
  transition: 'transition_policy_application_stage',
  setNumber: 'set_policy_application_number',
  correctNumber: 'correct_policy_application_number',
} as const

export const APPROVED_APPLICATION_RPCS = [
  APPLICATION_RPC.create,
  APPLICATION_RPC.setParticipants,
  APPLICATION_RPC.setAllocations,
  APPLICATION_RPC.transition,
] as const

export const APPROVED_EDIT_RPCS = [
  APPLICATION_RPC.update,
  APPLICATION_RPC.setParticipants,
  APPLICATION_RPC.setAllocations,
  APPLICATION_RPC.transition,
  APPLICATION_RPC.setNumber,
  APPLICATION_RPC.correctNumber,
] as const

export type ApplicationMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export type ApplicationSubmitPhase = 'create' | 'participants' | 'allocations' | 'transition'

export type ApplicationSubmitResult =
  | { ok: true; applicationId: string }
  | {
      ok: false
      phase: ApplicationSubmitPhase
      message: string
      applicationId: string | null
      recovery: boolean
    }

export type ApplicationCreateInput = {
  householdId: string
  carrierId: string
  productId: string
  productLine: ProductionProductLine
  state: string
  targetStage: ProductionStage
  entryMode?: ProductionEntryMode
  premiumMode: string
  plannedPremium: string
  faceAmount: string
  initialDeposit: string
  applicationNumber: string
  submissionDate: string
  policyNumber?: string
  participants: ProductionParticipantDraft[]
  allocations: ProductionAllocationDraft[]
}

function mutationFailure(err: unknown): ApplicationMutationResult<never> {
  return { ok: false, message: formatApplicationUserError(err) }
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data) return null
  if (Array.isArray(data)) {
    const first = data[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }
  if (typeof data === 'object') return data as Record<string, unknown>
  return null
}

function isProductLine(value: unknown): value is ProductionProductLine {
  return typeof value === 'string' && (PRODUCTION_PRODUCT_LINES as readonly string[]).includes(value)
}

export function formatApplicationDevError(context: string, err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const pg = err as PostgrestError
    return `[${context}] ${pg.message}${pg.code ? ` (${pg.code})` : ''}`
  }
  return `[${context}] ${String(err)}`
}

export function buildCreatePayload(input: ApplicationCreateInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    household_id: input.householdId,
    carrier_id: input.carrierId,
    product_id: input.productId,
    product_line: input.productLine,
    state: input.state.trim().toUpperCase(),
  }
  const applicationNumber = input.applicationNumber.trim()
  if (applicationNumber) payload.application_number = applicationNumber
  const submissionDate = input.submissionDate.trim()
  if (submissionDate) payload.submission_date = submissionDate

  if (isLifeProductLine(input.productLine)) {
    payload.submitted_premium_cents = dollarsToCents(input.plannedPremium)
    if (isPremiumMode(input.premiumMode)) payload.premium_mode = input.premiumMode
    const face = dollarsToCents(input.faceAmount)
    if (face != null) payload.face_amount_cents = face
  }
  if (isFiaProductLine(input.productLine)) {
    payload.annuity_deposit_cents = dollarsToCents(input.initialDeposit)
  }
  return payload
}

export async function fetchApplicationHouseholds(
  supabase: SupabaseClient,
): Promise<ProductionHouseholdOption[]> {
  const { data, error } = await supabase
    .from('households')
    .select('id, display_name')
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name ?? 'Household'),
    }))
}

export async function fetchApplicationMembers(
  supabase: SupabaseClient,
  householdId: string,
): Promise<ProductionMemberOption[]> {
  if (!householdId) return []
  const { data, error } = await supabase
    .from('household_members')
    .select('id, first_name, last_name, is_primary_contact')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('last_name', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      is_primary_contact: Boolean(row.is_primary_contact),
    }))
}

export async function fetchActiveApplicationCarriers(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; name: string; code: string }>> {
  const { data, error } = await supabase
    .from('carriers')
    .select('id, name, code')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      code: String(row.code ?? ''),
    }))
}

export async function fetchActiveApplicationProducts(
  supabase: SupabaseClient,
): Promise<ProductionEntryProductOption[]> {
  const { data, error } = await supabase
    .from('insurance_products')
    .select('id, carrier_id, name, product_line')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .filter((row) => row?.id && isProductLine(row.product_line))
    .map((row) => ({
      id: String(row.id),
      carrier_id: String(row.carrier_id),
      name: String(row.name ?? ''),
      product_line: row.product_line as ProductionProductLine,
    }))
}

export async function fetchActiveWritingAdvisors(
  supabase: SupabaseClient,
): Promise<ProductionAdvisorOption[]> {
  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('id, display_name, states_licensed')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name ?? 'Advisor'),
      states_licensed: Array.isArray(row.states_licensed)
        ? row.states_licensed.map((value) => String(value))
        : [],
    }))
}

export async function fetchCurrentAdvisorProfileId(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null
  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data?.id) return null
  return String(data.id)
}

export async function createPolicyApplication(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<ApplicationMutationResult<{ applicationId: string }>> {
  const { data, error } = await supabase.rpc(APPLICATION_RPC.create, { p_payload: payload })
  if (error) return mutationFailure(error)
  const row = asRecord(data)
  const applicationId = row?.application_id
  if (typeof applicationId !== 'string' || !applicationId) {
    return { ok: false, message: APPLICATION_GENERIC_ERROR }
  }
  return { ok: true, data: { applicationId } }
}

export async function setPolicyApplicationParticipants(
  supabase: SupabaseClient,
  applicationId: string,
  participants: ProductionParticipantDraft[],
  reason: string | null = null,
): Promise<ApplicationMutationResult<{ participantCount: number }>> {
  const { data, error } = await supabase.rpc(APPLICATION_RPC.setParticipants, {
    p_application_id: applicationId,
    p_participants: participants,
    p_reason: reason,
  })
  if (error) return mutationFailure(error)
  const row = asRecord(data)
  return { ok: true, data: { participantCount: Number(row?.participant_count ?? participants.length) } }
}

export async function setPolicyApplicationAllocations(
  supabase: SupabaseClient,
  applicationId: string,
  allocations: ProductionAllocationDraft[],
  reason: string | null = null,
): Promise<ApplicationMutationResult<{ allocationCount: number }>> {
  const { data, error } = await supabase.rpc(APPLICATION_RPC.setAllocations, {
    p_application_id: applicationId,
    p_allocations: toWritingAllocationRpcPayload(allocations),
    p_reason: reason,
  })
  if (error) return mutationFailure(error)
  const row = asRecord(data)
  return { ok: true, data: { allocationCount: Number(row?.allocation_count ?? allocations.length) } }
}

export async function transitionPolicyApplicationStage(
  supabase: SupabaseClient,
  input: {
    applicationId: string
    toStage: string
    reason: string
    fields?: Record<string, unknown>
    deliveryStatus?: string | null
  },
): Promise<ApplicationMutationResult<{ applicationId: string }>> {
  const { data, error } = await supabase.rpc(APPLICATION_RPC.transition, {
    p_application_id: input.applicationId,
    p_to_stage: input.toStage,
    p_disposition: null,
    p_delivery_status: input.deliveryStatus ?? null,
    p_reason: input.reason,
    p_fields: input.fields ?? {},
  })
  if (error) return { ok: false, message: formatStageTransitionUserError(error) }
  const row = asRecord(data)
  const id = typeof row?.application_id === 'string' ? row.application_id : input.applicationId
  return { ok: true, data: { applicationId: id } }
}

/**
 * Browser workflow is not one database transaction.
 * create_policy_application is atomic for the draft row.
 * Participants, allocations, and stage hops are subsequent RPCs.
 * A post-create failure keeps the draft; there is no cleanup/delete RPC.
 */
export async function submitProductionApplication(
  supabase: SupabaseClient,
  input: ApplicationCreateInput,
): Promise<ApplicationSubmitResult> {
  const created = await createPolicyApplication(supabase, buildCreatePayload(input))
  if (!created.ok) {
    return { ok: false, phase: 'create', message: created.message, applicationId: null, recovery: false }
  }
  const applicationId = created.data.applicationId

  const participants = await setPolicyApplicationParticipants(
    supabase,
    applicationId,
    input.participants,
  )
  if (!participants.ok) {
    return {
      ok: false,
      phase: 'participants',
      message: applicationRecoveryCopy(applicationId).message,
      applicationId,
      recovery: true,
    }
  }

  const allocations = await setPolicyApplicationAllocations(
    supabase,
    applicationId,
    input.allocations,
  )
  if (!allocations.ok) {
    return {
      ok: false,
      phase: 'allocations',
      message: applicationRecoveryCopy(applicationId).message,
      applicationId,
      recovery: true,
    }
  }

  const plan = catchUpTransitionPlan(input.targetStage)
  const submissionDate = input.submissionDate.trim()
  const policyNumber = input.policyNumber?.trim() ?? ''
  const entryMode = input.entryMode ?? 'new_business'
  for (const stage of plan) {
    const fields: Record<string, unknown> = {}
    if (stage === 'submitted' && submissionDate) fields.submission_date = submissionDate
    if (stage === 'issued' && policyNumber) fields.policy_number = policyNumber
    const moved = await transitionPolicyApplicationStage(supabase, {
      applicationId,
      toStage: stage,
      reason: transitionReasonForStage(stage, entryMode),
      fields,
      deliveryStatus: stage === 'in_force' ? 'not_required' : null,
    })
    if (!moved.ok) {
      return {
        ok: false,
        phase: 'transition',
        message: applicationRecoveryCopy(applicationId).message,
        applicationId,
        recovery: true,
      }
    }
  }

  return { ok: true, applicationId }
}

export async function updatePolicyApplication(
  supabase: SupabaseClient,
  applicationId: string,
  payload: Record<string, unknown>,
): Promise<ApplicationMutationResult<{ applicationId: string }>> {
  const { data, error } = await supabase.rpc(APPLICATION_RPC.update, {
    p_id: applicationId,
    p_payload: payload,
  })
  if (error) return mutationFailure(error)
  const row = asRecord(data)
  const id = typeof row?.application_id === 'string' ? row.application_id : applicationId
  return { ok: true, data: { applicationId: id } }
}

/**
 * Phase 2 Case Operations wrapper. Sends only the approved operational keys
 * through update_policy_application. Not a generic patch helper.
 */
export async function saveCaseOperations(
  supabase: SupabaseClient,
  applicationId: string,
  patch: CaseOperationsPatch,
): Promise<ApplicationMutationResult<{ applicationId: string; unchanged: boolean }>> {
  const sanitized = sanitizeCaseOperationsPatch(patch)
  const keys = Object.keys(sanitized)
  if (keys.some((key) => !(CASE_OPERATIONS_PAYLOAD_KEYS as readonly string[]).includes(key))) {
    return { ok: false, message: 'That Case Operations change cannot be saved.' }
  }
  if (keys.length === 0) {
    return { ok: true, data: { applicationId, unchanged: true } }
  }
  const updated = await updatePolicyApplication(supabase, applicationId, sanitized)
  if (!updated.ok) return updated
  return { ok: true, data: { applicationId: updated.data.applicationId, unchanged: false } }
}

export async function setPolicyApplicationNumber(
  supabase: SupabaseClient,
  applicationId: string,
  applicationNumber: string,
): Promise<ApplicationMutationResult<{ applicationNumber: string }>> {
  const { data, error } = await supabase.rpc(APPLICATION_RPC.setNumber, {
    p_application_id: applicationId,
    p_application_number: applicationNumber,
  })
  if (error) return mutationFailure(error)
  const row = asRecord(data)
  return {
    ok: true,
    data: { applicationNumber: String(row?.application_number ?? applicationNumber) },
  }
}

export async function correctPolicyApplicationNumber(
  supabase: SupabaseClient,
  applicationId: string,
  applicationNumber: string,
  reason: string,
): Promise<ApplicationMutationResult<{ applicationNumber: string }>> {
  const { data, error } = await supabase.rpc(APPLICATION_RPC.correctNumber, {
    p_application_id: applicationId,
    p_application_number: applicationNumber,
    p_reason: reason,
  })
  if (error) return mutationFailure(error)
  const row = asRecord(data)
  return {
    ok: true,
    data: { applicationNumber: String(row?.application_number ?? applicationNumber) },
  }
}

export type ApplicationEditInput = {
  applicationId: string
  stage: ProductionStage
  isOwner: boolean
  original: ApplicationEditOriginal
  draft: ApplicationEditDraft
  intent: ApplicationEditIntent
}

export type ApplicationEditResult =
  | { ok: true; applicationId: string; saved: ApplicationEditPhase[] }
  | {
      ok: false
      phase: ApplicationEditPhase
      message: string
      applicationId: string
      saved: ApplicationEditPhase[]
    }

function editFailure(
  saved: ApplicationEditPhase[],
  phase: ApplicationEditPhase,
  applicationId: string,
  rpcMessage: string,
): ApplicationEditResult {
  return {
    ok: false,
    phase,
    message: `${rpcMessage} ${formatPartialSaveMessage(saved, phase)}`,
    applicationId,
    saved,
  }
}

/**
 * Browser edit workflow is not one database transaction.
 * Successful earlier RPCs stay saved. A later failure does not roll them back.
 */
export async function saveProductionApplicationEdit(
  supabase: SupabaseClient,
  input: ApplicationEditInput,
): Promise<ApplicationEditResult> {
  const saved: ApplicationEditPhase[] = []
  const { applicationId, stage, isOwner, original, draft, intent } = input

  const fields = buildUpdatePayload({ stage, original, draft })
  if (fields) {
    const updated = await updatePolicyApplication(supabase, applicationId, fields)
    if (!updated.ok) return editFailure(saved, 'fields', applicationId, updated.message)
    saved.push('fields')
  }

  const line = (draft.productLine || original.productLine) as ProductionProductLine
  const nextParticipants = buildParticipantPayload({
    productLine: line,
    roleMembers: draft.roleMembers,
  })
  if (!participantsEqual(nextParticipants, original.participants)) {
    const reason = draft.participantReason.trim() || null
    const participants = await setPolicyApplicationParticipants(
      supabase,
      applicationId,
      nextParticipants,
      reason,
    )
    if (!participants.ok) return editFailure(saved, 'participants', applicationId, participants.message)
    saved.push('participants')
  }

  if (!allocationsEqual(draft.allocations, original.allocations)) {
    const reason = draft.allocationReason.trim() || null
    const allocations = await setPolicyApplicationAllocations(
      supabase,
      applicationId,
      draft.allocations,
      reason,
    )
    if (!allocations.ok) return editFailure(saved, 'allocations', applicationId, allocations.message)
    saved.push('allocations')
  }

  const numberMode = applicationNumberMode({
    stage,
    applicationNumber: original.applicationNumber,
    isOwner,
  })
  const nextNumber = draft.applicationNumber.trim()
  if (numberMode === 'set' && nextNumber && nextNumber !== original.applicationNumber.trim()) {
    const numbered = await setPolicyApplicationNumber(supabase, applicationId, nextNumber)
    if (!numbered.ok) {
      return editFailure(saved, 'application_number', applicationId, numbered.message)
    }
    saved.push('application_number')
  }
  if (numberMode === 'correct' && nextNumber && nextNumber !== original.applicationNumber.trim()) {
    const corrected = await correctPolicyApplicationNumber(
      supabase,
      applicationId,
      nextNumber,
      draft.applicationNumberReason.trim(),
    )
    if (!corrected.ok) {
      return editFailure(saved, 'application_number', applicationId, corrected.message)
    }
    saved.push('application_number')
  }

  const plan = recoveryTransitionPlan(stage, intent)
  const submissionDate = draft.submissionDate.trim()
  for (const toStage of plan) {
    const transitionFields =
      toStage === 'submitted' && submissionDate ? { submission_date: submissionDate } : {}
    const moved = await transitionPolicyApplicationStage(supabase, {
      applicationId,
      toStage,
      reason: transitionReasonForStage(toStage),
      fields: transitionFields,
    })
    if (!moved.ok) return editFailure(saved, 'transition', applicationId, moved.message)
    if (!saved.includes('transition')) saved.push('transition')
  }

  return { ok: true, applicationId, saved }
}
