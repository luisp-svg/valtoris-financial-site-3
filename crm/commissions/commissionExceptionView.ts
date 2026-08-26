/**
 * UI-only derived commission exception flags.
 * Reuses existing work-item fields from 034 snapshots, 035 ledger sums, and
 * accepted_pending overlay. Does not persist statuses, Eligible, Released,
 * or a second accounting state machine. Does not query per row.
 */
import { formatSignedCents } from '../production/compensationView'
import { formatCents } from '../production/productionApi'
import type { CommissionWorkItem } from './commissionWorkView'
import { formatCommissionWorkStatusLabel } from './commissionWorkView'

export const COMMISSION_EXCEPTION_BUCKETS = [
  'all',
  'outstanding',
  'reconciled',
  'overpaid',
  'chargeback_activity',
  'expected_unavailable',
  'attribution_review',
  'pending_without_actual',
] as const

export type CommissionExceptionBucket = (typeof COMMISSION_EXCEPTION_BUCKETS)[number]

/** Owner-only buckets that would leak staging or unattributed cash if shown to advisors. */
export const OWNER_ONLY_EXCEPTION_BUCKETS = [
  'attribution_review',
  'pending_without_actual',
] as const satisfies readonly CommissionExceptionBucket[]

export const PENDING_WITHOUT_ACTUAL_COPY = 'Reviewed Pending — payment not recorded'

export const EXPECTED_UNAVAILABLE_RECONCILIATION_COPY =
  'Reconciliation cannot be calculated.'

export const CHARGEBACK_RECONCILED_COPY =
  'Chargeback activity is present. Remaining expected is $0.00 — this record reconciles mathematically.'

export type CommissionExceptionFlags = {
  outstanding: boolean
  reconciled: boolean
  overpaid: boolean
  chargebackActivity: boolean
  expectedUnavailable: boolean
  attributionReview: boolean
  pendingWithoutActual: boolean
  needsAttention: boolean
}

export type CommissionExceptionNote = {
  bucket: Exclude<CommissionExceptionBucket, 'all'>
  title: string
  detail: string
}

export type CommissionExceptionCounts = Record<Exclude<CommissionExceptionBucket, 'all'>, number>

export type CommissionReconciliationTotals = {
  remainingExpectedCents: number | null
  varianceCents: number | null
  knownExpectedCount: number
  needsAttentionCount: number
}

/**
 * Variance is the existing 035 formula: net actual − pinned expected.
 * Null when Expected is unresolved so the UI cannot manufacture $0.
 */
export function varianceCentsForWorkItem(
  item: Pick<CommissionWorkItem, 'expectedCents' | 'netPaidCents'>,
): number | null {
  if (item.expectedCents == null) return null
  return item.netPaidCents - item.expectedCents
}

export function varianceCentsDisplay(cents: number | null): string {
  if (cents == null) return '—'
  return formatSignedCents(cents)
}

/** Display alias: remaining_expected_cents === 0 with resolved Expected. */
export function isReconciledDisplay(
  item: Pick<CommissionWorkItem, 'expectedCents' | 'remainingExpectedCents'>,
): boolean {
  return item.expectedCents != null && item.remainingExpectedCents === 0
}

export function hasActualPaidActivity(item: Pick<CommissionWorkItem, 'paidCents'>): boolean {
  return item.paidCents !== 0
}

export function hasActualLedgerActivity(
  item: Pick<
    CommissionWorkItem,
    'eventCount' | 'paidCents' | 'chargebackCents' | 'adjustmentCents' | 'recoveryCents' | 'netPaidCents'
  >,
): boolean {
  return (
    item.eventCount > 0 ||
    item.paidCents !== 0 ||
    item.chargebackCents !== 0 ||
    item.adjustmentCents !== 0 ||
    item.recoveryCents !== 0 ||
    item.netPaidCents !== 0
  )
}

