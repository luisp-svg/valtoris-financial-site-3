import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseServerClient } from '../../../lib/supabase/server.js'
import { createSupabaseAdminClient } from '../../../lib/supabase/admin.js'

/**
 * GET /api/crm/documents/signed-url?documentId=...
 *
 * Authenticated CRM users with household access receive a short-lived signed URL.
 * Never returns raw permanent storage paths to unauthorized callers.
 */

const SIGNED_URL_SECONDS = 120

function readQueryParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

export async function handleCrmDocumentSignedUrlRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const documentId = readQueryParam(req.query.documentId)
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

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, household_id, storage_bucket, storage_path, mime_type, doc_type, file_name, visibility')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (docError || !doc) {
    return res.status(404).json({ ok: false, error: 'Document not found' })
  }

  // RLS already gated the select. Mint signed URL with service role after authZ succeeded.
  let admin
  try {
    admin = createSupabaseAdminClient()
  } catch {
    return res.status(500).json({ ok: false, error: 'Unable to create download link' })
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, SIGNED_URL_SECONDS)

  if (signedError || !signed?.signedUrl) {
    return res.status(500).json({ ok: false, error: 'Unable to create download link' })
  }

  return res.status(200).json({
    ok: true,
    url: signed.signedUrl,
    expiresInSeconds: SIGNED_URL_SECONDS,
    mimeType: doc.mime_type,
    fileName:
      doc.doc_type === 'relationship_photo' ? 'relationship-photo.jpg' : doc.file_name,
    label: doc.doc_type === 'relationship_photo' ? 'Relationship Photo' : doc.file_name,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleCrmDocumentSignedUrlRequest(req, res)
}
