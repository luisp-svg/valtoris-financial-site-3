import type { BusinessAssessmentAnswers } from '../../../components/assessment/business/types.js'
import type { RetirementAssessmentAnswers } from '../../../components/assessment/retirement/types.js'
import type { CreditAssessmentAnswers } from '../../../components/assessment/credit/types.js'
import type { StudentLoanAssessmentAnswers } from '../../../components/assessment/studentLoan/types.js'
import type { DemoAssessmentAnswers } from '../../../components/assessment/types.js'
import type { CalculatorAnswers } from '../../../components/calculator/types.js'
import {
  PUBLIC_REPORT_CARD_ASSESSMENT_VERSION,
  PUBLIC_REPORT_CARD_SCORING_VERSION,
  type PublicReportCardAssessmentType,
} from '../../../modules/reportCard/publicIngestCatalog.js'

/**
 * Public Report Card → CRM ingest — shared types.
 * Family remains the reference contract from supabase/migrations/020.
 * Generalized in supabase/migrations/043_public_report_card_ingest.sql.
 */

/** Bump when the request/response contract for this endpoint changes. */
export const ASSESSMENT_VERSION = PUBLIC_REPORT_CARD_ASSESSMENT_VERSION

/** Bump when the server scoring formulas materially change (keeps history comparable). */
export const FAMILY_REPORT_CARD_SCORING_VERSION = PUBLIC_REPORT_CARD_SCORING_VERSION.family
export const BUSINESS_REPORT_CARD_SCORING_VERSION = PUBLIC_REPORT_CARD_SCORING_VERSION.business
export const RETIREMENT_REPORT_CARD_SCORING_VERSION = PUBLIC_REPORT_CARD_SCORING_VERSION.retirement
export const PROTECTION_GAP_RESULT_VERSION = PUBLIC_REPORT_CARD_SCORING_VERSION.protection
export const STUDENT_LOAN_REPORT_CARD_SCORING_VERSION = PUBLIC_REPORT_CARD_SCORING_VERSION.student_loan
export const CREDIT_REPORT_CARD_SCORING_VERSION = PUBLIC_REPORT_CARD_SCORING_VERSION.credit

export type { PublicReportCardAssessmentType }

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

export type PublicReportCardAnswers =
  | DemoAssessmentAnswers
  | BusinessAssessmentAnswers
  | RetirementAssessmentAnswers
  | CalculatorAnswers
  | StudentLoanAssessmentAnswers
  | CreditAssessmentAnswers

/** Fully validated + typed public ingest request body. */
export type FamilyReportCardIngestRequest = {
  submissionId: string
  assessmentType: PublicReportCardAssessmentType
  assessmentVersion: number
  answers: PublicReportCardAnswers
  sourcePage: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  referrer: string | null
  cardPublicKey: string | null
  cardSlug: string | null
  campaignCode: string | null
  eventCode: string | null
  sourceChannel: string | null
  clientReportedScore: number | null
  clientReportedGrade: string | null
  consent: ConsentSnapshot
  submittedAt: string | null
}

export type PublicReportCardIngestRequest = FamilyReportCardIngestRequest

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
