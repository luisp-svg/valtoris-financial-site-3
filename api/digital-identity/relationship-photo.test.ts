import { describe, expect, it, vi } from 'vitest'
import { handleDigitalIdentityRelationshipPhotoRequest } from './relationship-photo'

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(k: string, v: string) {
      this.headers[k] = v
    },
    getHeader(k: string) {
      return this.headers[k]
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
    end() {
      return this
    },
  }
  return res
}

describe('POST /api/digital-identity/relationship-photo', () => {
  it('rejects non-POST methods', async () => {
    const res = mockRes()
    await handleDigitalIdentityRelationshipPhotoRequest(
      { method: 'GET', headers: {}, query: {}, body: null, socket: { remoteAddress: '127.0.0.1' } } as never,
      res as never,
    )
    expect(res.statusCode).toBe(405)
  })

  it('requires acknowledgment through upload adapter', async () => {
    const res = mockRes()
    const upload = vi.fn(async () => ({
      ok: false as const,
      code: 'acknowledgment_required',
      error: 'Please acknowledge photo storage before saving a photo.',
    }))
    await handleDigitalIdentityRelationshipPhotoRequest(
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: '127.0.0.1:5180',
          origin: 'http://127.0.0.1:5180',
        },
        query: {},
        body: {
          uploadToken: 'a'.repeat(64),
          photoAcknowledgment: false,
          imageBase64: Buffer.from('ffd8ffe0', 'hex').toString('base64'),
          source: 'digital_identity_connect',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      res as never,
      { upload, checkRateLimit: () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 }) },
    )
    expect(upload).toHaveBeenCalled()
    expect(res.statusCode).toBe(400)
    expect(res.body).toMatchObject({ ok: false, code: 'acknowledgment_required' })
  })

  it('returns 201 on successful save', async () => {
    const res = mockRes()
    await handleDigitalIdentityRelationshipPhotoRequest(
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: '127.0.0.1:5180',
          origin: 'http://127.0.0.1:5180',
        },
        query: {},
        body: {
          uploadToken: 'b'.repeat(64),
          photoAcknowledgment: true,
          imageBase64: Buffer.from('ffd8ffe000104a464946', 'hex').toString('base64'),
          source: 'digital_identity_connect',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      res as never,
      {
        upload: async () => ({ ok: true as const, saved: true as const }),
        checkRateLimit: () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 }),
      },
    )
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ ok: true, saved: true })
  })
})
