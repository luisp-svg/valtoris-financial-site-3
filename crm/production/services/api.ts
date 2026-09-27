import { calendarToday, type CaseView } from './caseModel'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Allocation,
  OpportunityOption,
  ServiceHistory,
  ServiceRecord,
} from './model'
const RECORD_SELECT =
  '*, household:households!household_id(display_name), opportunity:opportunities!opportunity_id(title)'
export async function listServiceRecords(
  client: SupabaseClient,
  offset: number,
  archived: boolean,
  view: CaseView = 'all',
): Promise<ServiceRecord[]> {
  let query = client
    .from('service_production_records')
    .select(
      RECORD_SELECT +
        (view === 'overdue_requirements'
          ? ',requirements:service_production_requirements!inner(id)'
          : ''),
    )
    .order('created_at', { ascending: false })
    .order('id')
    .range(offset, offset + 49)
  query = archived
    ? query.not('deleted_at', 'is', null)
    : query.is('deleted_at', null)
  if (view !== 'all') query = query.eq('production_status', 'submitted')
  if (view === 'overdue_follow_up')
    query = query.lt('next_follow_up_date', calendarToday())
  if (view === 'unassigned') query = query.is('case_owner_user_id', null)
  if (view === 'waiting')
    query = query.in('case_stage', ['waiting_client', 'waiting_provider'])
  if (view === 'overdue_requirements')
    query = query
      .in('requirements.status', ['open', 'scheduled'])
      .is('requirements.deleted_at', null)
      .lt('requirements.due_date', calendarToday())
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as ServiceRecord[]
}
export async function loadServiceRecord(client: SupabaseClient, id: string) {
  const results = await Promise.all([
    client
      .from('service_production_records')
      .select(RECORD_SELECT)
      .eq('id', id)
      .maybeSingle(),
    client
      .from('service_production_allocations')
      .select('*, advisor:advisor_profiles!advisor_id(display_name)')
      .eq('record_id', id)
      .is('effective_to', null)
      .order('effective_from')
      .order('id'),
    client
      .from('service_production_history')
      .select('id,event_type,reason,created_at')
      .eq('record_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  for (const result of results) if (result.error) throw result.error
  if (!results[0].data) throw new Error('CRM_SP:not_found')
  return {
    record: results[0].data as unknown as ServiceRecord,
    allocations: results[1].data as unknown as Allocation[],
    history: results[2].data as unknown as ServiceHistory[],
  }
}
export async function searchServiceOpportunities(
  client: SupabaseClient,
  search: string,
): Promise<OpportunityOption[]> {
  const { data, error } = await client
    .from('opportunities')
    .select(
      'id,household_id,title,vertical:service_verticals!inner(code),household:households!inner(display_name)',
    )
    .is('deleted_at', null)
    .in('status', ['open', 'on_hold', 'won'])
    .in('vertical.code', [
      'pc',
      'health',
      'student_loans',
      'credit_repair',
      'wills_trusts',
      'tax_strategy',
    ])
    .ilike('title', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as unknown as OpportunityOption[]
}
export async function serviceMutation(
  client: SupabaseClient,
  name:
    | 'create_service_production'
    | 'update_service_production'
    | 'set_service_production_allocations'
    | 'review_service_production_estimate'
    | 'archive_service_production',
  args: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return data
}

export async function getServiceOpportunity(
  client: SupabaseClient,
  id: string,
): Promise<OpportunityOption | null> {
  const { data, error } = await client
    .from('opportunities')
    .select(
      'id,household_id,title,vertical:service_verticals!inner(code),household:households!inner(display_name)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .in('status', ['open', 'on_hold', 'won'])
    .in('vertical.code', [
      'pc',
      'health',
      'student_loans',
      'credit_repair',
      'wills_trusts',
      'tax_strategy',
    ])
    .maybeSingle()
  if (error) throw error
  return data as unknown as OpportunityOption | null
}

export async function findServiceRecord(
  client: SupabaseClient,
  opportunityId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('service_production_records')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}
