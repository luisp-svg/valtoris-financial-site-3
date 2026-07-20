import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  AssigneeOption,
  CreateTaskInput,
  CrmTask,
  HouseholdOption,
  LeadOption,
  OpportunityOption,
} from './types'

const TASK_SELECT = `
  id,
  household_id,
  opportunity_id,
  title,
  description,
  due_date,
  priority,
  status,
  assigned_user_id,
  created_by_user_id,
  created_at,
  completed_at,
  deleted_at,
  household:households!tasks_household_id_fkey ( id, display_name ),
  assignee:profiles!tasks_assigned_user_id_fkey ( id, full_name, email )
`

export type FormOptionSource = 'households' | 'leads' | 'opportunities' | 'assignees'

export function formatSupabaseError(
  source: FormOptionSource | string,
  error: unknown,
): string {
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

function normalizeTask(row: Record<string, unknown>): CrmTask {
  const household = row.household
  const assignee = row.assignee
  return {
    ...(row as Omit<CrmTask, 'household' | 'assignee'>),
    household: Array.isArray(household)
      ? (household[0] as CrmTask['household'])
      : ((household as CrmTask['household']) ?? null),
    assignee: Array.isArray(assignee)
      ? (assignee[0] as CrmTask['assignee'])
      : ((assignee as CrmTask['assignee']) ?? null),
  }
}

export async function fetchVisibleTasks(
  supabase: SupabaseClient,
  options?: { dueOn?: string; assignedUserId?: string; limit?: number },
): Promise<CrmTask[]> {
  let query = supabase
    .from('tasks')
    .select(TASK_SELECT)
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (options?.dueOn) {
    query = query.eq('due_date', options.dueOn)
  }
  if (options?.assignedUserId) {
    query = query.eq('assigned_user_id', options.assignedUserId)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => normalizeTask(row as Record<string, unknown>))
}

export async function createTask(
  supabase: SupabaseClient,
  input: CreateTaskInput,
  createdByUserId: string,
): Promise<CrmTask> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title.trim(),
      description: input.description.trim() || null,
      due_date: input.due_date || null,
      priority: input.priority,
      status: 'open',
      assigned_user_id: input.assigned_user_id,
      household_id: input.household_id,
      opportunity_id: input.opportunity_id,
      created_by_user_id: createdByUserId,
    })
    .select(TASK_SELECT)
    .single()

  if (error) throw error
  return normalizeTask(data as Record<string, unknown>)
}

export async function fetchHouseholdOptions(
  supabase: SupabaseClient,
): Promise<HouseholdOption[]> {
  // households.display_name is the canonical label column.
  const { data, error } = await supabase
    .from('households')
    .select('id, display_name')
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
    .order('display_name', { ascending: true })
    .limit(200)

  if (error) throw error
  return (data ?? []) as HouseholdOption[]
}

export async function fetchLeadOptions(supabase: SupabaseClient): Promise<LeadOption[]> {
  // leads has TWO FKs to households (household_id + potential_duplicate_of_household_id).
  // Ambiguous embeds like `household:households(...)` fail with PGRST201 — pin household_id.
  const { data, error } = await supabase
    .from('leads')
    .select(
      `
      id,
      household_id,
      lead_type,
      status,
      normalized_email,
      household:households!household_id ( display_name )
    `,
    )
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })
    .limit(100)

  if (error) throw error

  return (data ?? []).map((lead) => {
    const household = Array.isArray(lead.household) ? lead.household[0] : lead.household
    const householdName =
      household && typeof household === 'object' && 'display_name' in household
        ? String((household as { display_name: string }).display_name)
        : null
    const label =
      householdName ||
      (lead.normalized_email ? String(lead.normalized_email) : null) ||
      `${String(lead.lead_type ?? 'lead')} · ${String(lead.status ?? 'new')}`
    return {
      id: lead.id as string,
      household_id: lead.household_id as string,
      label,
    }
  })
}

export async function fetchOpportunityOptions(
  supabase: SupabaseClient,
  householdId: string,
): Promise<OpportunityOption[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, household_id, title')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []) as OpportunityOption[]
}

/**
 * Assignees are profiles.id values (tasks.assigned_user_id → profiles).
 * Owner: profiles RLS allows reading active owner/advisor rows.
 * Advisor: only own profile (profiles_select: id = auth.uid()).
 * No list-assignees RPC exists; do not broaden RLS.
 */
export async function fetchAssigneeOptions(
  supabase: SupabaseClient,
  role: 'owner' | 'advisor',
  profileId: string,
): Promise<AssigneeOption[]> {
  if (role === 'advisor') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', profileId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return data ? [data as AssigneeOption] : []
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['owner', 'advisor'])
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .limit(100)

  if (error) throw error
  return (data ?? []) as AssigneeOption[]
}

export function localDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
