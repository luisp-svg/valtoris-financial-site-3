/**
 * SERVER ONLY — issue Relationship Photo upload grants after Let's Connect.
 * Failures must never roll back successful lead ingest.
 */

import { createHash, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RelationshipPhotoGrantPublic = {
  available: true
  uploadToken: string
  expiresAt: string
}

export type RelationshipPhotoGrantUnavailable = {
  available: false
}

export type RelationshipPhotoGrantResult =
  | RelationshipPhotoGrantPublic
  | RelationshipPhotoGrantUnavailable

export function hashPhotoUploadToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

export function buildRelationshipPhotoStoragePath(
  householdId: string,
  extension: 'jpg' | 'png' | 'webp' = 'jpg',
): string {
  return `digital-identity/relationship-photos/${householdId}/${randomUUID()}.${extension}`
}

/**
 * Best-effort grant issuance. Never throws to callers that must preserve lead success.
 */
export async function issueRelationshipPhotoUploadGrant(
  admin: SupabaseClient,
  input: {
    leadId: string
    householdId: string
    submissionId: string
  },
): Promise<RelationshipPhotoGrantResult> {
  try {
    if (!input.leadId || !input.householdId || !input.submissionId) {
      return { available: false }
    }

    const { data, error } = await admin.rpc('issue_digital_identity_photo_upload_grant', {
      p_lead_id: input.leadId,
      p_household_id: input.householdId,
      p_submission_id: input.submissionId,
    })

    if (error || !data || typeof data !== 'object') {
      return { available: false }
    }

    const row = data as Record<string, unknown>
    const uploadToken = typeof row.upload_token === 'string' ? row.upload_token : null
    const expiresAt = typeof row.expires_at === 'string' ? row.expires_at : null
    if (!uploadToken || !expiresAt || row.ok !== true) {
      return { available: false }
    }

    return {
      available: true,
      uploadToken,
      expiresAt,
    }
  } catch {
    return { available: false }
  }
}
