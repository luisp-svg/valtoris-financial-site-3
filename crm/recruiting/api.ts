import type { SupabaseClient } from '@supabase/supabase-js'
import type { CarrierReview, Credential, History, Option, Readiness, Recruit } from './types'

/** Stable pagination avoids silently losing older recruiting records. RLS scopes every page. */
export async function listRecruits(db: SupabaseClient): Promise<Recruit[]> {
  const rows: Recruit[] = []
  let after = ''
  for (;;) {
    let query = db.from('recruit_records').select('*').order('id').limit(100)
    if (after) query = query.gt('id', after)
    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break
    const next = String(data[data.length - 1].id)
    if (next <= after) throw new Error('Recruiting could not finish loading. Please refresh.')
    rows.push(...data as Recruit[])
    after = next
  }
  return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
}
export async function recruitingManager(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc('crm_can_manage_recruiting')
  if (error) throw error
  return data === true
}
export async function recruitDetail(db: SupabaseClient, id: string, manager: boolean) {
  const results = await Promise.all([
    db.from('recruit_records').select('*').eq('id', id).maybeSingle(),
    db.from('recruit_credentials').select('*').eq('recruit_id', id).order('updated_at', { ascending: false }),
    db.from('recruit_carrier_readiness').select('*').eq('recruit_id', id).order('updated_at', { ascending: false }),
    db.rpc('recruit_readiness', { p_recruit_id: id }),
    manager ? db.from('recruit_history').select('*').eq('recruit_id', id).order('occurred_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
  ])
  for (const result of results) if (result.error) throw result.error
  if (!results[0].data) throw new Error('Recruit not available for your account.')
  return { record: results[0].data as Recruit, credentials: results[1].data as Credential[], carriers: results[2].data as CarrierReview[], readiness: results[3].data as Readiness[], history: results[4].data as History[] }
}
export async function recruitOptions(db: SupabaseClient): Promise<{ advisors: Option[]; carriers: Option[] }> {
  const [advisors, carriers] = await Promise.all([
    db.from('advisor_profiles').select('id,display_name,email').is('deleted_at', null).eq('is_active', true).order('display_name'),
    db.from('carriers').select('id,name').is('deleted_at', null).eq('is_active', true).order('name'),
  ])
  if (advisors.error) throw advisors.error
  if (carriers.error) throw carriers.error
  return { advisors: (advisors.data ?? []).map(row => ({ id: row.id, name: row.display_name, email: row.email })), carriers: carriers.data ?? [] }
}
export async function recruitCommand(db: SupabaseClient, record: Recruit | null, action: string, payload: Record<string, unknown>, reason: string): Promise<string> {
  const { data, error } = await db.rpc('recruit_command', { p_recruit_id: record?.id ?? null, p_revision: record?.revision ?? null, p_action: action, p_payload: payload, p_reason: reason })
  if (error) throw error
  return String(data)
}
export function recruitingError(error: unknown): string {
  const e = error as { code?: string; message?: string }
  if (e.code === '23505') return 'A matching email, linked advisor, or requirement already exists. Open that record to update it.'
  if (e.code === '23514' || e.code === '23502') return 'Check the required fields, dates, and evidence. Verified items need an effective date, an expiration date or confirmed no expiration, and an evidence reference.'
  if (e.code === '22007' || e.code === '22008') return 'Enter dates as YYYY-MM-DD.'
  return e.message || 'Unable to save. Refresh and try again.'
}
