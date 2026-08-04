import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it, vi } from 'vitest'
import { handleDigitalIdentityCardRequest } from './card'
import type { PublicCardLookupResult } from '../../server/digitalIdentity'
import { LETS_CONNECT_CTA_LABEL } from '../../modules/digital-identity'

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
  key?: string
  slug?: string
  origin?: string
  host?: string
}): VercelRequest {
  return {
    method: input.method ?? 'GET',
    query: {
      ...(input.key !== undefined ? { key: input.key } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
    },
    headers: {
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.host ? { host: input.host } : {}),
    },
  } as unknown as VercelRequest
}

const foundCard: PublicCardLookupResult = {
  status: 'found',
  card: {
    publicKey: 'pk_test_public_key01',
    slug: 'jane-advisor',
    kind: 'advisor_card',
    displayName: 'Jane Advisor',
    approvedTitle: 'Advisor',
    approvedCompany: null,
    headline: null,
    bio: null,
    headshotUrl: null,
    phone: '555-0100',
    email: 'jane@example.com',
    website: null,
    socialLinks: [],
    specialties: [],
    calendlyUrl: null,
    themeKey: 'default',
    ctas: [{ key: 'lets_connect', label: LETS_CONNECT_CTA_LABEL, enabled: true }],
    primaryConnectLabel: LETS_CONNECT_CTA_LABEL,
    cardUrl: '/c/k/pk_test_public_key01',
  },
}

describe('GET /api/digital-identity/card', () => {
  it('returns 200 for a found card by key', async () => {
    const res = mockRes()
    const lookup = vi.fn(async () => foundCard)
    await handleDigitalIdentityCardRequest(mockReq({ key: 'pk_test_public_key01' }), res, {
      lookup,
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.body).toEqual({ ok: true, card: foundCard.card })
    expect(res.headers['Cache-Control']).toBe('private, no-store')
    expect(JSON.stringify(res.body)).not.toMatch(/advisorProfileId|user_id|publish_profile/)
  })

  it('returns 200 for a found card by slug', async () => {
    const res = mockRes()
    const lookup = vi.fn(async () => foundCard)
    await handleDigitalIdentityCardRequest(mockReq({ slug: 'jane-advisor' }), res, { lookup })
    expect(lookup).toHaveBeenCalledWith({ slug: 'jane-advisor' })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 404 unavailable for missing/private cards', async () => {
    const res = mockRes()
    await handleDigitalIdentityCardRequest(mockReq({ key: 'pk_test_public_key99' }), res, {
      lookup: async () => ({ status: 'unavailable' }),
    })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.body).toEqual({ ok: false, code: 'unavailable' })
  })

  it('returns 400 for both, neither, or malformed identifiers', async () => {
    const both = mockRes()
    await handleDigitalIdentityCardRequest(
      mockReq({ key: 'pk_test_public_key01', slug: 'jane' }),
      both,
      { lookup: async () => ({ status: 'found', card: foundCard.card }) },
    )
    expect(both.status).toHaveBeenCalledWith(400)

    const neither = mockRes()
    await handleDigitalIdentityCardRequest(mockReq({}), neither, {
      lookup: async () => ({ status: 'found', card: foundCard.card }),
    })
    expect(neither.status).toHaveBeenCalledWith(400)

    const malformed = mockRes()
    await handleDigitalIdentityCardRequest(mockReq({ key: 'bad' }), malformed, {
      lookup: async () => ({ status: 'invalid_request', reason: 'invalid_public_key' }),
    })
    expect(malformed.status).toHaveBeenCalledWith(400)
    expect(malformed.body).toEqual({ ok: false, code: 'invalid_request' })
  })

  it('allows GET/OPTIONS only', async () => {
    const res = mockRes()
    await handleDigitalIdentityCardRequest(mockReq({ method: 'POST', key: 'x' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, OPTIONS')
  })

  it('returns safe 500 without raw errors', async () => {
    const res = mockRes()
    await handleDigitalIdentityCardRequest(mockReq({ key: 'pk_test_public_key01' }), res, {
      lookup: async () => ({ status: 'server_error' }),
    })
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.body).toEqual({ ok: false, code: 'server_error' })
  })

  it('sets same-origin CORS when Origin matches Host', async () => {
    const res = mockRes()
    await handleDigitalIdentityCardRequest(
      mockReq({
        key: 'pk_test_public_key01',
        origin: 'https://valtoris.example',
        host: 'valtoris.example',
      }),
      res,
      { lookup: async () => foundCard },
    )
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://valtoris.example')
  })
})
