import { isValidDateOnly } from '../dashboard/dates'
import {
  parsePositiveDollarCents,
  signedCentsForManualEvent,
  type AdjustmentDirection,
  type ManualCommissionEventType,
} from './commissionMoney'
import type { RecordCommissionEventArgs } from './commissionWriteApi'
import { MANUAL_RECORD_EVENT_TYPES, type RecordCommissionDraft } from './commissionWriteView'
import { isPendingOnlyCommissionStub, type CommissionWorkItem } from './commissionWorkView'

export type RecordCommissionFieldErrors = {
  eventType?: string
  amount?: string
  transactionDate?: string
  reason?: string
}

export type RecordCommissionDraftResult =
  | { ok: true; args: RecordCommissionEventArgs }
  | { ok: false; errors: RecordCommissionFieldErrors }

export function validateRecordCommissionDraft(options: {
  item: Pick<
    CommissionWorkItem,
    'applicationId' | 'allocationId' | 'expectedRow' | 'providerId' | 'pendingOnlyStub'
  >
  draft: RecordCommissionDraft
  idempotencyKey: string
  preIssue: boolean
  includeCarrierId: boolean
}): RecordCommissionDraftResult {
  const errors: RecordCommissionFieldErrors = {}
  if (
    !MANUAL_RECORD_EVENT_TYPES.includes(options.draft.eventType as ManualCommissionEventType)
  ) {
    errors.eventType = 'Choose Paid, Adjustment, Chargeback, or Recovery.'
  }
  if (options.draft.eventType === 'reversal' as string) {
    errors.eventType = 'Reversal has its own action.'
  }
  const parsed = parsePositiveDollarCents(options.draft.amountInput)
  if (!parsed.ok) {
    errors.amount =
      parsed.reason === 'blank'
        ? 'Enter an amount.'
        : parsed.reason === 'zero'
          ? 'Amount cannot be zero.'
          : 'Enter a valid dollar amount.'
  }
  if (!isValidDateOnly(options.draft.transactionDate)) {
    errors.transactionDate = 'Enter a transaction date.'
  }
  if (!options.draft.reason.trim()) {
    errors.reason = 'Enter a reason or source note.'
  }
  if (!options.item.allocationId) {
    errors.eventType = 'This row has no writing allocation to post against.'
  }
  if (isPendingOnlyCommissionStub(options.item)) {
    errors.eventType = 'Pending-only rows cannot be posted to the commission ledger.'
  }
  if (
    Object.keys(errors).length > 0 ||
    !parsed.ok ||
    !options.item.allocationId ||
    isPendingOnlyCommissionStub(options.item)
  ) {
    return { ok: false, errors }
  }

  const signed = signedCentsForManualEvent({
    eventType: options.draft.eventType,
    magnitudeCents: parsed.cents,
    adjustmentDirection: options.draft.adjustmentDirection as AdjustmentDirection,
  })
  if (signed == null) {
    return { ok: false, errors: { amount: 'Enter a valid dollar amount.' } }
  }

  return {
    ok: true,
    args: {
      applicationId: options.item.applicationId,
      eventType: options.draft.eventType,
      amountCents: signed,
      reason: options.draft.reason.trim(),
      idempotencyKey: options.idempotencyKey,
      allocationId: options.item.allocationId,
      expectedCompensationId: options.item.expectedRow?.id ?? null,
      carrierId: options.includeCarrierId ? options.item.providerId : null,
      carrierTransactionId: options.draft.carrierTransactionId,
      statementIdentifier: options.draft.statementIdentifier,
      statementDate: options.draft.statementDate,
      transactionDate: options.draft.transactionDate,
      policyReference: options.draft.policyReference,
      sourceFile: options.draft.sourceFile,
      rawDescription: options.draft.rawDescription,
      preIssue: options.preIssue,
    },
  }
}

export function validateReverseReason(reason: string): string | null {
  return reason.trim() ? null : 'Enter a reason for this reversal.'
}

export type AttributionDraftLine = {
  allocationId: string
  selected: boolean
  amountInput: string
}

export function validateAttributionDraft(options: {
  sourceAmountCents: number
  lines: readonly AttributionDraftLine[]
  reason: string
}):
  | { ok: true; attributions: Array<{ allocationId: string; amountCents: number }> }
  | { ok: false; message: string } {
  if (!options.reason.trim()) {
    return { ok: false, message: 'Enter a reason for attribution.' }
  }
  const selected = options.lines.filter((line) => line.selected)
  if (selected.length === 0) {
    return { ok: false, message: 'Choose at least one writing allocation.' }
  }
  const attributions: Array<{ allocationId: string; amountCents: number }> = []
  let sum = 0
  for (const line of selected) {
    const parsed = parsePositiveDollarCents(line.amountInput)
    if (!parsed.ok) {
      return {
        ok: false,
        message:
          parsed.reason === 'zero'
            ? 'Attributed amounts cannot be zero.'
            : 'Enter a valid dollar amount for each selected writing advisor.',
      }
    }
    const signed =
      options.sourceAmountCents < 0 ? -parsed.cents : parsed.cents
    attributions.push({ allocationId: line.allocationId, amountCents: signed })
    sum += signed
  }
  if (sum !== options.sourceAmountCents) {
    return {
      ok: false,
      message: 'Attributed amounts must add up to the original event amount.',
    }
  }
  return { ok: true, attributions }
}
