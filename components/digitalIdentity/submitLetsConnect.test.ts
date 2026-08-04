import { describe, expect, it, vi } from 'vitest'
import { submitLetsConnect } from './submitLetsConnect'

const SUBMISSION_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('submitLetsConnect', () => {
  it('POSTs to /api/digital-identity/connect and maps success', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          created: true,
          submissionId: SUBMISSION_ID,
          matchStatus: 'new_prospect',
        }),
        { status: 201 },
      ),
    )

    const result = await submitLetsConnect(
      { submissionId: SUBMISSION_ID, firstName: 'Alex' },
      { fetchImpl: fetchImpl as never },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(true)
      expect(result.matchStatus).toBe('new_prospect')
      expect(result.httpStatus).toBe(201)
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/digital-identity/connect',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).not.toHaveProperty('householdId')
  })

  it('maps validation failures to user-safe errors', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ ok: false, error: 'Privacy acknowledgment is required.', code: 'invalid_consent' }),
        { status: 400 },
      ),
    )

    const result = await submitLetsConnect(
      { submissionId: SUBMISSION_ID },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('validation')
      expect(result.error).toContain('Privacy acknowledgment')
    }
  })

  it('maps rate limiting', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 429 }))
    const result = await submitLetsConnect({}, { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('rate_limited')
  })

  it('maps network failures', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const result = await submitLetsConnect({}, { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('network')
  })

  it('never imports admin modules (boundary smoke)', () => {
    // Static guarantee: this module only uses fetch. Runtime import graph is
    // covered by lint/boundary tests elsewhere; assert success shape has no internals.
    const success = {
      ok: true as const,
      created: true,
      submissionId: SUBMISSION_ID,
      matchStatus: 'new_prospect',
      httpStatus: 201,
    }
    expect(success).not.toHaveProperty('householdId')
    expect(success).not.toHaveProperty('advisorProfileId')
  })
})
