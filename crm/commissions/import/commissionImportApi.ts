/**
 * Phase 3A/3B commission import API.
 * Creates/stages 036 batches and reviews/posts through existing owner RPCs.
 * Reads batches/rows/candidates with SELECT + RLS only.
 * Does not call 035 write RPCs, alias RPCs, or table DML.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPERIOR_PAID_REPORT_SOURCE_TYPE } from './commissionImportConstants'
import type { CanonicalImportRow } from './commissionImportCsv'
import {
  COMMISSION_IMPORT_LOAD_ERROR,
  COMMISSION_IMPORT_POST_ERROR,
  COMMISSION_IMPORT_REVIEW_ERROR,
  COMMISSION_IMPORT_STAGE_ERROR,
  formatCommissionImportUserError,
} from './commissionImportErrors'
import {
  buildConfirmDuplicateRequest,
  buildPostImportRowRequest,
  buildReadyReviewRequest,
  importApplicationCandidateFilter,
  isLiveWritingAllocation,
  type DuplicateReviewRequest,
  type ReadyReviewRequest,
} from './commissionImportReview'
import type { CommissionImportBatchView, CommissionImportRowView, ResolvedImportContext } from './commissionImportView'

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

function embedOne(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }
  return asRecord(value)
}

function mapBatch(row: Record<string, unknown>): CommissionImportBatchView {
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
    import_status: row.import_status === 'duplicate_file' ? 'duplicate_file' : 'open',
    duplicate_of_batch_id: asString(row.duplicate_of_batch_id),
    row_count: asNumber(row.row_count) ?? 0,
    ready_count: asNumber(row.ready_count) ?? 0,
    review_count: asNumber(row.review_count) ?? 0,
    duplicate_count: asNumber(row.duplicate_count) ?? 0,
    ignored_count: asNumber(row.ignored_count) ?? 0,
    posted_count: asNumber(row.posted_count) ?? 0,
    failed_count: asNumber(row.failed_count) ?? 0,
    created_at: String(row.created_at ?? ''),
  }
}

function mapRow(row: Record<string, unknown>): CommissionImportRowView {
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
    agent_entered_premium_cents: asNumber(row.agent_entered_premium_cents),
    company_calculated_premium_cents: asNumber(row.company_calculated_premium_cents),
    source_gross_rate: asNumber(row.source_gross_rate),
    source_factor_rate: asNumber(row.source_factor_rate),
    source_net_rate: asNumber(row.source_net_rate),
    source_split_rate: asNumber(row.source_split_rate),
    source_type: asString(row.source_type),
    source_transaction_type: asString(row.source_transaction_type),
    source_income_cents: asNumber(row.source_income_cents) ?? 0,
    source_is_chargeback_visual: row.source_is_chargeback_visual === true,
    review_status: String(row.review_status ?? ''),
    review_reason: asString(row.review_reason),
    resolved_carrier_id: asString(row.resolved_carrier_id),
    resolved_application_id: asString(row.resolved_application_id),
    resolved_allocation_id: asString(row.resolved_allocation_id),
    resolved_advisor_id: asString(row.resolved_advisor_id),
    resolved_event_type: asString(row.resolved_event_type),
    posted_commission_event_id: asString(row.posted_commission_event_id),
    created_at: String(row.created_at ?? ''),
  }
}

const BATCH_COLUMNS =
  'id, source_type, source_file, file_sha256, statement_identifier, fs_code, statement_date, source_created_at, payee_name, import_status, duplicate_of_batch_id, row_count, ready_count, review_count, duplicate_count, ignored_count, posted_count, failed_count, created_at'

const ROW_COLUMNS =
  'id, batch_id, source_section, source_page, source_row_ordinal, source_row_key, transaction_fingerprint, transaction_date, payment_number, source_company, source_product, source_policy_number, source_writing_associate, source_client, agent_entered_premium_cents, company_calculated_premium_cents, source_gross_rate, source_factor_rate, source_net_rate, source_split_rate, source_type, source_transaction_type, source_income_cents, source_is_chargeback_visual, review_status, review_reason, resolved_carrier_id, resolved_application_id, resolved_allocation_id, resolved_advisor_id, resolved_event_type, posted_commission_event_id, created_at'

export type CreateImportBatchInput = {
  sourceFile: string
  fileSha256: string
  statementIdentifier: string
  fsCode?: string | null
  statementDate?: string | null
  sourceCreatedAt?: string | null
  payeeName?: string | null
}

export function createCommissionImportBatchRpcArgs(input: CreateImportBatchInput): Record<string, unknown> {
  return {
    p_source_type: EXPERIOR_PAID_REPORT_SOURCE_TYPE,
    p_source_file: input.sourceFile.trim(),
    p_file_sha256: input.fileSha256,
    p_statement_identifier: input.statementIdentifier.trim(),
    p_fs_code: input.fsCode?.trim() || null,
    p_statement_date: input.statementDate?.trim() || null,
    p_source_created_at: input.sourceCreatedAt?.trim() || null,
    p_payee_name: input.payeeName?.trim() || null,
  }
}

export type CreateImportBatchResult =
  | { ok: true; duplicate: false; batch: CommissionImportBatchView }
  | {
      ok: true
      duplicate: true
      batch: CommissionImportBatchView
      originalBatchId: string
    }
  | { ok: false; message: string }

export async function createCommissionImportBatch(
  supabase: SupabaseClient,
  input: CreateImportBatchInput,
): Promise<CreateImportBatchResult> {
  const { data, error } = await supabase.rpc(
    'create_commission_import_batch',
    createCommissionImportBatchRpcArgs(input),
  )
  if (error) return { ok: false, message: formatCommissionImportUserError(error) }
  const row = asRecord(data)
  const batchRaw = asRecord(row?.batch)
  if (!row || row.ok !== true || !batchRaw) {
    return { ok: false, message: formatCommissionImportUserError(error) }
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

export type StageImportRowsResult =
  | { ok: true; created: number; sameBatchExisting: number; rowIds: string[] }
  | { ok: false; message: string }

export async function stageCommissionImportRows(
  supabase: SupabaseClient,
  input: { batchId: string; rows: readonly CanonicalImportRow[] },
): Promise<StageImportRowsResult> {
  const { data, error } = await supabase.rpc('stage_commission_import_rows', {
    p_batch_id: input.batchId,
    p_rows: input.rows,
  })
  if (error) return { ok: false, message: formatCommissionImportUserError(error) }
  const row = asRecord(data)
  if (!row || row.ok !== true) {
    return { ok: false, message: COMMISSION_IMPORT_STAGE_ERROR }
  }
  const rowIds = Array.isArray(row.row_ids) ? row.row_ids.map((id) => String(id)) : []
  return {
    ok: true,
    created: asNumber(row.created) ?? 0,
    sameBatchExisting: asNumber(row.same_batch_existing) ?? 0,
    rowIds,
  }
}

export async function fetchCommissionImportBatches(
  supabase: SupabaseClient,
): Promise<CommissionImportBatchView[]> {
  const { data, error } = await supabase
    .from('commission_import_batches')
    .select(BATCH_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(COMMISSION_IMPORT_LOAD_ERROR)
  return (data ?? []).map((row) => mapBatch(row as Record<string, unknown>))
}

export async function fetchCommissionImportBatch(
  supabase: SupabaseClient,
  batchId: string,
): Promise<CommissionImportBatchView | null> {
  const { data, error } = await supabase
    .from('commission_import_batches')
    .select(BATCH_COLUMNS)
    .eq('id', batchId)
    .maybeSingle()
  if (error) throw new Error(COMMISSION_IMPORT_LOAD_ERROR)
  return data ? mapBatch(data as Record<string, unknown>) : null
}

export async function fetchCommissionImportRows(
  supabase: SupabaseClient,
  batchId: string,
): Promise<CommissionImportRowView[]> {
  const { data, error } = await supabase
    .from('commission_import_rows')
    .select(ROW_COLUMNS)
    .eq('batch_id', batchId)
    .order('source_section', { ascending: true })
    .order('source_row_ordinal', { ascending: true })
  if (error) throw new Error(COMMISSION_IMPORT_LOAD_ERROR)
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function fetchResolvedImportContext(
  supabase: SupabaseClient,
  rows: readonly CommissionImportRowView[],
): Promise<Map<string, ResolvedImportContext>> {
  const applicationIds = [
    ...new Set(rows.map((row) => row.resolved_application_id).filter((id): id is string => Boolean(id))),
  ]
  const advisorIds = [
    ...new Set(rows.map((row) => row.resolved_advisor_id).filter((id): id is string => Boolean(id))),
  ]
  const result = new Map<string, ResolvedImportContext>()
  if (applicationIds.length === 0 && advisorIds.length === 0) return result

  const advisorNames = new Map<string, string>()
  if (advisorIds.length > 0) {
    const { data } = await supabase
      .from('advisor_profiles')
      .select('id, display_name')
      .in('id', advisorIds)
    for (const row of data ?? []) {
      const rec = row as { id: string; display_name?: string | null }
      if (rec.display_name) advisorNames.set(rec.id, rec.display_name)
    }
  }

  if (applicationIds.length > 0) {
    const { data } = await supabase
      .from('policy_applications')
      .select(
        'id, application_number, policy_number, production_stage, household:households(display_name), carrier:carriers(name), product:insurance_products(name)',
      )
      .in('id', applicationIds)
    for (const row of data ?? []) {
      const rec = row as Record<string, unknown>
      const household = embedOne(rec.household)
      const carrier = embedOne(rec.carrier)
      const product = embedOne(rec.product)
      result.set(String(rec.id), {
        applicationId: String(rec.id),
        applicationNumber: asString(rec.application_number),
        policyNumber: asString(rec.policy_number),
        clientName: asString(household?.display_name),
        advisorName: null,
        carrierName: asString(carrier?.name),
        productName: asString(product?.name),
        productionStage: asString(rec.production_stage),
      })
    }
  }

  for (const row of rows) {
    if (!row.resolved_application_id) continue
    const current = result.get(row.resolved_application_id) ?? {
      applicationId: row.resolved_application_id,
      applicationNumber: null,
      policyNumber: null,
      clientName: null,
      advisorName: null,
      carrierName: null,
      productName: null,
      productionStage: null,
    }
    result.set(row.resolved_application_id, {
      ...current,
      advisorName: row.resolved_advisor_id ? advisorNames.get(row.resolved_advisor_id) ?? null : current.advisorName,
    })
  }
  return result
}

export type ImportApplicationCandidate = {
  id: string
  applicationNumber: string | null
  policyNumber: string | null
  clientName: string | null
  carrierName: string | null
  productName: string | null
  productionStage: string | null
}

export type ImportAllocationCandidate = {
  id: string
  applicationId: string
  advisorId: string
  advisorName: string
  commissionBps: number
  writingContractLevel: string | null
}

export type PostedImportEventView = {
  id: string
  eventType: string
  amountCents: number
  transactionDate: string | null
  createdAt: string | null
  statementIdentifier: string | null
  sourceFile: string | null
  allocationId: string | null
  advisorId: string | null
  advisorName: string | null
}

export type DuplicatePeerView = CommissionImportRowView & {
  statementIdentifier: string | null
  sourceFile: string | null
}

const APPLICATION_CANDIDATE_SELECT =
  'id, application_number, policy_number, production_stage, household:households(display_name), carrier:carriers(name), product:insurance_products(name)'

const ALLOCATION_CANDIDATE_SELECT =
  'id, application_id, advisor_id, allocation_role, recipient_type, commission_bps, writing_contract_level, effective_to, advisor:advisor_profiles!advisor_id(display_name)'

const POSTED_EVENT_SELECT =
  'id, event_type, amount_cents, transaction_date, created_at, statement_identifier, source_file, allocation_id, advisor_id, advisor:advisor_profiles!advisor_id(display_name)'

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
  if (!isLiveWritingAllocation(row)) return null
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

export async function fetchImportApplicationCandidates(
  supabase: SupabaseClient,
  row: Pick<
    CommissionImportRowView,
    'source_policy_number' | 'resolved_carrier_id' | 'source_type' | 'source_section' | 'review_status'
  >,
): Promise<ImportApplicationCandidate[]> {
  const filter = importApplicationCandidateFilter(row)
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
  if (error) throw new Error(COMMISSION_IMPORT_LOAD_ERROR)
  return (data ?? []).map((item) => mapApplicationCandidate(item as Record<string, unknown>))
}

export async function fetchLiveWritingAllocations(
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
  if (error) throw new Error(COMMISSION_IMPORT_LOAD_ERROR)
  return (data ?? [])
    .map((item) => mapAllocationCandidate(item as Record<string, unknown>))
    .filter((item): item is ImportAllocationCandidate => Boolean(item))
}

export async function fetchFingerprintPeers(
  supabase: SupabaseClient,
  row: Pick<CommissionImportRowView, 'id' | 'transaction_fingerprint'>,
): Promise<DuplicatePeerView[]> {
  if (!row.transaction_fingerprint) return []
  const { data, error } = await supabase
    .from('commission_import_rows')
    .select(`${ROW_COLUMNS}, batch:commission_import_batches(statement_identifier, source_file)`)
    .eq('transaction_fingerprint', row.transaction_fingerprint)
    .neq('id', row.id)
    .limit(25)
  if (error) throw new Error(COMMISSION_IMPORT_LOAD_ERROR)
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

export async function fetchPostedImportEvents(
  supabase: SupabaseClient,
  eventIds: readonly string[],
): Promise<Map<string, PostedImportEventView>> {
  const ids = [...new Set(eventIds.filter(Boolean))]
  const result = new Map<string, PostedImportEventView>()
  if (ids.length === 0) return result
  const { data, error } = await supabase
    .from('policy_writing_commission_events')
    .select(POSTED_EVENT_SELECT)
    .in('id', ids)
  if (error) throw new Error(COMMISSION_IMPORT_LOAD_ERROR)
  for (const item of data ?? []) {
    const rec = item as Record<string, unknown>
    const advisor = embedOne(rec.advisor)
    result.set(String(rec.id), {
      id: String(rec.id),
      eventType: String(rec.event_type ?? ''),
      amountCents: asNumber(rec.amount_cents) ?? 0,
      transactionDate: asString(rec.transaction_date),
      createdAt: asString(rec.created_at),
      statementIdentifier: asString(rec.statement_identifier),
      sourceFile: asString(rec.source_file),
      allocationId: asString(rec.allocation_id),
      advisorId: asString(rec.advisor_id),
      advisorName: asString(advisor?.display_name),
    })
  }
  return result
}

export type ReviewImportRowInput = {
  row: CommissionImportRowView
  applicationId?: string | null
  allocationId?: string | null
  allocationApplicationId?: string | null
  eventType?: string | null
  reason?: string | null
  distinct?: boolean
}

export type ReviewImportRowResult =
  | { ok: true; row: CommissionImportRowView }
  | { ok: false; message: string }

export function readyReviewRpcName(): 'review_commission_import_row' {
  return 'review_commission_import_row'
}

export function postImportRpcName(): 'post_commission_import_row' {
  return 'post_commission_import_row'
}

export async function reviewCommissionImportRow(
  supabase: SupabaseClient,
  input: ReviewImportRowInput,
): Promise<ReviewImportRowResult> {
  const built = buildReadyReviewRequest({
    row: input.row,
    applicationId: input.applicationId,
    allocationId: input.allocationId,
    allocationApplicationId: input.allocationApplicationId,
    eventType: input.eventType,
    reason: input.reason,
    distinct: input.distinct,
  })
  if (!built.ok) return { ok: false, message: built.message }
  return invokeReviewRpc(supabase, built.args)
}

export async function confirmDuplicateImportRow(
  supabase: SupabaseClient,
  input: { row: CommissionImportRowView; reason?: string | null },
): Promise<ReviewImportRowResult> {
  const built = buildConfirmDuplicateRequest(input)
  if (!built.ok) return { ok: false, message: built.message }
  return invokeReviewRpc(supabase, built.args)
}

async function invokeReviewRpc(
  supabase: SupabaseClient,
  args: ReadyReviewRequest | DuplicateReviewRequest,
): Promise<ReviewImportRowResult> {
  const { data, error } = await supabase.rpc('review_commission_import_row', args)
  if (error) return { ok: false, message: formatCommissionImportUserError(error) }
  const payload = asRecord(data)
  const rowRaw = asRecord(payload?.row)
  if (!payload || payload.ok !== true || !rowRaw) {
    return { ok: false, message: COMMISSION_IMPORT_REVIEW_ERROR }
  }
  return { ok: true, row: mapRow(rowRaw) }
}

export type PostImportRowResult =
  | { ok: true; duplicate: boolean; eventId: string | null; row: CommissionImportRowView }
  | { ok: false; message: string }

export async function postCommissionImportRow(
  supabase: SupabaseClient,
  input: { row: CommissionImportRowView; reason: string },
): Promise<PostImportRowResult> {
  const built = buildPostImportRowRequest(input)
  if (!built.ok) return { ok: false, message: built.message }
  const { data, error } = await supabase.rpc('post_commission_import_row', built.args)
  if (error) return { ok: false, message: formatCommissionImportUserError(error) }
  const payload = asRecord(data)
  const rowRaw = asRecord(payload?.row)
  const eventRaw = asRecord(payload?.event)
  if (!payload || payload.ok !== true || !rowRaw) {
    return { ok: false, message: COMMISSION_IMPORT_POST_ERROR }
  }
  return {
    ok: true,
    duplicate: payload.duplicate === true,
    eventId: asString(eventRaw?.id) ?? asString(rowRaw.posted_commission_event_id),
    row: mapRow(rowRaw),
  }
}
