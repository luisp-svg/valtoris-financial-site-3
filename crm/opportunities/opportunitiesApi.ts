/**
 * CRM-8.2 — opportunities DB contract (valtoris-crm-dev / migrations 006+010+012+014).
 *
 * COLUMN MUTABILITY (UPDATE via PostgREST under RLS + enforce_opportunity_protected_columns)
 * ---------------------------------------------------------------------------
 * Directly writable (no RPC):
 *   title, need_identified, next_action, next_action_due_at, metadata,
 *   source_assessment_id, source_lead_id, source_recommendation_id
 *
 * Immutable after create (trigger always blocks):
 *   household_id, service_vertical_id, pipeline_id
 *
 * Writable only via move_opportunity_stage RPC:
 *   stage_id, stage_entered_at, status, closed_at
 *   (RPC derives status/closed_at from pipeline_stages.is_won/is_lost/is_terminal)
 *
 * Writable only via assign_opportunity RPC (MISSING) or convert_recommendation…:
 *   assigned_advisor_id, assigned_at, assigned_by_user_id, assignment_reason
 *
 * System-managed:
 *   id, created_at, updated_at (set_updated_at trigger)
 *
 * Soft delete:
 *   deleted_at exists but client UPDATE is blocked by SELECT policy
 *   (deleted_at IS NULL). soft_delete_opportunity RPC does not exist — omit from UI.
 *
 * INSERT (create): RLS allows owner OR crm_can_access_household(household_id).
 * Protect trigger is UPDATE-only, so assignment + stage_entered_at may be set on INSERT.
 *
 * OMITTED FROM UI (no writable product path / not a column):
 *   description — column does not exist
 *   archive — no archive flag/status
 *   metadata / source_* — not part of CRM-8.2 forms
 *   deleted_at — not client-writable under current RLS
 *   status on edit — derived by move_opportunity_stage; do not edit directly
 *   assigned_* on edit — assign_opportunity RPC missing
 */

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeCreateOpportunityInput,
  normalizeUpdateOpportunityInput,
  validateCreateOpportunityInput,
  validateStageMove,
  validateUpdateOpportunityInput,
  type CreateOpportunityValidationContext,
} from './opportunityValidation'
import type {
  CreateOpportunityFormValues,
  FetchOpportunitiesFilters,
  OpportunityActivityRecord,
  OpportunityAdvisorOption,
  OpportunityDetail,
  OpportunityHouseholdOption,
  OpportunityHouseholdSummary,
  OpportunityListItem,
  OpportunityLoadResult,
  OpportunityOwnerSummary,
  OpportunityPipelineOption,
  OpportunityPipelineSummary,
  OpportunityServiceVerticalOption,
  OpportunityServiceVerticalSummary,
  OpportunityStageOption,
  OpportunityStageSummary,
  OpportunityStatus,
  OpportunityStatusGroup,
  OpportunityWorkspace,
  UpdateOpportunityInput,
} from './types'

export const OPPORTUNITY_LIST_DEFAULT_LIMIT = 100
export const OPPORTUNITY_ACTIVITY_FETCH_LIMIT = 50

const OPPORTUNITY_STATUS_SET = new Set<OpportunityStatus>(['open', 'won', 'lost', 'on_hold'])

const STAGE_EMBED_SELECT = `
  id,
  name,
  code,
  sort_order,
  is_won,
  is_lost,
  is_terminal
`

const OPPORTUNITY_LIST_SELECT = `
  id,
  title,
  status,
  household_id,
  pipeline_id,
  stage_id,
  service_vertical_id,
  assigned_advisor_id,
  next_action,
  next_action_due_at,
  stage_entered_at,
  closed_at,
  updated_at,
  created_at,
  household:households!household_id ( id, display_name ),
  pipeline:pipelines!pipeline_id ( id, name ),
  stage:pipeline_stages!stage_id ( ${STAGE_EMBED_SELECT} ),
  service_vertical:service_verticals!service_vertical_id ( id, code, name ),
  assigned_advisor:advisor_profiles!assigned_advisor_id ( id, display_name )
`

const OPPORTUNITY_DETAIL_SELECT = `
  ${OPPORTUNITY_LIST_SELECT},
  need_identified,
  source_assessment_id,
  source_lead_id,
  source_recommendation_id,
  assigned_at,
  assignment_reason,
  metadata
`

