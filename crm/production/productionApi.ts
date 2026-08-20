/**
 * P1B-1 Production read API — SELECT only.
 * Mutations (insert/update/upsert/delete/rpc writes) are intentionally absent.
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  ProductionAdvisorOption,
  ProductionAdvisorSummary,
  ProductionAllocation,
  ProductionApplicationDetail,
  ProductionApplicationListItem,
  ProductionCarrierOption,
  ProductionCarrierSummary,
  ProductionDeliveryStatus,
  ProductionDisposition,
  ProductionHouseholdSummary,
  ProductionLinkedPolicy,
  ProductionMemberSummary,
  ProductionParticipant,
  ProductionParticipantRole,
  ProductionProductLine,
  ProductionProductSummary,
  ProductionRecipientType,
  ProductionAllocationRole,
  ProductionStage,
  ProductionStageHistoryEntry,
  ProductionLinkedOpportunity,
} from './types'
import { PRODUCTION_PRODUCT_LINES, PRODUCTION_STAGES } from './types'

export const PRODUCTION_LIST_DEFAULT_LIMIT = 200

const MEMBER_EMBED = `id, first_name, last_name`
const ADVISOR_EMBED = `id, display_name`

const PARTICIPANT_EMBED = `
  id,
  role,
  household_member_id,
  effective_to,
  member:household_members!household_member_id ( ${MEMBER_EMBED} )
`

const ALLOCATION_EMBED = `
  id,
  recipient_type,
  advisor_id,
  allocation_role,
  commission_bps,
  production_credit_bps,
  effective_to,
  advisor:advisor_profiles!advisor_id ( ${ADVISOR_EMBED} )
`

const HISTORY_EMBED = `
  id,
  from_stage,
  to_stage,
  from_disposition,
  to_disposition,
  from_delivery_status,
  to_delivery_status,
  reason,
  changed_by_user_id,
  changed_at
`

const LINKED_POLICY_EMBED = `
  id,
  policy_number,
  status,
  terminated_on,
  termination_reason,
  deleted_at
`

const APPLICATION_LIST_SELECT = `
  id,
  household_id,
  carrier_id,
  product_id,
  product_line,
  state,
  application_number,
  policy_number,
  production_stage,
  underwriting_disposition,
  delivery_status,
  submission_date,
  next_follow_up_date,
  submitted_premium_cents,
  annuity_deposit_cents,
  face_amount_cents,
  premium_mode,
  issue_date,
  in_force_date,
  updated_at,
  deleted_at,
  writing_receivable_expected,
  household:households!household_id ( id, display_name ),
  carrier:carriers!carrier_id ( id, name, code ),
  product:insurance_products!product_id ( id, name, product_line ),
  participants:policy_application_participants ( ${PARTICIPANT_EMBED} ),
  allocations:policy_agent_allocations ( ${ALLOCATION_EMBED} ),
  stage_history:policy_application_stage_history ( ${HISTORY_EMBED} ),
  linked_policies:policies!source_application_id ( ${LINKED_POLICY_EMBED} )
`

const APPLICATION_DETAIL_SELECT = `
  ${APPLICATION_LIST_SELECT},
  opportunity_id,
  opportunity:opportunities!opportunity_id (
    id,
    title,
    status,
    stage:pipeline_stages!stage_id ( name )
  ),
  is_replacement,
  is_exchange_or_transfer,
  target_premium_cents,
  total_points_scaled,
  decision_date,
  production_month,
  notes,
  created_at,
  created_by_user_id
`

type EmbedOne<T> = T | T[] | null

function asSingle<T>(value: EmbedOne<T>): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function asArray<T>(value: EmbedOne<T>): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function isProductionStage(value: unknown): value is ProductionStage {
  return typeof value === 'string' && (PRODUCTION_STAGES as readonly string[]).includes(value)
}

function isProductLine(value: unknown): value is ProductionProductLine {
  return (
    typeof value === 'string' && (PRODUCTION_PRODUCT_LINES as readonly string[]).includes(value)
  )
}

function mapHousehold(value: EmbedOne<ProductionHouseholdSummary>): ProductionHouseholdSummary | null {
  const row = asSingle(value)
  if (!row?.id) return null
  return { id: String(row.id), display_name: row.display_name ?? null }
}

function mapCarrier(value: EmbedOne<ProductionCarrierSummary>): ProductionCarrierSummary | null {
  const row = asSingle(value)
  if (!row?.id) return null
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    code: String(row.code ?? ''),
  }
}

function mapProduct(value: EmbedOne<ProductionProductSummary>): ProductionProductSummary | null {
  const row = asSingle(value)
  if (!row?.id || !isProductLine(row.product_line)) return null
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    product_line: row.product_line,
  }
}

function mapMember(value: EmbedOne<ProductionMemberSummary>): ProductionMemberSummary | null {
  const row = asSingle(value)
  if (!row?.id) return null
  return {
    id: String(row.id),
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
  }
}

function mapAdvisor(value: EmbedOne<ProductionAdvisorSummary>): ProductionAdvisorSummary | null {
  const row = asSingle(value)
  if (!row?.id) return null
  return { id: String(row.id), display_name: row.display_name ?? null }
}

type RawParticipant = {
  id: string
  role: string
  household_member_id: string
  effective_to: string | null
  member?: EmbedOne<ProductionMemberSummary>
}

function mapParticipants(value: EmbedOne<RawParticipant>): ProductionParticipant[] {
  return asArray(value)
    .filter((row) => row?.id && row.household_member_id && row.role)
    .map((row) => ({
      id: String(row.id),
      role: row.role as ProductionParticipantRole,
      household_member_id: String(row.household_member_id),
      effective_to: row.effective_to ?? null,
      member: mapMember(row.member ?? null),
    }))
}

type RawAllocation = {
  id: string
  recipient_type: string
  advisor_id: string | null
  allocation_role: string
  commission_bps: number
  production_credit_bps: number
  effective_to: string | null
  advisor?: EmbedOne<ProductionAdvisorSummary>
}

function mapAllocations(value: EmbedOne<RawAllocation>): ProductionAllocation[] {
  return asArray(value)
    .filter((row) => row?.id && row.recipient_type && row.allocation_role)
    .map((row) => ({
      id: String(row.id),
      recipient_type: row.recipient_type as ProductionRecipientType,
      advisor_id: row.advisor_id ? String(row.advisor_id) : null,
      allocation_role: row.allocation_role as ProductionAllocationRole,
      commission_bps: Number(row.commission_bps ?? 0),
      production_credit_bps: Number(row.production_credit_bps ?? 0),
      effective_to: row.effective_to ?? null,
      advisor: mapAdvisor(row.advisor ?? null),
    }))
}

type RawHistory = {
  id: string
  from_stage: string | null
  to_stage: string
  from_disposition: string | null
  to_disposition: string | null
  from_delivery_status: string | null
  to_delivery_status: string | null
  reason: string | null
  changed_by_user_id: string | null
  changed_at: string
}

function mapHistory(value: EmbedOne<RawHistory>): ProductionStageHistoryEntry[] {
  return asArray(value)
    .filter((row) => row?.id && row.to_stage && row.changed_at)
    .map((row) => ({
      id: String(row.id),
      from_stage: (row.from_stage as ProductionStage | null) ?? null,
      to_stage: row.to_stage as ProductionStage,
      from_disposition: (row.from_disposition as ProductionDisposition | null) ?? null,
      to_disposition: (row.to_disposition as ProductionDisposition | null) ?? null,
      from_delivery_status: (row.from_delivery_status as ProductionDeliveryStatus | null) ?? null,
      to_delivery_status: (row.to_delivery_status as ProductionDeliveryStatus | null) ?? null,
      reason: row.reason ?? null,
      changed_by_user_id: row.changed_by_user_id ? String(row.changed_by_user_id) : null,
      changed_at: String(row.changed_at),
    }))
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
}

type RawLinkedPolicy = {
  id: string
  policy_number: string | null
  status: string | null
  deleted_at: string | null
  terminated_on?: string | null
  termination_reason?: string | null
}

function mapLinkedPolicies(value: EmbedOne<RawLinkedPolicy>): ProductionLinkedPolicy[] {
  return asArray(value)
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      policy_number: row.policy_number ?? null,
      status: row.status ?? null,
      deleted_at: row.deleted_at ?? null,
      terminated_on: row.terminated_on ?? null,
      termination_reason: row.termination_reason ?? null,
    }))
}

type RawListRow = {
  id: string
  household_id: string
  carrier_id: string
  product_id: string
  product_line: string
  state: string
  application_number: string | null
  policy_number: string | null
  production_stage: string
  underwriting_disposition: string
  delivery_status: string
  submission_date: string | null
  next_follow_up_date: string | null
  submitted_premium_cents: number | null
  annuity_deposit_cents: number | null
  face_amount_cents: number | null
  premium_mode: string | null
  issue_date: string | null
  in_force_date: string | null
  updated_at: string
  deleted_at: string | null
  writing_receivable_expected?: boolean
  household?: EmbedOne<ProductionHouseholdSummary>
  carrier?: EmbedOne<ProductionCarrierSummary>
  product?: EmbedOne<ProductionProductSummary>
  participants?: EmbedOne<RawParticipant>
  allocations?: EmbedOne<RawAllocation>
  stage_history?: EmbedOne<RawHistory>
  linked_policies?: EmbedOne<RawLinkedPolicy>
}

function mapListItem(row: RawListRow): ProductionApplicationListItem | null {
  if (!row?.id || !isProductionStage(row.production_stage) || !isProductLine(row.product_line)) {
    return null
  }
  return {
    id: String(row.id),
    household_id: String(row.household_id),
    carrier_id: String(row.carrier_id),
    product_id: String(row.product_id),
    product_line: row.product_line,
    state: String(row.state ?? ''),
    application_number: row.application_number ?? null,
    policy_number: row.policy_number ?? null,
    production_stage: row.production_stage,
    underwriting_disposition: row.underwriting_disposition as ProductionDisposition,
    delivery_status: row.delivery_status as ProductionDeliveryStatus,
    submission_date: row.submission_date ?? null,
    next_follow_up_date: row.next_follow_up_date ?? null,
    submitted_premium_cents:
      row.submitted_premium_cents == null ? null : Number(row.submitted_premium_cents),
    annuity_deposit_cents:
      row.annuity_deposit_cents == null ? null : Number(row.annuity_deposit_cents),
    face_amount_cents: row.face_amount_cents == null ? null : Number(row.face_amount_cents),
    premium_mode: row.premium_mode ?? null,
    issue_date: row.issue_date ?? null,
    in_force_date: row.in_force_date ?? null,
    updated_at: String(row.updated_at),
    deleted_at: row.deleted_at ?? null,
    household: mapHousehold(row.household ?? null),
    carrier: mapCarrier(row.carrier ?? null),
    product: mapProduct(row.product ?? null),
    participants: mapParticipants(row.participants ?? null),
    allocations: mapAllocations(row.allocations ?? null),
    stage_history: mapHistory(row.stage_history ?? null),
    linked_policies: mapLinkedPolicies(row.linked_policies ?? null),
    expected_compensations: [],
    overdue_requirement_count: 0,
    writing_receivable_expected: row.writing_receivable_expected !== false,
  }
}

type RawDetailRow = RawListRow & {
  opportunity_id: string | null
  opportunity?: EmbedOne<{
    id: string
    title: string | null
    status: string | null
    stage?: EmbedOne<{ name: string | null }>
  }>
  is_replacement: boolean
  is_exchange_or_transfer: boolean
  target_premium_cents: number | null
  total_points_scaled: number | null
  decision_date: string | null
  production_month: string | null
  notes: string | null
  created_at: string
  created_by_user_id: string | null
}

function mapLinkedOpportunity(
  opportunityId: string | null,
  value: RawDetailRow['opportunity'],
): ProductionLinkedOpportunity | null {
  const row = asSingle(value ?? null)
  if (!row?.id && !opportunityId) return null
  const stage = asSingle(row?.stage ?? null)
  return {
    id: String(row?.id ?? opportunityId),
    title: row?.title?.trim() ? String(row.title) : 'Opportunity',
    status: row?.status ? String(row.status) : '',
    stage_name: stage?.name ? String(stage.name) : null,
  }
}

function mapDetail(row: RawDetailRow): ProductionApplicationDetail | null {
  const base = mapListItem(row)
  if (!base) return null
  const opportunityId = row.opportunity_id ? String(row.opportunity_id) : null
  return {
    ...base,
    opportunity_id: opportunityId,
    linked_opportunity: mapLinkedOpportunity(opportunityId, row.opportunity),
    is_replacement: Boolean(row.is_replacement),
    is_exchange_or_transfer: Boolean(row.is_exchange_or_transfer),
    target_premium_cents:
      row.target_premium_cents == null ? null : Number(row.target_premium_cents),
    total_points_scaled:
      row.total_points_scaled == null ? null : Number(row.total_points_scaled),
    decision_date: row.decision_date ?? null,
    production_month: row.production_month ?? null,
    notes: row.notes ?? null,
    created_at: String(row.created_at),
    created_by_user_id: row.created_by_user_id ? String(row.created_by_user_id) : null,
  }
}

export function formatProductionSupabaseError(context: string, err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const pg = err as PostgrestError
    return `[${context}] ${pg.message}${pg.code ? ` (${pg.code})` : ''}`
  }
  return `[${context}] ${String(err)}`
}

/**
 * Loads production applications visible under RLS.
 * Soft-deleted rows are excluded by default so owner queues stay uncluttered.
 */
