/**
 * Pure helpers for duplicate-resolution UI state (no DOM harness in repo).
 */

import type { DuplicateResolutionWriteAction } from './types'

export function canOwnerResolveDuplicate(options: {
  isOwner: boolean
  reviewStatus: string | null | undefined
  resolving: boolean
  alreadySucceeded: boolean
}): boolean {
  return (
    options.isOwner &&
    options.reviewStatus === 'pending' &&
    !options.resolving &&
    !options.alreadySucceeded
  )
}

export function duplicateConfirmCopy(action: DuplicateResolutionWriteAction): {
  title: string
  confirmLabel: string
  mentionsCanonicalContactUnchanged: boolean
  mentionsProvisionalMerged: boolean
  mentionsKeepSeparate: boolean
} {
  if (action === 'confirm_same_household') {
    return {
      title: 'Confirm same household',
      confirmLabel: 'Confirm Same Household',
      mentionsCanonicalContactUnchanged: true,
      mentionsProvisionalMerged: true,
      mentionsKeepSeparate: false,
    }
  }
  return {
    title: 'Keep as separate household',
    confirmLabel: 'Keep as Separate Household',
    mentionsCanonicalContactUnchanged: false,
    mentionsProvisionalMerged: false,
    mentionsKeepSeparate: true,
  }
}

/** After successful confirm, public assessment must still be treated as IFD not FP. */
export function postResolutionProvenanceGuard(assessment: {
  assessment_type: string
  capture_channel: string
  overall_score: number | null
  overall_grade: string | null
}): {
  remainsPublicSelfReport: boolean
  remainsFamily: boolean
  eligibleForFinancialProgress: boolean
  scoreUnchanged: number | null
  gradeUnchanged: string | null
} {
  return {
    remainsPublicSelfReport: assessment.capture_channel === 'public_self_report',
    remainsFamily: assessment.assessment_type === 'family',
    eligibleForFinancialProgress: assessment.capture_channel !== 'public_self_report',
    scoreUnchanged: assessment.overall_score,
    gradeUnchanged: assessment.overall_grade,
  }
}