const ACTIVITY_SELECT = `
  id,
  household_id,
  opportunity_id,
  actor_user_id,
  activity_type,
  title,
  body,
  metadata,
  occurred_at,
  created_at,
  actor:profiles!activities_actor_user_id_fkey ( id, full_name )
`

const ACTOR_FALLBACK_LABEL = 'Advisor'

export function formatSupabaseError(source: string, error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Partial<PostgrestError> & { message?: string }
    const parts = [
      `${source} failed`,
      e.message ? `message=${e.message}` : null,
      e.code ? `code=${e.code}` : null,
      e.details ? `details=${e.details}` : null,
      e.hint ? `hint=${e.hint}` : null,
    ].filter(Boolean)
    if (parts.length > 1) return parts.join(' | ')
  }
  if (error instanceof Error && error.message) {
    return `${source} failed | message=${error.message}`
  }
  return `${source} failed | message=Unknown error`
}

export function asSingle<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null
  return (value as T) ?? null
}

export function parseOpportunityStatus(value: unknown): OpportunityStatus {
  if (typeof value === 'string' && OPPORTUNITY_STATUS_SET.has(value as OpportunityStatus)) {
    return value as OpportunityStatus
  }
  // Unknown DB values must not invent a lifecycle stage — fall back to open for typing only.
  return 'open'
}

export function isClosedStatus(status: OpportunityStatus): boolean {
  return status === 'won' || status === 'lost'
}

export function matchesStatusGroup(
  status: OpportunityStatus,
  group: OpportunityStatusGroup | undefined,
): boolean {
  if (!group || group === 'all') return true
  if (group === 'closed') return isClosedStatus(status)
  return !isClosedStatus(status)
}

function normalizePipeline(value: unknown): OpportunityPipelineSummary | null {
  const row = asSingle<{ id?: unknown; name?: unknown }>(value)
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name : 'Pipeline unavailable',
  }
}

function normalizeStage(value: unknown): OpportunityStageSummary | null {
  const row = asSingle<{
    id?: unknown
    name?: unknown
    code?: unknown
    sort_order?: unknown
    is_won?: unknown
    is_lost?: unknown
    is_terminal?: unknown
  }>(value)
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name : 'Stage unavailable',
    code: typeof row.code === 'string' ? row.code : '',
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order) || 0,
    is_won: Boolean(row.is_won),
    is_lost: Boolean(row.is_lost),
    is_terminal: Boolean(row.is_terminal),
  }
}

function normalizeOwner(value: unknown): OpportunityOwnerSummary | null {
  const row = asSingle<{ id?: unknown; display_name?: unknown }>(value)
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    display_name:
      typeof row.display_name === 'string' && row.display_name.trim()
        ? row.display_name
        : 'Advisor',
  }
}

function normalizeHousehold(value: unknown): OpportunityHouseholdSummary | null {
  const row = asSingle<{ id?: unknown; display_name?: unknown }>(value)
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    display_name:
      typeof row.display_name === 'string' && row.display_name.trim()
        ? row.display_name
        : 'Household unavailable',
  }
}

function normalizeServiceVertical(value: unknown): OpportunityServiceVerticalSummary | null {
  const row = asSingle<{ id?: unknown; code?: unknown; name?: unknown }>(value)
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    code: typeof row.code === 'string' ? row.code : '',
    name:
      typeof row.name === 'string' && row.name.trim()
        ? row.name
        : typeof row.code === 'string' && row.code
          ? row.code
          : 'Service unavailable',
  }
}

function readEmbeddedFullName(value: unknown): string | null {
  const row = asSingle<{ full_name?: unknown }>(value)
  if (!row || typeof row.full_name !== 'string') return null
  const trimmed = row.full_name.trim()
  return trimmed || null
}

export function resolveActorDisplayName(options: {
  userId: string | null | undefined
  profileFullName?: string | null
  advisorDisplayName?: string | null
}): string | null {
  if (!options.userId) return null
  const profileName = options.profileFullName?.trim()
  if (profileName) return profileName
  const advisorName = options.advisorDisplayName?.trim()
  if (advisorName) return advisorName
  return ACTOR_FALLBACK_LABEL
}