export async function fetchProductionApplications(
  supabase: SupabaseClient,
  options?: { limit?: number; includeDeleted?: boolean },
): Promise<ProductionApplicationListItem[]> {
  const limit = options?.limit ?? PRODUCTION_LIST_DEFAULT_LIMIT
  let query = supabase
    .from('policy_applications')
    .select(APPLICATION_LIST_SELECT)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!options?.includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query
  if (error) throw error

  return (data as unknown as RawListRow[])
    .map(mapListItem)
    .filter((row): row is ProductionApplicationListItem => row != null)
}

export type FetchProductionApplicationResult =
  | { ok: true; application: ProductionApplicationDetail }
  | { ok: false; kind: 'not_found' }
  | { ok: false; kind: 'error'; message: string }

export async function fetchProductionApplicationById(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<FetchProductionApplicationResult> {
  if (!applicationId.trim()) {
    return { ok: false, kind: 'not_found' }
  }

  const { data, error } = await supabase
    .from('policy_applications')
    .select(APPLICATION_DETAIL_SELECT)
    .eq('id', applicationId)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      kind: 'error',
      message: 'Unable to load this production application.',
    }
  }
  if (!data) return { ok: false, kind: 'not_found' }

  const mapped = mapDetail(data as unknown as RawDetailRow)
  if (!mapped) return { ok: false, kind: 'not_found' }
  return { ok: true, application: mapped }
}

