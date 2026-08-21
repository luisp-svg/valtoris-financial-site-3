/**
 * Owner post-placement recording UX over Migration 045.
 * Eligibility is local. Date-vs-outcome classification is not computed here —
 * record_policy_post_placement_outcome remains authoritative.
 */
import { isValidDateOnly } from '../dashboard/dates'
import type { CrmSupportedRole } from '../types'
import {
  formatPolicyLifecycleLabel,
  linkedPolicyLifecycleStatus,
} from './policyLifecycle'
import type { ProductionApplicationListItem } from './types'

export const POST_PLACEMENT_OUTCOMES = ['canceled', 'surrendered'] as const
export type PostPlacementOutcome = (typeof POST_PLACEMENT_OUTCOMES)[number]

export const POST_PLACEMENT_REASON_MAX = 500

export const RECORD_POST_PLACEMENT_ACTION_LABEL = 'Record canceled or surrendered'

export type PostPlacementDraft = {
  outcome: PostPlacementOutcome | ''
  terminatedOn: string
  reason: string
}

export type PostPlacementFieldErrors = {
  outcome?: string
  terminatedOn?: string
  reason?: string
}

export type PostPlacementRpcArgs = {
  p_application_id: string
  p_status: PostPlacementOutcome
  p_reason: string
  p_terminated_on: string | null
}

export type PostPlacementDraftResult =
  | { ok: true; args: PostPlacementRpcArgs }
  | { ok: false; errors: PostPlacementFieldErrors }

export function isPostPlacementOutcome(value: string | null | undefined): value is PostPlacementOutcome {
  return value === 'canceled' || value === 'surrendered'
}

export function formatPostPlacementOutcomeLabel(outcome: PostPlacementOutcome): string {
  return formatPolicyLifecycleLabel(outcome) ?? outcome
}

export function defaultPostPlacementDraft(): PostPlacementDraft {
  return { outcome: '', terminatedOn: '', reason: '' }
}

export function canRecordPostPlacementOutcome(options: {
  role: CrmSupportedRole | null
  productionStage: string | null | undefined
  deletedAt?: string | null
  linkedPolicyStatus?: string | null
}): boolean {
  if (options.role !== 'owner') return false
  if (options.deletedAt != null) return false
  if (options.productionStage !== 'in_force') return false
  return options.linkedPolicyStatus === 'in_force'
}

export function canRecordPostPlacementForApplication(
  role: CrmSupportedRole | null,
  item: Pick<ProductionApplicationListItem, 'production_stage' | 'deleted_at' | 'linked_policies'>,
): boolean {
  const linkedStatus = linkedPolicyLifecycleStatus(item)
  return canRecordPostPlacementOutcome({
    role,
    productionStage: item.production_stage,
    deletedAt: item.deleted_at,
    linkedPolicyStatus: linkedStatus,
  })
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function validatePostPlacementDraft(options: {
  applicationId: string
  draft: PostPlacementDraft
}): PostPlacementDraftResult {
  const errors: PostPlacementFieldErrors = {}
  if (!isPostPlacementOutcome(options.draft.outcome)) {
    errors.outcome = 'Choose Canceled / Early Termination or Surrendered.'
  }
  const reason = options.draft.reason.trim()
  if (!reason) {
    errors.reason = 'Enter a termination reason.'
  } else if (reason.length > POST_PLACEMENT_REASON_MAX) {
    errors.reason = `Keep the termination reason to ${POST_PLACEMENT_REASON_MAX} characters.`
  }
  const terminatedOn = blankToNull(options.draft.terminatedOn)
  if (terminatedOn && !isValidDateOnly(terminatedOn)) {
    errors.terminatedOn = 'Enter a valid termination date, or leave it blank.'
  }
  if (errors.outcome || errors.reason || errors.terminatedOn) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    args: {
      p_application_id: options.applicationId,
      p_status: options.draft.outcome as PostPlacementOutcome,
      p_reason: reason,
      p_terminated_on: terminatedOn,
    },
  }
}