/** Normalize a list/detail row. Stage names always come from embedded pipeline_stages — never invented. */
export function normalizeOpportunityListItem(row: Record<string, unknown>): OpportunityListItem {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    status: parseOpportunityStatus(row.status),
    household_id: String(row.household_id),
    pipeline_id: String(row.pipeline_id),
    stage_id: String(row.stage_id),
    service_vertical_id: String(row.service_vertical_id),
    assigned_advisor_id: (row.assigned_advisor_id as string | null) ?? null,
    next_action: (row.next_action as string | null) ?? null,
    next_action_due_at: (row.next_action_due_at as string | null) ?? null,
    stage_entered_at: (row.stage_entered_at as string | null) ?? null,
    closed_at: (row.closed_at as string | null) ?? null,
    updated_at: String(row.updated_at),
    created_at: String(row.created_at),
    household: normalizeHousehold(row.household),
    pipeline: normalizePipeline(row.pipeline),
    stage: normalizeStage(row.stage),
    service_vertical: normalizeServiceVertical(row.service_vertical),
    assigned_advisor: normalizeOwner(row.assigned_advisor),
  }
}

export function normalizeOpportunityDetail(row: Record<string, unknown>): OpportunityDetail {
  const base = normalizeOpportunityListItem(row)
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  return {
    ...base,
    need_identified: Boolean(row.need_identified),
    source_assessment_id: (row.source_assessment_id as string | null) ?? null,
    source_lead_id: (row.source_lead_id as string | null) ?? null,
    source_recommendation_id: (row.source_recommendation_id as string | null) ?? null,
    assigned_at: (row.assigned_at as string | null) ?? null,
    assignment_reason: (row.assignment_reason as string | null) ?? null,
    metadata,
  }
}

export function normalizeOpportunityActivityRow(
  row: Record<string, unknown>,
  advisorNames: Map<string, string> = new Map(),
): OpportunityActivityRecord {
  const actorUserId = (row.actor_user_id as string | null) ?? null
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  return {
    id: String(row.id),
    household_id: String(row.household_id),
    opportunity_id: (row.opportunity_id as string | null) ?? null,
    actor_user_id: actorUserId,
    actor_display_name: resolveActorDisplayName({
      userId: actorUserId,
      profileFullName: readEmbeddedFullName(row.actor),
      advisorDisplayName: actorUserId ? advisorNames.get(actorUserId) ?? null : null,
    }),
    activity_type: String(row.activity_type),
    title: String(row.title ?? ''),
    body: (row.body as string | null) ?? null,
    metadata,
    occurred_at: String(row.occurred_at),
    created_at: String(row.created_at),
  }
}

/** Stable list ordering: updated_at desc, then id desc. */
export function sortOpportunitiesByUpdatedAtDesc(
  items: OpportunityListItem[],
): OpportunityListItem[] {
  return [...items].sort((a, b) => {
    const byUpdated = b.updated_at.localeCompare(a.updated_at)
    if (byUpdated !== 0) return byUpdated
    return b.id.localeCompare(a.id)
  })
}

export function opportunityMatchesSearch(item: OpportunityListItem, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  if (item.title.toLowerCase().includes(normalized)) return true
  if (item.household?.display_name.toLowerCase().includes(normalized)) return true
  if (item.pipeline?.name.toLowerCase().includes(normalized)) return true
  if (item.stage?.name.toLowerCase().includes(normalized)) return true
  if (item.service_vertical?.name.toLowerCase().includes(normalized)) return true
  if (item.assigned_advisor?.display_name.toLowerCase().includes(normalized)) return true
  return false
}

export function filterOpportunityListItems(
  items: OpportunityListItem[],
  filters?: Pick<FetchOpportunitiesFilters, 'search' | 'statusGroup'>,
): OpportunityListItem[] {
  if (!filters) return items
  return items.filter((item) => {
    if (!opportunityMatchesSearch(item, filters.search ?? '')) return false
    if (!matchesStatusGroup(item.status, filters.statusGroup)) return false
    return true
  })
}

async function fetchAdvisorDisplayNamesByUserId(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('user_id, display_name')
    .in('user_id', unique)
    .is('deleted_at', null)
    .eq('is_active', true)

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[crm/opportunities]', formatSupabaseError('advisor_display_names', error))
    }
    return map
  }

  for (const row of data ?? []) {
    const userId = typeof row.user_id === 'string' ? row.user_id : null
    const displayName =
      typeof row.display_name === 'string' ? row.display_name.trim() : ''
    if (userId && displayName) map.set(userId, displayName)
  }
  return map
}

