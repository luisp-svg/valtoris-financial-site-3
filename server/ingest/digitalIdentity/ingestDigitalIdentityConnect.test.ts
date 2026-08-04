import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { ingestDigitalIdentityConnect } from './ingestDigitalIdentityConnect'
import {
  matchCandidateFixture,
  resolveCardSuccessFixture,
  validConnectRequestBodyFixture,
  VALID_SUBMISSION_ID,
} from './testFixtures'
import type { MatchCandidate } from '../familyReportCard/types'

function makeAdminStub(
  rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>,
) {
  return {
    rpc: vi.fn(rpcImpl),
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: null, error: null })),
      })),
    })),
  } as unknown as SupabaseClient
}

function newProspectRpcResponse(overrides: Record<string, unknown> = {}) {
  return {
    created: true,
    lead_id: 'lead-1',
    household_id: 'hh-1',
    member_id: 'member-1',
    assessment_id: null,
    match_status: 'new_prospect',
    duplicate_review_id: null,
    ...overrides,
  }
}

describe('ingestDigitalIdentityConnect', () => {
  it('rejects invalid submission before touching the database', async () => {
    const admin = makeAdminStub(async () => ({ data: null, error: null }))
    const result = await ingestDigitalIdentityConnect(
      { not: 'valid' },
      { admin, findCandidates: async () => [], resolveCard: async () => resolveCardSuccessFixture() },
    )
    expect(result.ok).toBe(false)
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it('creates a new prospect end-to-end when there are no matching candidates', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_digital_identity_connect') {
        return { data: newProspectRpcResponse(), error: null }
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const findCandidates = vi.fn(async (): Promise<MatchCandidate[]> => [])
    const resolveCard = vi.fn(async () => resolveCardSuccessFixture())
    const persist = vi.fn(async () => ({
      ok: true as const,
      created: true,
      leadId: 'lead-1',
      householdId: 'hh-1',
      matchStatus: 'new_prospect',
      duplicateReviewId: null,
    }))
    const orchestrateFollowUpTask = vi.fn().mockResolvedValue({
      status: 'task_created',
      taskId: 'task-1',
      errorCategory: null,
      needsManualReview: false,
    })

    const issuePhotoGrant = vi.fn(async () => ({
      available: true as const,
      uploadToken: 'a'.repeat(64),
      expiresAt: '2026-08-03T18:20:05.000Z',
    }))

    const result = await ingestDigitalIdentityConnect(validConnectRequestBodyFixture(), {
      admin,
      findCandidates,
      resolveCard,
      persist,
      orchestrateFollowUpTask,
      issuePhotoGrant,
      now: () => new Date('2026-08-03T18:00:05.000Z'),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.matchStatus).toBe('new_prospect')
      expect(result.submissionId).toBe(VALID_SUBMISSION_ID)
      expect(result.relationshipPhoto).toEqual({
        available: true,
        uploadToken: 'a'.repeat(64),
        expiresAt: '2026-08-03T18:20:05.000Z',
      })
      expect(result).not.toHaveProperty('householdId')
      expect(result).not.toHaveProperty('leadId')
      expect(result).not.toHaveProperty('taskId')
      expect(result).not.toHaveProperty('advisorProfileId')
    }
    expect(issuePhotoGrant).toHaveBeenCalled()

    expect(orchestrateFollowUpTask).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        leadId: 'lead-1',
        matchStatus: 'new_prospect',
        created: true,
      }),
    )

    expect(persist).toHaveBeenCalled()
    const persistArgs = persist.mock.calls[0] as unknown as [unknown, Record<string, unknown>]
    const payload = persistArgs[1] ?? {}
    expect(payload.advisor_profile_id).toBe('11111111-1111-4111-8111-111111111111')
    expect(payload.match_status).toBe('new_prospect')
    expect(payload.raw_payload).toMatchObject({
      company: 'Acme Co',
      reason: 'Would like to connect',
    })
    expect(JSON.stringify(payload.raw_payload)).not.toMatch(/advisorProfileId|householdId/)
  })

  it('classifies an exact_trusted_match and forwards matched household to RPC', async () => {
    let capturedPayload: Record<string, unknown> | undefined
    const admin = makeAdminStub(async () => ({ data: null, error: null }))

    const result = await ingestDigitalIdentityConnect(validConnectRequestBodyFixture(), {
      admin,
      resolveCard: async () => resolveCardSuccessFixture(),
      findCandidates: async () => [matchCandidateFixture()],
      persist: async (_admin, payload) => {
        capturedPayload = payload
        return {
          ok: true,
          created: true,
          leadId: 'lead-1',
          householdId: 'hh-existing-1',
          matchStatus: 'exact_trusted_match',
          duplicateReviewId: null,
        }
      },
      orchestrateFollowUpTask: vi.fn().mockResolvedValue({
        status: 'task_created',
        taskId: 'task-1',
        errorCategory: null,
        needsManualReview: false,
      }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.matchStatus).toBe('exact_trusted_match')
    expect(capturedPayload?.matched_household_id).toBe('hh-existing-1')
    expect(result).not.toHaveProperty('householdId')
  })

  it('classifies a possible_match for email-only overlap', async () => {
    let capturedPayload: Record<string, unknown> | undefined

    const result = await ingestDigitalIdentityConnect(validConnectRequestBodyFixture(), {
      admin: makeAdminStub(async () => ({ data: null, error: null })),
      resolveCard: async () => resolveCardSuccessFixture(),
      findCandidates: async () => [
        matchCandidateFixture({
          normalizedPhone: '+15559999999',
          firstName: 'Other',
          lastName: 'Person',
        }),
      ],
      persist: async (_admin, payload) => {
        capturedPayload = payload
        return {
          ok: true,
          created: true,
          leadId: 'lead-1',
          householdId: 'hh-prov',
          matchStatus: 'possible_match',
          duplicateReviewId: 'dup-1',
        }
      },
      orchestrateFollowUpTask: vi.fn().mockResolvedValue({
        status: 'task_created',
        taskId: 'task-dup',
        errorCategory: null,
        needsManualReview: false,
      }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.matchStatus).toBe('possible_match')
    expect(capturedPayload?.match_status).toBe('possible_match')
    expect(capturedPayload?.candidate_household_id).toBe('hh-existing-1')
  })

  it('still returns ok:true when follow-up task automation fails', async () => {
    const result = await ingestDigitalIdentityConnect(validConnectRequestBodyFixture(), {
      admin: makeAdminStub(async () => ({ data: null, error: null })),
      resolveCard: async () => resolveCardSuccessFixture(),
      findCandidates: async () => [],
      persist: async () => ({
        ok: true,
        created: true,
        leadId: 'lead-1',
        householdId: 'hh-1',
        matchStatus: 'new_prospect',
        duplicateReviewId: null,
      }),
      orchestrateFollowUpTask: vi.fn().mockRejectedValue(new Error('task boom')),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result).not.toHaveProperty('householdId')
    }
  })

  it('handles idempotent replay with created:false and skips task automation', async () => {
    const orchestrateFollowUpTask = vi.fn()

    const result = await ingestDigitalIdentityConnect(validConnectRequestBodyFixture(), {
      admin: makeAdminStub(async () => ({ data: null, error: null })),
      resolveCard: async () => resolveCardSuccessFixture(),
      findCandidates: async () => [],
      persist: async () => ({
        ok: true,
        created: false,
        leadId: 'lead-1',
        householdId: 'hh-1',
        matchStatus: 'new_prospect',
        duplicateReviewId: null,
      }),
      orchestrateFollowUpTask,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(false)
      expect(result.matchStatus).toBe('new_prospect')
      expect(result).not.toHaveProperty('householdId')
    }
    expect(orchestrateFollowUpTask).not.toHaveBeenCalled()
  })

  it('rejects invalid consent before persist', async () => {
    const persist = vi.fn()
    const result = await ingestDigitalIdentityConnect(
      validConnectRequestBodyFixture({
        consent: {
          privacyAcknowledged: false,
          contactPermission: false,
          emailMarketingConsent: false,
          smsMarketingConsent: false,
        },
      }),
      {
        admin: makeAdminStub(async () => ({ data: null, error: null })),
        resolveCard: async () => resolveCardSuccessFixture(),
        findCandidates: async () => [],
        persist,
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_consent')
    expect(persist).not.toHaveBeenCalled()
  })

  it('rejects honeypot before persist', async () => {
    const persist = vi.fn()
    const result = await ingestDigitalIdentityConnect(
      validConnectRequestBodyFixture({ honeypot: 'bot' }),
      {
        admin: makeAdminStub(async () => ({ data: null, error: null })),
        resolveCard: async () => resolveCardSuccessFixture(),
        findCandidates: async () => [],
        persist,
      },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('bot_suspected')
    expect(persist).not.toHaveBeenCalled()
  })
})
