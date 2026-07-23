import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { CreateHouseholdNoteInput, HouseholdActivityRecord, HouseholdNote } from './types'

export class HouseholdNoteValidationError extends Error {
  readonly name = 'HouseholdNoteValidationError'

  constructor(message: string) {
    super(message)
  }
}

export function formatSupabaseError(source: string, error: unknown): string {
  if (error instanceof HouseholdNoteValidationError) {
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

const NOTE_SELECT = `
  id,
  household_id,
  opportunity_id,
  author_user_id,
  body,
  visibility,
  created_at,
  updated_at,
  author:profiles!notes_author_user_id_fkey ( id, full_name )
`

const ACTIVITY_SELECT = `
  id,
  household_id,
  actor_user_id,
  activity_type,
  title,
  body,
  metadata,
  occurred_at,
  created_at,
  actor:profiles!activities_actor_user_id_fkey ( id, full_name )
`

const TIMELINE_FETCH_LIMIT = 50
const ACTOR_FALLBACK_LABEL = 'Advisor'

function asSingle<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null
  return (value as T) ?? null
}

function readEmbeddedFullName(value: unknown): string | null {
  const row = asSingle<{ full_name?: unknown }>(value)
  if (!row || typeof row.full_name !== 'string') return null
  const trimmed = row.full_name.trim()
  return trimmed || null
}

/** Trim and reject empty note bodies before any write. */
export function normalizeNoteBody(body: string): string {
  return body.trim()
}

export function assertValidNoteBody(body: string): string {
  const normalized = normalizeNoteBody(body)
  if (!normalized) {
    throw new HouseholdNoteValidationError('Note body is required.')
  }
  return normalized
}

/**
 * Prefer profile full_name when RLS allows it; otherwise advisor_profiles.display_name.
 * Never blocks callers — falls back to a neutral label when a user id is present.
 */
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
    // Author display must not block timeline/note loading.
    if (import.meta.env.DEV) {
      console.error('[crm/households/notes]', formatSupabaseError('advisor_display_names', error))
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

function normalizeNoteRow(
  row: Record<string, unknown>,
  advisorNames: Map<string, string>,
): HouseholdNote {
  const authorUserId = String(row.author_user_id)
  return {
    id: String(row.id),
    household_id: String(row.household_id),
    opportunity_id: (row.opportunity_id as string | null) ?? null,
    author_user_id: authorUserId,
    author_display_name: resolveActorDisplayName({
      userId: authorUserId,
      profileFullName: readEmbeddedFullName(row.author),
      advisorDisplayName: advisorNames.get(authorUserId) ?? null,
    }),
    body: String(row.body ?? ''),
    visibility: 'internal',
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function normalizeActivityRow(
  row: Record<string, unknown>,
  advisorNames: Map<string, string>,
): HouseholdActivityRecord {
  const actorUserId = (row.actor_user_id as string | null) ?? null
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  return {
    id: String(row.id),
    household_id: String(row.household_id),
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

export async function fetchHouseholdNotes(
  supabase: SupabaseClient,
  householdId: string,
  options?: { limit?: number },
): Promise<HouseholdNote[]> {
  const limit = options?.limit ?? TIMELINE_FETCH_LIMIT
  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_SELECT)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []) as Record<string, unknown>[]
  const authorIds = rows.map((row) => String(row.author_user_id))
  const advisorNames = await fetchAdvisorDisplayNamesByUserId(supabase, authorIds)
  return rows.map((row) => normalizeNoteRow(row, advisorNames))
}

export async function fetchHouseholdActivityRecords(
  supabase: SupabaseClient,
  householdId: string,
  options?: { limit?: number },
): Promise<HouseholdActivityRecord[]> {
  const limit = options?.limit ?? TIMELINE_FETCH_LIMIT
  const { data, error } = await supabase
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []) as Record<string, unknown>[]
  const actorIds = rows
    .map((row) => (row.actor_user_id as string | null) ?? null)
    .filter((id): id is string => Boolean(id))
  const advisorNames = await fetchAdvisorDisplayNamesByUserId(supabase, actorIds)
  return rows.map((row) => normalizeActivityRow(row, advisorNames))
}

export async function createHouseholdNote(
  supabase: SupabaseClient,
  input: CreateHouseholdNoteInput,
  authorUserId: string,
): Promise<HouseholdNote> {
  const body = assertValidNoteBody(input.body)

  const { data, error } = await supabase
    .from('notes')
    .insert({
      household_id: input.household_id,
      author_user_id: authorUserId,
      body,
      visibility: 'internal',
    })
    .select(NOTE_SELECT)
    .single()

  if (error) throw error

  const advisorNames = await fetchAdvisorDisplayNamesByUserId(supabase, [authorUserId])
  return normalizeNoteRow(data as Record<string, unknown>, advisorNames)
}

export async function updateHouseholdNote(
  supabase: SupabaseClient,
  noteId: string,
  body: string,
): Promise<HouseholdNote> {
  const normalizedBody = assertValidNoteBody(body)

  const { data, error } = await supabase
    .from('notes')
    .update({ body: normalizedBody })
    .eq('id', noteId)
    .is('deleted_at', null)
    .select(NOTE_SELECT)
    .single()

  if (error) throw error

  const authorUserId = String((data as { author_user_id: string }).author_user_id)
  const advisorNames = await fetchAdvisorDisplayNamesByUserId(supabase, [authorUserId])
  return normalizeNoteRow(data as Record<string, unknown>, advisorNames)
}

/** Soft-deletes via soft_delete_note RPC. Does not accept caller household_id. */
export async function softDeleteHouseholdNote(
  supabase: SupabaseClient,
  noteId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('soft_delete_note', {
    p_note_id: noteId,
  })

  if (error) throw error

  const deletedId = typeof data === 'string' ? data : data != null ? String(data) : ''
  if (!deletedId) {
    throw new Error(formatSupabaseError('soft_delete_note', { message: 'Empty RPC result' }))
  }
  return deletedId
}
