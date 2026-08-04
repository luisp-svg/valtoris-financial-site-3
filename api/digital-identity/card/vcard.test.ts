import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it, vi } from 'vitest'
import {
  handleDigitalIdentityVCardRequest,
  resolveRequestOrigin,
} from './vcard'
import type { PublicCardLookupResult } from '../../../server/digitalIdentity'
import { LETS_CONNECT_CTA_LABEL } from '../../../modules/digital-identity'

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
  origin?: string
  host?: string
  proto?: string
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
      ...(input.proto ? { 'x-forwarded-proto': input.proto } : {}),
    },
  } as unknown as VercelRequest
}

const foundCard: PublicCardLookupResult = {
  status: 'found',
  card: {
    publicKey: 'pk_test_public_key01',
    slug: 'luis-perez',
    kind: 'advisor_card',
    displayName: 'Luis Perez',
    approvedTitle: 'Advisor',
    approvedCompany: 'Valtoris Financial',
    headline: null,
    bio: null,
    headshotUrl: 'https://cdn.example.com/luis.jpg',
    phone: '555-0100',
    email: 'luis@example.com',
    website: 'https://example.com',
    socialLinks: [],
    specialties: [],
    calendlyUrl: 'https://calendly.com/luis',
    themeKey: 'default',
    ctas: [{ key: 'lets_connect', label: LETS_CONNECT_CTA_LABEL, enabled: true }],
    primaryConnectLabel: LETS_CONNECT_CTA_LABEL,
    cardUrl: '/c/k/pk_test_public_key01',
  },
}

describe('resolveRequestOrigin', () => {
  it('defaults to https and honors x-forwarded-proto', () => {
    expect(
      resolveRequestOrigin(mockReq({ host: 'valtoris.example', proto: 'https' })),
    ).toBe('https://valtoris.example')
    expect(
      resolveRequestOrigin(mockReq({ host: 'localhost:3000', proto: 'http' })),
    ).toBe('http://localhost:3000')
  })
})

describe('GET /api/digital-identity/card/vcard', () => {
  it('returns a downloadable vCard for a published card by key', async () => {
    const res = mockRes()
    await handleDigitalIdentityVCardRequest(
      mockReq({
        key: 'pk_test_public_key01',
        host: 'valtoris.example',
        proto: 'https',
      }),
      res,
      { lookup: async () => foundCard },
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.headers['Content-Type']).toMatch(/text\/vcard/)
    expect(res.headers['Content-Disposition']).toMatch(/Luis-Perez\.vcf/)
    expect(res.headers['Cache-Control']).toBe('private, no-store')
    expect(typeof res.body).toBe('string')
    const body = String(res.body)
    expect(body.startsWith('BEGIN:VCARD')).toBe(true)
    expect(body.includes('FN:Luis Perez')).toBe(true)
    expect(body.includes('TEL;TYPE=CELL,VOICE:555-0100')).toBe(true)
    expect(body.includes('https://valtoris.example/c/k/pk_test_public_key01')).toBe(true)
    expect(body).not.toMatch(/advisorProfileId|publish_profile|cta_config/)
  })

  it('returns a downloadable vCard by slug', async () => {
    const res = mockRes()
    await handleDigitalIdentityVCardRequest(
      mockReq({ slug: 'luis-perez', host: 'valtoris.example' }),
      res,
      { lookup: async () => foundCard },
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(String(res.body)).toContain('ORG:Valtoris Financial')
  })

  it('omits hidden phone/email from the download', async () => {
    const res = mockRes()
    await handleDigitalIdentityVCardRequest(
      mockReq({ key: 'pk_test_public_key01', host: 'valtoris.example' }),
      res,
      {
        lookup: async () => ({
          status: 'found',
          card: { ...foundCard.card, phone: null, email: null },
        }),
      },
    )
    const body = String(res.body)
    expect(body.includes('TEL')).toBe(false)
    expect(body.includes('EMAIL')).toBe(false)
  })

  it('returns identical unavailable for draft/disabled/missing cards', async () => {
    const res = mockRes()
    await handleDigitalIdentityVCardRequest(
      mockReq({ key: 'pk_test_public_key01', host: 'valtoris.example' }),
      res,
      { lookup: async () => ({ status: 'unavailable' }) },
    )
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.body).toEqual({ ok: false, code: 'unavailable' })
  })

  it('rejects both key and slug', async () => {
    const lookup = vi.fn()
    const res = mockRes()
    await handleDigitalIdentityVCardRequest(
      mockReq({ key: 'a', slug: 'b', host: 'valtoris.example' }),
      res,
      { lookup },
    )
    expect(lookup).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects neither key nor slug', async () => {
    const res = mockRes()
    await handleDigitalIdentityVCardRequest(
      mockReq({ host: 'valtoris.example' }),
      res,
      { lookup: async () => foundCard },
    )
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects non-GET methods', async () => {
    const res = mockRes()
    await handleDigitalIdentityVCardRequest(
      mockReq({ method: 'POST', key: 'pk_test_public_key01', host: 'valtoris.example' }),
      res,
      { lookup: async () => foundCard },
    )
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('maps lookup server errors safely', async () => {
    const res = mockRes()
    await handleDigitalIdentityVCardRequest(
      mockReq({ key: 'pk_test_public_key01', host: 'valtoris.example' }),
      res,
      { lookup: async () => ({ status: 'server_error' }) },
    )
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.body).toEqual({ ok: false, code: 'server_error' })
  })
})
