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
import { resolveTrustedCampaignAttribution } from './resolveTrustedCampaign'
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
  resolveCampaign?: typeof resolveTrustedCampaignAttribution
}

function buildDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim()
}

/**
 * Allowlisted metadata only — never secrets, never trusted advisor UUIDs
 * from the browser, never full raw request dumps, never advisor_notes.
 */
function buildAllowlistedSourceMetadata(
  request: {
    company: string | null
    title: string | null
    reasonForConnecting: string | null
    note: string | null
    preferredFollowUpMethod: string | null
  },
  attribution: {
    cardPublicKey: string
    campaignCode: string | null
    eventCode: string | null
    campaignLabel: string | null
    sourceChannel: string | null
    utms: Record<string, unknown>
    referrer: string | null
    firstSeenAt: string
  },
): Record<string, unknown> {
  return {
    company: request.company,
    title: request.title,
    reason: request.reasonForConnecting,
    note: request.note,
    preferredFollowUp: request.preferredFollowUpMethod,
    cardPublicKey: attribution.cardPublicKey,
    campaignCode: attribution.campaignCode,
    eventCode: attribution.eventCode,
    campaignLabel: attribution.campaignLabel,
    sourceChannel: attribution.sourceChannel,
    utms: attribution.utms,
    referrer: attribution.referrer,
    firstSeenAt: attribution.firstSeenAt,
  }
}

async function writeCampaignAttributionActivities(
  admin: SupabaseClient,
  input: {
    householdId: string
    leadId: string
    cardPublicKey: string
    campaignCode: string
    eventCode: string | null
    sourceChannel: string | null
    occurredAt: string
  },
): Promise<void> {
  const baseMeta = {
    lead_id: input.leadId,
    cardPublicKey: input.cardPublicKey,
    campaignCode: input.campaignCode,
    eventCode: input.eventCode,
    sourceChannel: input.sourceChannel,
    module: 'digital_identity',
  }
  const rows = [
    {
      title: 'Campaign attributed',
      body: 'Digital Identity relationship attributed to a trusted campaign.',
      metadata: {
        ...baseMeta,
        eventKey: 'digital_identity.campaign_attributed',
        event: 'digital_identity.campaign_attributed',
      },
    },
  ]
  if (input.eventCode) {
    rows.push(
      {
        title: 'Event attributed',
        body: 'Digital Identity relationship attributed to a trusted event code.',
        metadata: {
          ...baseMeta,
          eventKey: 'digital_identity.event_attributed',
          event: 'digital_identity.event_attributed',
        },
      },
      {
        title: 'Connected at event',
        body: 'Relationship connected in the context of a Digital Identity event.',
        metadata: {
          ...baseMeta,
          eventKey: 'digital_identity.relationship_connected_at_event',
          event: 'digital_identity.relationship_connected_at_event',
        },
      },
    )
  }
  await admin.from('activities').insert(
    rows.map((row) => ({
      household_id: input.householdId,
      lead_id: input.leadId,
      assessment_id: null,
      actor_user_id: null,
      activity_type: 'system',
      title: row.title,
      body: row.body,
      metadata: row.metadata,
      occurred_at: input.occurredAt,
    })),
  )
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

  const resolveCampaign = deps.resolveCampaign ?? resolveTrustedCampaignAttribution
  let attribution: Awaited<ReturnType<typeof resolveTrustedCampaignAttribution>>
  try {
    attribution = await resolveCampaign(admin, {
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
  } catch {
    attribution = {
      trusted: false,
      campaignCode: null,
      eventCode: null,
      campaignLabel: null,
      sourceChannel: null,
      firstTouchMetadata: {
        cardPublicKey: cardResult.cardPublicKey,
        campaignCode: null,
        eventCode: null,
        sourceChannel: null,
        utms: {},
        referrer: null,
        occurredAt: submittedAt,
        firstSeenAt: submittedAt,
      },
      lastTouchMetadata: {
        cardPublicKey: cardResult.cardPublicKey,
        campaignCode: null,
        eventCode: null,
        sourceChannel: null,
        utms: {},
        referrer: null,
        occurredAt: submittedAt,
      },
    }
  }

  const firstTouch = attribution.firstTouchMetadata
  const allowlistedMeta = buildAllowlistedSourceMetadata(request, {
    cardPublicKey: cardResult.cardPublicKey,
    campaignCode: attribution.campaignCode,
    eventCode: attribution.eventCode,
    campaignLabel: attribution.campaignLabel,
    sourceChannel: attribution.sourceChannel,
    utms:
      firstTouch.utms && typeof firstTouch.utms === 'object'
        ? (firstTouch.utms as Record<string, unknown>)
        : {},
    referrer: typeof firstTouch.referrer === 'string' ? firstTouch.referrer : null,
    firstSeenAt: submittedAt,
  })

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
    // Only trusted codes become original_campaign / activity attribution.
    campaign_code: attribution.campaignCode,
    event_code: attribution.eventCode,
  }

  const persistFn = deps.persist ?? persistDigitalIdentityConnect
  const persistResult = await persistFn(admin, rpcPayload)

  if (!persistResult.ok) {
    return { ok: false, error: persistResult.error, code: persistResult.code }
  }

  const matchStatus =
    (persistResult.matchStatus as MatchStatus) || classification.status

  // Last-touch is mutable; update on create and idempotent replay.
  try {
    await admin
      .from('leads')
      .update({ last_touch_source_metadata: attribution.lastTouchMetadata })
      .eq('id', persistResult.leadId)
  } catch {
    // Non-fatal — first-touch CRM capture already succeeded.
  }

  // Idempotent replay: skip task automation + campaign activities.
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

    if (attribution.trusted && attribution.campaignCode) {
      try {
        await writeCampaignAttributionActivities(admin, {
          householdId: persistResult.householdId,
          leadId: persistResult.leadId,
          cardPublicKey: cardResult.cardPublicKey,
          campaignCode: attribution.campaignCode,
          eventCode: attribution.eventCode,
          sourceChannel: attribution.sourceChannel,
          occurredAt: submittedAt,
        })
      } catch {
        // Non-fatal.
      }
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
