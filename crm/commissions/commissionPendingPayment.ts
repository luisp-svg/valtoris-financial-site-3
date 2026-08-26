/**
 * Owner Record Payment from reviewed accepted_pending evidence.
 * Creates a new 035 paid event. Does not mutate Pending rows or statuses.
 */
import { crmCommissionsRecordPaymentPath } from '../../constants/routes'
import { formatSignedCents } from '../production/compensationView'
import { formatCents } from '../production/productionApi'
import { centsToDollarInput } from './commissionMoney'
import { defaultRecordCommissionDraft, type RecordCommissionDraft } from './commissionWriteView'
import type { CommissionWorkItem } from './commissionWorkView'

export const RECORD_PAYMENT_ACTION_LABEL = 'Record Payment'

export const PENDING_IS_NOT_PAID_COPY =
  'Accepted Pending is reviewed staging. It is not Paid and was not posted to the ledger.'

export const PENDING_AMOUNT_IS_SUGGESTION_COPY =
  'Pending amount is a suggestion only. Enter the actual paid amount from payment evidence. This does not change the Pending row.'

export const PENDING_AND_PAID_COEXISTENCE_COPY =
  'Pending evidence reviewed. Paid recorded separately.'

export const COMMISSION_PAYMENT_RECORDED_COPY = 'Payment recorded.'

export const COMMISSION_PAYMENT_ALREADY_RECORDED_COPY =
  'This payment was already recorded. Nothing new was posted.'

export const PENDING_PAYMENT_REASON =
  'Owner-confirmed carrier payment. Pending amount is a suggestion only and is not the paid amount.'

export const PENDING_PAYMENT_ALREADY_PAID_NOTE =
  'This writing allocation already has actual commission recorded. Confirm this is a new payment. Duplicate carrier statement identity is still rejected by the ledger.'

export const COMMISSION_RECORD_PAYMENT_QUERY = {
  flag: 'recordPayment',
  application: 'application',
  allocation: 'allocation',
} as const

export function canRecordPaymentFromAcceptedPendingRow(row: {
  pending_review_status: string
  resolved_application_id: string | null
  resolved_allocation_id: string | null
  source_income_cents: number
}): boolean {
  return (
    row.pending_review_status === 'accepted_pending' &&
    Boolean(row.resolved_application_id) &&
    Boolean(row.resolved_allocation_id) &&
    row.source_income_cents > 0
  )
}

export function acceptedPendingRecordPaymentPath(row: {
  pending_review_status: string
  resolved_application_id: string | null
  resolved_allocation_id: string | null
  source_income_cents: number
}): string | null {
  if (!canRecordPaymentFromAcceptedPendingRow(row)) return null
  if (!row.resolved_application_id || !row.resolved_allocation_id) return null
  return crmCommissionsRecordPaymentPath(row.resolved_application_id, row.resolved_allocation_id)
}

export function canRecordPendingPayment(
  isOwner: boolean,
  item: Pick<
    CommissionWorkItem,
    'kind' | 'allocationId' | 'pendingSource' | 'pendingOnlyStub'
  >,
): boolean {
  if (!isOwner) return false
  if (item.kind !== 'writing_advisor') return false
  if (!item.allocationId) return false
  const pending = item.pendingSource
  if (!pending) return false
  if (pending.amountCents <= 0) return false
  return true
}

export function pendingPaymentRawDescription(rowId: string): string {
  return `Pending import row ${rowId} (reviewed staging evidence; not a ledger event).`
}

export function defaultPendingPaymentDraft(
  item: Pick<CommissionWorkItem, 'pendingSource' | 'referenceLabel'>,
  today: string,
): RecordCommissionDraft {
  const pending = item.pendingSource
  const base = defaultRecordCommissionDraft(today)
  if (!pending) return { ...base, eventType: 'paid' }
  return {
    ...base,
    eventType: 'paid',
    amountInput: centsToDollarInput(pending.amountCents),
    transactionDate: pending.transactionDate || today,
    reason: PENDING_PAYMENT_REASON,
    statementIdentifier: pending.statementIdentifier ?? '',
    statementDate: pending.statementDate ?? '',
    policyReference: pending.policyNumber || item.referenceLabel,
    sourceFile: pending.sourceFile ?? '',
    rawDescription: pendingPaymentRawDescription(pending.rowId),
  }
}

export function parseCommissionRecordPaymentSearch(
  search: URLSearchParams,
): { applicationId: string; allocationId: string } | null {
  if (search.get(COMMISSION_RECORD_PAYMENT_QUERY.flag) !== '1') return null
  const applicationId = search.get(COMMISSION_RECORD_PAYMENT_QUERY.application)?.trim() ?? ''
  const allocationId = search.get(COMMISSION_RECORD_PAYMENT_QUERY.allocation)?.trim() ?? ''
  if (!applicationId || !allocationId) return null
  return { applicationId, allocationId }
}

export function canOpenPendingPaymentFromSearch(options: {
  isOwner: boolean
  item: CommissionWorkItem | undefined
}): boolean {
  if (!options.isOwner || !options.item) return false
  return canRecordPendingPayment(true, options.item)
}

export function remainingExpectedDisplay(cents: number | null): string {
  if (cents == null) return '—'
  return cents < 0 ? formatSignedCents(cents) : formatCents(cents)
}

export function pendingPaymentShowsCoexistence(
  item: Pick<CommissionWorkItem, 'pendingSource' | 'paidCents'>,
): boolean {
  return Boolean(item.pendingSource) && item.paidCents > 0
}
