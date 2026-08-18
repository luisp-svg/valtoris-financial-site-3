import { parseSignedDollarCents } from '../import/commissionImportMoney'

export const COMMISSION_PENDING_REVIEW_STATUSES = [
  'accepted_pending',
  'duplicate',
  'review_duplicate_candidate',
  'review_policy_match',
  'review_advisor_match',
  'review_split_attribution',
  'ignored_nonwriting',
  'ignored_nonpolicy',
  'invalid_amount',
  'invalid_source_identity',
] as const

export type CommissionPendingReviewStatus = (typeof COMMISSION_PENDING_REVIEW_STATUSES)[number]

export type CommissionPendingRowBucket = 'accepted' | 'review' | 'ignored' | 'duplicate'

export type CommissionPendingBatchView = {
  id: string
  source_type: string
  source_file: string
  file_sha256: string
  statement_identifier: string
  fs_code: string | null
  statement_date: string | null
  source_created_at: string | null
  payee_name: string | null
  statement_amount_cents: number | null
  escrow_cents: number | null
  import_status: 'open' | 'duplicate_file'
  duplicate_of_batch_id: string | null
  row_count: number
  accepted_count: number
  review_count: number
  duplicate_count: number
  ignored_count: number
  failed_count: number
  created_at: string
}

export type CommissionPendingRowView = {
  id: string
  batch_id: string
  source_section: string
  source_page: number | null
  source_row_ordinal: number
  source_row_key: string
  transaction_fingerprint: string
  transaction_date: string | null
  payment_number: string | null
  source_company: string | null
  source_product: string | null
  source_policy_number: string | null
  source_writing_associate: string | null
  source_client: string | null
  source_agent_entered_premium_cents: number | null
  source_company_calculated_premium_cents: number | null
  source_gross_rate: number | null
  source_factor_rate: number | null
  source_net_rate: number | null
  source_split_rate: number | null
  source_type: string | null
  source_transaction_type: string | null
  source_income_cents: number
  source_is_negative: boolean
  source_is_chargeback_visual: boolean
  pending_review_status: CommissionPendingReviewStatus | string
  pending_review_reason: string | null
  resolved_carrier_id: string | null
  resolved_application_id: string | null
  resolved_allocation_id: string | null
  resolved_advisor_id: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  accepted_pending: 'Accepted pending',
  review_policy_match: 'Policy match needed',
  review_advisor_match: 'Writing advisor match needed',
  review_split_attribution: 'Writing allocation selection needed',
  review_duplicate_candidate: 'Possible duplicate',
  ignored_nonwriting: 'Ignored — non-writing compensation',
  ignored_nonpolicy: 'Ignored — non-policy commission',
  duplicate: 'Duplicate source transaction',
  invalid_amount: 'Invalid amount',
  invalid_source_identity: 'Invalid source identity',
}

const REASON_LABELS: Record<string, string> = {
  additional_commissions: 'This row is an additional non-policy commission.',
  income_cents_required_positive: 'Pending Income must be a positive amount.',
  missing_source_identity: 'This row is missing enough source identity to import.',
  unclassified: 'This row could not be classified automatically.',
  unsupported_source_type: 'This source type is not a writing-advisor commission type.',
  override_nonwriting: 'Override compensation is excluded from writing-advisor pending.',
  unknown_carrier: 'The source company does not match an active carrier.',
  missing_policy_number: 'A policy number is required to match this row.',
  policy_not_found: 'No Production application matches this carrier and policy number.',
  multiple_policy_matches: 'More than one Production application matches this carrier and policy number.',
  missing_writing_associate: 'A writing associate is required to match this row.',
  unknown_writing_associate: 'The writing associate does not match the statement payee household.',
  no_writing_allocation: 'This application has no live writing allocation.',
  multiple_writing_allocations: 'Multiple writing allocations exist.',
  exact_carrier_policy_single_writing_allocation:
    'Matched carrier, policy, and a single writing allocation.',
  cross_report_payment_identity: 'This installment already matches a previous pending import by payment identity.',
  cross_report_fingerprint_ambiguous: 'This row looks like another imported pending transaction and needs review.',
}

export function formatPendingReviewStatus(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
}

