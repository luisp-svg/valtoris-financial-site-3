/**
 * P1B-2B application entry API.
 * Reads: SELECT only (households, members, active catalog, advisors).
 * Writes: the four approved Migration 032 RPCs — never table INSERT/UPDATE/UPSERT/DELETE.
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  APPLICATION_GENERIC_ERROR,
  applicationRecoveryCopy,
  formatApplicationUserError,
} from './applicationErrors'
import {
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
  ProductionEntryProductOption,
  ProductionEntryStage,
  ProductionHouseholdOption,
  ProductionMemberOption,
  ProductionParticipantDraft,
  ProductionProductLine,
} from './types'
import { PRODUCTION_PRODUCT_LINES } from './types'

const APPLICATION_RPC = {
  create: 'create_policy_application',
  setParticipants: 'set_policy_application_participants',
  setAllocations: 'set_policy_application_allocations',
  transition: 'transition_policy_application_stage',
} as const

export const APPROVED_APPLICATION_RPCS = [
  APPLICATION_RPC.create,
  APPLICATION_RPC.setParticipants,
  APPLICATION_RPC.setAllocations,
  APPLICATION_RPC.transition,
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
  targetStage: ProductionEntryStage
  premiumMode: string
  plannedPremium: string
  faceAmount: string
  initialDeposit: string
  applicationNumber: string
  submissionDate: string
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
    .select('id, display_name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name ?? 'Advisor'),
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
    p_allocations: allocations,
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
  },
): Promise<ApplicationMutationResult<{ applicationId: string }>> {
  const { data, error } = await supabase.rpc(APPLICATION_RPC.transition, {
    p_application_id: input.applicationId,
    p_to_stage: input.toStage,
    p_disposition: null,
    p_delivery_status: null,
    p_reason: input.reason,
    p_fields: input.fields ?? {},
  })
  if (error) return mutationFailure(error)
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
  for (const stage of plan) {
    const fields =
      stage === 'submitted' && submissionDate ? { submission_date: submissionDate } : {}
    const moved = await transitionPolicyApplicationStage(supabase, {
      applicationId,
      toStage: stage,
      reason: transitionReasonForStage(stage),
      fields,
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
