import type { SupabaseClient } from '@supabase/supabase-js'
import type { ManualCommissionEventType } from './commissionMoney'
import {
  commissionWriteErrorCode,
  formatCommissionWriteUserError,
} from './commissionWriteErrors'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export type RecordCommissionEventArgs = {
  applicationId: string
  eventType: ManualCommissionEventType
  amountCents: number
  reason: string
  idempotencyKey: string
  allocationId: string
  expectedCompensationId?: string | null
  carrierId?: string | null
  carrierTransactionId?: string | null
  statementIdentifier?: string | null
  statementDate?: string | null
  transactionDate: string
  policyReference?: string | null
  sourceFile?: string | null
  sourceRow?: number | null
  rawDescription?: string | null
  preIssue: boolean
}

export type CommissionWriteSuccess = {
  ok: true
  duplicate: boolean
  data: Record<string, unknown>
}

export type CommissionWriteFailure = {
  ok: false
  duplicate: false
  code: string | null
  message: string
}

export type CommissionWriteResult = CommissionWriteSuccess | CommissionWriteFailure

function mapRpcResult(
  data: unknown,
  error: unknown,
): CommissionWriteResult {
  if (error) {
    return {
      ok: false,
      duplicate: false,
      code: commissionWriteErrorCode(error),
      message: formatCommissionWriteUserError(error),
    }
  }
  const row = asRecord(data)
  if (!row || row.ok !== true) {
    return {
      ok: false,
      duplicate: false,
      code: null,
      message: formatCommissionWriteUserError(error),
    }
  }
  return {
    ok: true,
    duplicate: row.duplicate === true,
    data: row,
  }
}

export function recordCommissionEventRpcArgs(input: RecordCommissionEventArgs): Record<string, unknown> {
  return {
    p_application_id: input.applicationId,
    p_event_type: input.eventType,
    p_amount_cents: input.amountCents,
    p_reason: input.reason.trim(),
    p_idempotency_key: input.idempotencyKey,
    p_allocation_id: input.allocationId,
    p_expected_compensation_id: emptyToNull(input.expectedCompensationId ?? null),
    p_carrier_id: emptyToNull(input.carrierId ?? null),
    p_carrier_transaction_id: emptyToNull(input.carrierTransactionId),
    p_statement_identifier: emptyToNull(input.statementIdentifier),
    p_statement_date: emptyToNull(input.statementDate),
    p_transaction_date: input.transactionDate,
    p_policy_reference: emptyToNull(input.policyReference),
    p_source_file: emptyToNull(input.sourceFile),
    p_source_row: input.sourceRow ?? null,
    p_raw_description: emptyToNull(input.rawDescription),
  }
}

export async function recordPolicyWritingCommissionEvent(
  supabase: SupabaseClient,
  input: RecordCommissionEventArgs,
): Promise<CommissionWriteResult> {
  const rpcName = input.preIssue
    ? 'record_policy_writing_commission_event_pre_issue'
    : 'record_policy_writing_commission_event'
  const { data, error } = await supabase.rpc(rpcName, recordCommissionEventRpcArgs(input))
  return mapRpcResult(data, error)
}

export async function reversePolicyWritingCommissionEvent(
  supabase: SupabaseClient,
  input: { eventId: string; reason: string },
): Promise<CommissionWriteResult> {
  const { data, error } = await supabase.rpc('reverse_policy_writing_commission_event', {
    p_event_id: input.eventId,
    p_reason: input.reason.trim(),
  })
  return mapRpcResult(data, error)
}

export type AttributionLine = {
  allocationId: string
  amountCents: number
}

export async function attributeUnattributedCommissionEvent(
  supabase: SupabaseClient,
  input: {
    eventId: string
    attributions: readonly AttributionLine[]
    reason: string
    idempotencyKey: string
  },
): Promise<CommissionWriteResult> {
  const { data, error } = await supabase.rpc('attribute_unattributed_commission_event', {
    p_event_id: input.eventId,
    p_attributions: input.attributions.map((line) => ({
      allocation_id: line.allocationId,
      amount_cents: line.amountCents,
    })),
    p_reason: input.reason.trim(),
    p_idempotency_key: input.idempotencyKey,
  })
  return mapRpcResult(data, error)
}
