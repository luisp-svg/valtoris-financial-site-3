/**
 * Case Operations (Phase 2) — UI eligibility for low-risk operational fields.
 * Mirrors Migration 032 update_policy_application v_allowed (never replaced in 033–044).
 * Server remains authoritative. This helper only hides edits the RPC would reject.
 */
import type { CrmSupportedRole } from '../types'
import { isFiaProductLine, isLifeProductLine } from './applicationView'
import type {
  ProductionDeliveryStatus,
  ProductionProductLine,
  ProductionStage,
} from './types'
import { PRODUCTION_STAGES } from './types'

/** Payload keys this surface may send. Unknown keys are never introduced. */
export const CASE_OPERATIONS_PAYLOAD_KEYS = [
  'next_follow_up_date',
  'notes',
  'is_replacement',
  'is_exchange_or_transfer',
  'delivery_status',
] as const

export type CaseOperationsPayloadKey = (typeof CASE_OPERATIONS_PAYLOAD_KEYS)[number]

export const CASE_OPERATIONS_NOTES_MAX = 5000

/** Matches 032: flags editable in draft / pre_submitted / submitted / in_underwriting / postponed. */
export const CASE_OPERATIONS_FLAG_STAGES: ProductionStage[] = [
  'draft',
  'pre_submitted',
  'submitted',
  'in_underwriting',
  'postponed',
]

/** Matches 032: delivery_status is in v_allowed only at issued. */
export const CASE_OPERATIONS_DELIVERY_STAGES: ProductionStage[] = ['issued']

/**
 * Values update_policy_application accepts for delivery_status.
 * not_required is reserved for the in_force transition (reason required).
 * pre_issue is not an issued progress value.
 */
export const ISSUED_DELIVERY_EDIT_STATUSES = [
  'not_started',
  'with_agent',
  'with_client',
  'requirements_pending',
  'complete',
] as const satisfies readonly ProductionDeliveryStatus[]

export type IssuedDeliveryEditStatus = (typeof ISSUED_DELIVERY_EDIT_STATUSES)[number]

const FLAG_STAGE_SET = new Set<string>(CASE_OPERATIONS_FLAG_STAGES)
const DELIVERY_EDIT_SET = new Set<string>(ISSUED_DELIVERY_EDIT_STATUSES)

export type CaseOperationsDraft = {
  nextFollowUpDate: string
  notes: string
  isReplacement: boolean
  isExchangeOrTransfer: boolean
  deliveryStatus: ProductionDeliveryStatus | ''
}

export type CaseOperationsPatch = {
  next_follow_up_date?: string | null
  notes?: string | null
  is_replacement?: boolean
  is_exchange_or_transfer?: boolean
  delivery_status?: IssuedDeliveryEditStatus
}

export type CaseOperationsEligibility = {
  followUp: boolean
  notes: boolean
  replacement: boolean
  exchange: boolean
  delivery: boolean
}

export function canAccessCaseOperations(options: {
  role: CrmSupportedRole | null
  deletedAt: string | null | undefined
}): boolean {
  if (options.deletedAt) return false
  return options.role === 'owner' || options.role === 'advisor'
}

export function isIssuedDeliveryEditStatus(
  status: string | null | undefined,
): status is IssuedDeliveryEditStatus {
  return Boolean(status && DELIVERY_EDIT_SET.has(status))
}

export function caseOperationsEligibility(options: {
  role: CrmSupportedRole | null
  stage: ProductionStage | string | null | undefined
  productLine: ProductionProductLine | string | null | undefined
  deliveryStatus: ProductionDeliveryStatus | string | null | undefined
  deletedAt: string | null | undefined
}): CaseOperationsEligibility {
  const none: CaseOperationsEligibility = {
    followUp: false,
    notes: false,
    replacement: false,
    exchange: false,
    delivery: false,
  }
  if (!canAccessCaseOperations(options)) return none
  const stage = options.stage
  if (!stage || !(PRODUCTION_STAGES as readonly string[]).includes(stage)) return none

  const flagsOpen = FLAG_STAGE_SET.has(stage)
  return {
    followUp: true,
    notes: true,
    replacement: flagsOpen,
    exchange: flagsOpen && isFiaProductLine(options.productLine),
    delivery: stage === 'issued' && isIssuedDeliveryEditStatus(options.deliveryStatus),
  }
}

