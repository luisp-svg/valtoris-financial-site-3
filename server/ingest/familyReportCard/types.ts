import type { DemoAssessmentAnswers } from '../../../components/assessment/types'

/**
 * Public Family Report Card → CRM ingest — shared types.
 * Mirrors the DB contracts introduced in supabase/migrations/020_public_family_diagnostic_ingest.sql.
 */

/** Bump when the request/response contract for this endpoint changes. */
export const ASSESSMENT_VERSION = 1

/** Bump when the server scoring formulas materially change (keeps history comparable). */
export const FAMILY_REPORT_CARD_SCORING_VERSION = 1

export type MatchStatus = 'exact_trusted_match' | 'possible_match' | 'new_prospect'

export type MatchConfidence = 'high' | 'medium' | 'low'

export type SheetsSyncStatus = 'pending' | 'succeeded' | 'failed' | 'skipped'

export type SheetsErrorCategory =
  | 'not_configured'
  | 'timeout'
  | 'http_error'
  | 'network_error'
  | 'malformed_response'

/**
 * Explicit consent snapshot at capture time.
 * Missing keys must always resolve to false/null — never infer consent from
 * the mere presence of an email or phone number.
 */
export type ConsentSnapshot = {
  assessmentStorageAcknowledged: boolean
  contactPermission: boolean
  emailMarketingConsent: boolean
  smsMarketingConsent: boolean
  privacyAcknowledged: boolean
  consentVersion: string | null
  consentedAt: string | null
}

/** Fully validated + typed public ingest request body. */
export type FamilyReportCardIngestRequest = {
  submissionId: string
  assessmentType: 'family'
  assessmentVersion: number
  answers: DemoAssessmentAnswers
  sourcePage: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  referrer: string | null
  clientReportedScore: number | null
  clientReportedGrade: string | null
  consent: ConsentSnapshot
  submittedAt: string | null
}

export type FamilyReportCardIngestSuccess = {
  ok: true
  created: boolean
  submissionId: string
  assessmentId: string | null
  matchStatus: MatchStatus
  sheetsSync: {
    status: SheetsSyncStatus
    errorCategory?: SheetsErrorCategory
  }
}

export type FamilyReportCardIngestError = {
  ok: false
  error: string
  code: string
}

export type FamilyReportCardIngestResult = FamilyReportCardIngestSuccess | FamilyReportCardIngestError

/** A potential existing CRM contact considered during identity matching. */
export type MatchCandidate = {
  householdId: string
  displayName: string | null
  normalizedEmail: string | null
  normalizedPhone: string | null
  firstName: string | null
  lastName: string | null
  source: 'household' | 'member'
  memberId?: string
  isDeleted?: boolean
}

export type MatchClassificationResult = {
  status: MatchStatus
  matchedHouseholdId?: string
  candidateHouseholdId?: string
  matchReason: string
  matchConfidence: MatchConfidence
  candidatesConsidered: number
}
