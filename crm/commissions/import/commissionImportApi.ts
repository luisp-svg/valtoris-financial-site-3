/**
 * Phase 3A commission import API.
 * Creates/stages 036 batches through existing owner RPCs.
 * Reads batches/rows with SELECT + RLS only.
 * Does not call review, post, alias, or 035 write RPCs.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { EXPERIOR_PAID_REPORT_SOURCE_TYPE } from './commissionImportConstants'
import type { CanonicalImportRow } from './commissionImportCsv'
import {
  COMMISSION_IMPORT_LOAD_ERROR,
  COMMISSION_IMPORT_STAGE_ERROR,
  formatCommissionImportUserError,
} from './commissionImportErrors'
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
      .select('id, application_number, policy_number, household:households(display_name)')
      .in('id', applicationIds)
    for (const row of data ?? []) {
      const rec = row as {
        id: string
        application_number?: string | null
        policy_number?: string | null
        household?: { display_name?: string | null } | { display_name?: string | null }[] | null
      }
      const household = Array.isArray(rec.household) ? rec.household[0] : rec.household
      result.set(rec.id, {
        applicationId: rec.id,
        applicationNumber: rec.application_number ?? null,
        policyNumber: rec.policy_number ?? null,
        clientName: household?.display_name ?? null,
        advisorName: null,
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
    }
    result.set(row.resolved_application_id, {
      ...current,
      advisorName: row.resolved_advisor_id ? advisorNames.get(row.resolved_advisor_id) ?? null : current.advisorName,
    })
  }
  return result
}