export function isExpectedUnavailableException(
  item: Pick<
    CommissionWorkItem,
    | 'expectedCents'
    | 'derivedStatus'
    | 'eventCount'
    | 'paidCents'
    | 'chargebackCents'
    | 'adjustmentCents'
    | 'recoveryCents'
    | 'netPaidCents'
  >,
): boolean {
  if (item.derivedStatus.primary === 'expected_unavailable') return true
  return hasActualLedgerActivity(item) && item.expectedCents == null
}

export function isPendingWithoutActual(
  item: Pick<CommissionWorkItem, 'pendingSource' | 'pendingCents' | 'paidCents'>,
): boolean {
  const pendingAmount = item.pendingSource?.amountCents ?? item.pendingCents
  if (pendingAmount <= 0) return false
  return !hasActualPaidActivity(item)
}

export function commissionExceptionFlags(
  item: CommissionWorkItem,
  isOwner: boolean,
): CommissionExceptionFlags {
  const outstanding = item.outstandingCents > 0
  const reconciled = isReconciledDisplay(item)
  const variance = varianceCentsForWorkItem(item)
  const overpaid = variance != null && variance > 0
  const chargebackActivity = item.derivedStatus.chargedBack || item.chargebackCents !== 0
  const expectedUnavailable = isExpectedUnavailableException(item)
  const attributionReview = isOwner && item.kind === 'unattributed'
  const pendingWithoutActual = isOwner && isPendingWithoutActual(item)
  const chargebackNeedsAttention =
    chargebackActivity &&
    (item.remainingExpectedCents == null ||
      item.remainingExpectedCents !== 0 ||
      (variance != null && variance !== 0))
  const needsAttention =
    !reconciled &&
    (expectedUnavailable ||
      attributionReview ||
      overpaid ||
      pendingWithoutActual ||
      chargebackNeedsAttention ||
      item.derivedStatus.needsReview)

  return {
    outstanding,
    reconciled,
    overpaid,
    chargebackActivity,
    expectedUnavailable,
    attributionReview,
    pendingWithoutActual,
    needsAttention,
  }
}

export function workItemMatchesExceptionBucket(
  item: CommissionWorkItem,
  bucket: CommissionExceptionBucket,
  isOwner: boolean,
): boolean {
  if (bucket === 'all') return true
  if (!isOwner && (OWNER_ONLY_EXCEPTION_BUCKETS as readonly string[]).includes(bucket)) {
    return false
  }
  const flags = commissionExceptionFlags(item, isOwner)
  switch (bucket) {
    case 'outstanding':
      return flags.outstanding
    case 'reconciled':
      return flags.reconciled
    case 'overpaid':
      return flags.overpaid
    case 'chargeback_activity':
      return flags.chargebackActivity
    case 'expected_unavailable':
      return flags.expectedUnavailable
    case 'attribution_review':
      return flags.attributionReview
    case 'pending_without_actual':
      return flags.pendingWithoutActual
    default:
      return true
  }
}

export function formatExceptionBucketLabel(bucket: CommissionExceptionBucket): string {
  switch (bucket) {
    case 'all':
      return 'All'
    case 'outstanding':
      return 'Outstanding'
    case 'reconciled':
      return 'Reconciled'
    case 'overpaid':
      return 'Overpaid'
    case 'chargeback_activity':
      return 'Chargeback activity'
    case 'expected_unavailable':
      return 'Expected unavailable'
    case 'attribution_review':
      return 'Attribution review'
    case 'pending_without_actual':
      return 'Pending without actual'
    default:
      return bucket
  }
}

export function visibleExceptionBuckets(isOwner: boolean): readonly CommissionExceptionBucket[] {
  if (isOwner) return COMMISSION_EXCEPTION_BUCKETS
  return COMMISSION_EXCEPTION_BUCKETS.filter(
    (bucket) => !(OWNER_ONLY_EXCEPTION_BUCKETS as readonly string[]).includes(bucket),
  )
}

export function formatCommissionReconciliationLabel(item: CommissionWorkItem): string {
  if (isReconciledDisplay(item)) return 'Reconciled'
  return formatCommissionWorkStatusLabel(item.derivedStatus.primary)
}

