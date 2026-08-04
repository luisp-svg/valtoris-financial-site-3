import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '../../../lib/supabase/admin'
import {
  normalizeEmail,
  normalizePhone,
} from '../../../crm/households/normalizeContact'
import { findMatchCandidates } from '../familyReportCard/findCandidates'
import { classifyMatch } from '../familyReportCard/match'
import type { MatchCandidate } from '../familyReportCard/types'
import { persistDigitalIdentityConnect } from './persist'
import { issueRelationshipPhotoUploadGrant } from './photoGrant'
import { resolveCardForIngest } from './resolveCardForIngest'
import { orchestrateDigitalIdentityFollowUpTask } from './taskAutomation'
import type {
  DigitalIdentityConnectResult,
  MatchStatus,
  RelationshipPhotoAvailability,
} from './types'
import { validateDigitalIdentityConnectRequest } from './validation'

export type IngestDigitalIdentityConnectDeps = {
  admin?: SupabaseClient
  now?: () => Date
  findCandidates?: typeof findMatchCandidates
  resolveCard?: typeof resolveCardForIngest
  persist?: typeof persistDigitalIdentityConnect
  /** Injectable for tests; defaults to orchestrateDigitalIdentityFollowUpTask. */
  orchestrateFollowUpTask?: typeof orchestrateDigitalIdentityFollowUpTask
  issuePhotoGrant?: typeof issueRelationshipPhotoUploadGrant
}

function buildDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim()
}

/**
 * Allowlisted metadata only — never secrets, never trusted advisor UUIDs
 * from the browser, never full raw request dumps.
 */
function buildAllowlistedSourceMetadata(request: {
  company: string | null
  title: string | null
  reasonForConnecting: string | null
  note: string | null
  preferredFollowUpMethod: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  referrer: string | null
  sourceChannel: string | null
}): Record<string, unknown> {
  return {
    company: request.company,
    title: request.title,
    reason: request.reasonForConnecting,
    note: request.note,
    preferredFollowUp: request.preferredFollowUpMethod,
    utms: {
      utmSource: request.utmSource,
      utmMedium: request.utmMedium,
      utmCampaign: request.utmCampaign,
      utmTerm: request.utmTerm,
      utmContent: request.utmContent,
    },
    referrer: request.referrer,
    sourceChannel: request.sourceChannel,
  }
}

/**
 * Orchestrates public Let's Connect CRM ingest:
 * validate → resolve card → normalize → match → persist → task automation.
 *
 * Never returns householdId, advisor ids, or task ids in the public result.
 */
export async function ingestDigitalIdentityConnect(
  rawBody: unknown,
  deps: IngestDigitalIdentityConnectDeps = {},
): Promise<DigitalIdentityConnectResult> {
  const now = deps.now ?? (() => new Date())

  const validation = validateDigitalIdentityConnectRequest(rawBody, {
    now: () => now().getTime(),
  })

  if (!validation.ok) {
    return { ok: false, error: validation.error, code: validation.code }
  }

  const request = validation.value

  let admin: SupabaseClient
  try {
    admin = deps.admin ?? createSupabaseAdminClient()
  } catch {
    return { ok: false, error: 'Unable to save submission', code: 'admin_client_unavailable' }
  }

  const resolveCard = deps.resolveCard ?? resolveCardForIngest
  const cardResult = await resolveCard(admin, {
    publicKey: request.cardPublicKey,
    slug: request.cardSlug,
  })

  if (!cardResult.ok) {
    return {
      ok: false,
      error: cardResult.error,
      code: cardResult.code,
    }
  }

  const normalizedEmail = normalizeEmail(request.email)
  const normalizedPhone = normalizePhone(request.phone)

  const findCandidatesFn = deps.findCandidates ?? findMatchCandidates

  let candidates: MatchCandidate[] = []
  try {
    candidates = await findCandidatesFn(admin, {
      normalizedEmail,
      normalizedPhone,
    })
  } catch {
    return { ok: false, error: 'Unable to save submission', code: 'candidate_lookup_failed' }
  }

  const classification = classifyMatch({
    normalizedEmail,
    normalizedPhone,
    firstName: request.firstName,
    lastName: request.lastName,
    candidates,
  })

  const submittedAt =
    request.formSubmittedAt && !Number.isNaN(Date.parse(request.formSubmittedAt))
      ? request.formSubmittedAt
      : now().toISOString()

  const allowlistedMeta = buildAllowlistedSourceMetadata(request)

  const rpcPayload: Record<string, unknown> = {
    idempotency_key: request.submissionId,
    match_status: classification.status,
    matched_household_id: classification.matchedHouseholdId ?? null,
    candidate_household_id: classification.candidateHouseholdId ?? null,
    match_reason: classification.matchReason,
    match_confidence: classification.matchConfidence,
    display_name: buildDisplayName(request.firstName, request.lastName) || null,
    first_name: request.firstName,
    last_name: request.lastName,
    email: request.email || null,
    phone: request.phone || null,
    normalized_email: normalizedEmail,
    normalized_phone: normalizedPhone,
    submitted_at: submittedAt,
    source_page: request.sourcePage,
    consent_snapshot: request.consentSnapshot,
    original_source_metadata: allowlistedMeta,
    raw_payload: allowlistedMeta,
    advisor_profile_id: cardResult.advisorProfileId,
    advisor_slug: cardResult.advisorSlug,
    card_public_key: cardResult.cardPublicKey,
    card_slug: cardResult.cardSlug,
    campaign_code: request.campaignCode,
    event_code: request.eventCode,
  }

  const persistFn = deps.persist ?? persistDigitalIdentityConnect
  const persistResult = await persistFn(admin, rpcPayload)

  if (!persistResult.ok) {
    return { ok: false, error: persistResult.error, code: persistResult.code }
  }

  const matchStatus =
    (persistResult.matchStatus as MatchStatus) || classification.status

  // Idempotent replay: skip task automation.
  if (persistResult.created) {
    const orchestrateTask =
      deps.orchestrateFollowUpTask ?? orchestrateDigitalIdentityFollowUpTask
    try {
      await orchestrateTask(admin, {
        leadId: persistResult.leadId,
        matchStatus: classification.status,
        created: true,
      })
    } catch {
      // Intentionally swallowed — CRM persist already succeeded.
    }
  }

  const issueGrant = deps.issuePhotoGrant ?? issueRelationshipPhotoUploadGrant
  let relationshipPhoto: RelationshipPhotoAvailability = { available: false }
  try {
    relationshipPhoto = await issueGrant(admin, {
      leadId: persistResult.leadId,
      householdId: persistResult.householdId,
      submissionId: request.submissionId,
    })
  } catch {
    relationshipPhoto = { available: false }
  }

  return {
    ok: true,
    created: persistResult.created,
    submissionId: request.submissionId,
    matchStatus: persistResult.created ? classification.status : matchStatus,
    relationshipPhoto,
  }
}
