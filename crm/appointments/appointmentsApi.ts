import type { SupabaseClient } from '@supabase/supabase-js'
export type Appointment = { id: string; household_id: string; title: string; starts_at: string; ends_at: string | null; status: string; agentcrm_sync_status: string | null; external_agentcrm_event_id: string | null; notes: string | null; households: { display_name: string } | null }
export async function fetchAppointmentsPage(client: SupabaseClient, page: number, upcoming: boolean, now = new Date().toISOString()) {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid appointment page.')
  let query = client.from('appointments').select('id,household_id,title,starts_at,ends_at,status,agentcrm_sync_status,external_agentcrm_event_id,notes,households(display_name)', { count: 'exact' }).is('deleted_at', null)
  if (upcoming) query = query.gte('starts_at', now).neq('status', 'cancelled')
  const { data, error, count } = await query.order('starts_at', { ascending: upcoming }).order('id', { ascending: true }).range((page - 1) * 50, page * 50 - 1)
  if (error) throw error
  if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error('Appointment total unavailable.')
  return { rows: (data ?? []) as unknown as Appointment[], total: count }
}
