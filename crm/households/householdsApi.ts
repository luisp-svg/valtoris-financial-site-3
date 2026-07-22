import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { normalizeEmail, normalizePhone } from './normalizeContact'
import type {
  AssessmentType,
  CreateHouseholdMemberInput,
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
  MemberRelationshipCreateOption,
  UpdateHouseholdMemberInput,
} from './types'

/**
 * households has two FKs to advisor_profiles (assigned + original) — pin assigned_advisor_id.
 * pipeline_stages is pinned via relationship_stage_id for clarity.
 * Members are optional embeds; RLS may hide them for unassigned-pool rows.
 */
const MEMBER_EMBED_SELECT = `
    id,
    household_id,
    first_name,
    last_name,
    relationship,
    is_primary_contact,
    email,
    phone,
    date_of_birth,
    created_at,
    updated_at,
    deleted_at
`

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
    ${MEMBER_EMBED_SELECT}
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
    ${MEMBER_EMBED_SELECT}
  )
`

const MEMBER_ROW_SELECT = `
  id,
  household_id,
  first_name,
  last_name,
  relationship,
  is_primary_contact,
  email,
  phone,
  date_of_birth,
  created_at,
  updated_at,
  deleted_at
`

const MEMBER_RELATIONSHIPS = new Set<MemberRelationship>([
  'primary',
  'spouse',
  'partner',
  'child',
  'dependent',
  'parent',
  'grandparent',
  'business_partner',
  'employee',
  'other',
])

/** Options shown for create / edit of non-legacy relationships. */
export const MEMBER_RELATIONSHIP_CREATE_OPTIONS: {
  value: MemberRelationshipCreateOption
  label: string
}[] = [
  { value: 'primary', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'business_partner', label: 'Business Partner' },
  { value: 'employee', label: 'Employee' },
  { value: 'other', label: 'Other' },
]

const ASSESSMENT_TYPES = new Set<AssessmentType>([
  'family',
  'business',
  'retirement',
  'protection',
])

export function formatSupabaseError(source: string, error: unknown): string {
  if (error instanceof Error && error.name === 'PrimarySwitchMutationError') {
    return error.message
  }
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

function sortMembers(members: HouseholdMemberSummary[]): HouseholdMemberSummary[] {
  return [...members].sort((a, b) => {
    if (a.is_primary_contact !== b.is_primary_contact) {
      return a.is_primary_contact ? -1 : 1
    }
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
  })
}

function normalizeMemberRow(
  member: Record<string, unknown>,
  fallbackHouseholdId?: string,
): HouseholdMemberSummary | null {
  if (
    typeof member.id !== 'string' ||
    typeof member.first_name !== 'string' ||
    typeof member.last_name !== 'string'
  ) {
    return null
  }
  if (member.deleted_at != null) return null

  const householdId =
    typeof member.household_id === 'string'
      ? member.household_id
      : fallbackHouseholdId
  if (!householdId) return null

  return {
    id: member.id,
    household_id: householdId,
    first_name: member.first_name,
    last_name: member.last_name,
    relationship: normalizeRelationship(member.relationship),
    is_primary_contact: Boolean(member.is_primary_contact),
    email: (member.email as string | null) ?? null,
    phone: (member.phone as string | null) ?? null,
    date_of_birth: (member.date_of_birth as string | null) ?? null,
    created_at: typeof member.created_at === 'string' ? member.created_at : '',
    updated_at: typeof member.updated_at === 'string' ? member.updated_at : '',
  }
}

function normalizeMembers(
  value: unknown,
  fallbackHouseholdId?: string,
): HouseholdMemberSummary[] {
  if (!Array.isArray(value)) return []
  const members: HouseholdMemberSummary[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const normalized = normalizeMemberRow(row as Record<string, unknown>, fallbackHouseholdId)
    if (normalized) members.push(normalized)
  }
  return sortMembers(members)
}

function normalizeHouseholdListItem(row: Record<string, unknown>): CrmHouseholdListItem {
  const id = String(row.id)
  return {
    id,
    display_name: String(row.display_name),
    status: row.status as CrmHouseholdListItem['status'],
    primary_email: (row.primary_email as string | null) ?? null,
    primary_phone: (row.primary_phone as string | null) ?? null,
    assigned_advisor_id: (row.assigned_advisor_id as string | null) ?? null,
    relationship_stage_id: String(row.relationship_stage_id),
    updated_at: String(row.updated_at),
    assigned_advisor: asSingle<HouseholdAdvisorSummary>(row.assigned_advisor),
    relationship_stage: asSingle<HouseholdStageSummary>(row.relationship_stage),
    members: normalizeMembers(row.members, id),
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
      return 'Self'
    case 'spouse':
      return 'Spouse'
    case 'partner':
      return 'Partner'
    case 'child':
      return 'Child'
    case 'dependent':
      return 'Dependent'
    case 'parent':
      return 'Parent'
    case 'grandparent':
      return 'Grandparent'
    case 'business_partner':
      return 'Business Partner'
    case 'employee':
      return 'Employee'
    default:
      return 'Other'
  }
}

/** Dropdown options; legacy partner/dependent included only when editing that value. */
export function getRelationshipSelectOptions(
  current?: MemberRelationship | null,
): { value: MemberRelationship; label: string }[] {
  const options: { value: MemberRelationship; label: string }[] =
    MEMBER_RELATIONSHIP_CREATE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    }))

  if (current === 'partner') {
    options.push({ value: 'partner', label: 'Partner' })
  }
  if (current === 'dependent') {
    options.push({ value: 'dependent', label: 'Dependent' })
  }
  return options
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

async function countActiveMembers(
  supabase: SupabaseClient,
  householdId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('household_members')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .is('deleted_at', null)

  if (error) throw error
  return count ?? 0
}

async function findPrimaryMemberId(
  supabase: SupabaseClient,
  householdId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('is_primary_contact', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

async function setMemberPrimaryFlag(
  supabase: SupabaseClient,
  memberId: string,
  isPrimary: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('household_members')
    .update({ is_primary_contact: isPrimary })
    .eq('id', memberId)
    .is('deleted_at', null)

  if (error) throw error
}

/**
 * Raised when a primary-contact switch clears the previous primary, the follow-up
 * write fails, and restoring the previous primary also fails.
 */
export class PrimarySwitchMutationError extends Error {
  readonly context: string
  readonly operationError: unknown
  readonly restoreError: unknown
  readonly previousPrimaryId: string
  readonly primaryMayBeUnset = true as const

  constructor(args: {
    context: string
    operationError: unknown
    restoreError: unknown
    previousPrimaryId: string
  }) {
    const operationMessage = formatSupabaseError(args.context, args.operationError)
    const restoreMessage = formatSupabaseError(
      `${args.context}_restore_primary`,
      args.restoreError,
    )
    super(
      `${args.context} failed after clearing the previous primary contact, and restoring the previous primary also failed. The household may currently have no primary contact. ${operationMessage} | ${restoreMessage}`,
    )
    this.name = 'PrimarySwitchMutationError'
    this.context = args.context
    this.operationError = args.operationError
    this.restoreError = args.restoreError
    this.previousPrimaryId = args.previousPrimaryId
  }
}

/**
 * After a failed create/update that cleared another member's primary flag, attempt
 * restore. Never swallows the original or restore error.
 * - Restore succeeds → rethrow the original operation error.
 * - Restore fails → throw PrimarySwitchMutationError (explicit no-primary warning).
 */
export async function recoverFromPrimarySwitchFailure(args: {
  context: string
  previousPrimaryId: string | null
  operationError: unknown
  restorePrimary: (previousPrimaryId: string) => Promise<void>
}): Promise<never> {
  const { context, previousPrimaryId, operationError, restorePrimary } = args
  if (!previousPrimaryId) {
    throw operationError
  }

  try {
    await restorePrimary(previousPrimaryId)
  } catch (restoreError) {
    if (import.meta.env.DEV) {
      console.error(
        '[crm/households/members]',
        formatSupabaseError(`${context}_restore_primary`, restoreError),
      )
      console.error(
        '[crm/households/members]',
        formatSupabaseError(context, operationError),
      )
    }
    throw new PrimarySwitchMutationError({
      context,
      operationError,
      restoreError,
      previousPrimaryId,
    })
  }

  throw operationError
}

function buildMemberWritePayload(input: {
  first_name: string
  last_name: string
  relationship: MemberRelationship
  is_primary_contact: boolean
  email: string | null
  phone: string | null
  date_of_birth: string | null
}) {
  const email = input.email?.trim() || null
  const phone = input.phone?.trim() || null
  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    relationship: input.relationship,
    is_primary_contact: input.is_primary_contact,
    email,
    normalized_email: normalizeEmail(email),
    phone,
    normalized_phone: normalizePhone(phone),
    date_of_birth: input.date_of_birth?.trim() || null,
  }
}

/**
 * Creates a household member. The first active member of a household is always
 * marked primary. Switching primary clears the previous primary first, with
 * best-effort restoration if the create fails afterward.
 */
export async function createHouseholdMember(
  supabase: SupabaseClient,
  input: CreateHouseholdMemberInput,
): Promise<HouseholdMemberSummary> {
  const activeCount = await countActiveMembers(supabase, input.household_id)
  const wantPrimary = activeCount === 0 ? true : Boolean(input.is_primary_contact)

  let previousPrimaryId: string | null = null
  if (wantPrimary) {
    previousPrimaryId = await findPrimaryMemberId(supabase, input.household_id)
    if (previousPrimaryId) {
      await setMemberPrimaryFlag(supabase, previousPrimaryId, false)
    }
  }

  const payload = {
    household_id: input.household_id,
    ...buildMemberWritePayload({ ...input, is_primary_contact: wantPrimary }),
  }

  try {
    const { data, error } = await supabase
      .from('household_members')
      .insert(payload)
      .select(MEMBER_ROW_SELECT)
      .single()

    if (error) throw error
    const normalized = normalizeMemberRow(data as Record<string, unknown>)
    if (!normalized) {
      throw new Error('Created member could not be normalized')
    }
    return normalized
  } catch (error) {
    return recoverFromPrimarySwitchFailure({
      context: 'create_member',
      previousPrimaryId,
      operationError: error,
      restorePrimary: (id) => setMemberPrimaryFlag(supabase, id, true),
    })
  }
}

/**
 * Updates a household member. When promoting to primary, clears the previous
 * primary first and restores it if the update fails.
 */
export async function updateHouseholdMember(
  supabase: SupabaseClient,
  memberId: string,
  householdId: string,
  input: UpdateHouseholdMemberInput,
): Promise<HouseholdMemberSummary> {
  const wantPrimary = Boolean(input.is_primary_contact)
  let previousPrimaryId: string | null = null

  if (wantPrimary) {
    previousPrimaryId = await findPrimaryMemberId(supabase, householdId)
    if (previousPrimaryId && previousPrimaryId !== memberId) {
      await setMemberPrimaryFlag(supabase, previousPrimaryId, false)
    } else {
      previousPrimaryId = null
    }
  }

  const payload = buildMemberWritePayload(input)

  try {
    const { data, error } = await supabase
      .from('household_members')
      .update(payload)
      .eq('id', memberId)
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .select(MEMBER_ROW_SELECT)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      throw new Error('Member not found or no longer available')
    }
    const normalized = normalizeMemberRow(data as Record<string, unknown>)
    if (!normalized) {
      throw new Error('Updated member could not be normalized')
    }
    return normalized
  } catch (error) {
    return recoverFromPrimarySwitchFailure({
      context: 'update_member',
      previousPrimaryId,
      operationError: error,
      restorePrimary: (id) => setMemberPrimaryFlag(supabase, id, true),
    })
  }
}

/** Soft-deletes a member via soft_delete_household_member RPC. Does not auto-assign a replacement primary. */
export async function softDeleteHouseholdMember(
  supabase: SupabaseClient,
  memberId: string,
  householdId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('soft_delete_household_member', {
    p_member_id: memberId,
  })

  if (error) throw error

  if (data !== memberId) {
    throw new Error(
      'delete_member failed | Soft-delete RPC did not confirm the expected member id.',
    )
  }

  // SELECT RLS hides soft-deleted rows; confirm the member is no longer visible as active.
  const { data: stillActive, error: verifyError } = await supabase
    .from('household_members')
    .select('id')
    .eq('id', memberId)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .maybeSingle()

  if (verifyError) throw verifyError
  if (stillActive) {
    throw new Error(
      'delete_member failed | Soft-delete did not take effect; member is still active.',
    )
  }
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
