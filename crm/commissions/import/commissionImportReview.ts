import type { ManualCommissionEventType } from '../commissionMoney'
import {
  isAdditionalCommissionSection,
  isOverrideSourceType,
  type CommissionImportRowView,
} from './commissionImportView'

export const IMPORT_POSTABLE_EVENT_TYPES = [
  'paid',
  'adjustment',
  'chargeback',
  'recovery',
] as const satisfies readonly ManualCommissionEventType[]

export type ImportPostableEventType = (typeof IMPORT_POSTABLE_EVENT_TYPES)[number]

export const OVERRIDE_EXCLUSION_COPY =
  'Excluded from Valtoris writing-advisor compensation — Override source row.'

export const ADDITIONAL_COMMISSION_EXCLUSION_COPY = 'Excluded — non-policy commission.'

export const POST_LEDGER_WARNING_COPY =
  'This will create a financial event in the commission ledger. If it is wrong after posting, correction must be made through the existing commission reversal workflow.'

export const PRE_ISSUE_IMPORT_BLOCK_COPY =
  'This application is not issued or in force, so the import cannot post this row to the ledger. Import posting does not use the pre-issue path. Record pre-issue actuals from the commissions workspace only when that exception applies.'

export const POSTED_CORRECTION_COPY =
  'Posted import rows are read-only here. Financial correction uses the existing Reverse workflow on the commissions workspace.'

const READY_RESOLUTION_REASON = 'Owner resolved application, writing allocation, and event type.'
const DISTINCT_RESOLUTION_REASON =
  'Owner confirmed this source row is distinct and resolved application, writing allocation, and event type.'
const DUPLICATE_CONFIRM_REASON = 'Owner confirmed this source row is a duplicate.'

export function isExcludedFromWritingCompensation(
  row: Pick<
    CommissionImportRowView,
    'source_type' | 'source_section' | 'review_status'
  >,
): boolean {
  if (isOverrideSourceType(row.source_type)) return true
  if (isAdditionalCommissionSection(row.source_section)) return true
  if (row.review_status === 'ignored_nonwriting') return true
  if (row.review_status === 'ignored_nonpolicy') return true
  return false
}

export function writingExclusionCopy(
  row: Pick<CommissionImportRowView, 'source_type' | 'source_section' | 'review_status'>,
): string | null {
  if (isOverrideSourceType(row.source_type)) return OVERRIDE_EXCLUSION_COPY
  if (
    isAdditionalCommissionSection(row.source_section) ||
    row.review_status === 'ignored_nonpolicy'
  ) {
    return ADDITIONAL_COMMISSION_EXCLUSION_COPY
  }
  if (row.review_status === 'ignored_nonwriting') {
    return 'Excluded from Valtoris writing-advisor compensation.'
  }
  return null
}

export function isImportEventType(
  value: string | null | undefined,
): value is ImportPostableEventType {
  return IMPORT_POSTABLE_EVENT_TYPES.includes(value as ImportPostableEventType)
}

export function eventTypeAllowedForIncome(
  eventType: ImportPostableEventType,
  incomeCents: number,
): boolean {
  if (!Number.isSafeInteger(incomeCents) || incomeCents === 0) return false
  if (eventType === 'paid' || eventType === 'recovery') return incomeCents > 0
  if (eventType === 'chargeback') return incomeCents < 0
  return incomeCents !== 0
}

export function eventTypeSignError(
  eventType: string | null | undefined,
  incomeCents: number,
): string | null {
  if (!eventType) return 'Choose Paid, Adjustment, Chargeback, or Recovery.'
  if (eventType === 'reversal') return 'Reversal is not an imported transaction type.'
  if (!isImportEventType(eventType)) return 'Choose Paid, Adjustment, Chargeback, or Recovery.'
  if (incomeCents === 0) return 'Income cannot be zero.'
  if (!eventTypeAllowedForIncome(eventType, incomeCents)) {
    if (eventType === 'paid') return 'Paid requires positive Income.'
    if (eventType === 'recovery') return 'Recovery requires positive Income.'
    if (eventType === 'chargeback') return 'Chargeback requires negative Income.'
    return 'Adjustment requires nonzero Income.'
  }
  return null
}

