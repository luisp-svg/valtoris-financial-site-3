import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it, vi } from 'vitest'
import { handleDigitalIdentityQrRequest } from './qr'

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
    send: vi.fn((payload: unknown) => {
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
  key?: string
  slug?: string
  format?: string
  host?: string
  proto?: string
}): VercelRequest {
  return {
    method: input.method ?? 'GET',
    query: {
      ...(input.key !== undefined ? { key: input.key } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.format !== undefined ? { format: input.format } : {}),
    },
    headers: {
      ...(input.host ? { host: input.host } : {}),
      ...(input.proto ? { 'x-forwarded-proto': input.proto } : {}),
    },
  } as unknown as VercelRequest
}

describe('GET /api/digital-identity/card/qr', () => {
  it('returns SVG for a valid published key', async () => {
    const res = mockRes()
    const generate = vi.fn(async () => ({
      status: 'found' as const,
      format: 'svg' as const,
      contentType: 'image/svg+xml; charset=utf-8',
      filename: 'Luis-Perez-QR.svg',
      destinationUrl: 'https://valtoris.example/c/k/pk_test_public_key01',
      body: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    }))

    await handleDigitalIdentityQrRequest(
      mockReq({
        key: 'pk_test_public_key01',
        format: 'svg',
        host: 'valtoris.example',
        proto: 'https',
      }),
      res,
      { generate },
    )

    expect(generate).toHaveBeenCalledWith({
      key: 'pk_test_public_key01',
      format: 'svg',
      origin: 'https://valtoris.example',
      campaignCode: null,
      eventCode: null,
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.headers['Content-Type']).toMatch(/image\/svg\+xml/)
    expect(res.headers['Content-Disposition']).toMatch(/Luis-Perez-QR\.svg/)
    expect(res.headers['X-Valtoris-QR-Destination']).toBe(
      'https://valtoris.example/c/k/pk_test_public_key01',
    )
    expect(String(res.body)).toContain('<svg')
  })

  it('returns PNG and print PNG content types', async () => {
    const pngBody = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    for (const format of ['png', 'png-hires'] as const) {
      const res = mockRes()
      await handleDigitalIdentityQrRequest(
        mockReq({
          key: 'pk_test_public_key01',
          format,
          host: 'valtoris.example',
        }),
        res,
        {
          generate: async () => ({
            status: 'found',
            format,
            contentType: 'image/png',
            filename:
              format === 'png-hires' ? 'Luis-Perez-QR-Print.png' : 'Luis-Perez-QR.png',
            destinationUrl: 'https://valtoris.example/c/k/pk_test_public_key01',
            body: pngBody,
          }),
        },
      )
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.headers['Content-Type']).toBe('image/png')
    }
  })

  it('rejects slug-based QR requests', async () => {
    const generate = vi.fn()
    const res = mockRes()
    await handleDigitalIdentityQrRequest(
      mockReq({ slug: 'luis-perez', host: 'valtoris.example' }),
      res,
      { generate },
    )
    expect(generate).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.body).toEqual({ ok: false, code: 'invalid_request' })
  })

  it('rejects missing key and unknown formats', async () => {
    const resMissing = mockRes()
    await handleDigitalIdentityQrRequest(
      mockReq({ host: 'valtoris.example' }),
      resMissing,
      {
        generate: async () => ({ status: 'invalid_request', reason: 'missing' }),
      },
    )
    expect(resMissing.status).toHaveBeenCalledWith(400)

    const resFormat = mockRes()
    await handleDigitalIdentityQrRequest(
      mockReq({
        key: 'pk_test_public_key01',
        format: 'pdf',
        host: 'valtoris.example',
      }),
      resFormat,
      {
        generate: async () => ({ status: 'invalid_request', reason: 'invalid_format' }),
      },
    )
    expect(resFormat.status).toHaveBeenCalledWith(400)
  })

  it('returns unavailable for unpublished cards', async () => {
    const res = mockRes()
    await handleDigitalIdentityQrRequest(
      mockReq({ key: 'pk_test_public_key01', host: 'valtoris.example' }),
      res,
      { generate: async () => ({ status: 'unavailable' }) },
    )
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.body).toEqual({ ok: false, code: 'unavailable' })
  })

  it('rejects non-GET methods', async () => {
    const res = mockRes()
    await handleDigitalIdentityQrRequest(
      mockReq({
        method: 'POST',
        key: 'pk_test_public_key01',
        host: 'valtoris.example',
      }),
      res,
      { generate: async () => ({ status: 'unavailable' }) },
    )
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
