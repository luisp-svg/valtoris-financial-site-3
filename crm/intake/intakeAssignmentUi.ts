import { isIntakeArchiveBlockedByDuplicateReview } from './intakeArchiveUi'
import type { IntakeQueueItem } from './types'

export const INTAKE_ASSIGN_ADVISOR_ACTION_LABEL = 'Assign Advisor'

export const INTAKE_ASSIGN_SUCCESS_COPY = 'Household assignment updated.'

export const INTAKE_WORKFLOW_DUPLICATE_BLOCK_COPY =
  'Resolve the possible duplicate before assigning or creating an Opportunity.'

export const INTAKE_ASSIGN_RPC_BEHAVIOR_COPY =
  'This uses the existing household assignment action. It may update the household, applicable Intake leads, and open or on-hold Opportunities.'

export function intakeAssignConfirmationCopy(advisorName: string): string {
  const name = advisorName.trim() || 'this advisor'
  return `Assign this household and its active work to ${name}?`
}

/**
 * Owner-only. Matches assign_household. Assigned advisors and unassigned-pool
 * visibility do not receive reassignment control.
 */
export function canPresentIntakeAssignAdvisorAction(input: {
  isOwner: boolean
  householdId: string | null
}): boolean {
  return input.isOwner && Boolean(input.householdId)
}

export function intakeAssignVisibilityForItem(
  item: Pick<
    IntakeQueueItem,
    'household' | 'leadStatus' | 'duplicateReview' | 'duplicateReviewStatus'
  >,
  access: { isOwner: boolean },
): {
  canPresent: boolean
  blockedByDuplicate: boolean
} {
  return {
    canPresent: canPresentIntakeAssignAdvisorAction({
      isOwner: access.isOwner,
      householdId: item.household?.id ?? null,
    }),
    blockedByDuplicate: isIntakeArchiveBlockedByDuplicateReview({
      leadStatus: item.leadStatus,
      duplicateReviewStatus: item.duplicateReview?.status ?? item.duplicateReviewStatus,
    }),
  }
}
