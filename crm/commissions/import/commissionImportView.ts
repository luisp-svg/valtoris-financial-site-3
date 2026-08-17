export const COMMISSION_IMPORT_REVIEW_STATUSES = [
  'ready_to_post',
  'duplicate',
  'review_duplicate_candidate',
  'review_policy_match',
  'review_advisor_match',
  'review_split_attribution',
  'review_transaction_type',
  'ignored_nonwriting',
  'ignored_nonpolicy',
  'invalid_amount',
  'invalid_source_identity',
] as const

export type CommissionImportReviewStatus = (typeof COMMISSION_IMPORT_REVIEW_STATUSES)[number]

export type CommissionImportRowBucket = 'ready' | 'review' | 'ignored' | 'duplicate' | 'posted'

export type CommissionImportBatchView = {
  id: string
  source_type: string
  source_file: string
  file_sha256: string
  statement_identifier: string
  fs_code: string | null
  statement_date: string | null
  source_created_at: string | null
  payee_name: string | null
  import_status: 'open' | 'duplicate_file'
  duplicate_of_batch_id: string | null
  row_count: number
  ready_count: number
  review_count: number
  duplicate_count: number
  ignored_count: number
  posted_count: number
  failed_count: number
  created_at: string
}

export type CommissionImportRowView = {
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
  agent_entered_premium_cents: number | null
  company_calculated_premium_cents: number | null
  source_gross_rate: number | null
  source_factor_rate: number | null
  source_net_rate: number | null
  source_split_rate: number | null
  source_type: string | null
  source_transaction_type: string | null
  source_income_cents: number
  source_is_chargeback_visual: boolean
  review_status: CommissionImportReviewStatus | string
  review_reason: string | null
  resolved_carrier_id: string | null
  resolved_application_id: string | null
  resolved_allocation_id: string | null
  resolved_advisor_id: string | null
  resolved_event_type: string | null
  posted_commission_event_id: string | null
  created_at: string
}

export type ResolvedImportContext = {
  applicationId: string
  applicationNumber: string | null
  policyNumber: string | null
  clientName: string | null
  advisorName: string | null
}

const STATUS_LABELS: Record<string, string> = {
  ready_to_post: 'Ready to post',
  review_policy_match: 'Policy match needed',
  review_advisor_match: 'Writing advisor match needed',
  review_split_attribution: 'Writing allocation selection needed',
  review_transaction_type: 'Transaction type review needed',
  review_duplicate_candidate: 'Possible duplicate',
  ignored_nonwriting: 'Ignored — non-writing compensation',
  ignored_nonpolicy: 'Ignored — non-policy commission',
  duplicate: 'Duplicate source transaction',
  invalid_amount: 'Invalid amount',
  invalid_source_identity: 'Invalid source identity',
}

const REASON_LABELS: Record<string, string> = {
  additional_commissions: 'This row is an additional non-policy commission.',
  income_cents_required_nonzero: 'Income must be a nonzero amount.',
  missing_source_identity: 'This row is missing enough source identity to import.',
  unclassified: 'This row could not be classified automatically.',
  unsupported_source_type: 'This source type is not a writing-advisor commission type.',
  override_nonwriting: 'Override compensation is excluded from writing-advisor commission.',
  household_override_split: 'Household override row needs writing-allocation review. It is not treated as writing-advisor compensation.',
  household_override_ambiguous:
    'Household override row needs writing-advisor review. It is not treated as writing-advisor compensation.',
  negative_without_chargeback_visual: 'Negative transaction needs classification. It is not a confirmed chargeback.',
  unknown_carrier: 'The source company does not match an active carrier.',
  missing_policy_number: 'A policy number is required to match this row.',
  policy_not_found: 'No Production application matches this carrier and policy number.',
  multiple_policy_matches: 'More than one Production application matches this carrier and policy number.',
  missing_writing_associate: 'A writing associate is required to match this row.',
  unknown_writing_associate: 'The writing associate does not match the statement payee household.',
  no_writing_allocation: 'This application has no live writing allocation.',
  multiple_writing_allocations: 'Multiple writing allocations exist.',
  exact_carrier_policy_single_writing_allocation: 'Matched carrier, policy, and a single writing allocation.',
  cross_report_payment_identity: 'This installment already matches a previous import by payment identity.',
  cross_report_fingerprint_ambiguous: 'This row looks like another imported transaction and needs review.',
}

export function formatImportReviewStatus(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
}

export function formatImportReviewReason(reason: string | null | undefined): string | null {
  if (!reason) return null
  return REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
}

export function importRowBucket(row: Pick<CommissionImportRowView, 'review_status' | 'posted_commission_event_id'>): CommissionImportRowBucket {
  if (row.posted_commission_event_id) return 'posted'
  if (row.review_status === 'ready_to_post') return 'ready'
  if (row.review_status === 'duplicate') return 'duplicate'
  if (row.review_status === 'ignored_nonwriting' || row.review_status === 'ignored_nonpolicy') {
    return 'ignored'
  }
  return 'review'
}

