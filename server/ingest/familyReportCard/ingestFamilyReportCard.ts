import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessAssessmentAnswers } from '../../../components/assessment/business/types.js'
import type { RetirementAssessmentAnswers } from '../../../components/assessment/retirement/types.js'
import type { CreditAssessmentAnswers } from '../../../components/assessment/credit/types.js'
import type { StudentLoanAssessmentAnswers } from '../../../components/assessment/studentLoan/types.js'
import type { DemoAssessmentAnswers } from '../../../components/assessment/types.js'
import type { CalculatorAnswers } from '../../../components/calculator/types.js'
import { createSupabaseAdminClient } from '../../../lib/supabase/admin.js'
import {
  leadTypeForAssessment,
  REPORT_PATH_BY_ASSESSMENT,
  type PublicReportCardAssessmentType,
} from '../../../modules/reportCard/publicIngestCatalog.js'
import { resolveCardForIngest } from '../digitalIdentity/resolveCardForIngest.js'
import { resolveTrustedCampaignAttribution } from '../digitalIdentity/resolveTrustedCampaign.js'
import { normalizeConsentSnapshot } from './consent.js'
import { findMatchCandidates } from './findCandidates.js'
import { classifyMatch } from './match.js'
import { normalizePublicReportCardContact } from './normalize.js'
import { persistFamilyReportCardIngest, updateLeadSheetsSync } from './persist.js'
import {
  compareClientScore,
  recalculateBusinessReportCardScore,
  recalculateFamilyReportCardScore,
  recalculateProtectionGapResult,
  recalculateRetirementReportCardScore,
  recalculateCreditReportCardScore,
  recalculateStudentLoanReportCardScore,
} from './score.js'
import {
  buildBusinessReportCardSheetsPayload,
  buildFamilyReportCardSheetsPayload,
  buildProtectionGapSheetsPayload,
  buildRetirementReportCardSheetsPayload,
  buildCreditReportCardSheetsPayload,
  buildStudentLoanReportCardSheetsPayload,
  writePublicReportCardToSheets,
} from './sheets.js'
import { orchestrateIngestFollowUpTask } from './taskAutomation.js'
import type {
  FamilyReportCardIngestResult,
  MatchCandidate,
  MatchStatus,
  PublicReportCardAnswers,
  SheetsErrorCategory,
  SheetsSyncStatus,
} from './types.js'
import { validateFamilyReportCardIngestRequest } from './validation.js'
import type { LeadSubmissionPayload } from '../../../utils/submitLeadToGoogleSheets.js'

export type IngestFamilyReportCardDeps = {
  admin?: SupabaseClient
  sheetsWriter?: typeof writePublicReportCardToSheets
  now?: () => Date
  findCandidates?: typeof findMatchCandidates
  /** Injectable for tests; defaults to orchestrateIngestFollowUpTask. */
  orchestrateFollowUpTask?: typeof orchestrateIngestFollowUpTask
  resolveCard?: typeof resolveCardForIngest
  resolveCampaign?: typeof resolveTrustedCampaignAttribution
}