export async function settleOpportunityLoad<T>(
  promise: Promise<T>,
  fallback: T,
  source: string,
): Promise<OpportunityLoadResult<T>> {
  try {
    const value = await promise
    return { ok: true, value }
  } catch (error) {
    const formatted = formatSupabaseError(source, error)
    if (import.meta.env.DEV) {
      console.error('[crm/opportunities]', formatted)
    }
    return { ok: false, value: fallback, error: formatted }
  }
}

/**
 * Fetches opportunities visible under RLS.
 * Server-side filters applied where columns exist; search is applied client-side after normalize.
 */
export async function fetchOpportunities(
  supabase: SupabaseClient,
  filters?: FetchOpportunitiesFilters,
): Promise<OpportunityListItem[]> {
  const limit = filters?.limit ?? OPPORTUNITY_LIST_DEFAULT_LIMIT

  let query = supabase
    .from('opportunities')
    .select(OPPORTUNITY_LIST_SELECT)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (filters?.pipelineId) {
    query = query.eq('pipeline_id', filters.pipelineId)
  }
  if (filters?.stageId) {
    query = query.eq('stage_id', filters.stageId)
  }
  if (filters?.ownerId) {
    query = query.eq('assigned_advisor_id', filters.ownerId)
  }
  if (filters?.serviceVerticalId) {
    query = query.eq('service_vertical_id', filters.serviceVerticalId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  } else if (filters?.statusGroup === 'open') {
    query = query.in('status', ['open', 'on_hold'])
  } else if (filters?.statusGroup === 'closed') {
    query = query.in('status', ['won', 'lost'])
  }

  const { data, error } = await query
  if (error) throw error

  const items = ((data ?? []) as Record<string, unknown>[]).map(normalizeOpportunityListItem)
  return filterOpportunityListItems(items, { search: filters?.search })
}

export async function fetchOpportunityById(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<OpportunityDetail | null> {
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_DETAIL_SELECT)
    .eq('id', opportunityId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return normalizeOpportunityDetail(data as Record<string, unknown>)
}

/**
 * Opportunity-scoped activities via activities.opportunity_id (indexed).
 * Does not include household-wide activities that lack opportunity_id.
 * Does not include notes (CRM-8.1: no opportunity note CRUD).
 */
export async function fetchOpportunityActivities(
  supabase: SupabaseClient,
  opportunityId: string,
  options?: { limit?: number },
): Promise<OpportunityActivityRecord[]> {
  const limit = options?.limit ?? OPPORTUNITY_ACTIVITY_FETCH_LIMIT
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('opportunity_id', opportunityId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []) as Record<string, unknown>[]
  const actorIds = rows
    .map((row) => (row.actor_user_id as string | null) ?? null)
    .filter((id): id is string => Boolean(id))
  const advisorNames = await fetchAdvisorDisplayNamesByUserId(supabase, actorIds)
  return rows.map((row) => normalizeOpportunityActivityRow(row, advisorNames))
}

export async function fetchOpportunityWorkspace(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<OpportunityWorkspace | null> {
  const opportunity = await fetchOpportunityById(supabase, opportunityId)
  if (!opportunity) return null

  const activities = await settleOpportunityLoad(
    fetchOpportunityActivities(supabase, opportunityId),
    [] as OpportunityActivityRecord[],
    'opportunity_activities',
  )

  return { opportunity, activities }
}

export function getOpportunityStageLabel(item: {
  stage: OpportunityStageSummary | null
}): string {
  return item.stage?.name ?? 'Stage unavailable'
}

export function getOpportunityPipelineLabel(item: {
  pipeline: OpportunityPipelineSummary | null
}): string {
  return item.pipeline?.name ?? 'Pipeline unavailable'
}

export function getOpportunityVerticalLabel(item: {
  service_vertical: OpportunityServiceVerticalSummary | null
}): string {
  return item.service_vertical?.name ?? 'Service unavailable'
}

export function getOpportunityOwnerLabel(item: {
  assigned_advisor: OpportunityOwnerSummary | null
}): string {
  return item.assigned_advisor?.display_name ?? 'Unassigned'
}

export function getOpportunityHouseholdLabel(item: {
  household: OpportunityHouseholdSummary | null
}): string {
  return item.household?.display_name ?? 'Household unavailable'
}

export function formatOpportunityStatusLabel(status: OpportunityStatus): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'won':
      return 'Won'
    case 'lost':
      return 'Lost'
    case 'on_hold':
      return 'On hold'
    default:
      return String(status)
  }
}

/**
 * Archive: there is no separate archived flag/status on opportunities.
 * Close = move to a won/lost (or terminal) stage via move_opportunity_stage.
 * Soft delete column exists but is not client-writable under current RLS.
 */
export const OPPORTUNITY_ARCHIVE_SUPPORT = {
  hasArchiveFlag: false,
  closeViaStageRpc: true,
  softDeleteViaDeletedAt: false,
  softDeleteBlockedByRls: true,
  softDeleteRequiresMissingRpc: 'soft_delete_opportunity',
  reassignRequiresMissingRpc: 'assign_opportunity',
} as const

export async function fetchOpportunityHouseholdOptions(
  supabase: SupabaseClient,
): Promise<OpportunityHouseholdOption[]> {
  const { data, error } = await supabase
    .from('households')
    .select('id, display_name')
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
    .order('display_name', { ascending: true })
    .limit(200)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    display_name: String(row.display_name ?? 'Household'),
  }))
}

