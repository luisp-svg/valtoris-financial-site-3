import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { DIGITAL_IDENTITY_LEAD_TYPE } from '../../modules/digital-identity'
import {
  buildDiagnosticFromAssessmentRow,
  extractDigitalIdentitySnapshot,
  normalizeDuplicateReviewStatus,
  normalizeLeadStatus,
  normalizeMatchStatus,
  normalizeSheetsSyncStatus,
  parseConsentSnapshot,
  resolveIntakeSubmittedContact,
  sortIntakeNewestFirst,
} from './intakeFormatters'
import { buildIntakeTaskAutomationSummary, mapFollowUpTaskRow } from './intakeTaskAutomation'
import type {
  DuplicateResolutionErrorCode,
  DuplicateResolutionFailure,
  DuplicateResolutionResponse,
  DuplicateResolutionResult,
  DuplicateResolutionWriteAction,
  IntakeAdvisorSummary,
  IntakeDuplicateReviewSummary,
  IntakeHouseholdSummary,
  IntakeLoadResult,
  IntakeQueueItem,
} from './types'
import { DUPLICATE_RESOLUTION_MAX_NOTES_LENGTH } from './types'
import { createPublicFamilyFollowUpTask } from '../tasks/followUp/followUpTaskRpc'
import { orchestratePostDuplicateResolutionTask } from '../tasks/followUp/postDuplicateTaskTransition'
import { reconcileLeadFollowUpTaskState } from '../tasks/followUp/reconcileLeadFollowUp'
import { workflowForMatchStatus } from '../tasks/followUp/workflowTypes'

export const INTAKE_QUEUE_LIMIT = 150

const LEAD_SELECT = `
  id,
  household_id,
  lead_type,
  status,
  source_page,
  submitted_at,
  overall_score,
  overall_grade,
  top_priorities,
  raw_payload,
  normalized_email,
  normalized_phone,
  duplicate_review_status,
  ingest_match_status,
  sheets_sync_status,
  consent_snapshot,
  original_campaign,
  original_advisor_slug,
  original_source_metadata,
  assigned_advisor_id,
  follow_up_task_automation_status,
  follow_up_task_id,
  deleted_at,
  household:households!leads_household_id_fkey (
    id,
    display_name,
    status,
    primary_email,
    primary_phone,
    assigned_advisor_id,
    duplicate_review_status,
    merged_into_household_id,
    deleted_at,
    assigned_advisor:advisor_profiles!assigned_advisor_id ( id, display_name )
  ),
  assigned_advisor:advisor_profiles!leads_assigned_advisor_id_fkey ( id, display_name )
`

const FOLLOW_UP_TASK_SELECT = `
  id,
  title,
  status,
  priority,
  due_date,
  assigned_user_id,
  workflow_type,
  source_type,
  lead_id,
  assessment_id,
  assignee:profiles!tasks_assigned_user_id_fkey ( id, full_name )
`

const ASSESSMENT_SELECT = `
  id,
  lead_id,
  household_id,
  assessment_type,
  status,
  overall_score,
  overall_grade,
  priorities,
  derived_metrics,
  capture_channel,
  scoring_version,
  completed_at,
  deleted_at
`

const DUPLICATE_SELECT = `
  id,
  incoming_lead_id,
  candidate_household_id,
  provisional_household_id,
  match_reason,
  match_confidence,
  status,
  resolution_notes,
  resolved_by_user_id,
  resolved_at
`

export function formatIntakeError(source: string, error: unknown): string {
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

function unwrapRelation<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null
  if (value && typeof value === 'object') return value as T
  return null
}

function mapAdvisor(value: unknown): IntakeAdvisorSummary | null {
  const row = unwrapRelation<Record<string, unknown>>(value)
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    displayName:
      typeof row.display_name === 'string' && row.display_name.trim()
        ? row.display_name.trim()
        : 'Advisor',
  }
}

