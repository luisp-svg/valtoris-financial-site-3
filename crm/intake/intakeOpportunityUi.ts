import { isIntakeArchiveBlockedByDuplicateReview } from './intakeArchiveUi'
import type { IntakeQueueItem } from './types'

export const INTAKE_CREATE_OPPORTUNITY_ACTION_LABEL = 'Create Opportunity'

export const INTAKE_CREATE_OPPORTUNITY_SUCCESS_COPY =
  'Opportunity created and added to Pipeline.'

/**
 * Follows opportunities_insert: owner, or advisor with household assignment
 * (crm_can_access_household). Unassigned-pool Intake visibility is not enough.
 */
export function canPresentIntakeCreateOpportunityAction(input: {
  isOwner: boolean
  currentAdvisorProfileId: string | null
  householdId: string | null
  householdAssignedAdvisorId: string | null
}): boolean {
  if (!input.householdId) return false
  if (input.isOwner) return true
  if (!input.currentAdvisorProfileId || !input.householdAssignedAdvisorId) return false
  return input.currentAdvisorProfileId === input.householdAssignedAdvisorId
}

export function intakeCreateOpportunityVisibilityForItem(
  item: Pick<
    IntakeQueueItem,
    'household' | 'leadStatus' | 'duplicateReview' | 'duplicateReviewStatus'
  >,
  access: { isOwner: boolean; currentAdvisorProfileId: string | null },
): {
  canPresent: boolean
  blockedByDuplicate: boolean
} {
  return {
    canPresent: canPresentIntakeCreateOpportunityAction({
      isOwner: access.isOwner,
      currentAdvisorProfileId: access.currentAdvisorProfileId,
      householdId: item.household?.id ?? null,
      householdAssignedAdvisorId: item.household?.assignedAdvisor?.id ?? null,
    }),
    blockedByDuplicate: isIntakeArchiveBlockedByDuplicateReview({
      leadStatus: item.leadStatus,
      duplicateReviewStatus: item.duplicateReview?.status ?? item.duplicateReviewStatus,
    }),
  }
}
