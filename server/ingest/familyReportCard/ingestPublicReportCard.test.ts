import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { scoreBusinessAssessment } from '../../../components/assessment/scoring/scoreBusinessAssessment'
import { scoreRetirementAssessment } from '../../../components/assessment/scoring/scoreRetirementAssessment'
import { DEMO_BUSINESS_ANSWERS } from '../../../components/reportCard/businessReportCardData'
import { DEMO_RETIREMENT_ANSWERS } from '../../../components/reportCard/retirementReportCardData'
import { ingestPublicReportCard } from './ingestFamilyReportCard'
import { normalizeBusinessContact, normalizeProtectionContact, normalizeRetirementContact } from './normalize'
import { recalculateProtectionGapResult } from './score'
import {
  matchCandidateFixture,
  validBusinessIngestRequestBodyFixture,
  validFamilyAnswersFixture,
  validIngestRequestBodyFixture,
  validProtectionAnswersFixture,
  validProtectionIngestRequestBodyFixture,
  validRetirementIngestRequestBodyFixture,
} from './testFixtures'
import type { MatchCandidate } from './types'

const LUIS_PROFILE_ID = '11111111-1111-4111-8111-111111111111'
const CARD_PUBLIC_KEY = 'pk_live_abcdefghijklmnop'

function makeAdminStub(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return {
    rpc: vi.fn(rpcImpl),
  } as unknown as SupabaseClient
}

function newProspectRpcResponse(overrides: Record<string, unknown> = {}) {
  return {
    created: true,
    lead_id: 'lead-1',
    household_id: 'hh-1',
    member_id: 'member-1',
    assessment_id: 'assess-1',
    match_status: 'new_prospect',
    sheets_sync_status: 'pending',
    duplicate_review_id: null,
    ...overrides,
  }
}

function captureIngestPayload(admin: SupabaseClient): Record<string, unknown> | undefined {
  const rpcCall = (admin.rpc as ReturnType<typeof vi.fn>).mock.calls.find(
    (call) => call[0] === 'ingest_public_report_card',
  )
  return rpcCall?.[1]?.p_payload as Record<string, unknown> | undefined
}

const resolvedLuisCard = {
  ok: true as const,
  digitalCardId: 'card-luis-1',
  advisorProfileId: LUIS_PROFILE_ID,
  advisorSlug: 'luis-perez',
  advisorDisplayName: 'Luis Perez',
  cardPublicKey: CARD_PUBLIC_KEY,
  cardSlug: 'luis-perez',
}

const trustedCampaign = {
  trusted: true,
  campaignCode: 'rr-chamber-2026',
  eventCode: 'breakfast-aug-12',
  campaignLabel: 'Round Rock Chamber',
  sourceChannel: 'link' as const,
  firstTouchMetadata: {
    utms: { utmSource: 'flyer', utmMedium: 'print', utmCampaign: 'chamber' },
    firstSeenAt: '2026-07-01T12:00:00.000Z',
  },
  lastTouchMetadata: {},
}

