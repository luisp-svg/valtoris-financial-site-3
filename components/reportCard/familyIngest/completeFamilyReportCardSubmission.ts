import { scoreBusinessAssessment } from '../../assessment/scoring/scoreBusinessAssessment'
import { scoreFamilyAssessment } from '../../assessment/scoring/scoreFamilyAssessment'
import { scoreRetirementAssessment } from '../../assessment/scoring/scoreRetirementAssessment'
import { scoreCreditAssessment } from '../../assessment/credit/scoreCreditAssessment'
import { scoreStudentLoanAssessment } from '../../assessment/studentLoan/scoreStudentLoanAssessment'
import type { BusinessAssessmentAnswers } from '../../assessment/business/types'
import type { CreditAssessmentAnswers } from '../../assessment/credit/types'
import type { RetirementAssessmentAnswers } from '../../assessment/retirement/types'
import type { StudentLoanAssessmentAnswers } from '../../assessment/studentLoan/types'
import type { DemoAssessmentAnswers } from '../../assessment/types'
import type { CalculatorAnswers } from '../../calculator/types'
import type { PublicReportCardAssessmentType } from '../../../modules/reportCard/publicIngestCatalog'
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
  FAMILY_INGEST_SESSION_KEY,
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

export async function completePublicReportCardCrmSubmission(input: {
  assessmentType: PublicReportCardAssessmentType
  answers:
    | DemoAssessmentAnswers
    | BusinessAssessmentAnswers
    | RetirementAssessmentAnswers
    | CalculatorAnswers
    | StudentLoanAssessmentAnswers
    | CreditAssessmentAnswers
  consent: FamilyConsentState
  session: FamilyIngestSession
  honeypotWebsite?: string
  submitOptions?: SubmitFamilyReportCardToCrmOptions
  nowIso?: string
  randomUuid?: () => string
  storageKey?: string
  sourcePage?: string
  phone: string
}): Promise<{
  result: FamilySubmitOrchestrationResult
  session: FamilyIngestSession
}> {
  const storageKey = input.storageKey ?? FAMILY_INGEST_SESSION_KEY
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
    storageKey,
  )
  let session = markFamilyIngestStatus(withId, 'submitting', storageKey)

  const nowIso = input.nowIso ?? new Date().toISOString()
  let clientReportedScore: number | null = null
  let clientReportedGrade: string | null = null
  if (input.assessmentType === 'family') {
    const scored = scoreFamilyAssessment(input.answers as DemoAssessmentAnswers)
    clientReportedScore = scored.overallScore
    clientReportedGrade = scored.overallGrade
  } else if (input.assessmentType === 'business') {
    const scored = scoreBusinessAssessment(input.answers as BusinessAssessmentAnswers)
    clientReportedScore = scored.overallScore
    clientReportedGrade = scored.overallGrade
  } else if (input.assessmentType === 'retirement') {
    const scored = scoreRetirementAssessment(input.answers as RetirementAssessmentAnswers)
    clientReportedScore = scored.overallScore
    clientReportedGrade = scored.overallGrade
  } else if (input.assessmentType === 'student_loan') {
    const scored = scoreStudentLoanAssessment((input.answers as StudentLoanAssessmentAnswers).diagnostic)
    clientReportedScore = scored.overallScore
    clientReportedGrade = scored.grade
  } else if (input.assessmentType === 'credit') {
    const scored = scoreCreditAssessment((input.answers as CreditAssessmentAnswers).diagnostic)
    clientReportedScore = scored.overallScore
    clientReportedGrade = scored.grade
  }

  const consentSnapshot = buildFamilyConsentSnapshot({
    consent: input.consent,
    phone: input.phone,
    nowIso,
  })

  const defaultSourcePage =
    input.assessmentType === 'family'
      ? ROUTES.familyAssessment
      : input.assessmentType === 'business'
        ? ROUTES.businessAssessment
        : input.assessmentType === 'retirement'
          ? ROUTES.retirementAssessment
          : input.assessmentType === 'student_loan'
            ? ROUTES.studentLoanAssessment
            : input.assessmentType === 'credit'
              ? ROUTES.creditAssessment
              : ROUTES.protectionGap

  const payload = buildFamilyReportCardIngestPayload({
    submissionId,
    answers: input.answers,
    session,
    consent: consentSnapshot,
    sourcePage: input.sourcePage ?? (getSourcePage() || defaultSourcePage),
    clientReportedScore,
    clientReportedGrade,
    submittedAt: nowIso,
    honeypotWebsite: input.honeypotWebsite ?? '',
    assessmentType: input.assessmentType,
  })

  const crm = await submitFamilyReportCardToCrm(payload, input.submitOptions)

  if (!crm.ok) {
    session = markFamilyIngestStatus(session, 'failed', storageKey)
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

  session = markFamilyIngestStatus(session, 'succeeded', storageKey)
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
  return completePublicReportCardCrmSubmission({
    assessmentType: 'family',
    answers: input.answers,
    consent: input.consent,
    session: input.session,
    honeypotWebsite: input.honeypotWebsite,
    submitOptions: input.submitOptions,
    nowIso: input.nowIso,
    randomUuid: input.randomUuid,
    phone: input.answers.family.phone,
    sourcePage: getSourcePage() || ROUTES.familyAssessment,
  })
}
