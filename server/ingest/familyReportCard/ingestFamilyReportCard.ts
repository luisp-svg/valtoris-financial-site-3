import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../lib/supabase/admin.js'
import { normalizeConsentSnapshot } from './consent.js'
import { findMatchCandidates } from './findCandidates.js'
import { classifyMatch } from './match.js'
import { normalizeSubmittedContact } from './normalize.js'
import { persistFamilyReportCardIngest, updateLeadSheetsSync } from './persist.js'
import { compareClientScore, recalculateFamilyReportCardScore } from './score.js'
import { buildFamilyReportCardSheetsPayload, writeFamilyReportCardToSheets } from './sheets.js'
import { orchestrateIngestFollowUpTask } from './taskAutomation.js'
import type {
  FamilyReportCardIngestResult,
  MatchCandidate,
  MatchStatus,
  SheetsErrorCategory,
  SheetsSyncStatus,
} from './types.js'
import { validateFamilyReportCardIngestRequest } from './validation.js'

export type IngestFamilyReportCardDeps = {
  admin?: SupabaseClient
  sheetsWriter?: typeof writeFamilyReportCardToSheets
  now?: () => Date
  findCandidates?: typeof findMatchCandidates
  /** Injectable for tests; defaults to orchestrateIngestFollowUpTask. */
  orchestrateFollowUpTask?: typeof orchestrateIngestFollowUpTask
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

/**
 * Orchestrates the full public Family Report Card ingest:
 * validate → normalize → recalculate score → find CRM candidates → classify
 * identity match → persist atomically via RPC → secondary Sheets write →
 * record Sheets sync status → return a safe, minimal public result.
 *
 * Never returns a household id (or any other internal CRM identifier beyond
 * `assessmentId`) in the public result.
 */
export async function ingestFamilyReportCard(
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
  const contact = normalizeSubmittedContact(request.answers)
  const consentSnapshot = normalizeConsentSnapshot(request.consent)
  const serverScore = recalculateFamilyReportCardScore(request.answers)
  const scoreComparison = compareClientScore({
    clientReportedScore: request.clientReportedScore,
    clientReportedGrade: request.clientReportedGrade,
    server: { overallScore: serverScore.overallScore, overallGrade: serverScore.overallGrade },
  })

  let admin: SupabaseClient
  try {
    admin = deps.admin ?? createSupabaseAdminClient()
  } catch {
    return { ok: false, error: 'Unable to save submission', code: 'admin_client_unavailable' }
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

  const submittedAt = request.submittedAt ?? now().toISOString()

  const originalSourceMetadata: Record<string, unknown> = {
    utmSource: request.utmSource,
    utmMedium: request.utmMedium,
    utmCampaign: request.utmCampaign,
    utmTerm: request.utmTerm,
    utmContent: request.utmContent,
    referrer: request.referrer,
  }

  const sheetsPayload = buildFamilyReportCardSheetsPayload({
    answers: request.answers,
    score: serverScore,
    sourcePage: request.sourcePage,
    submittedAt,
  })

  const rpcPayload: Record<string, unknown> = {
    idempotency_key: request.submissionId,
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
    original_source_metadata: originalSourceMetadata,
    overall_score: serverScore.overallScore,
    overall_grade: serverScore.overallGrade,
    top_priorities: serverScore.priorities,
    raw_payload: sheetsPayload,
    consent_snapshot: consentSnapshot,
    match_reason: classification.matchReason,
    match_confidence: classification.matchConfidence,
    scoring_version: serverScore.scoringVersion,
    answers: request.answers,
    derived_metrics: {
      protectionGapAmount: serverScore.protectionGapAmount,
      protectionGapFormatted: serverScore.protectionGapFormatted,
      currentLevel: serverScore.currentLevel,
      categories: serverScore.categories,
      scoreComparison,
    },
  }

  const persistResult = await persistFamilyReportCardIngest(admin, rpcPayload)

  if (!persistResult.ok) {
    return { ok: false, error: persistResult.error, code: persistResult.code }
  }

  // Idempotent replay: the RPC already returned the original row without
  // re-running matching/scoring server-side. Do not re-trigger the secondary
  // Sheets write — it either already succeeded or is tracked separately.
  // Task automation is also skipped on replay (idempotent RPC covers retries).
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

  // Follow-up task automation is best-effort and never fails the public response.
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

  const sheetsWriter = deps.sheetsWriter ?? writeFamilyReportCardToSheets

  let sheetsResult: { status: SheetsSyncStatus; errorCategory?: SheetsErrorCategory; externalRef?: string }
  try {
    sheetsResult = await sheetsWriter(sheetsPayload)
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
    // Sync bookkeeping is best-effort — the CRM write already succeeded and
    // must not be rolled back because of a secondary status-update failure.
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