export function canReviewImportRow(
  row: Pick<
    CommissionImportRowView,
    | 'posted_commission_event_id'
    | 'review_status'
    | 'source_type'
    | 'source_section'
  >,
): boolean {
  if (row.posted_commission_event_id) return false
  if (isExcludedFromWritingCompensation(row)) return false
  if (row.review_status === 'duplicate') return false
  if (row.review_status === 'invalid_amount') return false
  if (row.review_status === 'invalid_source_identity') return false
  return (
    row.review_status === 'review_policy_match' ||
    row.review_status === 'review_advisor_match' ||
    row.review_status === 'review_split_attribution' ||
    row.review_status === 'review_transaction_type'
  )
}

export function canConfirmDuplicate(
  row: Pick<
    CommissionImportRowView,
    'posted_commission_event_id' | 'review_status' | 'source_type' | 'source_section'
  >,
): boolean {
  if (row.posted_commission_event_id) return false
  if (isExcludedFromWritingCompensation(row)) return false
  return row.review_status === 'review_duplicate_candidate'
}

export function canConfirmDistinct(
  row: Pick<
    CommissionImportRowView,
    'posted_commission_event_id' | 'review_status' | 'source_type' | 'source_section'
  >,
): boolean {
  return canConfirmDuplicate(row)
}

export function canPostImportRow(
  row: Pick<
    CommissionImportRowView,
    | 'posted_commission_event_id'
    | 'review_status'
    | 'source_type'
    | 'source_section'
    | 'resolved_application_id'
    | 'resolved_allocation_id'
    | 'resolved_event_type'
    | 'source_income_cents'
  >,
): boolean {
  if (row.posted_commission_event_id) return false
  if (row.review_status !== 'ready_to_post') return false
  if (isExcludedFromWritingCompensation(row)) return false
  if (!row.resolved_application_id || !row.resolved_allocation_id) return false
  if (!isImportEventType(row.resolved_event_type)) return false
  if (!eventTypeAllowedForIncome(row.resolved_event_type, row.source_income_cents)) return false
  return true
}

