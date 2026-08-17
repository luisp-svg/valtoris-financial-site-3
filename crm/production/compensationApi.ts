/**
 * Production compensation reads.
 * Expected: SELECT on policy_application_expected_compensations (034 RLS).
 * Actual: pp_writing_commission_snapshot only — never N+1, never table DML.
 */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { formatCompensationUserError } from './compensationErrors'
import type {
  WritingCommissionEvent,
  WritingCommissionTotals,
} from './compensationView'
import type { PaidCommissionListEvent } from './dashboardView'
import {
  EXPECTED_CALCULATION_STATUSES,
  EXPECTED_REVIEW_REASONS,
  WRITING_CONTRACT_LEVELS,
  type ExpectedCalculationStatus,
  type ExpectedReviewReason,
  type LiveExpectedCompensationRow,
  type WritingContractLevel,
} from './types'

const EXPECTED_SELECT = `
  id,
  application_id,
  allocation_id,
  advisor_id,
  writing_contract_level,
  writing_rate,
  compensation_base_cents,
  commission_bps,
  expected_compensation_cents,
  calculation_status,
  review_reason,
  calculated_at,
  superseded_at,
  advisor:advisor_profiles!advisor_id ( id, display_name )
`

type EmbedOne<T> = T | T[] | null

function asSingle<T>(value: EmbedOne<T>): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function asArray<T>(value: EmbedOne<T>): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
  }
  if (typeof value === 'object') return value as Record<string, unknown>
  return null
}

function asCents(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value)
  return null
}

function asRequiredCents(value: unknown): number {
  return asCents(value) ?? 0
}

function isCalculationStatus(value: unknown): value is ExpectedCalculationStatus {
  return (
    typeof value === 'string' &&
    (EXPECTED_CALCULATION_STATUSES as readonly string[]).includes(value)
  )
}

function isReviewReason(value: unknown): value is ExpectedReviewReason {
  return typeof value === 'string' && (EXPECTED_REVIEW_REASONS as readonly string[]).includes(value)
}

function isContractLevel(value: unknown): value is WritingContractLevel {
  return typeof value === 'string' && (WRITING_CONTRACT_LEVELS as readonly string[]).includes(value)
}

type RawAdvisor = { id?: string; display_name?: string | null }

type RawExpectedRow = {
  id: string
  application_id: string
  allocation_id: string
  advisor_id: string
  writing_contract_level: string | null
  writing_rate: string | number | null
  compensation_base_cents: number | string | null
  commission_bps: number | null
  expected_compensation_cents: number | string | null
  calculation_status: string
  review_reason: string | null
  calculated_at: string
  superseded_at: string | null
  advisor?: EmbedOne<RawAdvisor>
}

export function mapLiveExpectedRow(row: RawExpectedRow): LiveExpectedCompensationRow | null {
  if (!row?.id || !row.application_id || !row.allocation_id || !row.advisor_id) return null
  if (row.superseded_at) return null
  if (!isCalculationStatus(row.calculation_status)) return null
  const advisor = asSingle(row.advisor ?? null)
  return {
    id: String(row.id),
    application_id: String(row.application_id),
    allocation_id: String(row.allocation_id),
    advisor_id: String(row.advisor_id),
    advisor_display_name: advisor?.display_name ?? null,
    writing_contract_level: isContractLevel(row.writing_contract_level)
      ? row.writing_contract_level
      : null,
    writing_rate: row.writing_rate == null ? null : String(row.writing_rate),
    compensation_base_cents: asCents(row.compensation_base_cents),
    commission_bps: row.commission_bps == null ? null : Number(row.commission_bps),
    expected_compensation_cents: asCents(row.expected_compensation_cents),
    calculation_status: row.calculation_status,
    review_reason: isReviewReason(row.review_reason) ? row.review_reason : null,
    calculated_at: String(row.calculated_at),
  }
}

export async function fetchLiveExpectedCompensations(
  supabase: SupabaseClient,
  applicationIds: readonly string[],
): Promise<Map<string, LiveExpectedCompensationRow[]>> {
  const byApp = new Map<string, LiveExpectedCompensationRow[]>()
  const ids = applicationIds.filter((id) => id.trim().length > 0)
  if (ids.length === 0) return byApp

  const { data, error } = await supabase
    .from('policy_application_expected_compensations')
    .select(EXPECTED_SELECT)
    .in('application_id', ids)
    .is('superseded_at', null)

  if (error) throw error

  for (const raw of asArray(data as EmbedOne<RawExpectedRow>)) {
    const mapped = mapLiveExpectedRow(raw)
    if (!mapped) continue
    const list = byApp.get(mapped.application_id) ?? []
    list.push(mapped)
    byApp.set(mapped.application_id, list)
  }
  return byApp
}

const PAID_EVENT_SELECT =
  'id, application_id, advisor_id, event_type, amount_cents, reversed_event_id, transaction_date'

export function mapPaidCommissionListEvent(value: unknown): PaidCommissionListEvent | null {
  const row = asRecord(value)
  if (!row?.id || typeof row.application_id !== 'string') return null
  if (typeof row.event_type !== 'string') return null
  const amount = asCents(row.amount_cents)
  if (amount == null) return null
  return {
    id: String(row.id),
    application_id: String(row.application_id),
    advisor_id: typeof row.advisor_id === 'string' ? row.advisor_id : null,
    event_type: row.event_type,
    amount_cents: amount,
    reversed_event_id:
      typeof row.reversed_event_id === 'string' ? row.reversed_event_id : null,
    transaction_date: typeof row.transaction_date === 'string' ? row.transaction_date : null,
  }
}

/**
 * One batched SELECT of 035 events for the loaded application ids.
 * RLS remains in force. Never N+1 snapshot RPCs.
 */
