import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleDigitalIdentityConnectRequest } from './connect'
import { _resetRateLimitStateForTests } from '../../server/ingest/familyReportCard/abuse'
import { VALID_SUBMISSION_ID } from '../../server/ingest/digitalIdentity/testFixtures'

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader: vi.fn((key: string, value: string) => {
      res.headers[key] = value
      return res
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((payload: unknown) => {
      res.body = payload
      return res
    }),
    end: vi.fn(() => res),
  }
  return res as unknown as VercelResponse & {
    statusCode: number
    body: unknown
    headers: Record<string, string>
  }
}

function mockReq(input: {
  method?: string
  body?: unknown
  origin?: string
  host?: string
  contentType?: string
  contentLength?: string
}): VercelRequest {
  return {
    method: input.method ?? 'POST',
    body: input.body ?? {},
    headers: {
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.host ? { host: input.host } : {}),
      'content-type': input.contentType ?? 'application/json',
      ...(input.contentLength ? { 'content-length': input.contentLength } : {}),
    },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as VercelRequest
}

afterEach(() => {
  _resetRateLimitStateForTests()
})

describe('POST /api/digital-identity/connect', () => {
  it('handles OPTIONS with CORS', async () => {
    const res = mockRes()
    await handleDigitalIdentityConnectRequest(
      mockReq({ method: 'OPTIONS', origin: 'https://example.com', host: 'example.com' }),
      res,
    )
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://example.com')
  })

  it('rejects non-POST methods', async () => {
    const res = mockRes()
    await handleDigitalIdentityConnectRequest(mockReq({ method: 'GET' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 201 for a new prospect without householdId', async () => {
    const res = mockRes()
    const ingest = vi.fn(async () => ({
      ok: true as const,
      created: true,
      submissionId: VALID_SUBMISSION_ID,
      matchStatus: 'new_prospect' as const,
    }))

    await handleDigitalIdentityConnectRequest(
      mockReq({ body: { submissionId: VALID_SUBMISSION_ID } }),
      res,
      { ingest },
    )

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.body).toEqual({
      ok: true,
      created: true,
      submissionId: VALID_SUBMISSION_ID,
      matchStatus: 'new_prospect',
    })
    expect(JSON.stringify(res.body)).not.toMatch(/householdId|leadId|taskId|advisorProfileId/)
  })

  it('returns 200 for idempotent replay created:false', async () => {
    const res = mockRes()
    await handleDigitalIdentityConnectRequest(
      mockReq({ body: { submissionId: VALID_SUBMISSION_ID } }),
      res,
      {
        ingest: async () => ({
          ok: true,
          created: false,
          submissionId: VALID_SUBMISSION_ID,
          matchStatus: 'new_prospect',
        }),
      },
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect((res.body as { created: boolean }).created).toBe(false)
  })

  it('returns 400 for validation errors', async () => {
    const res = mockRes()
    await handleDigitalIdentityConnectRequest(mockReq({ body: {} }), res, {
      ingest: async () => ({
        ok: false,
        error: 'Privacy acknowledgment is required.',
        code: 'invalid_consent',
      }),
    })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.body).toMatchObject({ ok: false, code: 'invalid_consent' })
  })

  it('returns 429 when rate limited', async () => {
    const res = mockRes()
    await handleDigitalIdentityConnectRequest(mockReq({ body: {} }), res, {
      checkRateLimit: () => ({ allowed: false }),
      ingest: async () => ({
        ok: true,
        created: true,
        submissionId: VALID_SUBMISSION_ID,
        matchStatus: 'new_prospect',
      }),
    })
    expect(res.status).toHaveBeenCalledWith(429)
  })

  it('returns 500 safe error for unexpected ingest failures', async () => {
    const res = mockRes()
    await handleDigitalIdentityConnectRequest(mockReq({ body: {} }), res, {
      ingest: async () => ({
        ok: false,
        error: 'Unable to save submission',
        code: 'ingest_rpc_failed',
      }),
    })
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.body).toEqual({ ok: false, error: 'Unable to save submission' })
  })

  it('returns 413 for oversized content-length', async () => {
    const res = mockRes()
    await handleDigitalIdentityConnectRequest(
      mockReq({ body: {}, contentLength: '200000' }),
      res,
      { ingest: vi.fn() },
    )
    expect(res.status).toHaveBeenCalledWith(413)
  })
})
