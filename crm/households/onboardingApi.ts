import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  AssessmentLifecycleStatus,
  CreateHouseholdOnboardingDraftInput,
  HouseholdOnboardingAssessment,
  UpdateHouseholdOnboardingDraftInput,
} from './types'

export const HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE = 'household_onboarding' as const

const ONBOARDING_ROW_SELECT =
  'id, household_id, assessment_type, status, completed_at, answers, derived_metrics, created_at, updated_at'

const ASSESSMENT_STATUS = new Set<AssessmentLifecycleStatus>(['draft', 'completed'])

/** Postgres unique_violation — race on one-active-draft index. */
const UNIQUE_VIOLATION = '23505'

export class HouseholdOnboardingError extends Error {
  readonly code: string

  constructor(message: string, code = 'onboarding_error') {
    super(message)
    this.name = 'HouseholdOnboardingError'
    this.code = code
  }
}

export function formatOnboardingError(source: string, error: unknown): string {
  if (error instanceof HouseholdOnboardingError) {
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

function assertHouseholdId(householdId: string): string {
  const trimmed = householdId.trim()
  if (!trimmed) {
    throw new HouseholdOnboardingError('Household id is required.', 'invalid_household_id')
  }
  return trimmed
}

function assertAssessmentId(assessmentId: string): string {
  const trimmed = assessmentId.trim()
  if (!trimmed) {
    throw new HouseholdOnboardingError('Assessment id is required.', 'invalid_assessment_id')
  }
  return trimmed
}

function asJsonObject(value: unknown, field: 'answers' | 'derived_metrics'): Record<string, unknown> {
  if (value == null) return {}
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  throw new HouseholdOnboardingError(
    `${field} must be a JSON object.`,
    `invalid_${field}`,
  )
}

function normalizeJsonDocument(value: unknown): Record<string, unknown> {
  if (value == null) return {}
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

/**
 * Normalizes a household_onboarding assessment row.
 * Returns null for wrong type, unknown status, or soft-deleted rows when deleted_at is present.
 */
export function normalizeHouseholdOnboardingAssessment(
  row: Record<string, unknown>,
): HouseholdOnboardingAssessment | null {
  if (row.deleted_at != null && row.deleted_at !== '') return null
  if (row.assessment_type !== HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE) return null

  const status = row.status
  if (typeof status !== 'string' || !ASSESSMENT_STATUS.has(status as AssessmentLifecycleStatus)) {
    return null
  }

  const completedAt =
    row.completed_at == null || row.completed_at === ''
      ? null
      : typeof row.completed_at === 'string'
        ? row.completed_at
        : String(row.completed_at)

  if (status === 'draft' && completedAt != null) return null
  if (status === 'completed' && completedAt == null) return null

  const householdId = row.household_id
  if (typeof householdId !== 'string' || householdId.trim() === '') return null

  const id = row.id
  if (typeof id !== 'string' || id.trim() === '') return null

  return {
    id,
    household_id: householdId,
    assessment_type: HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE,
    status: status as AssessmentLifecycleStatus,
    completed_at: completedAt,
    answers: normalizeJsonDocument(row.answers),
    derived_metrics: normalizeJsonDocument(row.derived_metrics),
    created_at: typeof row.created_at === 'string' ? row.created_at : String(row.created_at ?? ''),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : String(row.updated_at ?? ''),
  }
}

async function selectLatestOnboardingByStatus(
  supabase: SupabaseClient,
  householdId: string,
  status: AssessmentLifecycleStatus,
): Promise<HouseholdOnboardingAssessment | null> {
  let query = supabase
    .from('assessments')
    .select(ONBOARDING_ROW_SELECT)
    .eq('household_id', householdId)
    .eq('assessment_type', HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE)
    .eq('status', status)
    .is('deleted_at', null)

  if (status === 'draft') {
    query = query
      .is('completed_at', null)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    query = query
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .order('created_at', { ascending: false })
  }

  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw error
  if (!data) return null
  return normalizeHouseholdOnboardingAssessment(data as Record<string, unknown>)
}

/**
 * Latest active draft for a household, or null.
 * Soft-deleted and completed rows are excluded.
 */
export async function fetchLatestHouseholdOnboardingDraft(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdOnboardingAssessment | null> {
  return selectLatestOnboardingByStatus(supabase, assertHouseholdId(householdId), 'draft')
}

/**
 * Latest completed onboarding assessment for a household, or null.
 * Drafts and soft-deleted rows are excluded.
 */
export async function fetchLatestCompletedHouseholdOnboarding(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdOnboardingAssessment | null> {
  return selectLatestOnboardingByStatus(supabase, assertHouseholdId(householdId), 'completed')
}

/**
 * Creates a draft onboarding assessment, or returns the existing active draft.
 *
 * Duplicate handling: application-level return-existing, backed by unique partial
 * index `assessments_one_active_onboarding_draft_per_household_idx`. On unique
 * violation (concurrent create), re-fetches and returns the active draft.
 *
 * Does not write overall_score, overall_grade, or Financial Progress scores.
 */
export async function createHouseholdOnboardingDraft(
  supabase: SupabaseClient,
  input: CreateHouseholdOnboardingDraftInput,
): Promise<HouseholdOnboardingAssessment> {
  const householdId = assertHouseholdId(input.household_id)
  const answers =
    input.answers === undefined ? {} : asJsonObject(input.answers, 'answers')
  const derivedMetrics =
    input.derived_metrics === undefined
      ? {}
      : asJsonObject(input.derived_metrics, 'derived_metrics')

  const existing = await fetchLatestHouseholdOnboardingDraft(supabase, householdId)
  if (existing) return existing

  const payload = {
    household_id: householdId,
    assessment_type: HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE,
    status: 'draft' as const,
    completed_at: null,
    answers,
    derived_metrics: derivedMetrics,
  }

  const { data, error } = await supabase
    .from('assessments')
    .insert(payload)
    .select(ONBOARDING_ROW_SELECT)
    .single()

  if (error) {
    const code = (error as PostgrestError).code
    if (code === UNIQUE_VIOLATION) {
      const raced = await fetchLatestHouseholdOnboardingDraft(supabase, householdId)
      if (raced) return raced
    }
    throw error
  }

  const normalized = normalizeHouseholdOnboardingAssessment(data as Record<string, unknown>)
  if (!normalized || normalized.status !== 'draft') {
    throw new HouseholdOnboardingError(
      'Created onboarding draft could not be normalized.',
      'normalize_failed',
    )
  }
  return normalized
}

/**
 * Updates a draft onboarding assessment.
 *
 * JSON contract: full-document replacement per provided field.
 * - `answers` present → replaces the entire `answers` JSONB column
 * - `derived_metrics` present → replaces the entire `derived_metrics` JSONB column
 * - omitted fields are left unchanged
 *
 * Rejects completed or soft-deleted rows (no silent overwrite).
 * Does not write overall_score, overall_grade, or Financial Progress scores.
 */
export async function updateHouseholdOnboardingDraft(
  supabase: SupabaseClient,
  assessmentId: string,
  householdId: string,
  input: UpdateHouseholdOnboardingDraftInput,
): Promise<HouseholdOnboardingAssessment> {
  const id = assertAssessmentId(assessmentId)
  const hid = assertHouseholdId(householdId)

  if (input.answers === undefined && input.derived_metrics === undefined) {
    throw new HouseholdOnboardingError(
      'Provide answers and/or derived_metrics to update.',
      'empty_update',
    )
  }

  const patch: Record<string, unknown> = {}
  if (input.answers !== undefined) {
    patch.answers = asJsonObject(input.answers, 'answers')
  }
  if (input.derived_metrics !== undefined) {
    patch.derived_metrics = asJsonObject(input.derived_metrics, 'derived_metrics')
  }

  const { data, error } = await supabase
    .from('assessments')
    .update(patch)
    .eq('id', id)
    .eq('household_id', hid)
    .eq('assessment_type', HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE)
    .eq('status', 'draft')
    .is('deleted_at', null)
    .is('completed_at', null)
    .select(ONBOARDING_ROW_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new HouseholdOnboardingError(
      'Onboarding draft not found or is not updatable.',
      'draft_not_updatable',
    )
  }

  const normalized = normalizeHouseholdOnboardingAssessment(data as Record<string, unknown>)
  if (!normalized || normalized.status !== 'draft') {
    throw new HouseholdOnboardingError(
      'Updated onboarding draft could not be normalized.',
      'normalize_failed',
    )
  }
  return normalized
}

/**
 * Marks a draft onboarding assessment completed.
 * Sets status=completed and completed_at (application ISO timestamp).
 * Preserves answers and derived_metrics. Does not compute or persist scores/grades.
 */
export async function completeHouseholdOnboardingDraft(
  supabase: SupabaseClient,
  assessmentId: string,
  householdId: string,
  options: { completedAt?: Date } = {},
): Promise<HouseholdOnboardingAssessment> {
  const id = assertAssessmentId(assessmentId)
  const hid = assertHouseholdId(householdId)
  const completedAt = (options.completedAt ?? new Date()).toISOString()

  const { data, error } = await supabase
    .from('assessments')
    .update({
      status: 'completed',
      completed_at: completedAt,
    })
    .eq('id', id)
    .eq('household_id', hid)
    .eq('assessment_type', HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE)
    .eq('status', 'draft')
    .is('deleted_at', null)
    .is('completed_at', null)
    .select(ONBOARDING_ROW_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new HouseholdOnboardingError(
      'Onboarding draft not found or is already completed.',
      'draft_not_completable',
    )
  }

  const normalized = normalizeHouseholdOnboardingAssessment(data as Record<string, unknown>)
  if (!normalized || normalized.status !== 'completed' || normalized.completed_at == null) {
    throw new HouseholdOnboardingError(
      'Completed onboarding assessment could not be normalized.',
      'normalize_failed',
    )
  }
  return normalized
}
