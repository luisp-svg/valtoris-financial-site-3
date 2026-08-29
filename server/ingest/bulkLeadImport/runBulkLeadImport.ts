import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BULK_LEAD_IMPORT_BATCH_ID,
  BULK_LEAD_IMPORT_BATCH_SIZE,
  BULK_LEAD_IMPORT_MAX_BATCH_SIZE,
  BULK_LEAD_IMPORT_RPC,
} from '../../../modules/bulkLeadImport/constants.js'
import { findMatchCandidates } from '../familyReportCard/findCandidates.js'
import { classifyMatch } from '../familyReportCard/match.js'
import {
  assertNoProtectedBulkImportFields,
  buildBulkLeadImportRpcPayload,
  classifyBulkLeadImportDryRun,
  type BulkLeadImportIdentity,
} from './payload.js'

export type BulkLeadImportMode = 'dry_run' | 'execute'

export type BulkLeadImportRecordResult = {
  canonicalSourceRow: number
  externalSheetRowRef: string
  ok: boolean
  created: boolean
  outcome: string
  matchStatus: string | null
  householdId: string | null
  memberId: string | null
  leadId: string | null
  duplicateReviewId: string | null
  error: string | null
}

export type BulkLeadImportRunSummary = {
  ok: boolean
  mode: BulkLeadImportMode
  importBatchId: typeof BULK_LEAD_IMPORT_BATCH_ID
  attempted: number
  created: number
  alreadyExists: number
  reviewRequired: number
  failed: number
  stoppedEarly: boolean
  stopReason: string | null
  results: BulkLeadImportRecordResult[]
}

const DANGEROUS_FAILURES = [
  'not_authenticated',
  'not_authorized',
  'unsupported_batch',
  'protected_field',
]

function rpcErrorCode(message: string | undefined): string {
  const text = message ?? ''
  const match = text.match(/BULK_IMPORT:([a-z_]+)|PP:([a-z_]+)|([a-z_]+)/i)
  return (match?.[1] || match?.[2] || match?.[3] || text).toLowerCase()
}

function isDangerousFailure(code: string): boolean {
  return DANGEROUS_FAILURES.some((item) => code.includes(item))
}

export function assertBulkLeadImportBatchSize(size: number): number {
  if (!Number.isInteger(size) || size < 1) return BULK_LEAD_IMPORT_BATCH_SIZE
  return Math.min(size, BULK_LEAD_IMPORT_MAX_BATCH_SIZE)
}

export async function runBulkLeadImportBatch(input: {
  supabase: SupabaseClient
  identities: BulkLeadImportIdentity[]
  mode: BulkLeadImportMode
  batchSize?: number
}): Promise<BulkLeadImportRunSummary> {
  const limit = assertBulkLeadImportBatchSize(input.batchSize ?? BULK_LEAD_IMPORT_BATCH_SIZE)
  const slice = input.identities.slice(0, limit)
  const results: BulkLeadImportRecordResult[] = []
  let created = 0
  let alreadyExists = 0
  let reviewRequired = 0
  let failed = 0
  let stoppedEarly = false
  let stopReason: string | null = null

  for (const identity of slice) {
    const protectedError = assertNoProtectedBulkImportFields(identity as unknown as Record<string, unknown>)
    const built = buildBulkLeadImportRpcPayload(identity)
    const preview = classifyBulkLeadImportDryRun(identity)
    const base: BulkLeadImportRecordResult = {
      canonicalSourceRow: identity.canonicalSourceRow,
      externalSheetRowRef: preview.externalSheetRowRef,
      ok: false,
      created: false,
      outcome: 'rejected',
      matchStatus: null,
      householdId: null,
      memberId: null,
      leadId: null,
      duplicateReviewId: null,
      error: null,
    }

    if (protectedError || !built.ok) {
      const error = protectedError ?? (built.ok ? null : built.error)
      results.push({ ...base, error })
      failed += 1
      if (error && isDangerousFailure(error)) {
        stoppedEarly = true
        stopReason = error
        break
      }
      continue
    }

    if (input.mode === 'dry_run') {
      const candidates = await findMatchCandidates(input.supabase, {
        normalizedEmail: preview.normalizedEmail,
        normalizedPhone: preview.normalizedPhone,
      })
      const classification = classifyMatch({
        normalizedEmail: preview.normalizedEmail,
        normalizedPhone: preview.normalizedPhone,
        firstName: preview.firstName,
        lastName: preview.lastName,
        candidates,
      })
      results.push({
        ...base,
        ok: true,
        outcome: classification.status === 'exact_trusted_match'
          ? 'already_exists'
          : classification.status === 'possible_match'
            ? 'review_required'
            : 'would_create',
        matchStatus: classification.status,
        householdId: classification.matchedHouseholdId ?? classification.candidateHouseholdId ?? null,
      })
      continue
    }

    const { data, error } = await input.supabase.rpc(BULK_LEAD_IMPORT_RPC, {
      p_payload: built.payload,
    })
    if (error) {
      const code = rpcErrorCode(error.message)
      results.push({ ...base, error: code || error.message })
      failed += 1
      if (isDangerousFailure(code) || isDangerousFailure(error.message)) {
        stoppedEarly = true
        stopReason = code || error.message
        break
      }
      continue
    }

    const row = (data ?? {}) as Record<string, unknown>
    const matchStatus = typeof row.match_status === 'string' ? row.match_status : null
    const outcome = typeof row.outcome === 'string' ? row.outcome : 'unknown'
    const didCreate = row.created === true
    if (didCreate && outcome === 'review_required') reviewRequired += 1
    else if (didCreate) created += 1
    else alreadyExists += 1

    results.push({
      ...base,
      ok: row.ok === true,
      created: didCreate,
      outcome,
      matchStatus,
      householdId: typeof row.household_id === 'string' ? row.household_id : null,
      memberId: typeof row.member_id === 'string' ? row.member_id : null,
      leadId: typeof row.lead_id === 'string' ? row.lead_id : null,
      duplicateReviewId: typeof row.duplicate_review_id === 'string' ? row.duplicate_review_id : null,
    })
  }

  return {
    ok: failed === 0 && !stoppedEarly,
    mode: input.mode,
    importBatchId: BULK_LEAD_IMPORT_BATCH_ID,
    attempted: results.length,
    created,
    alreadyExists,
    reviewRequired,
    failed,
    stoppedEarly,
    stopReason,
    results,
  }
}
