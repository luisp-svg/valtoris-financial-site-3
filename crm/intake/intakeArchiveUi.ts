import type {
  DuplicateReviewStatus,
  IntakeArchiveReason,
  IntakeQueueItem,
  LeadStatus,
} from './types'

export const INTAKE_ARCHIVE_ACTION_LABEL = 'Archive / Dismiss'

export const INTAKE_ARCHIVE_CONFIRM_COPY =
  'This removes the submission from active Intake. The household, assessment, and CRM history will remain.'

export const INTAKE_ARCHIVE_SUCCESS_COPY =
  'Intake archived. Household and CRM history were retained.'

export const INTAKE_ARCHIVE_TASK_COMPLETED_COPY = 'Associated Intake follow-up task completed.'

export const INTAKE_ARCHIVE_DUPLICATE_BLOCK_COPY =
  'Resolve the possible duplicate before archiving this Intake.'

export const INTAKE_ARCHIVE_REASON_OPTIONS = [
  {
    value: 'dismissed' as const,
    label: 'Dismissed',
    help: 'No further action is needed on this Intake right now.',
  },
  {
    value: 'not_a_fit' as const,
    label: 'Not a Fit',
    help: 'The submission is not a current fit for follow-up.',
  },
  {
    value: 'spam' as const,
    label: 'Spam',
    help: 'The submission will leave active Intake, but CRM history is retained.',
  },
  {
    value: 'test_or_accidental' as const,
    label: 'Test / Accidental',
    help: 'This archives the Intake only. It does not permanently delete the household or CRM history.',
  },
] satisfies ReadonlyArray<{
  value: IntakeArchiveReason
  label: string
  help: string
}>

/**
 * Conservative Archive visibility. Unassigned-pool visibility is not mutation
 * permission. Server RPC still enforces authorization.
 */
export function canPresentIntakeArchiveAction(input: {
  isOwner: boolean
  currentAdvisorProfileId: string | null
  leadAssignedAdvisorId: string | null
  householdAssignedAdvisorId: string | null
}): boolean {
  if (input.isOwner) return true
  if (!input.currentAdvisorProfileId) return false
  return (
    input.currentAdvisorProfileId === input.leadAssignedAdvisorId ||
    input.currentAdvisorProfileId === input.householdAssignedAdvisorId
  )
}

export function isIntakeArchiveBlockedByDuplicateReview(input: {
  leadStatus: LeadStatus
  duplicateReviewStatus?: DuplicateReviewStatus | null
}): boolean {
  return input.leadStatus === 'duplicate_review' || input.duplicateReviewStatus === 'pending'
}

export function intakeArchiveVisibilityForItem(
  item: Pick<IntakeQueueItem, 'leadStatus' | 'duplicateReview' | 'duplicateReviewStatus' | 'assignedAdvisor' | 'household'>,
  access: { isOwner: boolean; currentAdvisorProfileId: string | null },
): {
  canPresent: boolean
  blockedByDuplicate: boolean
} {
  return {
    canPresent: canPresentIntakeArchiveAction({
      isOwner: access.isOwner,
      currentAdvisorProfileId: access.currentAdvisorProfileId,
      leadAssignedAdvisorId: item.assignedAdvisor?.id ?? null,
      householdAssignedAdvisorId: item.household?.assignedAdvisor?.id ?? null,
    }),
    blockedByDuplicate: isIntakeArchiveBlockedByDuplicateReview({
      leadStatus: item.leadStatus,
      duplicateReviewStatus: item.duplicateReview?.status ?? item.duplicateReviewStatus,
    }),
  }
}