export async function fetchOpportunityServiceVerticalOptions(
  supabase: SupabaseClient,
): Promise<OpportunityServiceVerticalOption[]> {
  const { data, error } = await supabase
    .from('service_verticals')
    .select('id, code, name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code ?? ''),
    name: String(row.name ?? row.code ?? 'Service'),
  }))
}

/** Service pipelines only — matches convert_recommendation_to_opportunity selection pattern. */
export async function fetchOpportunityPipelineOptions(
  supabase: SupabaseClient,
  options?: { serviceVerticalId?: string },
): Promise<OpportunityPipelineOption[]> {
  let query = supabase
    .from('pipelines')
    .select('id, name, service_vertical_id, pipeline_type, is_default, is_active')
    .eq('is_active', true)
    .eq('pipeline_type', 'service')
    .order('name', { ascending: true })

  if (options?.serviceVerticalId) {
    query = query.eq('service_vertical_id', options.serviceVerticalId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? 'Pipeline'),
    service_vertical_id: (row.service_vertical_id as string | null) ?? null,
    pipeline_type: String(row.pipeline_type ?? ''),
    is_default: Boolean(row.is_default),
    is_active: Boolean(row.is_active),
  }))
}

export async function fetchOpportunityStageOptions(
  supabase: SupabaseClient,
  pipelineId: string,
): Promise<OpportunityStageOption[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, pipeline_id, name, code, sort_order, is_won, is_lost, is_terminal')
    .eq('pipeline_id', pipelineId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    pipeline_id: String(row.pipeline_id),
    name: String(row.name ?? 'Stage'),
    code: String(row.code ?? ''),
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order) || 0,
    is_won: Boolean(row.is_won),
    is_lost: Boolean(row.is_lost),
    is_terminal: Boolean(row.is_terminal),
  }))
}

/** Single request for stages across many pipelines (create form reference load). */
export async function fetchOpportunityStageOptionsForPipelines(
  supabase: SupabaseClient,
  pipelineIds: string[],
): Promise<OpportunityStageOption[]> {
  const unique = [...new Set(pipelineIds.filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, pipeline_id, name, code, sort_order, is_won, is_lost, is_terminal')
    .in('pipeline_id', unique)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    pipeline_id: String(row.pipeline_id),
    name: String(row.name ?? 'Stage'),
    code: String(row.code ?? ''),
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order) || 0,
    is_won: Boolean(row.is_won),
    is_lost: Boolean(row.is_lost),
    is_terminal: Boolean(row.is_terminal),
  }))
}

/**
 * Active advisor profiles visible under RLS.
 * Owners and advisors can both SELECT active profiles (advisor_profiles_select).
 */
export async function fetchOpportunityAdvisorOptions(
  supabase: SupabaseClient,
): Promise<OpportunityAdvisorOption[]> {
  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('id, display_name, user_id')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('display_name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    display_name:
      typeof row.display_name === 'string' && row.display_name.trim()
        ? row.display_name.trim()
        : 'Advisor',
    user_id: String(row.user_id),
  }))
}

