import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { ingestFamilyReportCard } from './ingestFamilyReportCard'
import { matchCandidateFixture, validIngestRequestBodyFixture } from './testFixtures'
import type { MatchCandidate } from './types'

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

describe('ingestFamilyReportCard', () => {
  it('rejects an invalid submission before touching the database', async () => {
    const admin = makeAdminStub(async () => ({ data: null, error: null }))
    const result = await ingestFamilyReportCard(
      { not: 'a valid body' },
      { admin, findCandidates: async () => [] },
    )
    expect(result.ok).toBe(false)
    expect(admin.rpc).not.toHaveBeenCalled()
  })

  it('creates a new prospect end-to-end when there are no matching candidates', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_family_report_card') {
        return { data: newProspectRpcResponse(), error: null }
      }
      if (fn === 'update_lead_sheets_sync') {
        return { data: null, error: null }
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const sheetsWriter = vi.fn().mockResolvedValue({ status: 'succeeded' as const })
    const findCandidates = vi.fn(async (): Promise<MatchCandidate[]> => [])
    const orchestrateFollowUpTask = vi.fn().mockResolvedValue({
      status: 'task_created',
      taskId: 'task-1',
      errorCategory: null,
      needsManualReview: false,
    })

    const result = await ingestFamilyReportCard(validIngestRequestBodyFixture(), {
      admin,
      sheetsWriter,
      findCandidates,
      orchestrateFollowUpTask,
      now: () => new Date('2026-07-28T18:00:00.000Z'),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.matchStatus).toBe('new_prospect')
      expect(result.sheetsSync.status).toBe('succeeded')
      expect(result.assessmentId).toBe('assess-1')
      expect(result).not.toHaveProperty('householdId')
      expect(result).not.toHaveProperty('taskId')
    }

    expect(orchestrateFollowUpTask).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        leadId: 'lead-1',
        assessmentId: 'assess-1',
        matchStatus: 'new_prospect',
      }),
    )
    expect(sheetsWriter).toHaveBeenCalledTimes(1)
    const rpcCall = (admin.rpc as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'ingest_public_family_report_card',
    )
    expect(rpcCall).toBeDefined()
    const rpcPayload = rpcCall?.[1]?.p_payload as Record<string, unknown>
    expect(rpcPayload.match_status).toBe('new_prospect')
    expect(rpcPayload.idempotency_key).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
  })

  it('still returns ok:true when follow-up task automation fails', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_family_report_card') {
        return { data: newProspectRpcResponse(), error: null }
      }
      return { data: null, error: null }
    })

    const result = await ingestFamilyReportCard(validIngestRequestBodyFixture(), {
      admin,
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
      findCandidates: async () => [],
      orchestrateFollowUpTask: vi.fn().mockRejectedValue(new Error('task boom')),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.assessmentId).toBe('assess-1')
    }
  })

  it('classifies an exact_trusted_match and forwards the matched household to the RPC payload', async () => {
    let capturedPayload: Record<string, unknown> | undefined
    const admin = makeAdminStub(async (fn, args) => {
      if (fn === 'ingest_public_family_report_card') {
        capturedPayload = args.p_payload as Record<string, unknown>
        return {
          data: newProspectRpcResponse({ match_status: 'exact_trusted_match', household_id: 'hh-existing-1' }),
          error: null,
        }
      }
      return { data: null, error: null }
    })

    const result = await ingestFamilyReportCard(validIngestRequestBodyFixture(), {
      admin,
      sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
      findCandidates: async () => [matchCandidateFixture()],
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.matchStatus).toBe('exact_trusted_match')
    expect(capturedPayload?.matched_household_id).toBe('hh-existing-1')
  })

  it('still returns ok:true with a failed sheetsSync when the CRM write succeeds but Sheets fails', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_family_report_card') {
        return { data: newProspectRpcResponse(), error: null }
      }
      return { data: null, error: null }
    })

    const sheetsWriter = vi.fn().mockResolvedValue({ status: 'failed' as const, errorCategory: 'timeout' as const })

    const result = await ingestFamilyReportCard(validIngestRequestBodyFixture(), {
      admin,
      sheetsWriter,
      findCandidates: async () => [],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.sheetsSync.status).toBe('failed')
      expect(result.sheetsSync.errorCategory).toBe('timeout')
    }
  })

  it('handles idempotent replay without re-running the Sheets write', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_family_report_card') {
        return {
          data: newProspectRpcResponse({
            created: false,
            match_status: 'new_prospect',
            sheets_sync_status: 'succeeded',
          }),
          error: null,
        }
      }
      return { data: null, error: null }
    })

    const sheetsWriter = vi.fn().mockResolvedValue({ status: 'succeeded' as const })

    const result = await ingestFamilyReportCard(validIngestRequestBodyFixture(), {
      admin,
      sheetsWriter,
      findCandidates: async () => [],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(false)
      expect(result.sheetsSync.status).toBe('succeeded')
    }
    expect(sheetsWriter).not.toHaveBeenCalled()
  })

  it('returns a safe error when the RPC fails', async () => {
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_family_report_card') {
        return { data: null, error: { message: 'invalid_match_status' } }
      }
      return { data: null, error: null }
    })

    const result = await ingestFamilyReportCard(validIngestRequestBodyFixture(), {
      admin,
      findCandidates: async () => [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid_match_status')
      expect(result.error).toBe('Unable to save submission')
    }
  })

  it('returns a safe error when candidate lookup throws', async () => {
    const admin = makeAdminStub(async () => ({ data: null, error: null }))

    const result = await ingestFamilyReportCard(validIngestRequestBodyFixture(), {
      admin,
      findCandidates: async () => {
        throw new Error('db unavailable')
      },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('candidate_lookup_failed')
    expect(admin.rpc).not.toHaveBeenCalled()
  })
})
