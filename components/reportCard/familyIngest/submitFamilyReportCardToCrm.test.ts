import { describe, expect, it, vi } from 'vitest'
import { submitFamilyReportCardToCrm } from './submitFamilyReportCardToCrm'
import type { FamilyReportCardClientIngestBody } from './buildFamilyIngestPayload'
import { validFamilyAnswersFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { buildFamilyConsentSnapshot, INITIAL_FAMILY_CONSENT_STATE } from './familyConsent'
import { buildFamilyReportCardIngestPayload } from './buildFamilyIngestPayload'
import { createEmptyFamilyIngestSession } from './submissionSession'

function sampleBody(): FamilyReportCardClientIngestBody {
  const answers = validFamilyAnswersFixture()
  return buildFamilyReportCardIngestPayload({
    submissionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    answers,
    session: createEmptyFamilyIngestSession('2026-07-28T19:00:00.000Z'),
    consent: buildFamilyConsentSnapshot({
      consent: {
        ...INITIAL_FAMILY_CONSENT_STATE,
        assessmentStorageAcknowledged: true,
        privacyAcknowledged: true,
      },
      phone: answers.family.phone,
      nowIso: '2026-07-28T20:00:00.000Z',
    }),
    sourcePage: '/family-assessment',
    clientReportedScore: 72,
    clientReportedGrade: 'C',
    submittedAt: '2026-07-28T20:00:00.000Z',
  })
}

describe('submitFamilyReportCardToCrm', () => {
  it('handles 201 success', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: true,
          submissionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'succeeded' },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const result = await submitFamilyReportCardToCrm(sampleBody(), { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.httpStatus).toBe(201)
      expect(result.sheetsSyncStatus).toBe('succeeded')
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/ingest-family-report-card',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('handles 200 idempotent replay', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: false,
          submissionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          assessmentId: 'assess-1',
          matchStatus: 'new_prospect',
          sheetsSync: { status: 'pending' },
        }),
        { status: 200 },
      ),
    )
    const result = await submitFamilyReportCardToCrm(sampleBody(), { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.created).toBe(false)
  })

  it('maps 400 validation safely', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: 'Invalid phone number.', code: 'invalid_phone' }), {
        status: 400,
      }),
    )
    const result = await submitFamilyReportCardToCrm(sampleBody(), { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('validation')
      expect(result.error).toContain('Invalid phone')
      expect(result.error).not.toMatch(/sql|supabase|stack/i)
    }
  })

  it('maps 429 rate limit', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 429 }))
    const result = await submitFamilyReportCardToCrm(sampleBody(), { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('rate_limited')
      expect(result.error).toMatch(/Too many submission attempts/)
    }
  })

  it('maps 413 oversized', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 413 }))
    const result = await submitFamilyReportCardToCrm(sampleBody(), { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('payload_too_large')
  })

  it('maps 500 without exposing raw bodies', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: 'relation "leads" does not exist', stack: 'x' }), {
        status: 500,
      }),
    )
    const result = await submitFamilyReportCardToCrm(sampleBody(), { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('server')
      expect(result.error).not.toContain('leads')
      expect(result.error).not.toContain('stack')
    }
  })

  it('handles network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const result = await submitFamilyReportCardToCrm(sampleBody(), { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('network')
  })

  it('handles timeout/abort', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    })
    const result = await submitFamilyReportCardToCrm(sampleBody(), {
      fetchImpl: fetchImpl as never,
      timeoutMs: 5,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('timeout')
  })

  it('handles malformed success JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"ok":false}', { status: 200 }))
    const result = await submitFamilyReportCardToCrm(sampleBody(), { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('malformed_response')
  })
})
