import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseServerClient } from '../../../lib/supabase/server.js'
import { createSupabaseAdminClient } from '../../../lib/supabase/admin.js'

/**
 * DELETE /api/crm/documents/relationship-photo
 * Soft-deletes a Relationship Photo for authorized CRM users and cleans storage.
 */

export async function handleCrmRelationshipPhotoDeleteRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const documentId =
    req.body && typeof req.body === 'object' && typeof (req.body as { documentId?: unknown }).documentId === 'string'
      ? (req.body as { documentId: string }).documentId
      : ''

  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    return res.status(400).json({ ok: false, error: 'Invalid document id' })
  }

  const supabase = createSupabaseServerClient(req, res)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const { data, error } = await supabase.rpc('soft_delete_digital_identity_relationship_photo', {
    p_document_id: documentId,
  })

  if (error || !data || (data as { ok?: boolean }).ok !== true) {
    return res.status(403).json({ ok: false, error: 'Unable to remove Relationship Photo' })
  }

  const row = data as {
    storage_bucket?: string
    storage_path?: string
  }

  if (typeof row.storage_bucket === 'string' && typeof row.storage_path === 'string') {
    try {
      const admin = createSupabaseAdminClient()
      await admin.storage.from(row.storage_bucket).remove([row.storage_path])
    } catch {
      // Soft-delete already succeeded; storage cleanup is best-effort.
    }
  }

  return res.status(200).json({ ok: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleCrmRelationshipPhotoDeleteRequest(req, res)
}
