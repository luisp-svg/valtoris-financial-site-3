/**
 * Read-only Commission dashboard Pending source.
 * SELECT accepted_pending 040 rows for the current working set.
 * Does not call create/stage/review RPCs or write 035.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMMISSION_PENDING_LIST_LOAD_ERROR } from './pending/commissionPendingErrors'
import {
  COMMISSION_PENDING_NEEDS_REVIEW_STATUSES,
  type AcceptedPendingSourceFact,
} from './commissionPendingRead'

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
  if (Array.isArray(value)) return asRecord(value[0] ?? null)
  return asRecord(value)
}

const ACCEPTED_PENDING_SELECT =
  'id, batch_id, pending_review_status, source_income_cents, transaction_date, source_writing_associate, source_client, source_policy_number, source_company, source_product, source_row_ordinal, resolved_application_id, resolved_allocation_id, resolved_advisor_id, resolved_carrier_id, created_at, batch:commission_pending_import_batches(statement_date, statement_identifier, source_file, source_created_at)'

export const COMMISSION_PENDING_DASHBOARD_PAGE_SIZE = 1000

export function mapAcceptedPendingSourceFact(value: unknown): AcceptedPendingSourceFact | null {
  const row = asRecord(value)
  if (!row) return null
  if (row.pending_review_status !== 'accepted_pending') return null
  const applicationId = asString(row.resolved_application_id)
  const allocationId = asString(row.resolved_allocation_id)
  const advisorId = asString(row.resolved_advisor_id)
  const batchId = asString(row.batch_id)
  const id = asString(row.id)
  const sourceIncomeCents = asNumber(row.source_income_cents)
  if (!id || !batchId || !applicationId || !allocationId || !advisorId || sourceIncomeCents == null) {
    return null
  }
  const batch = embedOne(row.batch)
  return {
    id,
    batchId,
    pendingReviewStatus: 'accepted_pending',
    applicationId,
    allocationId,
    advisorId,
    sourceIncomeCents,
    statementDate: asString(batch?.statement_date),
    statementIdentifier: asString(batch?.statement_identifier),
    sourceFile: asString(batch?.source_file),
    sourceCreatedAt: asString(batch?.source_created_at),
    createdAt: String(row.created_at ?? ''),
    transactionDate: asString(row.transaction_date),
    sourceWritingAssociate: asString(row.source_writing_associate),
    sourceClient: asString(row.source_client),
    sourcePolicyNumber: asString(row.source_policy_number),
    sourceCompany: asString(row.source_company),
    sourceProduct: asString(row.source_product),
    carrierId: asString(row.resolved_carrier_id),
    sourceRow: asNumber(row.source_row_ordinal),
  }
}

export type CommissionPendingDashboardSource = {
  facts: AcceptedPendingSourceFact[]
  reviewCount: number
}

async function fetchAcceptedPendingFactsPage(
  supabase: SupabaseClient,
  applicationIds: readonly string[],
  from: number,
): Promise<{ facts: AcceptedPendingSourceFact[]; fetchedCount: number }> {
  const to = from + COMMISSION_PENDING_DASHBOARD_PAGE_SIZE - 1
  const { data, error } = await supabase
    .from('commission_pending_import_rows')
    .select(ACCEPTED_PENDING_SELECT)
    .eq('pending_review_status', 'accepted_pending')
    .in('resolved_application_id', applicationIds)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw new Error(COMMISSION_PENDING_LIST_LOAD_ERROR)
  const rows = data ?? []
  return {
    fetchedCount: rows.length,
    facts: rows
      .map((row) => mapAcceptedPendingSourceFact(row))
      .filter((row): row is AcceptedPendingSourceFact => Boolean(row)),
  }
}

export async function fetchCommissionPendingDashboardSource(
  supabase: SupabaseClient,
  applicationIds: readonly string[],
): Promise<CommissionPendingDashboardSource> {
  const ids = applicationIds.filter((id) => id.trim().length > 0)
  const reviewCountPromise = fetchPendingNeedsReviewCount(supabase)
  if (ids.length === 0) {
    return { facts: [], reviewCount: await reviewCountPromise }
  }

  const facts: AcceptedPendingSourceFact[] = []
  let from = 0
  while (true) {
    const page = await fetchAcceptedPendingFactsPage(supabase, ids, from)
    facts.push(...page.facts)
    if (page.fetchedCount < COMMISSION_PENDING_DASHBOARD_PAGE_SIZE) break
    from += COMMISSION_PENDING_DASHBOARD_PAGE_SIZE
  }

  return {
    facts,
    reviewCount: await reviewCountPromise,
  }
}

export async function fetchPendingNeedsReviewCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('commission_pending_import_rows')
    .select('id', { count: 'exact', head: true })
    .in('pending_review_status', [...COMMISSION_PENDING_NEEDS_REVIEW_STATUSES])
  if (error) throw new Error(COMMISSION_PENDING_LIST_LOAD_ERROR)
  return count ?? 0
}
