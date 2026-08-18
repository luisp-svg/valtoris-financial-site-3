/**
 * Pending commission import API.
 * Creates/stages 040 batches and reviews 041 rows only.
 * Does not call 035 write RPCs, 036 paid RPCs, or table DML.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanonicalImportRow } from '../import/commissionImportCsv'
import type {
  ImportAllocationCandidate,
  ImportApplicationCandidate,
} from '../import/commissionImportApi'
import { EXPERIOR_PENDING_REPORT_SOURCE_TYPE } from './commissionPendingConstants'
import {
  COMMISSION_PENDING_IMPORT_LOAD_ERROR,
  COMMISSION_PENDING_IMPORT_REVIEW_ERROR,
  COMMISSION_PENDING_IMPORT_STAGE_ERROR,
  formatCommissionPendingImportUserError,
} from './commissionPendingErrors'
import {
  buildAcceptPendingRequest,
  buildConfirmPendingDuplicateRequest,
  pendingApplicationCandidateFilter,
} from './commissionPendingReview'
import type {
  CommissionPendingBatchView,
  CommissionPendingRowView,
} from './commissionPendingView'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function mapBatch(row: Record<string, unknown>): CommissionPendingBatchView {
  return {
    id: String(row.id),
    source_type: String(row.source_type ?? ''),
    source_file: String(row.source_file ?? ''),
    file_sha256: String(row.file_sha256 ?? ''),
    statement_identifier: String(row.statement_identifier ?? ''),
    fs_code: asString(row.fs_code),
    statement_date: asString(row.statement_date),
    source_created_at: asString(row.source_created_at),
    payee_name: asString(row.payee_name),
    statement_amount_cents: asNumber(row.statement_amount_cents),
    escrow_cents: asNumber(row.escrow_cents),
    import_status: row.import_status === 'duplicate_file' ? 'duplicate_file' : 'open',
    duplicate_of_batch_id: asString(row.duplicate_of_batch_id),
    row_count: asNumber(row.row_count) ?? 0,
    accepted_count: asNumber(row.accepted_count) ?? 0,
    review_count: asNumber(row.review_count) ?? 0,
    duplicate_count: asNumber(row.duplicate_count) ?? 0,
    ignored_count: asNumber(row.ignored_count) ?? 0,
    failed_count: asNumber(row.failed_count) ?? 0,
    created_at: String(row.created_at ?? ''),
  }
}

function mapRow(row: Record<string, unknown>): CommissionPendingRowView {
  const income = asNumber(row.source_income_cents) ?? 0
  return {
    id: String(row.id),
    batch_id: String(row.batch_id),
    source_section: String(row.source_section ?? ''),
    source_page: asNumber(row.source_page),
    source_row_ordinal: asNumber(row.source_row_ordinal) ?? 0,
    source_row_key: String(row.source_row_key ?? ''),
    transaction_fingerprint: String(row.transaction_fingerprint ?? ''),
    transaction_date: asString(row.transaction_date),
    payment_number: asString(row.payment_number),
    source_company: asString(row.source_company),
    source_product: asString(row.source_product),
    source_policy_number: asString(row.source_policy_number),
    source_writing_associate: asString(row.source_writing_associate),
    source_client: asString(row.source_client),
    source_agent_entered_premium_cents: asNumber(row.source_agent_entered_premium_cents),
    source_company_calculated_premium_cents: asNumber(row.source_company_calculated_premium_cents),
    source_gross_rate: asNumber(row.source_gross_rate),
    source_factor_rate: asNumber(row.source_factor_rate),
    source_net_rate: asNumber(row.source_net_rate),
    source_split_rate: asNumber(row.source_split_rate),
    source_type: asString(row.source_type),
    source_transaction_type: asString(row.source_transaction_type),
    source_income_cents: income,
    source_is_negative: row.source_is_negative === true || income < 0,
    source_is_chargeback_visual: row.source_is_chargeback_visual === true,
    pending_review_status: String(row.pending_review_status ?? ''),
    pending_review_reason: asString(row.pending_review_reason),
    resolved_carrier_id: asString(row.resolved_carrier_id),
    resolved_application_id: asString(row.resolved_application_id),
    resolved_allocation_id: asString(row.resolved_allocation_id),
    resolved_advisor_id: asString(row.resolved_advisor_id),
    reviewed_by_user_id: asString(row.reviewed_by_user_id),
    reviewed_at: asString(row.reviewed_at),
    created_at: String(row.created_at ?? ''),
  }
}

export type CreatePendingImportBatchInput = {
  sourceFile: string
  fileSha256: string
  statementIdentifier: string
  fsCode: string | null
  statementDate: string | null
  sourceCreatedAt: string | null
  payeeName: string | null
  statementAmountCents: number | null
  escrowCents: number | null
}

export function createCommissionPendingImportBatchRpcArgs(input: CreatePendingImportBatchInput) {
  return {
    p_source_type: EXPERIOR_PENDING_REPORT_SOURCE_TYPE,
    p_source_file: input.sourceFile,
    p_file_sha256: input.fileSha256,
    p_statement_identifier: input.statementIdentifier,
    p_fs_code: input.fsCode?.trim() || null,
    p_statement_date: input.statementDate?.trim() || null,
    p_source_created_at: input.sourceCreatedAt?.trim() || null,
    p_payee_name: input.payeeName?.trim() || null,
    p_statement_amount_cents: input.statementAmountCents,
    p_escrow_cents: input.escrowCents,
  }
}

export type CreatePendingImportBatchResult =
  | { ok: true; duplicate: false; batch: CommissionPendingBatchView }
  | {
      ok: true
      duplicate: true
      batch: CommissionPendingBatchView
      originalBatchId: string
    }
  | { ok: false; message: string }

export async function createCommissionPendingImportBatch(
  supabase: SupabaseClient,
  input: CreatePendingImportBatchInput,
): Promise<CreatePendingImportBatchResult> {
  const { data, error } = await supabase.rpc(
    'create_commission_pending_import_batch',
    createCommissionPendingImportBatchRpcArgs(input),
  )
  if (error) return { ok: false, message: formatCommissionPendingImportUserError(error) }
  const row = asRecord(data)
  const batchRaw = asRecord(row?.batch)
  if (!row || row.ok !== true || !batchRaw) {
    return { ok: false, message: formatCommissionPendingImportUserError(error) }
  }
  const batch = mapBatch(batchRaw)
  if (row.duplicate === true) {
    return {
      ok: true,
      duplicate: true,
      batch,
      originalBatchId: String(row.original_batch_id ?? batch.duplicate_of_batch_id ?? ''),
    }
  }
  return { ok: true, duplicate: false, batch }
}

export type StagePendingImportRowsResult =
  | { ok: true; created: number; sameBatchExisting: number; rowIds: string[] }
  | { ok: false; message: string }

export async function stageCommissionPendingImportRows(
  supabase: SupabaseClient,
  input: { batchId: string; rows: readonly CanonicalImportRow[] },
): Promise<StagePendingImportRowsResult> {
  const { data, error } = await supabase.rpc('stage_commission_pending_import_rows', {
    p_batch_id: input.batchId,
    p_rows: input.rows,
  })
  if (error) return { ok: false, message: formatCommissionPendingImportUserError(error) }
  const row = asRecord(data)
  if (!row || row.ok !== true) {
    return { ok: false, message: COMMISSION_PENDING_IMPORT_STAGE_ERROR }
  }
  const rowIds = Array.isArray(row.row_ids) ? row.row_ids.map((id) => String(id)) : []
  return {
    ok: true,
    created: asNumber(row.created) ?? 0,
    sameBatchExisting: asNumber(row.same_batch_existing) ?? 0,
    rowIds,
  }
}

export async function fetchCommissionPendingImportBatches(
  supabase: SupabaseClient,
): Promise<CommissionPendingBatchView[]> {
  const { data, error } = await supabase
    .from('commission_pending_import_batches')
    .select(
      'id, source_type, source_file, file_sha256, statement_identifier, fs_code, statement_date, source_created_at, payee_name, statement_amount_cents, escrow_cents, import_status, duplicate_of_batch_id, row_count, accepted_count, review_count, duplicate_count, ignored_count, failed_count, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(COMMISSION_PENDING_IMPORT_LOAD_ERROR)
  return (data ?? []).map((row) => mapBatch(row as Record<string, unknown>))
}

export async function fetchCommissionPendingImportBatch(
  supabase: SupabaseClient,
  batchId: string,
): Promise<CommissionPendingBatchView | null> {
  const { data, error } = await supabase
    .from('commission_pending_import_batches')
    .select(
      'id, source_type, source_file, file_sha256, statement_identifier, fs_code, statement_date, source_created_at, payee_name, statement_amount_cents, escrow_cents, import_status, duplicate_of_batch_id, row_count, accepted_count, review_count, duplicate_count, ignored_count, failed_count, created_at',
    )
    .eq('id', batchId)
    .maybeSingle()
  if (error) throw new Error(COMMISSION_PENDING_IMPORT_LOAD_ERROR)
  return data ? mapBatch(data as Record<string, unknown>) : null
}

export async function fetchCommissionPendingImportRows(
  supabase: SupabaseClient,
  batchId: string,
): Promise<CommissionPendingRowView[]> {
  const { data, error } = await supabase
    .from('commission_pending_import_rows')
    .select(
      'id, batch_id, source_section, source_page, source_row_ordinal, source_row_key, transaction_fingerprint, transaction_date, payment_number, source_company, source_product, source_policy_number, source_writing_associate, source_client, source_agent_entered_premium_cents, source_company_calculated_premium_cents, source_gross_rate, source_factor_rate, source_net_rate, source_split_rate, source_type, source_transaction_type, source_income_cents, source_is_negative, source_is_chargeback_visual, pending_review_status, pending_review_reason, resolved_carrier_id, resolved_application_id, resolved_allocation_id, resolved_advisor_id, reviewed_by_user_id, reviewed_at, created_at',
    )
    .eq('batch_id', batchId)
    .order('source_row_ordinal', { ascending: true })
    .limit(500)
  if (error) throw new Error(COMMISSION_PENDING_IMPORT_LOAD_ERROR)
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

function embedOne(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return asRecord(value[0] ?? null)
  return asRecord(value)
}

const PENDING_ROW_COLUMNS =
  'id, batch_id, source_section, source_page, source_row_ordinal, source_row_key, transaction_fingerprint, transaction_date, payment_number, source_company, source_product, source_policy_number, source_writing_associate, source_client, source_agent_entered_premium_cents, source_company_calculated_premium_cents, source_gross_rate, source_factor_rate, source_net_rate, source_split_rate, source_type, source_transaction_type, source_income_cents, source_is_negative, source_is_chargeback_visual, pending_review_status, pending_review_reason, resolved_carrier_id, resolved_application_id, resolved_allocation_id, resolved_advisor_id, reviewed_by_user_id, reviewed_at, created_at'

const APPLICATION_CANDIDATE_SELECT =
  'id, application_number, policy_number, production_stage, household:households(display_name), carrier:carriers(name), product:insurance_products(name)'

const ALLOCATION_CANDIDATE_SELECT =
  'id, application_id, advisor_id, allocation_role, recipient_type, commission_bps, writing_contract_level, effective_to, advisor:advisor_profiles!advisor_id(display_name)'

function mapApplicationCandidate(row: Record<string, unknown>): ImportApplicationCandidate {
  const household = embedOne(row.household)
  const carrier = embedOne(row.carrier)
  const product = embedOne(row.product)
  return {
    id: String(row.id),
    applicationNumber: asString(row.application_number),
    policyNumber: asString(row.policy_number),
    clientName: asString(household?.display_name),
    carrierName: asString(carrier?.name),
    productName: asString(product?.name),
    productionStage: asString(row.production_stage),
  }
}

function mapAllocationCandidate(row: Record<string, unknown>): ImportAllocationCandidate | null {
  if (
    row.allocation_role !== 'writing' ||
    row.recipient_type !== 'advisor' ||
    row.effective_to != null ||
    !row.advisor_id
  ) {
    return null
  }
  const advisor = embedOne(row.advisor)
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    advisorId: String(row.advisor_id),
    advisorName: asString(advisor?.display_name) ?? 'Writing advisor',
    commissionBps: asNumber(row.commission_bps) ?? 0,
    writingContractLevel: asString(row.writing_contract_level),
  }
}

export async function fetchPendingApplicationCandidates(
  supabase: SupabaseClient,
  row: Pick<
    CommissionPendingRowView,
    | 'source_policy_number'
    | 'resolved_carrier_id'
    | 'source_type'
    | 'source_section'
    | 'pending_review_status'
  >,
): Promise<ImportApplicationCandidate[]> {
  const filter = pendingApplicationCandidateFilter(row)
  if (!filter.ok) return []
  let query = supabase
    .from('policy_applications')
    .select(APPLICATION_CANDIDATE_SELECT)
    .eq('policy_number_normalized', filter.policyNormalized)
    .is('deleted_at', null)
    .limit(20)
  if (filter.carrierId) {
    query = query.eq('carrier_id', filter.carrierId)
  }
  const { data, error } = await query
  if (error) throw new Error(COMMISSION_PENDING_IMPORT_LOAD_ERROR)
  return (data ?? []).map((item) => mapApplicationCandidate(item as Record<string, unknown>))
}

export async function fetchPendingLiveWritingAllocations(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<ImportAllocationCandidate[]> {
  if (!applicationId) return []
  const { data, error } = await supabase
    .from('policy_agent_allocations')
    .select(ALLOCATION_CANDIDATE_SELECT)
    .eq('application_id', applicationId)
    .eq('allocation_role', 'writing')
    .eq('recipient_type', 'advisor')
    .is('effective_to', null)
  if (error) throw new Error(COMMISSION_PENDING_IMPORT_LOAD_ERROR)
  return (data ?? [])
    .map((item) => mapAllocationCandidate(item as Record<string, unknown>))
    .filter((item): item is ImportAllocationCandidate => Boolean(item))
}

export type PendingDuplicatePeerView = CommissionPendingRowView & {
  statementIdentifier: string | null
  sourceFile: string | null
}

export async function fetchPendingFingerprintPeers(
  supabase: SupabaseClient,
  row: Pick<CommissionPendingRowView, 'id' | 'transaction_fingerprint'>,
): Promise<PendingDuplicatePeerView[]> {
  if (!row.transaction_fingerprint) return []
  const { data, error } = await supabase
    .from('commission_pending_import_rows')
    .select(
      `${PENDING_ROW_COLUMNS}, batch:commission_pending_import_batches(statement_identifier, source_file)`,
    )
    .eq('transaction_fingerprint', row.transaction_fingerprint)
    .neq('id', row.id)
    .limit(25)
  if (error) throw new Error(COMMISSION_PENDING_IMPORT_LOAD_ERROR)
  return (data ?? []).map((item) => {
    const rec = item as Record<string, unknown>
    const batch = embedOne(rec.batch)
    return {
      ...mapRow(rec),
      statementIdentifier: asString(batch?.statement_identifier),
      sourceFile: asString(batch?.source_file),
    }
  })
}

export type ReviewPendingRowResult =
  | { ok: true; row: CommissionPendingRowView }
  | { ok: false; message: string }

export function pendingReviewRpcName(): 'review_commission_pending_import_row' {
  return 'review_commission_pending_import_row'
}

export async function reviewCommissionPendingImportRow(
  supabase: SupabaseClient,
  input: {
    row: CommissionPendingRowView
    applicationId?: string | null
    allocationId?: string | null
    allocationApplicationId?: string | null
    reason?: string | null
    distinct?: boolean
  },
): Promise<ReviewPendingRowResult> {
  const built = buildAcceptPendingRequest(input)
  if (!built.ok) return { ok: false, message: built.message }
  return invokePendingReviewRpc(supabase, built.args)
}

export async function confirmDuplicatePendingImportRow(
  supabase: SupabaseClient,
  input: { row: CommissionPendingRowView; reason?: string | null },
): Promise<ReviewPendingRowResult> {
  const built = buildConfirmPendingDuplicateRequest(input)
  if (!built.ok) return { ok: false, message: built.message }
  return invokePendingReviewRpc(supabase, built.args)
}

async function invokePendingReviewRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ReviewPendingRowResult> {
  const { data, error } = await supabase.rpc('review_commission_pending_import_row', args)
  if (error) return { ok: false, message: formatCommissionPendingImportUserError(error) }
  const payload = asRecord(data)
  const rowRaw = asRecord(payload?.row)
  if (!payload || payload.ok !== true || !rowRaw) {
    return { ok: false, message: COMMISSION_PENDING_IMPORT_REVIEW_ERROR }
  }
  return { ok: true, row: mapRow(rowRaw) }
}