describe('ingestPublicReportCard — business / retirement / protection', () => {
  it('creates a Business Report Card lead and persists the server score', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') return { data: newProspectRpcResponse(), error: null }
      return { data: null, error: null }
    })
    const browser = scoreBusinessAssessment(DEMO_BUSINESS_ANSWERS)

    const result = await ingestPublicReportCard(validBusinessIngestRequestBodyFixture(), {
      admin,
      findCandidates: async () => [],
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.assessmentId).toBe('assess-1')
      expect(result).not.toHaveProperty('householdId')
    }
    const payload = captureIngestPayload(admin)
    expect(payload?.assessment_type).toBe('business')
    expect(payload?.lead_type).toBe('Business Report Card')
    expect(payload?.overall_score).toBe(browser.overallScore)
    expect(payload?.overall_grade).toBe(browser.overallGrade)
    expect(payload?.report_path).toBe('/business-results')
  })

  it('attaches a Business exact trusted match without inventing a household id in the public result', async () => {
    const contact = normalizeBusinessContact(DEMO_BUSINESS_ANSWERS)
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') {
        return {
          data: newProspectRpcResponse({ match_status: 'exact_trusted_match', household_id: 'hh-existing-1' }),
          error: null,
        }
      }
      return { data: null, error: null }
    })

    const result = await ingestPublicReportCard(validBusinessIngestRequestBodyFixture(), {
      admin,
      findCandidates: async (): Promise<MatchCandidate[]> => [
        matchCandidateFixture({
          householdId: 'hh-existing-1',
          normalizedEmail: contact.normalizedEmail,
          normalizedPhone: contact.normalizedPhone,
          firstName: contact.firstName,
          lastName: contact.lastName,
        }),
      ],
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.matchStatus).toBe('exact_trusted_match')
    expect(captureIngestPayload(admin)?.matched_household_id).toBe('hh-existing-1')
  })

  it('flags a Business possible duplicate when the name conflicts', async () => {
    const contact = normalizeBusinessContact(DEMO_BUSINESS_ANSWERS)
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') {
        return { data: newProspectRpcResponse({ match_status: 'possible_match' }), error: null }
      }
      return { data: null, error: null }
    })

    const result = await ingestPublicReportCard(validBusinessIngestRequestBodyFixture(), {
      admin,
      findCandidates: async () => [
        matchCandidateFixture({
          normalizedEmail: contact.normalizedEmail,
          normalizedPhone: contact.normalizedPhone,
          firstName: 'Morgan',
          lastName: 'Lee',
        }),
      ],
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.matchStatus).toBe('possible_match')
    expect(captureIngestPayload(admin)?.match_status).toBe('possible_match')
  })

  it('creates a Retirement Report Card lead with the server score', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') return { data: newProspectRpcResponse(), error: null }
      return { data: null, error: null }
    })
    const browser = scoreRetirementAssessment(DEMO_RETIREMENT_ANSWERS)

    const result = await ingestPublicReportCard(validRetirementIngestRequestBodyFixture(), {
      admin,
      findCandidates: async () => [],
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
    })

    expect(result.ok).toBe(true)
    const payload = captureIngestPayload(admin)
    expect(payload?.assessment_type).toBe('retirement')
    expect(payload?.lead_type).toBe('Retirement Report Card')
    expect(payload?.overall_score).toBe(browser.overallScore)
    expect(payload?.overall_grade).toBe(browser.overallGrade)
  })

  it('attaches a Retirement exact trusted match', async () => {
    const contact = normalizeRetirementContact(DEMO_RETIREMENT_ANSWERS)
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') {
        return {
          data: newProspectRpcResponse({ match_status: 'exact_trusted_match', household_id: 'hh-existing-1' }),
          error: null,
        }
      }
      return { data: null, error: null }
    })

    const result = await ingestPublicReportCard(validRetirementIngestRequestBodyFixture(), {
      admin,
      findCandidates: async () => [
        matchCandidateFixture({
          householdId: 'hh-existing-1',
          normalizedEmail: contact.normalizedEmail,
          normalizedPhone: contact.normalizedPhone,
          firstName: contact.firstName,
          lastName: contact.lastName,
        }),
      ],
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.matchStatus).toBe('exact_trusted_match')
  })

  it('persists Protection Gap metrics without inventing a grade', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') return { data: newProspectRpcResponse(), error: null }
      return { data: null, error: null }
    })
    const gap = recalculateProtectionGapResult(validProtectionAnswersFixture())

    const result = await ingestPublicReportCard(
      validProtectionIngestRequestBodyFixture({ clientReportedScore: 88, clientReportedGrade: 'B+' }),
      {
        admin,
        findCandidates: async () => [],
        sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
      },
    )

    expect(result.ok).toBe(true)
    const payload = captureIngestPayload(admin)
    expect(payload?.assessment_type).toBe('protection')
    expect(payload?.lead_type).toBe('Protection Gap')
    expect(payload?.overall_score).toBeNull()
    expect(payload?.overall_grade).toBeNull()
    expect(payload?.derived_metrics).toEqual(
      expect.objectContaining({
        totalNeed: gap.totalNeed,
        currentProtection: gap.currentProtection,
        netProtectionGap: gap.netProtectionGap,
        protectionGapFormatted: gap.protectionGapFormatted,
      }),
    )
  })
})

