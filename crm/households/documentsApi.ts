import type { SupabaseClient } from '@supabase/supabase-js'

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
export type HouseholdDocument = { id: string; file_name: string; doc_type: string; created_at: string; storage_bucket: string; storage_path: string }
export function validateQuoteFile(file: Pick<File, 'name' | 'size' | 'type'>): void {
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) throw new Error('Choose a PDF document.')
  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) throw new Error('Each PDF must be between 1 byte and 20 MB.')
}
export async function listHouseholdDocuments(client: SupabaseClient, householdId: string): Promise<HouseholdDocument[]> {
  const { data, error } = await client.from('documents').select('id,file_name,doc_type,created_at,storage_bucket,storage_path')
    .eq('household_id', householdId).is('deleted_at', null).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as HouseholdDocument[]
}
export async function uploadHouseholdDocument(client: SupabaseClient, householdId: string, file: File, docType: string): Promise<void> {
  validateQuoteFile(file)
  if (!['pc_quote_auto', 'pc_quote_home', 'pc_quote_umbrella', 'pc_quote_other'].includes(docType)) throw new Error('Choose a document category.')
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer())
  if (header !== '%PDF-') throw new Error('This file is not a valid PDF document.')
  const { data: user, error: authError } = await client.auth.getUser()
  if (authError || !user.user) throw new Error('Sign in again before uploading.')
  const id = crypto.randomUUID()
  const storagePath = `${householdId}/${id}/document.pdf`
  // Existing Storage RLS requires authorized metadata before object insertion.
  const { error: metadataError } = await client.from('documents').insert({ id, household_id: householdId, uploaded_by_user_id: user.user.id,
    doc_type: docType, file_name: file.name, storage_bucket: 'crm-documents', storage_path: storagePath,
    mime_type: 'application/pdf', byte_size: file.size, visibility: 'advisor_only', source_module: 'households' })
  if (metadataError) throw metadataError
  const { error } = await client.storage.from('crm-documents').upload(storagePath, file, { contentType: 'application/pdf', upsert: false })
  if (error) {
    const { error: cleanupError } = await client.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('household_id', householdId)
    if (cleanupError) throw new Error('Upload failed and its pending record could not be cleared. Contact your administrator before retrying.')
    throw error
  }
}
export async function downloadHouseholdDocument(client: SupabaseClient, document: HouseholdDocument): Promise<Blob> {
  const { data, error } = await client.storage.from(document.storage_bucket).download(document.storage_path)
  if (error) throw error
  return data
}