export function formatPendingReviewReason(reason: string | null | undefined): string | null {
  if (!reason) return null
  return REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
}

export function pendingRowBucket(
  row: Pick<CommissionPendingRowView, 'pending_review_status'>,
): CommissionPendingRowBucket {
  if (row.pending_review_status === 'accepted_pending') return 'accepted'
  if (
    row.pending_review_status === 'duplicate' ||
    row.pending_review_status === 'review_duplicate_candidate'
  ) {
    return 'duplicate'
  }
  if (
    row.pending_review_status === 'ignored_nonwriting' ||
    row.pending_review_status === 'ignored_nonpolicy'
  ) {
    return 'ignored'
  }
  return 'review'
}

export function isOverrideSourceType(sourceType: string | null | undefined): boolean {
  return (sourceType ?? '').trim().toLowerCase() === 'override'
}

export function isAdditionalCommissionSection(section: string | null | undefined): boolean {
  return section === 'additional_commissions'
}

export type PendingAmountSummary = {
  sourceIncomeCents: number
  acceptedIncomeCents: number
  reviewIncomeCents: number
  ignoredIncomeCents: number
  duplicateIncomeCents: number
  acceptedCount: number
  reviewCount: number
  ignoredCount: number
  duplicateCount: number
}

export function summarizePendingRowAmounts(
  rows: readonly CommissionPendingRowView[],
): PendingAmountSummary {
  const summary: PendingAmountSummary = {
    sourceIncomeCents: 0,
    acceptedIncomeCents: 0,
    reviewIncomeCents: 0,
    ignoredIncomeCents: 0,
    duplicateIncomeCents: 0,
    acceptedCount: 0,
    reviewCount: 0,
    ignoredCount: 0,
    duplicateCount: 0,
  }
  for (const row of rows) {
    summary.sourceIncomeCents += row.source_income_cents
    const bucket = pendingRowBucket(row)
    if (bucket === 'accepted') {
      summary.acceptedIncomeCents += row.source_income_cents
      summary.acceptedCount += 1
    } else if (bucket === 'review') {
      summary.reviewIncomeCents += row.source_income_cents
      summary.reviewCount += 1
    } else if (bucket === 'ignored') {
      summary.ignoredIncomeCents += row.source_income_cents
      summary.ignoredCount += 1
    } else {
      summary.duplicateIncomeCents += row.source_income_cents
      summary.duplicateCount += 1
    }
  }
  return summary
}

export function rowsForPendingBucket(
  rows: readonly CommissionPendingRowView[],
  bucket: CommissionPendingRowBucket,
): CommissionPendingRowView[] {
  return rows.filter((row) => pendingRowBucket(row) === bucket)
}

export function formatPendingSectionLabel(section: string | null | undefined): string {
  if (section === 'insurance') return 'Insurance'
  if (section === 'insurance_paid_over_12_months') return 'Paid over 12 months'
  if (section === 'additional_commissions') return 'Additional commissions'
  return section || '—'
}

export function canStageIntoPendingBatch(
  batch: Pick<CommissionPendingBatchView, 'import_status'>,
): boolean {
  return batch.import_status === 'open'
}

export function canRetryStageIntoOpenPendingBatch(
  batch: Pick<CommissionPendingBatchView, 'import_status' | 'row_count'> | null | undefined,
): boolean {
  return Boolean(batch && batch.import_status === 'open' && batch.row_count === 0)
}

export function shouldShowPendingImportEntry(role: string | null | undefined): boolean {
  return role === 'owner'
}

export function formatPendingBatchSourceLabel(sourceType: string | null | undefined): string {
  if (sourceType === 'experior_pending_report') return 'Experior Pending Report'
  return sourceType || '—'
}

export function parseOptionalMetadataCents(
  raw: string,
): { ok: true; cents: number | null } | { ok: false; message: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, cents: null }
  const parsed = parseSignedDollarCents(trimmed)
  if (!parsed.ok) {
    return { ok: false, message: 'Enter a valid dollar amount, or leave blank.' }
  }
  if (parsed.cents < 0) {
    return { ok: false, message: 'Statement amount and escrow cannot be negative.' }
  }
  return { ok: true, cents: parsed.cents }
}
