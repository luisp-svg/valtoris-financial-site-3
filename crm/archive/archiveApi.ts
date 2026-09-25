import type { SupabaseClient } from '@supabase/supabase-js'
export type ArchiveKind = 'household' | 'lead'
export type ArchivedRecord = { id: string; household_id: string; display_name: string; record_type: string; archived_at: string; household_archived: boolean }
export async function changeArchive(client: SupabaseClient, kind: ArchiveKind, id: string, archive: boolean) {
  const { data, error } = await client.rpc(archive ? 'archive_crm_record' : 'restore_crm_record', { p_kind: kind, p_id: id })
  if (error) {
    if (error.message.includes('restore_household_first')) throw new Error('Restore the household first, then restore this record.')
    if (error.message.includes('resolve_duplicate_first')) throw new Error('Resolve the pending duplicate review before archiving this record.')
    throw new Error('Unable to update this record. Refresh and try again.')
  }
  if (data?.ok !== true || data.id !== id || data.kind !== kind || data.archived !== archive) throw new Error('The change could not be confirmed. Refresh before trying again.')
}
export async function loadArchived(client: SupabaseClient, kind: ArchiveKind, page: number): Promise<ArchivedRecord[]> {
  const { data, error } = await client.rpc('list_archived_crm_records', { p_kind: kind, p_offset: page * 50, p_limit: 50 })
  if (error || !Array.isArray(data)) throw new Error('Unable to load archived records.')
  return data
}