export function isOverrideSourceType(sourceType: string | null | undefined): boolean {
  return (sourceType ?? '').trim().toLowerCase() === 'override'
}

export function isPaidOver12Section(section: string | null | undefined): boolean {
  return section === 'insurance_paid_over_12_months'
}

export function isAdditionalCommissionSection(section: string | null | undefined): boolean {
  return section === 'additional_commissions'
}

export function negativeTransactionCopy(row: Pick<
  CommissionImportRowView,
  'source_income_cents' | 'source_is_chargeback_visual' | 'resolved_event_type' | 'review_status'
>): string | null {
  if (row.source_income_cents >= 0) return null
  if (row.source_is_chargeback_visual && row.resolved_event_type === 'chargeback') {
    return 'Chargeback'
  }
  if (!row.source_is_chargeback_visual && row.review_status === 'review_transaction_type') {
    return 'Negative transaction needs classification'
  }
  return null
}

export function overrideSafetyCopy(row: Pick<CommissionImportRowView, 'source_type' | 'review_status'>): string | null {
  if (!isOverrideSourceType(row.source_type)) return null
  if (row.review_status === 'ignored_nonwriting') {
    return 'Excluded from Valtoris writing-advisor compensation.'
  }
  return 'Override source row — not treated as writing-advisor compensation.'
}

export function ignoredSafetyCopy(row: Pick<CommissionImportRowView, 'review_status' | 'source_section'>): string | null {
  if (row.review_status === 'ignored_nonwriting') {
    return 'Excluded from Valtoris writing-advisor compensation.'
  }
  if (row.review_status === 'ignored_nonpolicy' || isAdditionalCommissionSection(row.source_section)) {
    return 'Excluded — non-policy commission.'
  }
  return null
}

export type ImportAmountSummary = {
  sourceIncomeCents: number
  readyIncomeCents: number
  reviewIncomeCents: number
  ignoredIncomeCents: number
  duplicateIncomeCents: number
  postedIncomeCents: number
  readyCount: number
  reviewCount: number
  ignoredCount: number
  duplicateCount: number
  postedCount: number
}

export function summarizeImportRowAmounts(rows: readonly CommissionImportRowView[]): ImportAmountSummary {
  const summary: ImportAmountSummary = {
    sourceIncomeCents: 0,
    readyIncomeCents: 0,
    reviewIncomeCents: 0,
    ignoredIncomeCents: 0,
    duplicateIncomeCents: 0,
    postedIncomeCents: 0,
    readyCount: 0,
    reviewCount: 0,
    ignoredCount: 0,
    duplicateCount: 0,
    postedCount: 0,
  }
  for (const row of rows) {
    summary.sourceIncomeCents += row.source_income_cents
    const bucket = importRowBucket(row)
    if (bucket === 'ready') {
      summary.readyIncomeCents += row.source_income_cents
      summary.readyCount += 1
    } else if (bucket === 'review') {
      summary.reviewIncomeCents += row.source_income_cents
      summary.reviewCount += 1
    } else if (bucket === 'ignored') {
      summary.ignoredIncomeCents += row.source_income_cents
      summary.ignoredCount += 1
    } else if (bucket === 'duplicate') {
      summary.duplicateIncomeCents += row.source_income_cents
      summary.duplicateCount += 1
    } else {
      summary.postedIncomeCents += row.source_income_cents
      summary.postedCount += 1
    }
  }
  return summary
}

export function rowsForBucket(
  rows: readonly CommissionImportRowView[],
  bucket: CommissionImportRowBucket,
): CommissionImportRowView[] {
  return rows.filter((row) => importRowBucket(row) === bucket)
}

export function formatImportSectionLabel(section: string | null | undefined): string {
  if (section === 'insurance') return 'Insurance'
  if (section === 'insurance_paid_over_12_months') return 'Paid over 12 months'
  if (section === 'additional_commissions') return 'Additional commissions'
  return section || '—'
}

export function formatImportBatchSourceLabel(sourceType: string | null | undefined): string {
  if (sourceType === 'experior_paid_report') return 'Experior Paid Report'
  return sourceType?.trim() || '—'
}

export function canStageIntoBatch(batch: Pick<CommissionImportBatchView, 'import_status'>): boolean {
  return batch.import_status === 'open'
}

/** Empty open original batch from a prior create that never staged. Never stage into duplicate_file. */
export function canRetryStageIntoOpenBatch(
  batch: Pick<CommissionImportBatchView, 'import_status' | 'row_count'> | null | undefined,
): boolean {
  return Boolean(batch && batch.import_status === 'open' && batch.row_count === 0)
}

export function shouldShowImportEntry(role: string | null | undefined): boolean {
  return role === 'owner'
}