function mapHousehold(value: unknown): IntakeHouseholdSummary | null {
  const row = unwrapRelation<Record<string, unknown>>(value)
  if (!row || typeof row.id !== 'string') return null
  return {
    id: row.id,
    displayName:
      typeof row.display_name === 'string' && row.display_name.trim()
        ? row.display_name.trim()
        : 'Household',
    status: typeof row.status === 'string' ? row.status : 'lead',
    primaryEmail: typeof row.primary_email === 'string' ? row.primary_email : null,
    primaryPhone: typeof row.primary_phone === 'string' ? row.primary_phone : null,
    assignedAdvisor: mapAdvisor(row.assigned_advisor),
    duplicateReviewStatus: normalizeDuplicateReviewStatus(row.duplicate_review_status),
    mergedIntoHouseholdId:
      typeof row.merged_into_household_id === 'string' ? row.merged_into_household_id : null,
    deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
  }
}

/**
 * Loads public intake leads visible under RLS:
 * Family Report Card (Initial Financial Diagnostic) and Digital Identity (Let's Connect).
 * Soft-deleted leads are excluded. Onboarding assessments are never selected.
 */
export async function fetchIntakeQueue(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<IntakeQueueItem[]> {
  const limit = options?.limit ?? INTAKE_QUEUE_LIMIT

  const { data: leadRows, error: leadError } = await supabase
    .from('leads')
    .select(LEAD_SELECT)
    .is('deleted_at', null)
    .or(
      `ingest_match_status.not.is.null,lead_type.eq.Family Report Card,lead_type.eq.${DIGITAL_IDENTITY_LEAD_TYPE}`,
    )
    .order('submitted_at', { ascending: false })
    .limit(limit)

  if (leadError) throw leadError

  const leads = (leadRows ?? []) as Record<string, unknown>[]
  if (leads.length === 0) return []

  const leadIds = leads.map((row) => String(row.id))
  const householdIds = [
    ...new Set(
      leads
        .map((row) => (typeof row.household_id === 'string' ? row.household_id : null))
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  const { data: assessmentRows, error: assessmentError } = await supabase
    .from('assessments')
    .select(ASSESSMENT_SELECT)
    .in('lead_id', leadIds)
    .eq('assessment_type', 'family')
    .eq('capture_channel', 'public_self_report')
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('completed_at', { ascending: false })

  if (assessmentError) throw assessmentError

  const assessmentByLead = new Map<string, Record<string, unknown>>()
  for (const row of (assessmentRows ?? []) as Record<string, unknown>[]) {
    const leadId = typeof row.lead_id === 'string' ? row.lead_id : null
    if (!leadId || assessmentByLead.has(leadId)) continue
    assessmentByLead.set(leadId, row)
  }

  // duplicate_reviews is owner-only under RLS; advisors get an empty set (not an error).
  const duplicateByLead = new Map<string, IntakeDuplicateReviewSummary>()
  if (leadIds.length > 0) {
    const { data: duplicateRows, error: duplicateError } = await supabase
      .from('duplicate_reviews')
      .select(DUPLICATE_SELECT)
      .in('incoming_lead_id', leadIds)
      .order('created_at', { ascending: false })

    if (duplicateError) {
      // Advisors cannot read duplicate_reviews — treat as empty, not fatal.
      const code = (duplicateError as PostgrestError).code
      const message = String((duplicateError as PostgrestError).message ?? '')
      const permissionDenied =
        code === '42501' ||
        /permission denied|row-level security/i.test(message)
      if (!permissionDenied) throw duplicateError
    } else {
      for (const row of (duplicateRows ?? []) as Record<string, unknown>[]) {
        const leadId = typeof row.incoming_lead_id === 'string' ? row.incoming_lead_id : null
        if (!leadId || duplicateByLead.has(leadId)) continue
        if (typeof row.id !== 'string' || typeof row.candidate_household_id !== 'string') continue
        duplicateByLead.set(leadId, {
          id: row.id,
          status: normalizeDuplicateReviewStatus(row.status),
          matchReason: typeof row.match_reason === 'string' ? row.match_reason : 'possible_contact_match',
          matchConfidence: typeof row.match_confidence === 'string' ? row.match_confidence : 'medium',
          candidateHouseholdId: row.candidate_household_id,
          provisionalHouseholdId:
            typeof row.provisional_household_id === 'string' ? row.provisional_household_id : null,
          resolutionNotes: typeof row.resolution_notes === 'string' ? row.resolution_notes : null,
          resolvedAt: typeof row.resolved_at === 'string' ? row.resolved_at : null,
          resolvedByUserId:
            typeof row.resolved_by_user_id === 'string' ? row.resolved_by_user_id : null,
        })
      }
    }
  }

  const taskById = new Map<string, Record<string, unknown>>()
  const followUpTaskIds = [
    ...new Set(
      leads
        .map((row) => (typeof row.follow_up_task_id === 'string' ? row.follow_up_task_id : null))
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  if (followUpTaskIds.length > 0) {
    const { data: taskRows, error: taskError } = await supabase
      .from('tasks')
      .select(FOLLOW_UP_TASK_SELECT)
      .in('id', followUpTaskIds)
      .is('deleted_at', null)

    if (taskError) {
      // Task visibility follows household RLS; soft-fail rather than fail the queue.
      if (import.meta.env.DEV) {
        console.error('[crm/intake]', formatIntakeError('follow-up tasks', taskError))
      }
    } else {
      for (const row of (taskRows ?? []) as Record<string, unknown>[]) {
        if (typeof row.id === 'string') taskById.set(row.id, row)
      }
    }
  }

  // Also load open workflow tasks by assessment when follow_up_task_id is missing.
  const assessmentIds = [...assessmentByLead.values()]
    .map((row) => (typeof row.id === 'string' ? row.id : null))
    .filter((value): value is string => Boolean(value))
  const taskByAssessment = new Map<string, Record<string, unknown>>()
  if (assessmentIds.length > 0) {
    const { data: workflowTasks, error: workflowTaskError } = await supabase
      .from('tasks')
      .select(FOLLOW_UP_TASK_SELECT)
      .in('assessment_id', assessmentIds)
      .is('deleted_at', null)
      .not('workflow_type', 'is', null)
      .order('created_at', { ascending: false })

    if (!workflowTaskError) {
      for (const row of (workflowTasks ?? []) as Record<string, unknown>[]) {
        const assessmentId = typeof row.assessment_id === 'string' ? row.assessment_id : null
        if (!assessmentId || taskByAssessment.has(assessmentId)) continue
        taskByAssessment.set(assessmentId, row)
      }
    }
  }

  // Digital Identity tasks are lead-keyed (no assessment).
  const diLeadIdsMissingTask = leads
    .filter(
      (row) =>
        row.lead_type === DIGITAL_IDENTITY_LEAD_TYPE &&
        typeof row.follow_up_task_id !== 'string',
    )
    .map((row) => String(row.id))
  const taskByLead = new Map<string, Record<string, unknown>>()
  if (diLeadIdsMissingTask.length > 0) {
    const { data: diTasks, error: diTaskError } = await supabase
      .from('tasks')
      .select(FOLLOW_UP_TASK_SELECT)
      .in('lead_id', diLeadIdsMissingTask)
      .is('deleted_at', null)
      .not('workflow_type', 'is', null)
      .order('created_at', { ascending: false })

    if (!diTaskError) {
      for (const row of (diTasks ?? []) as Record<string, unknown>[]) {
        const leadId = typeof row.lead_id === 'string' ? row.lead_id : null
        if (!leadId || taskByLead.has(leadId)) continue
        taskByLead.set(leadId, row)
      }
    }
  }

  void householdIds

  const diLeadIds = leads
    .filter((row) => row.lead_type === DIGITAL_IDENTITY_LEAD_TYPE)
    .map((row) => String(row.id))
  const photoByLead = new Map<string, { documentId: string; createdAt: string | null }>()
  if (diLeadIds.length > 0) {
    const { data: photoRows, error: photoError } = await supabase
      .from('documents')
      .select('id, lead_id, created_at')
      .in('lead_id', diLeadIds)
      .eq('doc_type', 'relationship_photo')
      .is('deleted_at', null)

    if (!photoError) {
      for (const row of (photoRows ?? []) as Record<string, unknown>[]) {
        const leadId = typeof row.lead_id === 'string' ? row.lead_id : null
        const documentId = typeof row.id === 'string' ? row.id : null
        if (!leadId || !documentId || photoByLead.has(leadId)) continue
        photoByLead.set(leadId, {
          documentId,
          createdAt: typeof row.created_at === 'string' ? row.created_at : null,
        })
      }
    }
  }

  const items: IntakeQueueItem[] = leads.map((row) => {
    const leadId = String(row.id)
    const leadType =
      typeof row.lead_type === 'string' ? row.lead_type : 'Family Report Card'
    const leadScore =
      typeof row.overall_score === 'number'
        ? row.overall_score
        : row.overall_score == null
          ? null
          : Number(row.overall_score)
    const leadGrade = typeof row.overall_grade === 'string' ? row.overall_grade : null
    const household = mapHousehold(row.household)
    const assignedAdvisor = mapAdvisor(row.assigned_advisor) ?? household?.assignedAdvisor ?? null
    const assessment = leadType === DIGITAL_IDENTITY_LEAD_TYPE
      ? null
      : assessmentByLead.get(leadId) ?? null
    const consent = parseConsentSnapshot(row.consent_snapshot)
    const duplicateReview = duplicateByLead.get(leadId) ?? null
    const followUpTaskId =
      typeof row.follow_up_task_id === 'string' ? row.follow_up_task_id : null
    const assessmentId = assessment && typeof assessment.id === 'string' ? assessment.id : null
    const taskRow =
      (followUpTaskId ? taskById.get(followUpTaskId) : null) ??
      (assessmentId ? taskByAssessment.get(assessmentId) : null) ??
      taskByLead.get(leadId) ??
      null
    const taskSummary = buildIntakeTaskAutomationSummary({
      automationStatus: row.follow_up_task_automation_status,
      taskRow: taskRow ?? null,
      consent,
      duplicateReviewPending: duplicateReview?.status === 'pending',
      isOwner: false,
    })
    const originalCampaign =
      typeof row.original_campaign === 'string' ? row.original_campaign : null
    const originalAdvisorSlug =
      typeof row.original_advisor_slug === 'string' ? row.original_advisor_slug : null
    const sourceMetadata =
      row.original_source_metadata &&
      typeof row.original_source_metadata === 'object' &&
      !Array.isArray(row.original_source_metadata)
        ? (row.original_source_metadata as Record<string, unknown>)
        : {}
    const normalizedEmail =
      typeof row.normalized_email === 'string' ? row.normalized_email : null
    const normalizedPhone =
      typeof row.normalized_phone === 'string' ? row.normalized_phone : null
    const submitted = resolveIntakeSubmittedContact({
      rawPayload: row.raw_payload,
      leadType,
      householdDisplayName: household?.displayName ?? null,
      householdEmail: household?.primaryEmail ?? null,
      householdPhone: household?.primaryPhone ?? null,
      normalizedEmail,
      normalizedPhone,
    })

    return {
      leadId,
      householdId: typeof row.household_id === 'string' ? row.household_id : '',
      leadType,
      leadStatus: normalizeLeadStatus(row.status),
      ingestMatchStatus: normalizeMatchStatus(row.ingest_match_status),
      duplicateReviewStatus: normalizeDuplicateReviewStatus(row.duplicate_review_status),
      submittedAt:
        typeof row.submitted_at === 'string' ? row.submitted_at : new Date(0).toISOString(),
      sourcePage: typeof row.source_page === 'string' ? row.source_page : null,
      overallScore: Number.isFinite(leadScore as number) ? (leadScore as number) : null,
      overallGrade: leadGrade,
      submittedFirstName: submitted.firstName,
      submittedLastName: submitted.lastName,
      submittedFullName: submitted.fullName || household?.displayName || 'Prospect',
      submittedEmail: submitted.email,
      submittedPhone: submitted.phone,
      normalizedEmail,
      normalizedPhone,
      sheetsSyncStatus: normalizeSheetsSyncStatus(row.sheets_sync_status),
      consent,
      household,
      assignedAdvisor,
      diagnostic: buildDiagnosticFromAssessmentRow(
        assessment,
        Number.isFinite(leadScore as number) ? (leadScore as number) : null,
        leadGrade,
        row.top_priorities,
      ),
      digitalIdentity: extractDigitalIdentitySnapshot({
        leadType,
        rawPayload: row.raw_payload,
        sourceMetadata,
        originalCampaign,
        originalAdvisorSlug,
        relationshipPhoto: photoByLead.get(leadId) ?? null,
      }),
      duplicateReview,
      originalCampaign,
      originalAdvisorSlug,
      sourceMetadata,
      followUpTaskAutomationStatus: taskSummary.automationStatus,
      followUpTask: taskSummary.task ?? mapFollowUpTaskRow(taskRow),
      taskIndicators: taskSummary.indicators,
      taskCreationIssueMessage: taskSummary.creationIssueMessage,
    }
  })

  return sortIntakeNewestFirst(items)
}

export async function fetchIntakeQueueSafe(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<IntakeLoadResult<IntakeQueueItem[]>> {
  try {
    const value = await fetchIntakeQueue(supabase, options)
    return { ok: true, value }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[crm/intake]', formatIntakeError('intake queue', error))
    }
    return { ok: false, error: 'Unable to load incoming leads. Please try again.' }
  }
}

export async function fetchCurrentAdvisorProfileId(
  supabase: SupabaseClient,
  profileUserId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('advisor_profiles')
    .select('id')
    .eq('user_id', profileUserId)
    .maybeSingle()

  if (error || !data || typeof (data as { id?: unknown }).id !== 'string') return null
  return (data as { id: string }).id
}

export async function fetchCandidateHouseholdSummary(
  supabase: SupabaseClient,
  householdId: string,
): Promise<IntakeHouseholdSummary | null> {
  const { data, error } = await supabase
    .from('households')
    .select(
      `
      id,
      display_name,
      status,
      primary_email,
      primary_phone,
      assigned_advisor_id,
      duplicate_review_status,
      merged_into_household_id,
      deleted_at,
      assigned_advisor:advisor_profiles!assigned_advisor_id ( id, display_name )
    `,
    )
    .eq('id', householdId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return mapHousehold(data)
}

/**
 * Duplicate resolution writes go through resolve_public_family_duplicate_review (migration 021).
 * Owner-only; browser uses authenticated client (no service role).
 */
export function getDuplicateResolutionAvailability(role: string | null | undefined): {
  canResolveWrites: boolean
  requiresMigration021: false
  ownerOnly: true
  message: string | null
} {
  if (role === 'owner') {
    return {
      canResolveWrites: true,
      requiresMigration021: false,
      ownerOnly: true,
      message: null,
    }
  }
  return {
    canResolveWrites: false,
    requiresMigration021: false,
    ownerOnly: true,
    message:
      'Only owners can resolve possible duplicate reviews in this release. Advisors can open linked households but cannot confirm or dismiss matches.',
  }
}

export function sanitizeDuplicateResolutionNotes(notes: string | null | undefined): string | null {
  if (notes == null) return null
  const trimmed = Array.from(notes)
    .filter((ch) => ch.charCodeAt(0) !== 0)
    .join('')
    .trim()
  if (!trimmed) return null
  return trimmed.slice(0, DUPLICATE_RESOLUTION_MAX_NOTES_LENGTH)
}

export function mapDuplicateResolutionRpcError(error: unknown): DuplicateResolutionFailure {
  const raw =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : error instanceof Error
        ? error.message
        : ''

  const codeMatch = raw.match(/CRM_DUP:([a-z0-9_]+)/i)
  const code = (codeMatch?.[1]?.toLowerCase() ?? 'unknown') as DuplicateResolutionErrorCode

  const messages: Record<DuplicateResolutionErrorCode, string> = {
    not_authenticated: 'You must be signed in to resolve duplicate reviews.',
    not_authorized: 'Only owners can resolve possible duplicate reviews.',
    invalid_action: 'That resolution action is not supported.',
    not_found: 'This duplicate review could not be found. Refresh the intake queue and try again.',
    already_resolved_conflict:
      'This duplicate review was already resolved differently. Refresh the intake queue.',
    invalid_candidate:
      'The candidate household is missing, merged, or inactive. Refresh and review again.',
    invalid_provisional:
      'The provisional household is missing, merged, or inactive. Refresh and review again.',
    invalid_assessment:
      'The linked Initial Financial Diagnostic is missing or no longer a public self-report.',
    unsafe_dependents:
      'This provisional household has additional CRM records beyond the public intake. Manual owner review is required before linking.',
    notes_too_long: 'Resolution notes are too long. Shorten them and try again.',
    same_household: 'The provisional and candidate households cannot be the same record.',
    unknown: 'Unable to resolve this duplicate review. Please try again.',
  }

  const known = code in messages ? code : 'unknown'
  return { ok: false, code: known, message: messages[known] }
}

function mapDuplicateResolutionRpcPayload(value: unknown): DuplicateResolutionResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (row.ok !== true) return null
  const action = row.action
  if (action !== 'confirm_same_household' && action !== 'keep_separate') return null
  if (typeof row.duplicate_review_id !== 'string') return null
  if (typeof row.lead_id !== 'string') return null
  if (typeof row.resulting_household_id !== 'string') return null

  return {
    ok: true,
    action,
    duplicateReviewId: row.duplicate_review_id,
    leadId: row.lead_id,
    assessmentId: typeof row.assessment_id === 'string' ? row.assessment_id : null,
    resultingHouseholdId: row.resulting_household_id,
    provisionalHouseholdId:
      typeof row.provisional_household_id === 'string' ? row.provisional_household_id : null,
    resolvedAt:
      typeof row.resolved_at === 'string' ? row.resolved_at : new Date().toISOString(),
    alreadyResolved: row.already_resolved === true,
  }
}

export async function resolveDuplicateReview(
  supabase: SupabaseClient,
  input: {
    duplicateReviewId: string
    action: DuplicateResolutionWriteAction
    notes?: string | null
  },
): Promise<DuplicateResolutionResponse> {
  if (
    input.action !== 'confirm_same_household' &&
    input.action !== 'keep_separate'
  ) {
    return {
      ok: false,
      code: 'invalid_action',
      message: 'That resolution action is not supported.',
    }
  }

  const notes = sanitizeDuplicateResolutionNotes(input.notes)
  const rawNotesLength = input.notes
    ? Array.from(input.notes)
        .filter((ch) => ch.charCodeAt(0) !== 0)
        .join('')
        .trim().length
    : 0
  if (input.notes && rawNotesLength > DUPLICATE_RESOLUTION_MAX_NOTES_LENGTH) {
    return {
      ok: false,
      code: 'notes_too_long',
      message: 'Resolution notes are too long. Shorten them and try again.',
    }
  }

  const { data, error } = await supabase.rpc('resolve_public_family_duplicate_review', {
    p_duplicate_review_id: input.duplicateReviewId,
    p_action: input.action,
    p_resolution_notes: notes,
  })

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[crm/intake]', formatIntakeError('duplicate resolution', error))
    }
    return mapDuplicateResolutionRpcError(error)
  }

  const mapped = mapDuplicateResolutionRpcPayload(data)
  if (!mapped) {
    return {
      ok: false,
      code: 'unknown',
      message: 'Unable to resolve this duplicate review. Please try again.',
    }
  }

  // Follow-up task transition is best-effort and never undoes resolution.
  if (mapped.assessmentId) {
    try {
      await orchestratePostDuplicateResolutionTask(supabase, {
        assessmentId: mapped.assessmentId,
      })
    } catch {
      // Intentionally ignored — duplicate resolution already succeeded.
    }
  }

  return mapped
}

/**
 * Owner-only Digital Identity duplicate resolution (migration 026).
 * Uses resolve_digital_identity_duplicate_review — never touches assessments.
 * After resolve, best-effort create_digital_identity_follow_up_task
 * (review_digital_identity_lead / duplicate_resolution).
 */
export async function resolveDigitalIdentityDuplicateReview(
  supabase: SupabaseClient,
  input: {
    duplicateReviewId: string
    action: DuplicateResolutionWriteAction
    notes?: string | null
  },
): Promise<DuplicateResolutionResponse> {
  if (
    input.action !== 'confirm_same_household' &&
    input.action !== 'keep_separate'
  ) {
    return {
      ok: false,
      code: 'invalid_action',
      message: 'That resolution action is not supported.',
    }
  }

  const notes = sanitizeDuplicateResolutionNotes(input.notes)
  const rawNotesLength = input.notes
    ? Array.from(input.notes)
        .filter((ch) => ch.charCodeAt(0) !== 0)
        .join('')
        .trim().length
    : 0
  if (input.notes && rawNotesLength > DUPLICATE_RESOLUTION_MAX_NOTES_LENGTH) {
    return {
      ok: false,
      code: 'notes_too_long',
      message: 'Resolution notes are too long. Shorten them and try again.',
    }
  }

  const { data, error } = await supabase.rpc('resolve_digital_identity_duplicate_review', {
    p_duplicate_review_id: input.duplicateReviewId,
    p_action: input.action,
    p_resolution_notes: notes,
  })

  if (error) {
    if (import.meta.env.DEV) {
      console.error(
        '[crm/intake]',
        formatIntakeError('digital identity duplicate resolution', error),
      )
    }
    return mapDuplicateResolutionRpcError(error)
  }

  const mapped = mapDuplicateResolutionRpcPayload(data)
  if (!mapped) {
    return {
      ok: false,
      code: 'unknown',
      message: 'Unable to resolve this duplicate review. Please try again.',
    }
  }

  // Best-effort follow-up task — never undoes resolution.
  try {
    await supabase.rpc('create_digital_identity_follow_up_task', {
      p_lead_id: mapped.leadId,
      p_workflow_type: 'review_digital_identity_lead',
      p_creation_source: 'duplicate_resolution',
    })
  } catch {
    // Intentionally ignored — duplicate resolution already succeeded.
  }

  return mapped
}

export type RetryFollowUpTaskResult =
  | { ok: true; taskId: string | null; alreadyExists: boolean; needsManualReview: boolean }
  | { ok: false; message: string }

/**
 * Owner-authorized retry for failed follow-up task automation.
 * Browser supplies assessmentId (+ optional existing task/lead for reconciliation).
 * Workflow is derived from trusted match status — never from browser-supplied titles.
 */
export async function retryPublicFamilyFollowUpTask(
  supabase: SupabaseClient,
  input: {
    assessmentId: string
    matchStatus: IntakeQueueItem['ingestMatchStatus']
    duplicateReviewPending: boolean
    leadId?: string | null
    existingTaskId?: string | null
    existingTaskSourceType?: string | null
  },
): Promise<RetryFollowUpTaskResult> {
  if (!input.assessmentId) {
    return { ok: false, message: 'Unable to retry follow-up task. Please try again.' }
  }

  // If a manual task already exists, reconcile lead automation state first.
  if (input.leadId && input.existingTaskId && input.existingTaskSourceType === 'manual') {
    const reconciled = await reconcileLeadFollowUpTaskState(supabase, {
      leadId: input.leadId,
      taskId: input.existingTaskId,
      status: 'task_manually_created',
    })
    if (reconciled.ok) {
      return {
        ok: true,
        taskId: input.existingTaskId,
        alreadyExists: true,
        needsManualReview: false,
      }
    }
    // Fall through to automatic create RPC when reconcile cannot apply.
  }

  let workflow: string
  if (input.duplicateReviewPending) {
    workflow = 'resolve_possible_duplicate'
  } else if (input.matchStatus) {
    workflow = workflowForMatchStatus(input.matchStatus, {
      resolutionAction:
        input.matchStatus === 'possible_match' ? 'keep_separate' : null,
    })
  } else {
    return { ok: false, message: 'Unable to retry follow-up task. Please try again.' }
  }

  const created = await createPublicFamilyFollowUpTask(supabase, {
    assessmentId: input.assessmentId,
    workflowType: workflow,
    creationSource: input.duplicateReviewPending ? 'public_family_ingest' : 'system',
  })

  if (!created.ok) {
    return {
      ok: false,
      message: 'Unable to retry follow-up task. Please try again.',
    }
  }

  if (created.needsManualReview) {
    // Soft-deleted automatic key: if a separate manual task exists, reconcile that instead.
    if (input.leadId && input.existingTaskId) {
      const reconciled = await reconcileLeadFollowUpTaskState(supabase, {
        leadId: input.leadId,
        taskId: input.existingTaskId,
        status: 'task_manually_created',
      })
      if (reconciled.ok) {
        return {
          ok: true,
          taskId: input.existingTaskId,
          alreadyExists: true,
          needsManualReview: false,
        }
      }
    }
    return {
      ok: false,
      message: 'Follow-up task needs manual review. A previously deleted automatic task exists.',
    }
  }

  return {
    ok: true,
    taskId: created.taskId,
    alreadyExists: created.alreadyExists,
    needsManualReview: false,
  }
}

/**
 * Owner-authorized retry for Digital Identity follow-up task automation.
 * Lead-keyed (no assessment). Workflow derived from trusted match status.
 */
export async function retryDigitalIdentityFollowUpTask(
  supabase: SupabaseClient,
  input: {
    leadId: string
    matchStatus: IntakeQueueItem['ingestMatchStatus']
    duplicateReviewPending: boolean
    existingTaskId?: string | null
    existingTaskSourceType?: string | null
  },
): Promise<RetryFollowUpTaskResult> {
  if (!input.leadId) {
    return { ok: false, message: 'Unable to retry follow-up task. Please try again.' }
  }

  if (input.existingTaskId && input.existingTaskSourceType === 'manual') {
    const reconciled = await reconcileLeadFollowUpTaskState(supabase, {
      leadId: input.leadId,
      taskId: input.existingTaskId,
      status: 'task_manually_created',
    })
    if (reconciled.ok) {
      return {
        ok: true,
        taskId: input.existingTaskId,
        alreadyExists: true,
        needsManualReview: false,
      }
    }
  }

  let workflow: string
  if (input.duplicateReviewPending || input.matchStatus === 'possible_match') {
    workflow = 'resolve_digital_identity_duplicate'
  } else if (
    input.matchStatus === 'new_prospect' ||
    input.matchStatus === 'exact_trusted_match'
  ) {
    workflow = 'review_digital_identity_lead'
  } else {
    return { ok: false, message: 'Unable to retry follow-up task. Please try again.' }
  }

  const { data, error } = await supabase.rpc('create_digital_identity_follow_up_task', {
    p_lead_id: input.leadId,
    p_workflow_type: workflow,
    p_creation_source: 'system',
  })

  if (error) {
    if (import.meta.env.DEV) {
      console.error(
        '[crm/intake]',
        formatIntakeError('digital identity follow-up task retry', error),
      )
    }
    return {
      ok: false,
      message: 'Unable to retry follow-up task. Please try again.',
    }
  }

  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
    return {
      ok: false,
      message: 'Unable to retry follow-up task. Please try again.',
    }
  }

  const row = data as Record<string, unknown>
  if (row.needs_manual_review === true) {
    if (input.existingTaskId) {
      const reconciled = await reconcileLeadFollowUpTaskState(supabase, {
        leadId: input.leadId,
        taskId: input.existingTaskId,
        status: 'task_manually_created',
      })
      if (reconciled.ok) {
        return {
          ok: true,
          taskId: input.existingTaskId,
          alreadyExists: true,
          needsManualReview: false,
        }
      }
    }
    return {
      ok: false,
      message: 'Follow-up task needs manual review. A previously deleted automatic task exists.',
    }
  }

  return {
    ok: true,
    taskId: typeof row.task_id === 'string' ? row.task_id : null,
    alreadyExists: row.already_exists === true,
    needsManualReview: false,
  }
}