/** Resolves the signed-in user's advisor_profiles.id, or null for owners without a profile. */
export async function fetchCurrentAdvisorProfileId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data?.id ? String(data.id) : null
}

/**
 * Creates an opportunity via direct INSERT (RLS).
 * No create_opportunity RPC exists. Status uses the database default ('open').
 *
 * Audit fields are never accepted from callers:
 * - assigned_by_user_id ← auth.getUser()
 * - assigned_at ← generated here when assigning
 * - assignment_reason ← application constant 'manual' when assigning
 * - stage_entered_at ← generated here
 *
 * Advisor self-assign is re-checked from the authenticated session (not caller role claims).
 */
export async function createOpportunity(
  supabase: SupabaseClient,
  input: CreateOpportunityFormValues,
  validationContext: CreateOpportunityValidationContext,
): Promise<OpportunityDetail> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user?.id) {
    throw new Error('Not authenticated.')
  }
  const assignedByUserId = user.id

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', assignedByUserId)
    .is('deleted_at', null)
    .maybeSingle()
  if (profileError) throw profileError

  const sessionRole: 'owner' | 'advisor' =
    profileRow?.role === 'owner' ? 'owner' : 'advisor'
  const sessionAdvisorId = await fetchCurrentAdvisorProfileId(supabase, assignedByUserId)

  // Never trust caller-supplied role / actorAdvisorId for assignment enforcement.
  const secureContext: CreateOpportunityValidationContext = {
    ...validationContext,
    role: sessionRole,
    actorAdvisorId: sessionAdvisorId,
  }

  const validation = validateCreateOpportunityInput(input, secureContext)
  if (!validation.ok) {
    throw new Error(validation.formError ?? 'Invalid opportunity.')
  }

  const normalized = normalizeCreateOpportunityInput(input)
  const assignedAdvisorId = normalized.assigned_advisor_id

  if (
    sessionRole === 'advisor' &&
    assignedAdvisorId &&
    sessionAdvisorId &&
    assignedAdvisorId !== sessionAdvisorId
  ) {
    throw new Error('Advisors may only assign opportunities to themselves.')
  }

  const nowIso = new Date().toISOString()

  // Explicit allowlist — audit fields constructed here only.
  const insertPayload: Record<string, unknown> = {
    title: normalized.title,
    household_id: normalized.household_id,
    pipeline_id: normalized.pipeline_id,
    stage_id: normalized.stage_id,
    service_vertical_id: normalized.service_vertical_id,
    assigned_advisor_id: assignedAdvisorId,
    assigned_at: assignedAdvisorId ? nowIso : null,
    assigned_by_user_id: assignedAdvisorId ? assignedByUserId : null,
    assignment_reason: assignedAdvisorId ? 'manual' : null,
    next_action: normalized.next_action,
    next_action_due_at: normalized.next_action_due_at,
    need_identified: normalized.need_identified ?? true,
    stage_entered_at: nowIso,
  }

  for (const key of Object.keys(insertPayload)) {
    if (!(OPPORTUNITY_INSERT_ALLOWLIST as readonly string[]).includes(key)) {
      throw new Error(`Unexpected insert field "${key}" is not allowlisted.`)
    }
  }

  const { data, error } = await supabase
    .from('opportunities')
    .insert(insertPayload)
    .select(OPPORTUNITY_DETAIL_SELECT)
    .single()

  if (error) throw error
  return normalizeOpportunityDetail(data as Record<string, unknown>)
}

/** Columns the create helper may write. Audit timestamps/ids are filled internally. */
export const OPPORTUNITY_INSERT_ALLOWLIST = [
  'title',
  'household_id',
  'pipeline_id',
  'stage_id',
  'service_vertical_id',
  'assigned_advisor_id',
  'assigned_at',
  'assigned_by_user_id',
  'assignment_reason',
  'next_action',
  'next_action_due_at',
  'need_identified',
  'stage_entered_at',
] as const

/** Explicit allowlist used by tests — must match updateOpportunity payload keys. */
export const OPPORTUNITY_UPDATE_ALLOWLIST = [
  'title',
  'next_action',
  'next_action_due_at',
  'need_identified',
] as const