export function canShowCaseOperations(eligibility: CaseOperationsEligibility): boolean {
  return (
    eligibility.followUp ||
    eligibility.notes ||
    eligibility.replacement ||
    eligibility.exchange ||
    eligibility.delivery
  )
}

export function showLifeReplacementOnly(productLine: ProductionProductLine | string | null | undefined): boolean {
  return isLifeProductLine(productLine)
}

export function toCaseOperationsDraft(application: {
  next_follow_up_date: string | null
  notes: string | null
  is_replacement: boolean
  is_exchange_or_transfer: boolean
  delivery_status: ProductionDeliveryStatus
}): CaseOperationsDraft {
  return {
    nextFollowUpDate: application.next_follow_up_date?.slice(0, 10) ?? '',
    notes: application.notes ?? '',
    isReplacement: Boolean(application.is_replacement),
    isExchangeOrTransfer: Boolean(application.is_exchange_or_transfer),
    deliveryStatus: application.delivery_status,
  }
}

export function isCaseOperationsDirty(original: CaseOperationsDraft, draft: CaseOperationsDraft): boolean {
  return (
    original.nextFollowUpDate !== draft.nextFollowUpDate ||
    original.notes !== draft.notes ||
    original.isReplacement !== draft.isReplacement ||
    original.isExchangeOrTransfer !== draft.isExchangeOrTransfer ||
    original.deliveryStatus !== draft.deliveryStatus
  )
}

export type CaseOperationsBuildResult =
  | { ok: true; payload: CaseOperationsPatch | null }
  | { ok: false; message: string }

function normalizeNotes(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Build a strict patch of changed, eligible fields only.
 * Never includes stage, money, identifiers, allocations, or production month.
 */
export function buildCaseOperationsPayload(options: {
  eligibility: CaseOperationsEligibility
  original: CaseOperationsDraft
  draft: CaseOperationsDraft
}): CaseOperationsBuildResult {
  const { eligibility, original, draft } = options
  if (eligibility.notes && draft.notes.length > CASE_OPERATIONS_NOTES_MAX) {
    return {
      ok: false,
      message: `Application note must be ${CASE_OPERATIONS_NOTES_MAX} characters or fewer.`,
    }
  }

  const payload: CaseOperationsPatch = {}

  if (eligibility.followUp) {
    const next = draft.nextFollowUpDate.trim()
    const prev = original.nextFollowUpDate.trim()
    if (next !== prev) payload.next_follow_up_date = next || null
  }

  if (eligibility.notes) {
    const next = normalizeNotes(draft.notes)
    const prev = normalizeNotes(original.notes)
    if (next !== prev) payload.notes = next
  }

  if (eligibility.replacement && draft.isReplacement !== original.isReplacement) {
    payload.is_replacement = draft.isReplacement
  }

  if (eligibility.exchange && draft.isExchangeOrTransfer !== original.isExchangeOrTransfer) {
    payload.is_exchange_or_transfer = draft.isExchangeOrTransfer
  }

  if (eligibility.delivery && draft.deliveryStatus !== original.deliveryStatus) {
    if (!isIssuedDeliveryEditStatus(draft.deliveryStatus)) {
      return { ok: false, message: 'Choose a delivery progress value the server allows at Issued.' }
    }
    payload.delivery_status = draft.deliveryStatus
  }

  const keys = Object.keys(payload) as CaseOperationsPayloadKey[]
  if (keys.some((key) => !(CASE_OPERATIONS_PAYLOAD_KEYS as readonly string[]).includes(key))) {
    return { ok: false, message: 'That Case Operations change cannot be saved.' }
  }

  return { ok: true, payload: keys.length > 0 ? payload : null }
}

/** Runtime strip so a caller cannot smuggle unknown keys onto the RPC. */
export function sanitizeCaseOperationsPatch(payload: CaseOperationsPatch): CaseOperationsPatch {
  const out: CaseOperationsPatch = {}
  if ('next_follow_up_date' in payload) out.next_follow_up_date = payload.next_follow_up_date ?? null
  if ('notes' in payload) out.notes = payload.notes ?? null
  if ('is_replacement' in payload) out.is_replacement = Boolean(payload.is_replacement)
  if ('is_exchange_or_transfer' in payload) {
    out.is_exchange_or_transfer = Boolean(payload.is_exchange_or_transfer)
  }
  if ('delivery_status' in payload && isIssuedDeliveryEditStatus(payload.delivery_status)) {
    out.delivery_status = payload.delivery_status
  }
  return out
}
