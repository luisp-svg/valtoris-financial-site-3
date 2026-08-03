/**
 * Phase 6 follow-up workflow types for public Family Initial Financial Diagnostics.
 * Persistence: migration 022 (`tasks.workflow_type` + linkage columns).
 */

export const PUBLIC_FAMILY_TASK_WORKFLOW_TYPES = [
  'review_initial_diagnostic',
  'resolve_possible_duplicate',
] as const

export type PublicFamilyTaskWorkflowType = (typeof PUBLIC_FAMILY_TASK_WORKFLOW_TYPES)[number]

export type PublicFamilyMatchStatus =
  | 'new_prospect'
  | 'exact_trusted_match'
  | 'possible_match'

export type ContactPermissionState = 'granted' | 'denied' | 'unknown'

export type TaskAutomationDecision =
  | {
      shouldCreate: true
      workflowType: PublicFamilyTaskWorkflowType
      priority: 'low' | 'medium' | 'high' | 'urgent'
      /** Calendar days after submission/resolution date (simple day math; no holiday calendar). */
      dueInDays: number
      /** profiles.id when assignment is known; otherwise null. */
      assignToUserId: string | null
      reason: string
    }
  | {
      shouldCreate: false
      workflowType: null
      reason: string
    }

export type FollowUpConsentInput = {
  contactPermission?: boolean | null
  emailMarketingConsent?: boolean | null
  smsMarketingConsent?: boolean | null
  assessmentStorageAcknowledged?: boolean | null
  privacyAcknowledged?: boolean | null
}

export type FollowUpAutomationInput = {
  matchStatus: PublicFamilyMatchStatus
  consent: FollowUpConsentInput
  /** profiles.id for the assigned advisor, when household/lead already assigned. */
  assignedAdvisorUserId: string | null
  /** After migration 021 confirm/keep, automation runs review workflow. */
  resolutionAction?: 'confirm_same_household' | 'keep_separate' | null
  householdMergedIntoId?: string | null
  householdDeletedAt?: string | null
}

export function buildPublicFamilyTaskIdempotencyKey(
  assessmentId: string,
  workflowType: PublicFamilyTaskWorkflowType,
): string {
  return `public_family:${assessmentId}:${workflowType}`
}

export function resolveContactPermissionState(
  consent: FollowUpConsentInput,
): ContactPermissionState {
  if (consent.contactPermission === true) return 'granted'
  if (consent.contactPermission === false) return 'denied'
  return 'unknown'
}

export function workflowForMatchStatus(
  matchStatus: PublicFamilyMatchStatus,
  options?: { resolutionAction?: 'confirm_same_household' | 'keep_separate' | null },
): PublicFamilyTaskWorkflowType {
  if (options?.resolutionAction) return 'review_initial_diagnostic'
  if (matchStatus === 'possible_match') return 'resolve_possible_duplicate'
  return 'review_initial_diagnostic'
}
