import { presentEventReversal, type WritingCommissionEvent } from '../production/compensationView'
import { formatCommissionBpsPercent } from '../production/compensationLabels'
import type { CommissionWorkItem } from './commissionWorkView'
import type { AdjustmentDirection, ManualCommissionEventType } from './commissionMoney'

export const MANUAL_RECORD_EVENT_TYPES = [
  'paid',
  'adjustment',
  'chargeback',
  'recovery',
] as const satisfies readonly ManualCommissionEventType[]

export type WritingAttributionTarget = {
  allocationId: string
  advisorId: string | null
  advisorName: string
  splitLabel: string
}

export function canRecordAttributedActual(
  isOwner: boolean,
  item: Pick<CommissionWorkItem, 'kind' | 'allocationId'>,
): boolean {
  return isOwner && item.kind === 'writing_advisor' && Boolean(item.allocationId)
}

export function canReverseCommissionEvent(options: {
  isOwner: boolean
  event: WritingCommissionEvent
  allEvents: readonly WritingCommissionEvent[]
}): boolean {
  if (!options.isOwner) return false
  if (options.event.event_type === 'reversal') return false
  const reversal = presentEventReversal(options.event, options.allEvents)
  return reversal.kind === 'active'
}

export function canAttributeCommissionEvent(options: {
  isOwner: boolean
  unattributed: boolean
  event: WritingCommissionEvent
  allEvents: readonly WritingCommissionEvent[]
}): boolean {
  if (!options.isOwner || !options.unattributed) return false
  if (options.event.event_type === 'reversal') return false
  if (options.event.attribution_status && options.event.attribution_status !== 'review_required') {
    return false
  }
  return presentEventReversal(options.event, options.allEvents).kind === 'active'
}

export function writingAttributionTargets(
  workItems: readonly CommissionWorkItem[],
  applicationId: string,
): WritingAttributionTarget[] {
  const seen = new Set<string>()
  const targets: WritingAttributionTarget[] = []
  for (const item of workItems) {
    if (item.applicationId !== applicationId) continue
    if (item.kind !== 'writing_advisor' || !item.allocationId) continue
    if (seen.has(item.allocationId)) continue
    seen.add(item.allocationId)
    targets.push({
      allocationId: item.allocationId,
      advisorId: item.advisorId,
      advisorName: item.advisorName,
      splitLabel: formatCommissionBpsPercent(item.expectedRow?.commission_bps),
    })
  }
  return targets
}

export function ordinaryRecordRpcName(): 'record_policy_writing_commission_event' {
  return 'record_policy_writing_commission_event'
}

export function preIssueRecordRpcName(): 'record_policy_writing_commission_event_pre_issue' {
  return 'record_policy_writing_commission_event_pre_issue'
}

export function reverseRpcName(): 'reverse_policy_writing_commission_event' {
  return 'reverse_policy_writing_commission_event'
}

export function attributeRpcName(): 'attribute_unattributed_commission_event' {
  return 'attribute_unattributed_commission_event'
}

export function recordRpcName(preIssue: boolean): string {
  return preIssue ? preIssueRecordRpcName() : ordinaryRecordRpcName()
}

export type RecordCommissionDraft = {
  eventType: ManualCommissionEventType
  amountInput: string
  adjustmentDirection: AdjustmentDirection
  transactionDate: string
  reason: string
  statementIdentifier: string
  statementDate: string
  carrierTransactionId: string
  policyReference: string
  sourceFile: string
  rawDescription: string
}

export function defaultRecordCommissionDraft(today: string): RecordCommissionDraft {
  return {
    eventType: 'paid',
    amountInput: '',
    adjustmentDirection: 'increase',
    transactionDate: today,
    reason: '',
    statementIdentifier: '',
    statementDate: '',
    carrierTransactionId: '',
    policyReference: '',
    sourceFile: '',
    rawDescription: '',
  }
}