describe('ingestPublicReportCard — Digital Identity attribution', () => {
  it.each([
    ['family', validIngestRequestBodyFixture],
    ['business', validBusinessIngestRequestBodyFixture],
    ['retirement', validRetirementIngestRequestBodyFixture],
    ['protection', validProtectionIngestRequestBodyFixture],
  ] as const)('stamps Luis as originating advisor for Digital Card → %s', async (assessmentType, fixture) => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') return { data: newProspectRpcResponse(), error: null }
      return { data: null, error: null }
    })
    const resolveCard = vi.fn(async () => resolvedLuisCard)
    const resolveCampaign = vi.fn(async () => trustedCampaign)

    const result = await ingestPublicReportCard(
      fixture({
        cardPublicKey: CARD_PUBLIC_KEY,
        campaignCode: 'rr-chamber-2026',
        eventCode: 'breakfast-aug-12',
        sourceChannel: 'link',
        utmSource: 'flyer',
        utmMedium: 'print',
        utmCampaign: 'chamber',
      }),
      {
        admin,
        findCandidates: async () => [],
        sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
        resolveCard,
        resolveCampaign,
      },
    )

    expect(result.ok).toBe(true)
    expect(resolveCard).toHaveBeenCalled()
    const payload = captureIngestPayload(admin)
    expect(payload?.assessment_type).toBe(assessmentType)
    expect(payload?.advisor_profile_id).toBe(LUIS_PROFILE_ID)
    expect(payload?.advisor_slug).toBe('luis-perez')
    expect(payload?.campaign_code).toBe('rr-chamber-2026')
    expect(payload?.original_source_metadata).toEqual(
      expect.objectContaining({
        cardPublicKey: CARD_PUBLIC_KEY,
        campaignCode: 'rr-chamber-2026',
        eventCode: 'breakfast-aug-12',
        utmSource: 'flyer',
        utmMedium: 'print',
        utmCampaign: 'chamber',
      }),
    )
  })

  it('ingests organically when the Digital Card is unpublished', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') return { data: newProspectRpcResponse(), error: null }
      return { data: null, error: null }
    })

    const result = await ingestPublicReportCard(
      validIngestRequestBodyFixture({
        answers: validFamilyAnswersFixture(),
        cardPublicKey: CARD_PUBLIC_KEY,
      }),
      {
        admin,
        findCandidates: async () => [],
        sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
        resolveCard: async () => ({ ok: false, code: 'card_not_found', error: 'not found' }),
      },
    )

    expect(result.ok).toBe(true)
    const payload = captureIngestPayload(admin)
    expect(payload?.advisor_profile_id).toBeNull()
    expect(payload?.advisor_slug).toBeNull()
    expect(payload?.campaign_code).toBeNull()
  })

  it('does not call card resolution when no card reference is present', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') return { data: newProspectRpcResponse(), error: null }
      return { data: null, error: null }
    })
    const resolveCard = vi.fn(async () => resolvedLuisCard)

    await ingestPublicReportCard(validIngestRequestBodyFixture(), {
      admin,
      findCandidates: async () => [],
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
      resolveCard,
    })

    expect(resolveCard).not.toHaveBeenCalled()
    expect(captureIngestPayload(admin)?.advisor_profile_id).toBeNull()
  })
})

describe('ingestPublicReportCard — protection contact matching', () => {
  it('creates a Protection Gap lead on exact household match', async () => {
    const contact = normalizeProtectionContact(validProtectionAnswersFixture())
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') {
        return {
          data: newProspectRpcResponse({ match_status: 'exact_trusted_match', household_id: 'hh-existing-1' }),
          error: null,
        }
      }
      return { data: null, error: null }
    })

    const result = await ingestPublicReportCard(validProtectionIngestRequestBodyFixture(), {
      admin,
      findCandidates: async () => [
        matchCandidateFixture({
          householdId: 'hh-existing-1',
          normalizedEmail: contact.normalizedEmail,
          normalizedPhone: contact.normalizedPhone,
          firstName: contact.firstName,
          lastName: contact.lastName,
        }),
      ],
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.matchStatus).toBe('exact_trusted_match')
    expect(captureIngestPayload(admin)?.lead_type).toBe('Protection Gap')
  })
})
