import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shape expected by `public.ingest_digital_identity_connect(p_payload jsonb)`.
 * Callers build this in `ingestDigitalIdentityConnect.ts`.
 */
export type DigitalIdentityConnectRpcPayload = Record<string, unknown>

export type PersistDigitalIdentityConnectSuccess = {
  ok: true
  created: boolean
  leadId: string
  householdId: string
  matchStatus: string
  duplicateReviewId: string | null
}

export type PersistDigitalIdentityConnectError = {
  ok: false
  code: string
  error: string
}

export type PersistDigitalIdentityConnectResult =
  | PersistDigitalIdentityConnectSuccess
  | PersistDigitalIdentityConnectError

const SAFE_ERROR_MESSAGE = 'Unable to save submission'

/** Maps raw Postgres/RPC error text to a small, stable, safe-to-log code. */
function mapRpcErrorCode(error: { message?: string } | null | undefined): string {
  const message = typeof error?.message === 'string' ? error.message : ''

  const knownCodes = [
    'invalid_payload',
    'invalid_idempotency_key',
    'invalid_match_status',
    'matched_household_required',
    'matched_household_not_found',
    'invalid_name',
    'invalid_advisor_profile',
  ]

  for (const code of knownCodes) {
    if (message.includes(code)) return code
  }

  return 'ingest_rpc_failed'
}

export async function persistDigitalIdentityConnect(
  admin: SupabaseClient,
  rpcPayload: DigitalIdentityConnectRpcPayload,
): Promise<PersistDigitalIdentityConnectResult> {
  const { data, error } = await admin.rpc('ingest_digital_identity_connect', {
    p_payload: rpcPayload,
  })

  if (error) {
    return { ok: false, code: mapRpcErrorCode(error), error: SAFE_ERROR_MESSAGE }
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, code: 'malformed_rpc_response', error: SAFE_ERROR_MESSAGE }
  }

  const row = data as Record<string, unknown>

  if (typeof row.lead_id !== 'string' || typeof row.household_id !== 'string') {
    return { ok: false, code: 'malformed_rpc_response', error: SAFE_ERROR_MESSAGE }
  }

  return {
    ok: true,
    created: Boolean(row.created),
    leadId: row.lead_id,
    householdId: row.household_id,
    matchStatus: typeof row.match_status === 'string' ? row.match_status : '',
    duplicateReviewId:
      typeof row.duplicate_review_id === 'string' ? row.duplicate_review_id : null,
  }
}
