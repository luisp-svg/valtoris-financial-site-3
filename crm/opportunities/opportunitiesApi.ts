import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  FetchOpportunitiesFilters,
  OpportunityActivityRecord,
  OpportunityDetail,
  OpportunityHouseholdSummary,
  OpportunityListItem,
  OpportunityLoadResult,
  OpportunityOwnerSummary,
  OpportunityPipelineSummary,
  OpportunityServiceVerticalSummary,
  OpportunityStageSummary,
  OpportunityStatus,
  OpportunityStatusGroup,
  OpportunityWorkspace,
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
  // Status / owner / pipeline filters are applied server-side above.
  // Search is client-side so it can match embedded household/pipeline labels.
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
