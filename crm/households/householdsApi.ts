import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  AssessmentType,
  CrmHouseholdDetail,
  CrmHouseholdListItem,
  CrmHouseholdWorkspace,
  HouseholdActivitySummary,
  HouseholdAdvisorSummary,
  HouseholdAnnualReviewSummary,
  HouseholdAssessmentSummary,
  HouseholdMemberSummary,
  HouseholdOpenOpportunitySummary,
  HouseholdOpenTaskSummary,
  HouseholdStageSummary,
  MemberRelationship,
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
    relationship,
    is_primary_contact,
    deleted_at
  )
`

const HOUSEHOLD_DETAIL_SELECT = `
  id,
  display_name,
  status,
  primary_email,
  primary_phone,
  assigned_advisor_id,
  relationship_stage_id,
  created_at,
  updated_at,
  assigned_advisor:advisor_profiles!assigned_advisor_id ( id, display_name ),
  relationship_stage:pipeline_stages!relationship_stage_id ( id, name, code ),
  members:household_members!household_id (
    id,
    first_name,
    last_name,
    relationship,
    is_primary_contact,
    deleted_at
  )
`

const MEMBER_RELATIONSHIPS = new Set<MemberRelationship>([
  'primary',
  'spouse',
  'partner',
  'child',
  'dependent',
  'other',
])

const ASSESSMENT_TYPES = new Set<AssessmentType>([
  'family',
  'business',
  'retirement',
  'protection',
])

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

function normalizeRelationship(value: unknown): MemberRelationship {
  if (typeof value === 'string' && MEMBER_RELATIONSHIPS.has(value as MemberRelationship)) {
    return value as MemberRelationship
  }
  return 'other'
}

function normalizeMembers(value: unknown): HouseholdMemberSummary[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((member): member is Record<string, unknown> => {
      return (
        !!member &&
        typeof member === 'object' &&
        typeof (member as HouseholdMemberSummary).id === 'string' &&
        typeof (member as HouseholdMemberSummary).first_name === 'string' &&
        typeof (member as HouseholdMemberSummary).last_name === 'string' &&
        (member as { deleted_at?: string | null }).deleted_at == null
      )
    })
    .map((member) => ({
      id: String(member.id),
      first_name: String(member.first_name),
      last_name: String(member.last_name),
      relationship: normalizeRelationship(member.relationship),
      is_primary_contact: Boolean(member.is_primary_contact),
    }))
    .sort((a, b) => {
      if (a.is_primary_contact !== b.is_primary_contact) {
        return a.is_primary_contact ? -1 : 1
      }
      return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
    })
}

function normalizeHouseholdListItem(row: Record<string, unknown>): CrmHouseholdListItem {
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

function normalizeHouseholdDetail(row: Record<string, unknown>): CrmHouseholdDetail {
  return {
    ...normalizeHouseholdListItem(row),
    created_at: String(row.created_at),
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

export function getStatusLabel(status: CrmHouseholdListItem['status']): string {
  return status.replace(/_/g, ' ')
}

export function getRelationshipLabel(relationship: MemberRelationship): string {
  switch (relationship) {
    case 'primary':
      return 'Primary'
    case 'spouse':
      return 'Spouse'
    case 'partner':
      return 'Partner'
    case 'child':
      return 'Child'
    case 'dependent':
      return 'Dependent'
    default:
      return 'Other'
  }
}

export function getMemberDisplayName(member: HouseholdMemberSummary): string {
  return `${member.first_name} ${member.last_name}`.trim() || 'Unnamed member'
}

export function formatActivityTypeLabel(activityType: string): string {
  return activityType.replace(/_/g, ' ')
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
  return (data ?? []).map((row) => normalizeHouseholdListItem(row as Record<string, unknown>))
}

export async function fetchHouseholdById(
  supabase: SupabaseClient,
  householdId: string,
): Promise<CrmHouseholdDetail | null> {
  const { data, error } = await supabase
    .from('households')
    .select(HOUSEHOLD_DETAIL_SELECT)
    .eq('id', householdId)
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return normalizeHouseholdDetail(data as Record<string, unknown>)
}

async function fetchOpenTasksForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdOpenTaskSummary[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority, status')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    due_date: (row.due_date as string | null) ?? null,
    priority: String(row.priority),
    status: String(row.status),
  }))
}

async function fetchOpenOpportunitiesForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdOpenOpportunitySummary[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select(
      `
      id,
      title,
      status,
      next_action,
      stage:pipeline_stages!stage_id ( id, name )
    `,
    )
    .eq('household_id', householdId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(8)

  if (error) throw error
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: String(record.id),
      title: String(record.title),
      status: String(record.status),
      next_action: (record.next_action as string | null) ?? null,
      stage: asSingle<{ id: string; name: string }>(record.stage),
    }
  })
}

function normalizeAssessment(row: Record<string, unknown>): HouseholdAssessmentSummary | null {
  const assessmentType = row.assessment_type
  if (typeof assessmentType !== 'string' || !ASSESSMENT_TYPES.has(assessmentType as AssessmentType)) {
    return null
  }
  return {
    id: String(row.id),
    assessment_type: assessmentType as AssessmentType,
    overall_score:
      typeof row.overall_score === 'number'
        ? row.overall_score
        : row.overall_score == null
          ? null
          : Number(row.overall_score),
    overall_grade: (row.overall_grade as string | null) ?? null,
    completed_at: String(row.completed_at),
  }
}

async function fetchAssessmentsForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{
  familyAssessment: HouseholdAssessmentSummary | null
  businessAssessment: HouseholdAssessmentSummary | null
  protectionAssessment: HouseholdAssessmentSummary | null
}> {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, assessment_type, overall_score, overall_grade, completed_at')
    .eq('household_id', householdId)
    .in('assessment_type', ['family', 'business', 'protection'])
    .is('deleted_at', null)
    .order('completed_at', { ascending: false })

  if (error) throw error

  let familyAssessment: HouseholdAssessmentSummary | null = null
  let businessAssessment: HouseholdAssessmentSummary | null = null
  let protectionAssessment: HouseholdAssessmentSummary | null = null

  for (const row of data ?? []) {
    const assessment = normalizeAssessment(row as Record<string, unknown>)
    if (!assessment) continue
    if (assessment.assessment_type === 'family' && !familyAssessment) {
      familyAssessment = assessment
    } else if (assessment.assessment_type === 'business' && !businessAssessment) {
      businessAssessment = assessment
    } else if (assessment.assessment_type === 'protection' && !protectionAssessment) {
      protectionAssessment = assessment
    }
  }

  return { familyAssessment, businessAssessment, protectionAssessment }
}

async function fetchLatestAnnualReview(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdAnnualReviewSummary | null> {
  const { data, error } = await supabase
    .from('annual_reviews')
    .select('id, scheduled_for, completed_at, summary')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('scheduled_for', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    id: String(row.id),
    scheduled_for: (row.scheduled_for as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
  }
}

async function fetchRecentActivities(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdActivitySummary[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, activity_type, title, body, occurred_at')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(12)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    activity_type: String(row.activity_type),
    title: String(row.title),
    body: (row.body as string | null) ?? null,
    occurred_at: String(row.occurred_at),
  }))
}

async function settledOrEmpty<T>(promise: Promise<T>, fallback: T, source: string): Promise<T> {
  try {
    return await promise
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[crm/households/workspace]', formatSupabaseError(source, error))
    }
    return fallback
  }
}

export async function fetchHouseholdWorkspace(
  supabase: SupabaseClient,
  householdId: string,
): Promise<CrmHouseholdWorkspace | null> {
  const household = await fetchHouseholdById(supabase, householdId)
  if (!household) return null

  const [openTasks, openOpportunities, assessments, annualReview, recentActivities] =
    await Promise.all([
      settledOrEmpty(
        fetchOpenTasksForHousehold(supabase, householdId),
        [] as HouseholdOpenTaskSummary[],
        'open_tasks',
      ),
      settledOrEmpty(
        fetchOpenOpportunitiesForHousehold(supabase, householdId),
        [] as HouseholdOpenOpportunitySummary[],
        'open_opportunities',
      ),
      settledOrEmpty(
        fetchAssessmentsForHousehold(supabase, householdId),
        {
          familyAssessment: null,
          businessAssessment: null,
          protectionAssessment: null,
        },
        'assessments',
      ),
      settledOrEmpty(
        fetchLatestAnnualReview(supabase, householdId),
        null as HouseholdAnnualReviewSummary | null,
        'annual_reviews',
      ),
      settledOrEmpty(
        fetchRecentActivities(supabase, householdId),
        [] as HouseholdActivitySummary[],
        'activities',
      ),
    ])

  return {
    household,
    openTasks,
    openOpportunities,
    familyAssessment: assessments.familyAssessment,
    businessAssessment: assessments.businessAssessment,
    protectionAssessment: assessments.protectionAssessment,
    annualReview,
    recentActivities,
  }
}
