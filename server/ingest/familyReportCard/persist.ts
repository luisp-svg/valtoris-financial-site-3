import type { SupabaseClient } from '@supabase/supabase-js'
import type { SheetsSyncStatus } from './types.js'

/**
 * Shape expected by `public.ingest_public_report_card(p_payload jsonb)`
 * (supabase/migrations/043_public_report_card_ingest.sql). The Family wrapper
 * `ingest_public_family_report_card` remains for compatibility. Kept as a
 * loosely-typed record here since the RPC boundary is JSON.
 */
export type FamilyReportCardRpcPayload = Record<string, unknown>

export type PersistIngestSuccess = {
  ok: true
  created: boolean
  leadId: string
  householdId: string
  assessmentId: string | null
  matchStatus: string
  sheetsSyncStatus: string | null
  duplicateReviewId: string | null
}

export type PersistIngestError = {
  ok: false
  code: string
  error: string
}

export type PersistIngestResult = PersistIngestSuccess | PersistIngestError

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
    'invalid_assessment_type',
    'invalid_lead_type',
    'invalid_advisor',
  ]

  for (const code of knownCodes) {
    if (message.includes(code)) return code
  }

  return 'ingest_rpc_failed'
}

export async function persistFamilyReportCardIngest(
  admin: SupabaseClient,
  rpcPayload: FamilyReportCardRpcPayload,
): Promise<PersistIngestResult> {
  const { data, error } = await admin.rpc('ingest_public_report_card', { p_payload: rpcPayload })

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
    assessmentId: typeof row.assessment_id === 'string' ? row.assessment_id : null,
    matchStatus: typeof row.match_status === 'string' ? row.match_status : '',
    sheetsSyncStatus: typeof row.sheets_sync_status === 'string' ? row.sheets_sync_status : null,
    duplicateReviewId: typeof row.duplicate_review_id === 'string' ? row.duplicate_review_id : null,
  }
}

export async function updateLeadSheetsSync(
  admin: SupabaseClient,
  leadId: string,
  status: SheetsSyncStatus,
  errorCategory?: string,
  externalRef?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.rpc('update_lead_sheets_sync', {
    p_lead_id: leadId,
    p_status: status,
    p_error_category: errorCategory ?? null,
    p_external_ref: externalRef ?? null,
  })

  if (error) {
    return { ok: false, error: 'Unable to update Sheets sync status' }
  }
  return { ok: true }
}
