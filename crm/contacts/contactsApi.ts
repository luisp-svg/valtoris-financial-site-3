import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchOpportunityAdvisorOptions } from '../opportunities/opportunitiesApi'
import { mapQuickAddError } from './errors'
import {
  detailToFormValuesFromRow,
  mapContactDetail,
  mapContactListItem,
  parseCreateResult,
  parseDuplicatePreview,
  parseUpdateResult,
} from './mappers'
import {
  buildDuplicatePreviewPayload,
  buildManualContactUpdatePayload,
  buildQuickAddCreatePayload,
} from './payload'
import type {
  AdvisorOption,
  CollisionCreateResult,
  ContactDetail,
  ContactFormValues,
  ContactListFilters,
  ContactListItem,
  ContactListResult,
  DuplicatePreviewResult,
  QuickAddCreateResult,
  QuickAddUpdateResult,
} from './types'
import { MANUAL_CONTACT_HOUSEHOLD_EXCLUSION } from './exclusions'
import {
  CONTACTS_FETCH_CAP,
  CONTACTS_PAGE_SIZE,
  filterManualContacts,
  isContactsFetchCapped,
  paginateManualContacts,
} from './listPipeline'
import { formatPhoneForDisplay } from './validation'

export { MANUAL_CONTACT_HOUSEHOLD_EXCLUSION }
export { CONTACTS_FETCH_CAP, CONTACTS_PAGE_SIZE } from './listPipeline'

const CONTACT_LIST_SELECT = `
  id,
  lead_type,
  contact_category,
  how_we_met,
  submitted_at,
  created_at,
  deleted_at,
  household:households!household_id (
    id,
    display_name,
    status,
    lead_source,
    primary_email,
    primary_phone,
    city,
    state,
    assigned_advisor_id,
    created_at,
    deleted_at,
    merged_into_household_id,
    assigned_advisor:advisor_profiles!assigned_advisor_id ( id, display_name ),
    members:household_members!household_id (
      id,
      first_name,
      last_name,
      email,
      phone,
      company,
      job_title,
      website,
      is_primary_contact,
      deleted_at
    )
  )
`

const CONTACT_DETAIL_SELECT = `
  ${CONTACT_LIST_SELECT},
  consent_snapshot,
  created_by_user_id
`

async function attachFollowUpSummaries(
  supabase: SupabaseClient,
  items: ContactListItem[],
): Promise<ContactListItem[]> {
  if (items.length === 0) return items
  const householdIds = items.map((i) => i.householdId)
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, status, household_id')
    .in('household_id', householdIds)
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress'])
    .order('due_date', { ascending: true })

  if (error || !data) return items
  const byHousehold = new Map<string, { title: string; due_date: string | null }>()
  for (const row of data) {
    const hh = String(row.household_id)
    if (byHousehold.has(hh)) continue
    byHousehold.set(hh, {
      title: String(row.title ?? 'Follow-up'),
      due_date: (row.due_date as string | null) ?? null,
    })
  }
  return items.map((item) => {
    const task = byHousehold.get(item.householdId)
    if (!task) return item
    const due = task.due_date ? ` · due ${task.due_date}` : ''
    return { ...item, followUpTaskSummary: `${task.title}${due}` }
  })
}

/**
 * Contacts list data flow (Phase Q1B — bounded client filter/pagination):
 *
 * 1. Server query (RLS): lead_type='Manual Contact', deleted_at IS NULL
 * 2. Order: submitted_at DESC, created_at DESC, id DESC (stable)
 * 3. Limit: CONTACTS_FETCH_CAP (500) — full visible set for early volume, not one UI page
 * 4. Map/drop invalid/merged/non-manual households
 * 5. Client filters: category → advisor → search
 * 6. Client stable re-sort, then slice for the requested UI page (default 25)
 * 7. total = filtered length (never the 25-row page size)
 *
 * This is NOT server-side pagination. Search/filter run over the fetched set.
 */
export async function fetchManualContacts(
  supabase: SupabaseClient,
  filters: ContactListFilters,
): Promise<ContactListResult> {
  const pageSize = filters.pageSize > 0 ? filters.pageSize : CONTACTS_PAGE_SIZE
  const page = Math.max(1, filters.page)

  const { data, error } = await supabase
    .from('leads')
    .select(CONTACT_LIST_SELECT)
    .eq('lead_type', 'Manual Contact')
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(CONTACTS_FETCH_CAP)

  if (error) throw error

  const fetchedRows = data ?? []
  const mapped = fetchedRows
    .map((row) => mapContactListItem(row as Record<string, unknown>))
    .filter((row): row is ContactListItem => Boolean(row))

  const filtered = filterManualContacts(mapped, filters)
  const paged = paginateManualContacts(filtered, page, pageSize)
  const withTasks = await attachFollowUpSummaries(supabase, paged.items)

  return {
    items: withTasks,
    total: paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    fetchedCount: fetchedRows.length,
    fetchCapped: isContactsFetchCapped(fetchedRows.length),
  }
}