export async function fetchPaidCommissionEvents(
  supabase: SupabaseClient,
  applicationIds: readonly string[],
): Promise<PaidCommissionListEvent[]> {
  const ids = applicationIds.filter((id) => id.trim().length > 0)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('policy_writing_commission_events')
    .select(PAID_EVENT_SELECT)
    .in('application_id', ids)

  if (error) throw error

  return asArray(data as EmbedOne<Record<string, unknown>>)
    .map(mapPaidCommissionListEvent)
    .filter((row): row is PaidCommissionListEvent => row != null)
}

export type WritingCommissionAccountView = {
  accountId: string
  advisorId: string | null
  allocationId: string | null
  expectedCentsPinned: number | null
  events: WritingCommissionEvent[]
  reconciliation: WritingCommissionTotals | null
}

export type WritingCommissionSnapshotView = {
  viewer: 'owner' | 'advisor'
  applicationId: string
  accounts: WritingCommissionAccountView[]
  unattributedEvents: WritingCommissionEvent[]
  totals: WritingCommissionTotals
}

function mapTotals(value: unknown): WritingCommissionTotals | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    expected_cents: asCents(row.expected_cents),
    gross_paid_cents: asRequiredCents(row.gross_paid_cents),
    adjustment_cents: asRequiredCents(row.adjustment_cents),
    chargeback_cents: asRequiredCents(row.chargeback_cents),
    recovery_cents: asRequiredCents(row.recovery_cents),
    net_actual_cents: asRequiredCents(row.net_actual_cents),
    remaining_expected_cents: asCents(row.remaining_expected_cents),
    variance_cents: asCents(row.variance_cents),
  }
}

function mapEvent(value: unknown): WritingCommissionEvent | null {
  const row = asRecord(value)
  if (!row?.id || typeof row.event_type !== 'string') return null
  const amount = asCents(row.amount_cents)
  if (amount == null) return null
  return {
    id: String(row.id),
    event_type: row.event_type,
    amount_cents: amount,
    transaction_date: typeof row.transaction_date === 'string' ? row.transaction_date : null,
    statement_identifier:
      typeof row.statement_identifier === 'string' ? row.statement_identifier : null,
    policy_reference: typeof row.policy_reference === 'string' ? row.policy_reference : null,
    source_file: typeof row.source_file === 'string' ? row.source_file : null,
    source_row: row.source_row == null ? null : Number(row.source_row),
    reversed_event_id:
      typeof row.reversed_event_id === 'string' ? row.reversed_event_id : null,
    import_batch_identifier:
      typeof row.import_batch_identifier === 'string' ? row.import_batch_identifier : null,
    reason: typeof row.reason === 'string' ? row.reason : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  }
}

function mapAccount(value: unknown): WritingCommissionAccountView | null {
  const row = asRecord(value)
  if (!row) return null
  const account = asRecord(row.account)
  const events = Array.isArray(row.events)
    ? row.events.map(mapEvent).filter((event): event is WritingCommissionEvent => event != null)
    : []
  return {
    accountId: account?.id ? String(account.id) : '',
    advisorId: account?.advisor_id ? String(account.advisor_id) : null,
    allocationId: account?.allocation_id ? String(account.allocation_id) : null,
    expectedCentsPinned: asCents(account?.expected_cents_pinned),
    events,
    reconciliation: mapTotals(row.reconciliation),
  }
}

const EMPTY_TOTALS: WritingCommissionTotals = {
  expected_cents: null,
  gross_paid_cents: 0,
  adjustment_cents: 0,
  chargeback_cents: 0,
  recovery_cents: 0,
  net_actual_cents: 0,
  remaining_expected_cents: null,
  variance_cents: null,
}

export function mapWritingCommissionSnapshot(
  data: unknown,
): WritingCommissionSnapshotView | null {
  const row = asRecord(data)
  if (!row) return null
  const viewer = row.viewer === 'advisor' ? 'advisor' : row.viewer === 'owner' ? 'owner' : null
  if (!viewer || typeof row.application_id !== 'string') return null

  const accounts = Array.isArray(row.accounts)
    ? row.accounts
        .map(mapAccount)
        .filter((account): account is WritingCommissionAccountView => account != null)
    : []

  const unattributed =
    viewer === 'owner' && Array.isArray(row.unattributed_events)
      ? row.unattributed_events
          .map(mapEvent)
          .filter((event): event is WritingCommissionEvent => event != null)
      : []

  return {
    viewer,
    applicationId: row.application_id,
    accounts,
    unattributedEvents: unattributed,
    totals: mapTotals(row.totals) ?? EMPTY_TOTALS,
  }
}

export type FetchWritingCommissionSnapshotResult =
  | { ok: true; snapshot: WritingCommissionSnapshotView }
  | { ok: false; message: string }

export async function fetchWritingCommissionSnapshot(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<FetchWritingCommissionSnapshotResult> {
  if (!applicationId.trim()) {
    return { ok: false, message: formatCompensationUserError({ message: 'CRM_PP:not_found' }) }
  }

  const { data, error } = await supabase.rpc('pp_writing_commission_snapshot', {
    p_application_id: applicationId,
  })

  if (error) {
    return { ok: false, message: formatCompensationUserError(error) }
  }

  const mapped = mapWritingCommissionSnapshot(data)
  if (!mapped) {
    return { ok: false, message: formatCompensationUserError(error) }
  }
  return { ok: true, snapshot: mapped }
}

export function formatCompensationDevError(context: string, err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const pg = err as PostgrestError
    return `[${context}] ${pg.message}${pg.code ? ` (${pg.code})` : ''}`
  }
  return `[${context}] ${String(err)}`
}

export { EMPTY_TOTALS as EMPTY_COMMISSION_TOTALS }
