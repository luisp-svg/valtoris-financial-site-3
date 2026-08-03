import { scoreFamilyAssessment } from '../../assessment/scoring/scoreFamilyAssessment'
import type { DemoAssessmentAnswers } from '../../assessment/types'
import { getSourcePage } from '../../../utils/submitLeadToGoogleSheets'
import { ROUTES } from '../../../constants/routes'
import {
  buildFamilyConsentSnapshot,
  type FamilyConsentState,
  validateRequiredFamilyConsent,
} from './familyConsent'
import { buildFamilyReportCardIngestPayload } from './buildFamilyIngestPayload'
import {
  submitFamilyReportCardToCrm,
  type FamilyCrmSubmitResult,
  type SubmitFamilyReportCardToCrmOptions,
} from './submitFamilyReportCardToCrm'
import {
  ensureFamilySubmissionId,
  markFamilyIngestStatus,
  type FamilyIngestSession,
} from './submissionSession'

export type FamilySubmitOrchestrationSuccess = {
  ok: true
  navigateToResults: true
  submissionId: string
  crm: Extract<FamilyCrmSubmitResult, { ok: true }>
}

export type FamilySubmitOrchestrationFailure = {
  ok: false
  navigateToResults: false
  error: string
  code: string
  submissionId: string | null
  /** Missing required consent fields when validation fails locally. */
  consentMissing?: Array<'assessmentStorageAcknowledged' | 'privacyAcknowledged'>
}

export type FamilySubmitOrchestrationResult =
  | FamilySubmitOrchestrationSuccess
  | FamilySubmitOrchestrationFailure

/**
 * Completes a Family Report Card submission:
 * validate consent → stable UUID → score → CRM POST → navigate only on CRM success.
 * Google Sheets is handled exclusively by the server ingest path.
 */
export async function completeFamilyReportCardCrmSubmission(input: {
  answers: DemoAssessmentAnswers
  consent: FamilyConsentState
  session: FamilyIngestSession
  honeypotWebsite?: string
  submitOptions?: SubmitFamilyReportCardToCrmOptions
  nowIso?: string
  randomUuid?: () => string
}): Promise<{
  result: FamilySubmitOrchestrationResult
  session: FamilyIngestSession
}> {
  const consentCheck = validateRequiredFamilyConsent(input.consent)
  if (!consentCheck.ok) {
    return {
      session: input.session,
      result: {
        ok: false,
        navigateToResults: false,
        error: 'Please confirm the required acknowledgments before viewing your report.',
        code: 'consent_required',
        submissionId: input.session.submissionId,
        consentMissing: consentCheck.missing,
      },
    }
  }

  const { session: withId, submissionId } = ensureFamilySubmissionId(
    input.session,
    input.randomUuid,
  )
  let session = markFamilyIngestStatus(withId, 'submitting')

  const nowIso = input.nowIso ?? new Date().toISOString()
  const scored = scoreFamilyAssessment(input.answers)
  const consentSnapshot = buildFamilyConsentSnapshot({
    consent: input.consent,
    phone: input.answers.family.phone,
    nowIso,
  })

  const payload = buildFamilyReportCardIngestPayload({
    submissionId,
    answers: input.answers,
    session,
    consent: consentSnapshot,
    sourcePage: getSourcePage() || ROUTES.familyAssessment,
    clientReportedScore: scored.overallScore,
    clientReportedGrade: scored.overallGrade,
    submittedAt: nowIso,
    honeypotWebsite: input.honeypotWebsite ?? '',
  })

  const crm = await submitFamilyReportCardToCrm(payload, input.submitOptions)

  if (!crm.ok) {
    session = markFamilyIngestStatus(session, 'failed')
    return {
      session,
      result: {
        ok: false,
        navigateToResults: false,
        error: crm.error,
        code: crm.code,
        submissionId,
      },
    }
  }

  session = markFamilyIngestStatus(session, 'succeeded')
  return {
    session,
    result: {
      ok: true,
      navigateToResults: true,
      submissionId,
      crm,
    },
  }
}
