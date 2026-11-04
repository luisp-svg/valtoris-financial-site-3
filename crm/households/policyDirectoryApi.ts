import type { SupabaseClient } from '@supabase/supabase-js'
import { readAllPages } from '../../lib/readAllPages'

export type DirectoryPolicy = {
  id: string
  household_id: string
  source_application_id: string | null
  policy_number: string | null
  carrier: string
  policy_type: string
  status: string
  effective_date: string | null
  updated_at: string
  household: { display_name: string } | null
}

/** SELECT only. Page all authorized rows before applying directory filters. */
export async function fetchPolicyDirectory(client: SupabaseClient): Promise<DirectoryPolicy[]> {
  const rows = await readAllPages<Omit<DirectoryPolicy, 'household'> & {
    household: { display_name: string } | { display_name: string }[] | null
  }>((start, end) =>
    client.from('policies').select('id,household_id,source_application_id,policy_number,carrier,policy_type,status,effective_date,updated_at,household:households!household_id(display_name)')
      .is('deleted_at', null).order('updated_at', { ascending: false }).order('id', { ascending: true }).range(start, end),
  )
  return rows.map(row => {
    const household = Array.isArray(row.household) ? row.household[0] : row.household
    return { ...row, household: household && typeof household.display_name === 'string' ? household : null }
  })
}

export function filterPolicyDirectory(rows: readonly DirectoryPolicy[], search: string, status: string, carrier: string): DirectoryPolicy[] {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter(row => {
    if (status && row.status !== status) return false
    if (carrier && row.carrier !== carrier) return false
    const text = [row.household?.display_name, row.policy_number, row.carrier, row.policy_type].filter(Boolean).join(' ').toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  })
}
