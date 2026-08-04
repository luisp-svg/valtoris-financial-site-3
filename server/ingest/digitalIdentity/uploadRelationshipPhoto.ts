/**
 * SERVER ONLY — validate token + normalize image + private storage + consume grant.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../lib/supabase/admin.js'
import {
  buildRelationshipPhotoStoragePath,
  hashPhotoUploadToken,
} from './photoGrant.js'
import {
  normalizeRelationshipPhoto,
  RELATIONSHIP_PHOTO_MAX_BYTES,
} from './normalizeRelationshipPhoto.js'

export type UploadRelationshipPhotoInput = {
  uploadToken: string
  photoAcknowledgment: boolean
  image: Buffer
  source?: string | null
}

export type UploadRelationshipPhotoSuccess = {
  ok: true
  saved: true
}

export type UploadRelationshipPhotoError = {
  ok: false
  error: string
  code: string
}

export type UploadRelationshipPhotoResult =
  | UploadRelationshipPhotoSuccess
  | UploadRelationshipPhotoError

export type UploadRelationshipPhotoDeps = {
  admin?: SupabaseClient
}

function fail(code: string, error: string): UploadRelationshipPhotoError {
  return { ok: false, code, error }
}

export async function uploadRelationshipPhoto(
  input: UploadRelationshipPhotoInput,
  deps: UploadRelationshipPhotoDeps = {},
): Promise<UploadRelationshipPhotoResult> {
  if (!input.photoAcknowledgment) {
    return fail(
      'acknowledgment_required',
      'Please acknowledge photo storage before saving a photo.',
    )
  }

  if (input.source != null && input.source !== 'digital_identity_connect') {
    return fail('invalid_source', 'Submission rejected.')
  }

  const token =
    typeof input.uploadToken === 'string' ? input.uploadToken.trim().toLowerCase() : ''
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return fail('invalid_token', 'This photo upload link is invalid or expired.')
  }

  if (!input.image || input.image.length === 0) {
    return fail('empty', 'No image was provided.')
  }
  if (input.image.length > RELATIONSHIP_PHOTO_MAX_BYTES) {
    return fail('too_large', 'Photo must be 5 MB or smaller.')
  }

  let admin: SupabaseClient
  try {
    admin = deps.admin ?? createSupabaseAdminClient()
  } catch {
    return fail('admin_unavailable', 'Unable to save photo.')
  }

  const normalized = await normalizeRelationshipPhoto(input.image)
  if (!normalized.ok) {
    return fail(normalized.code, normalized.error)
  }

  // Peek grant via consume will validate; we need household id for path.
  // Resolve household from grant row through a lightweight service-role read.
  const tokenHash = hashPhotoUploadToken(token)
  const { data: grantRow, error: grantLookupError } = await admin
    .from('digital_identity_photo_upload_grants')
    .select('id, household_id, status, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (grantLookupError || !grantRow) {
    return fail('invalid_token', 'This photo upload link is invalid or expired.')
  }
  if (grantRow.revoked_at || grantRow.status === 'revoked') {
    return fail('revoked', 'This photo upload link is no longer valid.')
  }
  if (grantRow.status === 'consumed') {
    return fail('consumed', 'This photo was already saved.')
  }
  if (
    grantRow.status === 'expired' ||
    (typeof grantRow.expires_at === 'string' && Date.parse(grantRow.expires_at) <= Date.now())
  ) {
    return fail('expired', 'This photo upload link expired. Your connection is still saved.')
  }
  if (grantRow.status !== 'issued' && grantRow.status !== 'processing') {
    return fail('invalid_token', 'This photo upload link is invalid or expired.')
  }

  const householdId = String(grantRow.household_id)
  const storagePath = buildRelationshipPhotoStoragePath(householdId, normalized.extension)
  const bucket = 'crm-documents'

  const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, normalized.buffer, {
    contentType: normalized.mimeType,
    upsert: false,
  })

  if (uploadError) {
    return fail('storage_failed', 'Unable to save photo.')
  }

  const { data: consumeData, error: consumeError } = await admin.rpc(
    'consume_digital_identity_photo_upload_grant',
    {
      p_token_hash: tokenHash,
      p_storage_bucket: bucket,
      p_storage_path: storagePath,
      p_mime_type: normalized.mimeType,
      p_byte_size: normalized.byteSize,
      p_replaced: false,
    },
  )

  if (consumeError || !consumeData || (consumeData as { ok?: boolean }).ok !== true) {
    try {
      await admin.storage.from(bucket).remove([storagePath])
    } catch {
      // Best-effort orphan cleanup.
    }
    const message = consumeError?.message || ''
    if (/DI_PHOTO:expired/i.test(message)) {
      return fail('expired', 'This photo upload link expired. Your connection is still saved.')
    }
    if (/DI_PHOTO:consumed/i.test(message)) {
      return fail('consumed', 'This photo was already saved.')
    }
    if (/DI_PHOTO:revoked/i.test(message)) {
      return fail('revoked', 'This photo upload link is no longer valid.')
    }
    return fail('finalize_failed', 'Unable to save photo.')
  }

  // If replace soft-deleted prior docs, best-effort delete their objects.
  const replaced = (consumeData as { replaced_document_ids?: unknown }).replaced_document_ids
  if (Array.isArray(replaced) && replaced.length > 0) {
    try {
      const { data: priorRows } = await admin
        .from('documents')
        .select('storage_path')
        .in(
          'id',
          replaced.filter((id): id is string => typeof id === 'string'),
        )
      const paths = (priorRows || [])
        .map((row) => row.storage_path)
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
      if (paths.length > 0) {
        await admin.storage.from(bucket).remove(paths)
      }
    } catch {
      // Non-fatal cleanup.
    }
  }

  return { ok: true, saved: true }
}
