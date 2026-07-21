import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  CrmHouseholdListItem,
  HouseholdAdvisorSummary,
  HouseholdMemberSummary,
  HouseholdStageSummary,
} from './types'

/**
 * households has two FKs to advisor_profiles (assigned + original) — pin assigned_advisor_id.
 * pipeline_stages is pinned via relationship_stage_id for clarity.
 * Members are optional embeds; RLS may hide them for unassigned-pool rows.
 */
const HOUSEHOLD_LIST_SELECT = `
  id,
  display_name,
  status,
  primary_email,
  primary_phone,
  assigned_advisor_id,
  relationship_stage_id,
  updated_at,
  assigned_advisor:advisor_profiles!assigned_advisor_id ( id, display_name ),
  relationship_stage:pipeline_stages!relationship_stage_id ( id, name, code ),
  members:household_members!household_id (
    id,
    first_name,
    last_name,
    is_primary_contact
  )
`

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

function asSingle<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null
  return (value as T) ?? null
}

function normalizeMembers(value: unknown): HouseholdMemberSummary[] {
  if (!Array.isArray(value)) return []
  return value.filter((member): member is HouseholdMemberSummary => {
    return (
      !!member &&
      typeof member === 'object' &&
      typeof (member as HouseholdMemberSummary).id === 'string' &&
      typeof (member as HouseholdMemberSummary).first_name === 'string' &&
      typeof (member as HouseholdMemberSummary).last_name === 'string'
    )
  })
}

function normalizeHousehold(row: Record<string, unknown>): CrmHouseholdListItem {
  return {
    id: String(row.id),
    display_name: String(row.display_name),
    status: row.status as CrmHouseholdListItem['status'],
    primary_email: (row.primary_email as string | null) ?? null,
    primary_phone: (row.primary_phone as string | null) ?? null,
    assigned_advisor_id: (row.assigned_advisor_id as string | null) ?? null,
    relationship_stage_id: String(row.relationship_stage_id),
    updated_at: String(row.updated_at),
    assigned_advisor: asSingle<HouseholdAdvisorSummary>(row.assigned_advisor),
    relationship_stage: asSingle<HouseholdStageSummary>(row.relationship_stage),
    members: normalizeMembers(row.members),
  }
}

export function getPrimaryContactName(household: CrmHouseholdListItem): string | null {
  const primary = household.members.find((member) => member.is_primary_contact)
  if (primary) {
    const name = `${primary.first_name} ${primary.last_name}`.trim()
    return name || null
  }
  return null
}

export function getPrimaryContactLabel(household: CrmHouseholdListItem): string {
  const name = getPrimaryContactName(household)
  if (name) return name
  if (household.primary_email) return String(household.primary_email)
  if (household.primary_phone) return household.primary_phone
  return 'Primary contact not yet assigned'
}

export function getStageLabel(household: CrmHouseholdListItem): string {
  if (household.relationship_stage?.name) return household.relationship_stage.name
  if (household.status) {
    return household.status.replace(/_/g, ' ')
  }
  return 'Stage unavailable'
}

export function getAdvisorLabel(household: CrmHouseholdListItem): string {
  return household.assigned_advisor?.display_name?.trim() || 'Unassigned'
}

export async function fetchVisibleHouseholds(
  supabase: SupabaseClient,
): Promise<CrmHouseholdListItem[]> {
  const { data, error } = await supabase
    .from('households')
    .select(HOUSEHOLD_LIST_SELECT)
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => normalizeHousehold(row as Record<string, unknown>))
}