function parseAge(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeSheetsSyncStatus(value: string | null): SheetsSyncStatus {
  if (value === 'succeeded' || value === 'failed' || value === 'skipped' || value === 'pending') {
    return value
  }
  return 'pending'
}

function persistableAssessmentAnswers(
  assessmentType: PublicReportCardAssessmentType,
  answers: PublicReportCardAnswers,
):
  | PublicReportCardAnswers
  | { diagnostic: StudentLoanAssessmentAnswers['diagnostic'] }
  | { diagnostic: CreditAssessmentAnswers['diagnostic'] } {
  if (assessmentType === 'student_loan') {
    return { diagnostic: (answers as StudentLoanAssessmentAnswers).diagnostic }
  }
  if (assessmentType === 'credit') {
    return { diagnostic: (answers as CreditAssessmentAnswers).diagnostic }
  }
  return answers
}

type CanonicalResult = {
  overallScore: number | null
  overallGrade: string | null
  scoringVersion: number
  priorities: Array<{ level: string; title: string; why: string; timeline: string }>
  derivedMetrics: Record<string, unknown>
  sheetsPayload: LeadSubmissionPayload
}

function buildCanonicalResult(
  assessmentType: PublicReportCardAssessmentType,
  answers: PublicReportCardAnswers,
  sourcePage: string | null,
  submittedAt: string,
  clientReportedScore: number | null,
  clientReportedGrade: string | null,
): CanonicalResult {
  if (assessmentType === 'family') {
    const serverScore = recalculateFamilyReportCardScore(answers as DemoAssessmentAnswers)
    const scoreComparison = compareClientScore({
      clientReportedScore,
      clientReportedGrade,
      server: { overallScore: serverScore.overallScore, overallGrade: serverScore.overallGrade },
    })
    return {
      overallScore: serverScore.overallScore,
      overallGrade: serverScore.overallGrade,
      scoringVersion: serverScore.scoringVersion,
      priorities: serverScore.priorities,
      derivedMetrics: {
        protectionGapAmount: serverScore.protectionGapAmount,
        protectionGapFormatted: serverScore.protectionGapFormatted,
        currentLevel: serverScore.currentLevel,
        categories: serverScore.categories,
        scoreComparison,
      },
      sheetsPayload: buildFamilyReportCardSheetsPayload({
        answers: answers as DemoAssessmentAnswers,
        score: serverScore,
        sourcePage,
        submittedAt,
      }),
    }
  }

  if (assessmentType === 'business') {
    const serverScore = recalculateBusinessReportCardScore(answers as BusinessAssessmentAnswers)
    const scoreComparison = compareClientScore({
      clientReportedScore,
      clientReportedGrade,
      server: { overallScore: serverScore.overallScore, overallGrade: serverScore.overallGrade },
    })
    return {
      overallScore: serverScore.overallScore,
      overallGrade: serverScore.overallGrade,
      scoringVersion: serverScore.scoringVersion,
      priorities: serverScore.priorities,
      derivedMetrics: {
        currentLevel: serverScore.currentLevel,
        categories: serverScore.categories,
        scoreComparison,
        ...(serverScore.extraDerived ?? {}),
      },
      sheetsPayload: buildBusinessReportCardSheetsPayload({
        answers: answers as BusinessAssessmentAnswers,
        score: serverScore,
        sourcePage,
        submittedAt,
      }),
    }
  }

  if (assessmentType === 'retirement') {
    const serverScore = recalculateRetirementReportCardScore(answers as RetirementAssessmentAnswers)
    const scoreComparison = compareClientScore({
      clientReportedScore,
      clientReportedGrade,
      server: { overallScore: serverScore.overallScore, overallGrade: serverScore.overallGrade },
    })
    return {
      overallScore: serverScore.overallScore,
      overallGrade: serverScore.overallGrade,
      scoringVersion: serverScore.scoringVersion,
      priorities: serverScore.priorities,
      derivedMetrics: {
        currentLevel: serverScore.currentLevel,
        categories: serverScore.categories,
        scoreComparison,
        ...(serverScore.extraDerived ?? {}),
      },
      sheetsPayload: buildRetirementReportCardSheetsPayload({
        answers: answers as RetirementAssessmentAnswers,
        score: serverScore,
        sourcePage,
        submittedAt,
      }),
    }
  }

  if (assessmentType === 'student_loan') {
    const serverScore = recalculateStudentLoanReportCardScore(answers as StudentLoanAssessmentAnswers)
    const scoreComparison = compareClientScore({
      clientReportedScore,
      clientReportedGrade,
      server: { overallScore: serverScore.overallScore, overallGrade: serverScore.overallGrade },
    })
    return {
      overallScore: serverScore.overallScore,
      overallGrade: serverScore.overallGrade,
      scoringVersion: serverScore.scoringVersion,
      priorities: serverScore.priorities,
      derivedMetrics: {
        categories: serverScore.categories,
        criticalFlags: serverScore.flags,
        topReviewAreas: serverScore.reviewAreas,
        primaryGoal: serverScore.primaryGoal,
        urgency: serverScore.urgency,
        statusLabelKey: serverScore.statusLabelKey,
        statusLabel: serverScore.statusLabel,
        scoreComparison,
      },
      sheetsPayload: buildStudentLoanReportCardSheetsPayload({
        answers: answers as StudentLoanAssessmentAnswers,
        score: serverScore,
        sourcePage,
        submittedAt,
      }),
    }
  }

  if (assessmentType === 'credit') {
    const serverScore = recalculateCreditReportCardScore(answers as CreditAssessmentAnswers)
    const scoreComparison = compareClientScore({
      clientReportedScore,
      clientReportedGrade,
      server: { overallScore: serverScore.overallScore, overallGrade: serverScore.overallGrade },
    })
    return {
      overallScore: serverScore.overallScore,
      overallGrade: serverScore.overallGrade,
      scoringVersion: serverScore.scoringVersion,
      priorities: serverScore.priorities,
      derivedMetrics: {
        categories: serverScore.categories,
        criticalFlags: serverScore.flags,
        topReviewAreas: serverScore.reviewAreas,
        primaryGoal: serverScore.primaryGoal,
        urgency: serverScore.urgency,
        statusLabelKey: serverScore.statusLabelKey,
        statusLabel: serverScore.statusLabel,
        scoreComparison,
      },
      sheetsPayload: buildCreditReportCardSheetsPayload({
        answers: answers as CreditAssessmentAnswers,
        score: serverScore,
        sourcePage,
        submittedAt,
      }),
    }
  }

  const gap = recalculateProtectionGapResult(answers as CalculatorAnswers)
  return {
    overallScore: null,
    overallGrade: null,
    scoringVersion: gap.scoringVersion,
    priorities: gap.priorities,
    derivedMetrics: {
      totalNeed: gap.totalNeed,
      currentProtection: gap.currentProtection,
      netProtectionGap: gap.netProtectionGap,
      protectionGapFormatted: gap.protectionGapFormatted,
      components: gap.components,
    },
    sheetsPayload: buildProtectionGapSheetsPayload({
      answers: answers as CalculatorAnswers,
      result: gap,
      sourcePage,
      submittedAt,
    }),
  }
}

/**
 * Orchestrates public Report Card ingest for family, business, retirement, protection, student_loan, and credit:
 * validate → resolve optional Digital Identity card attribution → normalize →
 * recalculate score/gap server-side → find CRM candidates → classify identity
 * match → persist atomically via RPC → secondary Sheets write → follow-up task.
 *
 * Never returns a household id (or any other internal CRM identifier beyond
 * `assessmentId`) in the public result. Never trusts a browser-supplied advisor UUID.
 */
export async function ingestFamilyReportCard(
  rawBody: unknown,
  deps: IngestFamilyReportCardDeps = {},
): Promise<FamilyReportCardIngestResult> {
  return ingestPublicReportCard(rawBody, deps)
}

export async function ingestPublicReportCard(
  rawBody: unknown,
  deps: IngestFamilyReportCardDeps = {},
): Promise<FamilyReportCardIngestResult> {
  const now = deps.now ?? (() => new Date())

  const validation = validateFamilyReportCardIngestRequest(rawBody, {
    now: () => now().getTime(),
  })

  if (!validation.ok) {
    return { ok: false, error: validation.error, code: validation.code }
  }

  const request = validation.value
  const contact = normalizePublicReportCardContact(request.assessmentType, request.answers)
  const consentSnapshot = normalizeConsentSnapshot(request.consent)
  const submittedAt = request.submittedAt ?? now().toISOString()
  const canonical = buildCanonicalResult(
    request.assessmentType,
    request.answers,
    request.sourcePage,
    submittedAt,
    request.clientReportedScore,
    request.clientReportedGrade,
  )

  let admin: SupabaseClient
  try {
    admin = deps.admin ?? createSupabaseAdminClient()
  } catch {
    return { ok: false, error: 'Unable to save submission', code: 'admin_client_unavailable' }
  }

  let advisorProfileId: string | null = null
  let advisorSlug: string | null = null
  let cardPublicKey: string | null = null
  let campaignCode: string | null = null
  let eventCode: string | null = null
  let sourceChannel: string | null = null
  let campaignLabel: string | null = null
  let firstTouchUtms: Record<string, unknown> = {}
  let firstSeenAt = submittedAt

  if (request.cardPublicKey || request.cardSlug) {
    const resolveCard = deps.resolveCard ?? resolveCardForIngest
    const cardResult = await resolveCard(admin, {
      publicKey: request.cardPublicKey,
      slug: request.cardSlug,
    })
    if (cardResult.ok) {
      advisorProfileId = cardResult.advisorProfileId
      advisorSlug = cardResult.advisorSlug
      cardPublicKey = cardResult.cardPublicKey
      const resolveCampaign = deps.resolveCampaign ?? resolveTrustedCampaignAttribution
      try {
        const attribution = await resolveCampaign(admin, {
          digitalCardId: cardResult.digitalCardId,
          cardPublicKey: cardResult.cardPublicKey,
          campaignCode: request.campaignCode,
          eventCode: request.eventCode,
          sourceChannel: request.sourceChannel,
          utmSource: request.utmSource,
          utmMedium: request.utmMedium,
          utmCampaign: request.utmCampaign,
          utmTerm: request.utmTerm,
          utmContent: request.utmContent,
          referrer: request.referrer,
          occurredAt: submittedAt,
        })
        campaignCode = attribution.campaignCode
        eventCode = attribution.eventCode
        sourceChannel = attribution.sourceChannel
        campaignLabel = attribution.campaignLabel
        const firstTouch = attribution.firstTouchMetadata
        if (firstTouch.utms && typeof firstTouch.utms === 'object') {
          firstTouchUtms = firstTouch.utms as Record<string, unknown>
        }
        if (typeof firstTouch.firstSeenAt === 'string' && firstTouch.firstSeenAt) {
          firstSeenAt = firstTouch.firstSeenAt
        }
      } catch {
        // Card is trusted; campaign codes are dropped if unresolvable.
      }
    }
    // Invalid/unpublished card reference: ingest organically without advisor attribution.
  }

  const findCandidatesFn = deps.findCandidates ?? findMatchCandidates

  let candidates: MatchCandidate[] = []
  try {
    candidates = await findCandidatesFn(admin, {
      normalizedEmail: contact.normalizedEmail,
      normalizedPhone: contact.normalizedPhone,
    })
  } catch {
    return { ok: false, error: 'Unable to save submission', code: 'candidate_lookup_failed' }
  }

  const classification = classifyMatch({
    normalizedEmail: contact.normalizedEmail,
    normalizedPhone: contact.normalizedPhone,
    firstName: contact.firstName,
    lastName: contact.lastName,
    candidates,
  })

  const originalSourceMetadata: Record<string, unknown> = {
    utmSource: request.utmSource,
    utmMedium: request.utmMedium,
    utmCampaign: request.utmCampaign,
    utmTerm: request.utmTerm,
    utmContent: request.utmContent,
    referrer: request.referrer,
    cardPublicKey,
    campaignCode,
    eventCode,
    campaignLabel,
    sourceChannel,
    utms: firstTouchUtms,
    firstSeenAt,
  }

  const rpcPayload: Record<string, unknown> = {
    idempotency_key: request.submissionId,
    assessment_type: request.assessmentType,
    lead_type: leadTypeForAssessment(request.assessmentType),
    match_status: classification.status,
    matched_household_id: classification.matchedHouseholdId ?? null,
    candidate_household_id: classification.candidateHouseholdId ?? null,
    display_name: contact.displayName || null,
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.submitted.email,
    phone: contact.submitted.phone,
    normalized_email: contact.normalizedEmail,
    normalized_phone: contact.normalizedPhone,
    submitted_at: submittedAt,
    age: parseAge(contact.submitted.age),
    source_page: request.sourcePage,
    report_path: REPORT_PATH_BY_ASSESSMENT[request.assessmentType],
    original_source_metadata: originalSourceMetadata,
    overall_score: canonical.overallScore,
    overall_grade: canonical.overallGrade,
    top_priorities: canonical.priorities,
    raw_payload: canonical.sheetsPayload,
    consent_snapshot: consentSnapshot,
    match_reason: classification.matchReason,
    match_confidence: classification.matchConfidence,
    scoring_version: canonical.scoringVersion,
    answers: persistableAssessmentAnswers(request.assessmentType, request.answers),
    derived_metrics: canonical.derivedMetrics,
    advisor_profile_id: advisorProfileId,
    advisor_slug: advisorSlug,
    campaign_code: campaignCode,
  }

  const persistResult = await persistFamilyReportCardIngest(admin, rpcPayload)

  if (!persistResult.ok) {
    return { ok: false, error: persistResult.error, code: persistResult.code }
  }

  if (!persistResult.created) {
    return {
      ok: true,
      created: false,
      submissionId: request.submissionId,
      assessmentId: persistResult.assessmentId,
      matchStatus: (persistResult.matchStatus as MatchStatus) || classification.status,
      sheetsSync: { status: normalizeSheetsSyncStatus(persistResult.sheetsSyncStatus) },
    }
  }

  const orchestrateTask = deps.orchestrateFollowUpTask ?? orchestrateIngestFollowUpTask
  try {
    await orchestrateTask(admin, {
      leadId: persistResult.leadId,
      assessmentId: persistResult.assessmentId,
      matchStatus: classification.status,
    })
  } catch {
    // Intentionally swallowed — diagnostic persistence already succeeded.
  }

  const sheetsWriter = deps.sheetsWriter ?? writePublicReportCardToSheets

  let sheetsResult: { status: SheetsSyncStatus; errorCategory?: SheetsErrorCategory; externalRef?: string }
  try {
    sheetsResult = await sheetsWriter(canonical.sheetsPayload, leadTypeForAssessment(request.assessmentType))
  } catch {
    sheetsResult = { status: 'failed', errorCategory: 'network_error' }
  }

  try {
    await updateLeadSheetsSync(
      admin,
      persistResult.leadId,
      sheetsResult.status,
      sheetsResult.errorCategory,
      sheetsResult.externalRef,
    )
  } catch {
    // Sync bookkeeping is best-effort.
  }

  return {
    ok: true,
    created: true,
    submissionId: request.submissionId,
    assessmentId: persistResult.assessmentId,
    matchStatus: classification.status,
    sheetsSync: {
      status: sheetsResult.status,
      errorCategory: sheetsResult.errorCategory,
    },
  }
}
