import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_REPORT_CARD_ASSESSMENT_TYPES } from '../../../modules/reportCard/publicIngestCatalog'
import {
  isPublicSelfReportAssessment,
  normalizeWorkspaceAssessment,
  selectLatestPublicFamilyDiagnostic,
} from '../householdsApi'
import type { HouseholdAssessmentSummary } from '../types'
import {
  mapPublicFamilyDiagnosticDetail,
  mapPublicFamilyDiagnosticListItem,
} from './diagnosticFormatters'
import type {
  HouseholdAssessmentsLoadResult,
  PublicFamilyDiagnosticDetail,
  PublicFamilyDiagnosticListItem,
} from './types'
import { PUBLIC_FAMILY_DIAGNOSTIC_HISTORY_LIMIT } from './types'

const PUBLIC_FAMILY_SELECT = `
  id,
  household_id,
  lead_id,
  assessment_type,
  status,
  overall_score,
  overall_grade,
  completed_at,
  capture_channel,
  scoring_version,
  priorities,
  answers,
  derived_metrics,
  deleted_at
`

const LEAD_SELECT = `
  id,
  status,
  submitted_at,
  source_page,
  original_campaign,
  original_advisor_slug,
  original_source_metadata,
  ingest_match_status,
  duplicate_review_status,
  sheets_sync_status,
  consent_snapshot,
  assigned_advisor:advisor_profiles!leads_assigned_advisor_id_fkey ( id, display_name )
`

export function formatHouseholdAssessmentError(source: string, error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Partial<PostgrestError> & { message?: string }
    const parts = [
      `${source} failed`,
      e.message ? `message=${e.message}` : null,
      e.code ? `code=${e.code}` : null,
    ].filter(Boolean)
    if (parts.length > 1) return parts.join(' | ')
  }
  if (error instanceof Error && error.message) {
    return `${source} failed | message=${error.message}`
  }
  return `${source} failed | message=Unknown error`
}

function unwrapRelation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

async function fetchLeadsByIds(
  supabase: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>()
  if (leadIds.length === 0) return map

  const { data, error } = await supabase.from('leads').select(LEAD_SELECT).in('id', leadIds).is('deleted_at', null)

  if (error) throw error
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    if (typeof row.id === 'string') map.set(row.id, row)
  }
  return map
}

/**
 * Newest-first public Report Card and Protection Gap history for a household.
 * Soft-deleted and non-public rows are excluded by query + mapper.
 */
export async function fetchPublicFamilyDiagnosticHistory(
  supabase: SupabaseClient,
  householdId: string,
  options?: { limit?: number },
): Promise<PublicFamilyDiagnosticListItem[]> {
  if (!householdId.trim()) return []
  const limit = options?.limit ?? PUBLIC_FAMILY_DIAGNOSTIC_HISTORY_LIMIT

  const { data, error } = await supabase
    .from('assessments')
    .select(PUBLIC_FAMILY_SELECT)
    .eq('household_id', householdId)
    .in('assessment_type', [...PUBLIC_REPORT_CARD_ASSESSMENT_TYPES])
    .eq('capture_channel', 'public_self_report')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .is('deleted_at', null)
    .order('completed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []) as Record<string, unknown>[]
  const leadIds = [
    ...new Set(
      rows
        .map((row) => (typeof row.lead_id === 'string' ? row.lead_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const leads = await fetchLeadsByIds(supabase, leadIds)

  return rows
    .map((row, index) => {
      const leadId = typeof row.lead_id === 'string' ? row.lead_id : null
      return mapPublicFamilyDiagnosticListItem(row, {
        householdId,
        isLatest: index === 0,
        lead: leadId ? leads.get(leadId) ?? null : null,
      })
    })
    .filter((item): item is PublicFamilyDiagnosticListItem => item != null)
}

export async function fetchPublicFamilyDiagnosticHistorySafe(
  supabase: SupabaseClient,
  householdId: string,
  options?: { limit?: number },
): Promise<HouseholdAssessmentsLoadResult<PublicFamilyDiagnosticListItem[]>> {
  try {
    const value = await fetchPublicFamilyDiagnosticHistory(supabase, householdId, options)
    return { ok: true, value }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(
        '[crm/households/assessments]',
        formatHouseholdAssessmentError('public family history', error),
      )
    }
    return { ok: false, error: 'Unable to load public assessment history.' }
  }
}

export async function fetchLatestPublicFamilyDiagnosticSummary(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{
  latest: PublicFamilyDiagnosticListItem | null
  count: number
}> {
  const history = await fetchPublicFamilyDiagnosticHistory(supabase, householdId, {
    limit: PUBLIC_FAMILY_DIAGNOSTIC_HISTORY_LIMIT,
  })
  return {
    latest: history[0] ?? null,
    count: history.length,
  }
}

/**
 * Household-scoped detail. Returns null when missing, deleted, wrong household,
 * or not a public Report Card / Protection Gap.
 */
export async function fetchPublicFamilyDiagnosticDetail(
  supabase: SupabaseClient,
  householdId: string,
  assessmentId: string,
): Promise<PublicFamilyDiagnosticDetail | null> {
  if (!householdId.trim() || !assessmentId.trim()) return null

  const { data, error } = await supabase
    .from('assessments')
    .select(PUBLIC_FAMILY_SELECT)
    .eq('id', assessmentId)
    .eq('household_id', householdId)
    .in('assessment_type', [...PUBLIC_REPORT_CARD_ASSESSMENT_TYPES])
    .eq('capture_channel', 'public_self_report')
    .eq('status', 'completed')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as Record<string, unknown>
  let lead: Record<string, unknown> | null = null
  if (typeof row.lead_id === 'string') {
    const leads = await fetchLeadsByIds(supabase, [row.lead_id])
    lead = leads.get(row.lead_id) ?? null
  }

  return mapPublicFamilyDiagnosticDetail(row, householdId, lead)
}

export async function fetchPublicFamilyDiagnosticDetailSafe(
  supabase: SupabaseClient,
  householdId: string,
  assessmentId: string,
): Promise<HouseholdAssessmentsLoadResult<PublicFamilyDiagnosticDetail | null>> {
  try {
    const value = await fetchPublicFamilyDiagnosticDetail(supabase, householdId, assessmentId)
    return { ok: true, value }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(
        '[crm/households/assessments]',
        formatHouseholdAssessmentError('public family detail', error),
      )
    }
    return { ok: false, error: 'Unable to load this public assessment.' }
  }
}

/** Pure helpers re-exported for workspace selection without circular imports in tests. */
export function countPublicFamilyDiagnostics(
  rows: readonly Record<string, unknown>[],
): number {
  let count = 0
  for (const row of rows) {
    const assessment = normalizeWorkspaceAssessment(row)
    if (assessment && isPublicSelfReportAssessment(assessment)) count += 1
  }
  return count
}

export function selectLatestPublicFamilyDiagnosticSummary(
  rows: readonly Record<string, unknown>[],
): HouseholdAssessmentSummary | null {
  return selectLatestPublicFamilyDiagnostic(rows)
}

export { unwrapRelation }