export function commissionExceptionNotes(
  item: CommissionWorkItem,
  isOwner: boolean,
): CommissionExceptionNote[] {
  const flags = commissionExceptionFlags(item, isOwner)
  const notes: CommissionExceptionNote[] = []
  const variance = varianceCentsForWorkItem(item)

  if (flags.expectedUnavailable) {
    notes.push({
      bucket: 'expected_unavailable',
      title: 'Expected unavailable',
      detail: `Net actual: ${formatSignedCents(item.netPaidCents)}. ${EXPECTED_UNAVAILABLE_RECONCILIATION_COPY}`,
    })
  }
  if (flags.overpaid) {
    notes.push({
      bucket: 'overpaid',
      title: 'Overpaid',
      detail: `Variance ${varianceCentsDisplay(variance)}. Net actual exceeds pinned Expected.`,
    })
  }
  if (flags.chargebackActivity) {
    notes.push({
      bucket: 'chargeback_activity',
      title: 'Chargeback activity',
      detail: flags.reconciled
        ? CHARGEBACK_RECONCILED_COPY
        : `Chargebacks ${formatSignedCents(item.chargebackCents)}. Net actual ${formatSignedCents(item.netPaidCents)}.`,
    })
  }
  if (flags.attributionReview) {
    notes.push({
      bucket: 'attribution_review',
      title: 'Attribution review',
      detail: 'Unattributed actual commission needs owner attribution. Advisors do not see this cash.',
    })
  }
  if (flags.pendingWithoutActual) {
    notes.push({
      bucket: 'pending_without_actual',
      title: PENDING_WITHOUT_ACTUAL_COPY,
      detail: `Accepted Pending ${formatCents(item.pendingCents)} is staging evidence. No actual Paid activity is on this allocation.`,
    })
  }
  if (item.derivedStatus.needsReview && item.reviewReason) {
    const alreadyExpected = notes.some((note) => note.bucket === 'expected_unavailable')
    if (!alreadyExpected) {
      notes.push({
        bucket: 'expected_unavailable',
        title: 'Review required',
        detail: item.reviewReason,
      })
    }
  }
  return notes
}

export function emptyCommissionExceptionCounts(): CommissionExceptionCounts {
  return {
    outstanding: 0,
    reconciled: 0,
    overpaid: 0,
    chargeback_activity: 0,
    expected_unavailable: 0,
    attribution_review: 0,
    pending_without_actual: 0,
  }
}

export function summarizeCommissionExceptions(
  items: readonly CommissionWorkItem[],
  isOwner: boolean,
): CommissionExceptionCounts {
  const counts = emptyCommissionExceptionCounts()
  for (const item of items) {
    const flags = commissionExceptionFlags(item, isOwner)
    if (flags.outstanding) counts.outstanding += 1
    if (flags.reconciled) counts.reconciled += 1
    if (flags.overpaid) counts.overpaid += 1
    if (flags.chargebackActivity) counts.chargeback_activity += 1
    if (flags.expectedUnavailable) counts.expected_unavailable += 1
    if (flags.attributionReview) counts.attribution_review += 1
    if (flags.pendingWithoutActual) counts.pending_without_actual += 1
  }
  return counts
}

export function summarizeCommissionReconciliation(
  items: readonly CommissionWorkItem[],
  isOwner: boolean,
): CommissionReconciliationTotals {
  let remainingSum = 0
  let varianceSum = 0
  let knownExpectedCount = 0
  let needsAttentionCount = 0
  for (const item of items) {
    if (item.expectedCents != null && item.remainingExpectedCents != null) {
      remainingSum += item.remainingExpectedCents
      knownExpectedCount += 1
    }
    const variance = varianceCentsForWorkItem(item)
    if (variance != null) varianceSum += variance
    if (commissionExceptionFlags(item, isOwner).needsAttention) needsAttentionCount += 1
  }
  return {
    remainingExpectedCents: knownExpectedCount === 0 ? null : remainingSum,
    varianceCents: knownExpectedCount === 0 ? null : varianceSum,
    knownExpectedCount,
    needsAttentionCount,
  }
}