export function normalizeImportPolicyNumber(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export type ApplicationCandidateFilter =
  | { ok: false; reason: 'excluded' | 'missing_policy' }
  | { ok: true; policyNormalized: string; carrierId: string | null }

export function importApplicationCandidateFilter(
  row: Pick<
    CommissionImportRowView,
    'source_policy_number' | 'resolved_carrier_id' | 'source_type' | 'source_section' | 'review_status'
  >,
): ApplicationCandidateFilter {
  if (isExcludedFromWritingCompensation(row)) return { ok: false, reason: 'excluded' }
  const policyNormalized = normalizeImportPolicyNumber(row.source_policy_number)
  if (!policyNormalized) return { ok: false, reason: 'missing_policy' }
  return {
    ok: true,
    policyNormalized,
    carrierId: row.resolved_carrier_id,
  }
}

export type ReadyReviewRequest = {
  p_row_id: string
  p_reason: string
  p_review_status: 'ready_to_post'
  p_resolved_application_id: string
  p_resolved_allocation_id: string
  p_resolved_event_type: ImportPostableEventType
}

export type DuplicateReviewRequest = {
  p_row_id: string
  p_reason: string
  p_review_status: 'duplicate'
}

export type ReadyReviewBuildResult =
  | { ok: true; args: ReadyReviewRequest }
  | { ok: false; message: string }

export type DuplicateReviewBuildResult =
  | { ok: true; args: DuplicateReviewRequest }
  | { ok: false; message: string }

export function buildReadyReviewRequest(options: {
  row: CommissionImportRowView
  applicationId: string | null | undefined
  allocationId: string | null | undefined
  allocationApplicationId?: string | null
  eventType: string | null | undefined
  reason?: string | null
  distinct?: boolean
}): ReadyReviewBuildResult {
  if (isOverrideSourceType(options.row.source_type)) {
    return { ok: false, message: OVERRIDE_EXCLUSION_COPY }
  }
  if (isExcludedFromWritingCompensation(options.row)) {
    return { ok: false, message: writingExclusionCopy(options.row) ?? ADDITIONAL_COMMISSION_EXCLUSION_COPY }
  }
  if (options.row.posted_commission_event_id) {
    return { ok: false, message: 'Posted import rows cannot be reassigned.' }
  }
  if (options.row.review_status === 'duplicate' && !options.distinct) {
    return { ok: false, message: 'Duplicate rows cannot be promoted to ready.' }
  }
  if (options.distinct && !canConfirmDistinct(options.row)) {
    return { ok: false, message: 'This row cannot be confirmed as distinct.' }
  }
  if (!options.distinct && !canReviewImportRow(options.row) && !canConfirmDistinct(options.row)) {
    return { ok: false, message: 'This row cannot be resolved for posting.' }
  }
  const applicationId = options.applicationId?.trim() || ''
  const allocationId = options.allocationId?.trim() || ''
  if (!applicationId || !allocationId || !options.eventType) {
    return {
      ok: false,
      message: 'Choose the application, writing allocation, and event type together.',
    }
  }
  if (options.allocationApplicationId && options.allocationApplicationId !== applicationId) {
    return { ok: false, message: 'The writing allocation must belong to the selected application.' }
  }
  const signError = eventTypeSignError(options.eventType, options.row.source_income_cents)
  if (signError || !isImportEventType(options.eventType)) {
    return { ok: false, message: signError ?? 'Choose a supported event type.' }
  }
  const reason = (options.reason ?? '').trim()
  return {
    ok: true,
    args: {
      p_row_id: options.row.id,
      p_reason: reason || (options.distinct ? DISTINCT_RESOLUTION_REASON : READY_RESOLUTION_REASON),
      p_review_status: 'ready_to_post',
      p_resolved_application_id: applicationId,
      p_resolved_allocation_id: allocationId,
      p_resolved_event_type: options.eventType,
    },
  }
}

export function buildConfirmDuplicateRequest(options: {
  row: CommissionImportRowView
  reason?: string | null
}): DuplicateReviewBuildResult {
  if (!canConfirmDuplicate(options.row)) {
    return { ok: false, message: 'This row cannot be confirmed as a duplicate.' }
  }
  const reason = (options.reason ?? '').trim()
  return {
    ok: true,
    args: {
      p_row_id: options.row.id,
      p_reason: reason || DUPLICATE_CONFIRM_REASON,
      p_review_status: 'duplicate',
    },
  }
}

export function buildPostImportRowRequest(options: {
  row: CommissionImportRowView
  reason: string
}): { ok: true; args: { p_row_id: string; p_reason: string } } | { ok: false; message: string } {
  if (!canPostImportRow(options.row)) {
    return { ok: false, message: 'This row cannot be posted to the ledger.' }
  }
  const reason = options.reason.trim()
  if (!reason) return { ok: false, message: 'Enter a posting reason.' }
  return {
    ok: true,
    args: {
      p_row_id: options.row.id,
      p_reason: reason,
    },
  }
}

export function isLiveWritingAllocation(row: {
  allocation_role?: string | null
  recipient_type?: string | null
  effective_to?: string | null
  advisor_id?: string | null
}): boolean {
  return (
    row.allocation_role === 'writing' &&
    row.recipient_type === 'advisor' &&
    row.effective_to == null &&
    Boolean(row.advisor_id)
  )
}

export function peersInCurrentBatch(
  rows: readonly CommissionImportRowView[],
  row: Pick<CommissionImportRowView, 'id' | 'transaction_fingerprint'>,
): CommissionImportRowView[] {
  if (!row.transaction_fingerprint) return []
  return rows.filter(
    (peer) => peer.id !== row.id && peer.transaction_fingerprint === row.transaction_fingerprint,
  )
}

export function resultingSignedAmountCents(row: Pick<CommissionImportRowView, 'source_income_cents'>): number {
  return row.source_income_cents
}
