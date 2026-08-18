import { isLiveWritingAllocation } from '../import/commissionImportReview'
import {
  isAdditionalCommissionSection,
  isOverrideSourceType,
  type CommissionPendingRowView,
} from './commissionPendingView'

export const PENDING_ACCEPT_REASON =
  'Owner resolved application and live writing allocation for Pending.'
export const PENDING_DISTINCT_REASON =
  'Owner confirmed this Pending source row is distinct and resolved application and live writing allocation.'
export const PENDING_DUPLICATE_REASON = 'Owner confirmed this Pending source row is a duplicate.'

export const PENDING_OVERRIDE_EXCLUSION_COPY =
  'Excluded from writing-advisor Pending — Override source row.'
export const PENDING_ADDITIONAL_EXCLUSION_COPY = 'Excluded — non-policy commission.'

const REVIEW_RESOLVE_STATUSES = [
  'review_policy_match',
  'review_advisor_match',
  'review_split_attribution',
] as const

export function isExcludedFromPendingAcceptance(
  row: Pick<CommissionPendingRowView, 'source_type' | 'source_section' | 'pending_review_status'>,
): boolean {
  if (isOverrideSourceType(row.source_type)) return true
  if (isAdditionalCommissionSection(row.source_section)) return true
  if (row.pending_review_status === 'ignored_nonwriting') return true
  if (row.pending_review_status === 'ignored_nonpolicy') return true
  return false
}

export function pendingExclusionCopy(
  row: Pick<CommissionPendingRowView, 'source_type' | 'source_section' | 'pending_review_status'>,
): string | null {
  if (isOverrideSourceType(row.source_type)) return PENDING_OVERRIDE_EXCLUSION_COPY
  if (
    isAdditionalCommissionSection(row.source_section) ||
    row.pending_review_status === 'ignored_nonpolicy'
  ) {
    return PENDING_ADDITIONAL_EXCLUSION_COPY
  }
  if (row.pending_review_status === 'ignored_nonwriting') {
    return 'Excluded from writing-advisor Pending.'
  }
  return null
}

export function canResolvePendingRow(
  row: Pick<
    CommissionPendingRowView,
    'pending_review_status' | 'source_type' | 'source_section'
  >,
): boolean {
  if (isExcludedFromPendingAcceptance(row)) return false
  return REVIEW_RESOLVE_STATUSES.includes(
    row.pending_review_status as (typeof REVIEW_RESOLVE_STATUSES)[number],
  )
}

export function canConfirmPendingDuplicate(
  row: Pick<
    CommissionPendingRowView,
    'pending_review_status' | 'source_type' | 'source_section'
  >,
): boolean {
  if (isExcludedFromPendingAcceptance(row)) return false
  return row.pending_review_status === 'review_duplicate_candidate'
}

export function canConfirmPendingDistinct(
  row: Pick<
    CommissionPendingRowView,
    'pending_review_status' | 'source_type' | 'source_section'
  >,
): boolean {
  return canConfirmPendingDuplicate(row)
}

export function normalizePendingPolicyNumber(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export type PendingApplicationCandidateFilter =
  | { ok: false; reason: 'excluded' | 'missing_policy' }
  | { ok: true; policyNormalized: string; carrierId: string | null }

export function pendingApplicationCandidateFilter(
  row: Pick<
    CommissionPendingRowView,
    'source_policy_number' | 'resolved_carrier_id' | 'source_type' | 'source_section' | 'pending_review_status'
  >,
): PendingApplicationCandidateFilter {
  if (isExcludedFromPendingAcceptance(row)) return { ok: false, reason: 'excluded' }
  const policyNormalized = normalizePendingPolicyNumber(row.source_policy_number)
  if (!policyNormalized) return { ok: false, reason: 'missing_policy' }
  return {
    ok: true,
    policyNormalized,
    carrierId: row.resolved_carrier_id,
  }
}

export type PendingReviewAction = 'accept' | 'confirm_duplicate' | 'confirm_distinct'

export type AcceptPendingReviewRequest = {
  p_row_id: string
  p_action: 'accept' | 'confirm_distinct'
  p_reason: string
  p_resolved_application_id: string
  p_resolved_allocation_id: string
}

export type DuplicatePendingReviewRequest = {
  p_row_id: string
  p_action: 'confirm_duplicate'
  p_reason: string
}

export type PendingReviewBuildResult =
  | { ok: true; args: AcceptPendingReviewRequest | DuplicatePendingReviewRequest }
  | { ok: false; message: string }

export function buildAcceptPendingRequest(options: {
  row: CommissionPendingRowView
  applicationId?: string | null
  allocationId?: string | null
  allocationApplicationId?: string | null
  reason?: string | null
  distinct?: boolean
}): PendingReviewBuildResult {
  if (isOverrideSourceType(options.row.source_type)) {
    return { ok: false, message: PENDING_OVERRIDE_EXCLUSION_COPY }
  }
  if (isExcludedFromPendingAcceptance(options.row)) {
    return { ok: false, message: pendingExclusionCopy(options.row) ?? PENDING_ADDITIONAL_EXCLUSION_COPY }
  }
  if (options.row.pending_review_status === 'duplicate') {
    return { ok: false, message: 'Duplicate rows cannot become accepted Pending.' }
  }
  if (options.distinct && !canConfirmPendingDistinct(options.row)) {
    return { ok: false, message: 'This row cannot be confirmed as distinct.' }
  }
  if (!options.distinct && !canResolvePendingRow(options.row)) {
    return { ok: false, message: 'This row cannot be resolved for Pending.' }
  }
  const applicationId = options.applicationId?.trim() || ''
  const allocationId = options.allocationId?.trim() || ''
  if (!applicationId || !allocationId) {
    return {
      ok: false,
      message: 'Choose the application and live writing allocation together.',
    }
  }
  if (options.allocationApplicationId && options.allocationApplicationId !== applicationId) {
    return { ok: false, message: 'The writing allocation must belong to the selected application.' }
  }
  const reason = (options.reason ?? '').trim()
  return {
    ok: true,
    args: {
      p_row_id: options.row.id,
      p_action: options.distinct ? 'confirm_distinct' : 'accept',
      p_reason: reason || (options.distinct ? PENDING_DISTINCT_REASON : PENDING_ACCEPT_REASON),
      p_resolved_application_id: applicationId,
      p_resolved_allocation_id: allocationId,
    },
  }
}

export function buildConfirmPendingDuplicateRequest(options: {
  row: CommissionPendingRowView
  reason?: string | null
}): PendingReviewBuildResult {
  if (!canConfirmPendingDuplicate(options.row)) {
    return { ok: false, message: 'This row cannot be confirmed as a duplicate.' }
  }
  const reason = (options.reason ?? '').trim()
  return {
    ok: true,
    args: {
      p_row_id: options.row.id,
      p_action: 'confirm_duplicate',
      p_reason: reason || PENDING_DUPLICATE_REASON,
    },
  }
}

export { isLiveWritingAllocation }

export function pendingPeersInCurrentBatch(
  rows: readonly CommissionPendingRowView[],
  row: Pick<CommissionPendingRowView, 'id' | 'transaction_fingerprint'>,
): CommissionPendingRowView[] {
  if (!row.transaction_fingerprint) return []
  return rows.filter(
    (peer) => peer.id !== row.id && peer.transaction_fingerprint === row.transaction_fingerprint,
  )
}
