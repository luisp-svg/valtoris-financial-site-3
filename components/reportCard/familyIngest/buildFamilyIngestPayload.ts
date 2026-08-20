import type { DemoAssessmentAnswers } from '../../assessment/types'
import type { FamilyConsentSnapshot } from './familyConsent'
import type { FamilyIngestSession } from './submissionSession'

/** Client request body for POST /api/ingest-family-report-card (unified report-card contract). */
export type FamilyReportCardClientIngestBody = {
  submissionId: string
  assessmentType: 'family' | 'business' | 'retirement' | 'protection'
  assessmentVersion: number
  answers: DemoAssessmentAnswers | unknown
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
  consent: FamilyConsentSnapshot
  submittedAt: string | null
  formStartedAt: string | null
  /** Honeypot — must remain empty. */
  website: string
}

export const FAMILY_REPORT_CARD_ASSESSMENT_VERSION = 1

export function buildFamilyReportCardIngestPayload(input: {
  submissionId: string
  answers: DemoAssessmentAnswers | unknown
  session: FamilyIngestSession
  consent: FamilyConsentSnapshot
  sourcePage: string | null
  clientReportedScore: number | null
  clientReportedGrade: string | null
  submittedAt?: string | null
  honeypotWebsite?: string
  assessmentType?: FamilyReportCardClientIngestBody['assessmentType']
  assessmentVersion?: number
}): FamilyReportCardClientIngestBody {
  const card = input.session.cardAttribution ?? {
    cardPublicKey: null,
    cardSlug: null,
    campaignCode: null,
    eventCode: null,
    sourceChannel: null,
  }
  return {
    submissionId: input.submissionId,
    assessmentType: input.assessmentType ?? 'family',
    assessmentVersion: input.assessmentVersion ?? FAMILY_REPORT_CARD_ASSESSMENT_VERSION,
    answers: input.answers,
    sourcePage: input.sourcePage,
    utmSource: input.session.utm.utmSource,
    utmMedium: input.session.utm.utmMedium,
    utmCampaign: input.session.utm.utmCampaign,
    utmTerm: input.session.utm.utmTerm,
    utmContent: input.session.utm.utmContent,
    referrer: input.session.referrer,
    cardPublicKey: card.cardPublicKey,
    cardSlug: card.cardSlug,
    campaignCode: card.campaignCode,
    eventCode: card.eventCode,
    sourceChannel: card.sourceChannel,
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
