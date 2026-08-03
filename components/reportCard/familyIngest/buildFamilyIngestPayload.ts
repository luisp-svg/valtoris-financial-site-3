import type { DemoAssessmentAnswers } from '../../assessment/types'
import type { FamilyConsentSnapshot } from './familyConsent'
import type { FamilyIngestSession } from './submissionSession'

/** Client request body for POST /api/ingest-family-report-card (Phase 2 contract). */
export type FamilyReportCardClientIngestBody = {
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
  consent: FamilyConsentSnapshot
  submittedAt: string | null
  formStartedAt: string | null
  /** Honeypot — must remain empty. */
  website: string
}

export const FAMILY_REPORT_CARD_ASSESSMENT_VERSION = 1

export function buildFamilyReportCardIngestPayload(input: {
  submissionId: string
  answers: DemoAssessmentAnswers
  session: FamilyIngestSession
  consent: FamilyConsentSnapshot
  sourcePage: string | null
  clientReportedScore: number | null
  clientReportedGrade: string | null
  submittedAt?: string | null
  honeypotWebsite?: string
}): FamilyReportCardClientIngestBody {
  return {
    submissionId: input.submissionId,
    assessmentType: 'family',
    assessmentVersion: FAMILY_REPORT_CARD_ASSESSMENT_VERSION,
    answers: input.answers,
    sourcePage: input.sourcePage,
    utmSource: input.session.utm.utmSource,
    utmMedium: input.session.utm.utmMedium,
    utmCampaign: input.session.utm.utmCampaign,
    utmTerm: input.session.utm.utmTerm,
    utmContent: input.session.utm.utmContent,
    referrer: input.session.referrer,
    clientReportedScore: input.clientReportedScore,
    clientReportedGrade: input.clientReportedGrade,
    consent: {
      assessmentStorageAcknowledged: input.consent.assessmentStorageAcknowledged === true,
      contactPermission: input.consent.contactPermission === true,
      emailMarketingConsent: input.consent.emailMarketingConsent === true,
      smsMarketingConsent: input.consent.smsMarketingConsent === true,
      privacyAcknowledged: input.consent.privacyAcknowledged === true,
      consentVersion: input.consent.consentVersion,
      consentedAt: input.consent.consentedAt,
    },
    submittedAt: input.submittedAt ?? new Date().toISOString(),
    formStartedAt: input.session.formStartedAt,
    website: input.honeypotWebsite ?? '',
  }
}
