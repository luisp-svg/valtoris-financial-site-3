/**
 * CRM Intake — typed domain models for public Family Report Card prospects.
 * Match/sheets/consent fields live on `leads` (migration 020).
 * Follow-up task automation fields live on leads/tasks (migration 022).
 */

import type {
  FollowUpTaskAutomationStatus,
  IntakeFollowUpTaskSummary,
  IntakeTaskIndicator,
} from './intakeTaskAutomation'

export type {
  FollowUpTaskAutomationStatus,
  IntakeFollowUpTaskSummary,
  IntakeTaskIndicator,
} from './intakeTaskAutomation'

export type IngestMatchStatus =
  | 'exact_trusted_match'
  | 'possible_match'
  | 'new_prospect'

export type LeadStatus =
  | 'new'
  | 'unassigned'
  | 'assigned'
  | 'converted'
  | 'closed_lost'
  | 'duplicate_review'

export type DuplicateReviewStatus =
  | 'none'
  | 'pending'
  | 'confirmed_unique'
  | 'merged'
  | 'dismissed'

export type SheetsSyncStatus = 'pending' | 'succeeded' | 'failed' | 'skipped'

export type IntakeConsentSummary = {
  assessmentStorageAcknowledged: boolean
  contactPermission: boolean
  emailMarketingConsent: boolean
  smsMarketingConsent: boolean
  privacyAcknowledged: boolean
  consentVersion: string | null
  consentedAt: string | null
}

export type IntakeCategoryScore = {
  id: string
  title: string
  score: number | null
  grade: string | null
}

export type IntakeDiagnosticSummary = {
  assessmentId: string
  overallScore: number | null
  overallGrade: string | null
  categories: IntakeCategoryScore[]
  topPriorities: string[]
  captureChannel: string
  scoringVersion: number | null
  completedAt: string | null
  /** UI label — never "Financial Progress". */
  productLabel: 'Initial Financial Diagnostic'
}

export type IntakeAdvisorSummary = {
  id: string
  displayName: string
}

export type IntakeHouseholdSummary = {
  id: string
  displayName: string
  status: string
  primaryEmail: string | null
  primaryPhone: string | null
  assignedAdvisor: IntakeAdvisorSummary | null
  duplicateReviewStatus: DuplicateReviewStatus
  mergedIntoHouseholdId: string | null
  deletedAt: string | null
}

export type IntakeDuplicateReviewSummary = {
  id: string
  status: DuplicateReviewStatus
  matchReason: string
  matchConfidence: string
  candidateHouseholdId: string
  provisionalHouseholdId: string | null
  resolutionNotes: string | null
  resolvedAt: string | null
  resolvedByUserId: string | null
}

export type IntakeQueueItem = {
  leadId: string
  householdId: string
  leadType: string
  leadStatus: LeadStatus
  ingestMatchStatus: IngestMatchStatus | null
  duplicateReviewStatus: DuplicateReviewStatus
  submittedAt: string
  sourcePage: string | null
  overallScore: number | null
  overallGrade: string | null
  /** Submitted contact snapshot from raw_payload / lead fields. */
  submittedFirstName: string
  submittedLastName: string
  submittedFullName: string
  submittedEmail: string | null
  submittedPhone: string | null
  normalizedEmail: string | null
  normalizedPhone: string | null
  sheetsSyncStatus: SheetsSyncStatus | null
  consent: IntakeConsentSummary
  household: IntakeHouseholdSummary | null
  assignedAdvisor: IntakeAdvisorSummary | null
  diagnostic: IntakeDiagnosticSummary | null
  duplicateReview: IntakeDuplicateReviewSummary | null
  originalCampaign: string | null
  sourceMetadata: Record<string, unknown>
  /** Follow-up task automation (migration 022). Null when not loaded. */
  followUpTaskAutomationStatus: FollowUpTaskAutomationStatus | null
  followUpTask: IntakeFollowUpTaskSummary | null
  taskIndicators: IntakeTaskIndicator[]
  taskCreationIssueMessage: string | null
}

export type IntakeFilterId =
  | 'all'
  | 'needs_review'
  | 'new_prospects'
  | 'exact_matches'
  | 'possible_duplicates'
  | 'resolved'
  | 'unassigned'
  | 'assigned_to_me'
  | 'sheets_failed'

export type IntakeQueueCounts = Record<IntakeFilterId, number>

export type IntakeLoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export type DuplicateResolutionWriteAction =
  | 'confirm_same_household'
  | 'keep_separate'

/** UI-only non-mutating actions (not sent to the RPC). */
export type DuplicateResolutionUiAction =
  | DuplicateResolutionWriteAction
  | 'leave_pending'

export type DuplicateResolutionResult = {
  ok: true
  action: DuplicateResolutionWriteAction
  duplicateReviewId: string
  leadId: string
  assessmentId: string | null
  resultingHouseholdId: string
  provisionalHouseholdId: string | null
  resolvedAt: string
  alreadyResolved: boolean
}

export type DuplicateResolutionErrorCode =
  | 'not_authenticated'
  | 'not_authorized'
  | 'invalid_action'
  | 'not_found'
  | 'already_resolved_conflict'
  | 'invalid_candidate'
  | 'invalid_provisional'
  | 'invalid_assessment'
  | 'unsafe_dependents'
  | 'notes_too_long'
  | 'same_household'
  | 'unknown'

export type DuplicateResolutionFailure = {
  ok: false
  code: DuplicateResolutionErrorCode
  message: string
}

export type DuplicateResolutionResponse = DuplicateResolutionResult | DuplicateResolutionFailure

/** Migration 021 is present — owner write resolution is available via RPC. */
export const DUPLICATE_RESOLUTION_REQUIRES_MIGRATION_021 = false as const

export const DUPLICATE_RESOLUTION_MAX_NOTES_LENGTH = 2000

export const DUPLICATE_RESOLUTION_OWNER_ONLY_MESSAGE =
  'Only owners can resolve possible duplicate reviews in this release. Advisors can open linked households but cannot confirm or dismiss matches.'