/**
 * Production applications for a household. SELECT only; does not load compensation rows.
 */
export async function fetchHouseholdProductionApplications(
  supabase: SupabaseClient,
  householdId: string,
): Promise<ProductionApplicationDetail[]> {
  if (!householdId.trim()) return []
  const { data, error } = await supabase
    .from('policy_applications')
    .select(APPLICATION_DETAIL_SELECT)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as unknown as RawDetailRow[])
    .map(mapDetail)
    .filter((row): row is ProductionApplicationDetail => row != null)
    .map((row) => ({ ...row, expected_compensations: [] }))
}

/** Active carriers for filter dropdowns (RLS: advisors see active only). */
export async function fetchProductionCarrierOptions(
  supabase: SupabaseClient,
): Promise<ProductionCarrierOption[]> {
  const { data, error } = await supabase
    .from('carriers')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
  }))
}

/** Active advisors for owner writing-advisor filter. */
export async function fetchProductionAdvisorOptions(
  supabase: SupabaseClient,
): Promise<ProductionAdvisorOption[]> {
  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('id, display_name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('display_name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    display_name: String(row.display_name ?? 'Advisor'),
  }))
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function formatProductionDate(value: string | null | undefined): string {
  if (!value) return '—'
  const day = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, m, d] = day.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatProductionDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