export const OPPORTUNITY_UPDATE_FORBIDDEN = [
  'household_id',
  'service_vertical_id',
  'pipeline_id',
  'stage_id',
  'stage_entered_at',
  'status',
  'closed_at',
  'assigned_advisor_id',
  'assigned_at',
  'assigned_by_user_id',
  'assignment_reason',
  'metadata',
  'source_assessment_id',
  'source_lead_id',
  'source_recommendation_id',
  'deleted_at',
  'id',
] as const

/**
 * Updates only the four CRM-8.2A mutable columns.
 * Never spreads an Opportunity object; never sends protected columns.
 */
export async function updateOpportunity(
  supabase: SupabaseClient,
  opportunityId: string,
  input: UpdateOpportunityInput,
): Promise<OpportunityDetail> {
  const validation = validateUpdateOpportunityInput(input)
  if (!validation.ok) {
    throw new Error(validation.formError ?? 'Invalid opportunity.')
  }

  const normalized = normalizeUpdateOpportunityInput(input)
  const updatePayload: Record<string, unknown> = {
    title: normalized.title,
    next_action: normalized.next_action,
    next_action_due_at: normalized.next_action_due_at,
    need_identified: normalized.need_identified ?? true,
  }

  for (const key of OPPORTUNITY_UPDATE_FORBIDDEN) {
    if (key in updatePayload) {
      throw new Error(`Protected field "${key}" must not appear in opportunity update payloads.`)
    }
  }

  const { data, error } = await supabase
    .from('opportunities')
    .update(updatePayload)
    .eq('id', opportunityId)
    .is('deleted_at', null)
    .select(OPPORTUNITY_DETAIL_SELECT)
    .single()

  if (error) throw error
  return normalizeOpportunityDetail(data as Record<string, unknown>)
}

/**
 * Stage / status / closed_at — only via existing move_opportunity_stage RPC.
 * DB derives status + closed_at from stage flags; client must not set those columns.
 */
export async function moveOpportunityStage(
  supabase: SupabaseClient,
  opportunityId: string,
  stageId: string,
  stages: OpportunityStageOption[],
  pipelineId: string,
): Promise<OpportunityDetail> {
  const validation = validateStageMove(stageId, stages, pipelineId)
  if (!validation.ok) {
    throw new Error(validation.formError ?? 'Invalid stage.')
  }

  const { error: rpcError } = await supabase.rpc('move_opportunity_stage', {
    p_opportunity_id: opportunityId,
    p_stage_id: stageId,
  })

  if (rpcError) throw rpcError

  const detail = await fetchOpportunityById(supabase, opportunityId)
  if (!detail) {
    throw new Error('Opportunity stage updated, but the record could not be reloaded.')
  }
  return detail
}

/**
 * Soft-delete is blocked by existing RLS (SELECT requires deleted_at IS NULL).
 * No soft_delete_opportunity RPC exists. Do not UPDATE deleted_at from the client.
 */
export async function softDeleteOpportunity(
  _supabase: SupabaseClient,
  _opportunityId: string,
): Promise<string> {
  throw new Error(
    'Soft-delete is not available through the CRM client under current RLS. Close the opportunity with a won/lost stage instead. A soft_delete_opportunity RPC would be required (same pattern as soft_delete_note).',
  )
}

export function pickDefaultPipeline(
  pipelines: OpportunityPipelineOption[],
): OpportunityPipelineOption | null {
  if (pipelines.length === 0) return null
  return pipelines.find((row) => row.is_default) ?? pipelines[0] ?? null
}

export function pickDefaultStage(
  stages: OpportunityStageOption[],
): OpportunityStageOption | null {
  if (stages.length === 0) return null
  const identified = stages.find((row) => row.code === 'opportunity_identified')
  if (identified) return identified
  const openStages = stages.filter((row) => !row.is_won && !row.is_lost && !row.is_terminal)
  return openStages[0] ?? stages[0] ?? null
}

export function findCloseStage(
  stages: OpportunityStageOption[],
  kind: 'won' | 'lost',
): OpportunityStageOption | null {
  if (kind === 'won') {
    return stages.find((row) => row.is_won) ?? null
  }
  return stages.find((row) => row.is_lost) ?? stages.find((row) => row.is_terminal) ?? null
}