export async function fetchManualContactDetail(
  supabase: SupabaseClient,
  leadId: string,
): Promise<{ detail: ContactDetail; formSeed: ContactFormValues } | null> {
  const { data, error } = await supabase
    .from('leads')
    .select(CONTACT_DETAIL_SELECT)
    .eq('id', leadId)
    .eq('lead_type', 'Manual Contact')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const household = Array.isArray(data.household) ? data.household[0] : data.household
  const members = (household?.members ?? []) as Array<Record<string, unknown>>
  const primary =
    members.find((m) => m.is_primary_contact === true && m.deleted_at == null) ??
    members.find((m) => m.deleted_at == null)
  if (!primary) return null

  let enteredByName: string | null = null
  const createdBy = typeof data.created_by_user_id === 'string' ? data.created_by_user_id : null
  if (createdBy) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', createdBy)
      .maybeSingle()
    enteredByName =
      typeof profile?.full_name === 'string' && profile.full_name.trim()
        ? profile.full_name.trim()
        : null
  }

  const householdId = String(household.id)
  const [{ count: openTaskCount }, { data: notes }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress']),
    supabase
      .from('notes')
      .select('id, body, created_at')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const followUps = await attachFollowUpSummaries(supabase, [
    {
      leadId,
      householdId,
      fullName: '',
      company: null,
      jobTitle: null,
      category: null,
      categoryLabel: '',
      email: null,
      phone: null,
      city: null,
      state: null,
      locationLabel: null,
      assignedAdvisorId: null,
      assignedAdvisorName: null,
      howWeMet: null,
      dateEntered: null,
      followUpTaskSummary: null,
    },
  ])

  const detail = mapContactDetail(data as Record<string, unknown>, {
    enteredByName,
    openTaskCount: openTaskCount ?? 0,
    noteCount: notes?.length ? 1 : 0,
    recentNotePreview: notes?.[0]?.body
      ? String(notes[0].body).slice(0, 160)
      : null,
    followUpTaskSummary: followUps[0]?.followUpTaskSummary ?? null,
  })
  if (!detail) return null

  const formSeed = detailToFormValuesFromRow(
    {
      ...detail,
      phone: typeof primary.phone === 'string' ? formatPhoneForDisplay(primary.phone) : detail.phone,
    },
    String(primary.first_name ?? ''),
    String(primary.last_name ?? ''),
  )
  // Keep raw phone for edit (avoid double-formatting issues) — use stored phone digits/text
  formSeed.phone = typeof primary.phone === 'string' ? primary.phone : ''
  formSeed.email = typeof primary.email === 'string' ? primary.email : ''

  return { detail, formSeed }
}

export async function listActiveAdvisorsForAssignment(
  supabase: SupabaseClient,
): Promise<AdvisorOption[]> {
  const rows = await fetchOpportunityAdvisorOptions(supabase)
  return rows.map((row) => ({ id: row.id, displayName: row.display_name }))
}

export async function previewContactDuplicates(
  supabase: SupabaseClient,
  values: ContactFormValues,
  operation: 'create' | 'update',
  leadId?: string,
): Promise<DuplicatePreviewResult> {
  const payload = buildDuplicatePreviewPayload(values, operation, leadId)
  const { data, error } = await supabase.rpc('preview_quick_add_contact_duplicates', {
    p_payload: payload,
  })
  if (error) throw Object.assign(new Error(mapQuickAddError(error).message), { cause: error })
  const parsed = parseDuplicatePreview(data)
  if (!parsed) throw new Error(mapQuickAddError('QUICK_ADD:invalid_payload').message)
  return parsed
}

export async function createManualContact(
  supabase: SupabaseClient,
  values: ContactFormValues,
  options: {
    mode: 'create' | 'create_separate'
    createToken?: string | null
    includeAssignedAdvisor: boolean
  },
): Promise<QuickAddCreateResult | CollisionCreateResult> {
  const payload = buildQuickAddCreatePayload(values, {
    includeAssignedAdvisor: options.includeAssignedAdvisor,
  })
  const { data, error } = await supabase.rpc('quick_add_contact', {
    p_payload: payload,
    p_mode: options.mode,
    p_create_token: options.mode === 'create_separate' ? options.createToken ?? null : null,
  })
  if (error) throw Object.assign(new Error(mapQuickAddError(error).message), { cause: error })
  const parsed = parseCreateResult(data)
  if (!parsed) throw new Error(mapQuickAddError('QUICK_ADD:invalid_payload').message)
  return parsed
}

export async function updateManualContactRecord(
  supabase: SupabaseClient,
  leadId: string,
  values: ContactFormValues,
  options?: { mode?: 'update' | 'update_separate'; createToken?: string | null },
): Promise<QuickAddUpdateResult | CollisionCreateResult> {
  const payload = buildManualContactUpdatePayload(values, {
    mode: options?.mode,
    createToken: options?.createToken,
  })
  const { data, error } = await supabase.rpc('update_manual_contact', {
    p_lead_id: leadId,
    p_payload: payload,
  })
  if (error) throw Object.assign(new Error(mapQuickAddError(error).message), { cause: error })
  const parsed = parseUpdateResult(data)
  if (!parsed) throw new Error(mapQuickAddError('QUICK_ADD:invalid_payload').message)
  return parsed
}

/** Resolve an accessible Manual Contact lead for Open existing. */
export async function findManualContactLeadIdByHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .eq('household_id', householdId)
    .eq('lead_type', 'Manual Contact')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return typeof data?.id === 'string' ? data.id : null
}
