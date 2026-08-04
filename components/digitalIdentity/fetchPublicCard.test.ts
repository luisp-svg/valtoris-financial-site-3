import { describe, expect, it, vi } from 'vitest'
import {
  fetchPublicCard,
  publicCardFetchSideEffects,
} from './fetchPublicCard'
import type { IdentitySurfacePublicDto } from '../../modules/digital-identity'

function sampleCard(overrides: Partial<IdentitySurfacePublicDto> = {}): IdentitySurfacePublicDto {
  return {
    publicKey: 'pk_live_abcdefghijklmnop',
    slug: 'jane-advisor',
    kind: 'advisor_card',
    displayName: 'Jane Advisor',
    approvedTitle: 'Financial Advisor',
    approvedCompany: 'Valtoris Financial',
    headline: 'Clarity for families and founders.',
    bio: 'I help families protect what matters.',
    headshotUrl: 'https://cdn.example.com/jane.jpg',
    phone: '555-0100',
    email: 'jane@example.com',
    website: 'https://example.com',
    socialLinks: [{ key: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/jane' }],
    specialties: ['Family Protection'],
    calendlyUrl: 'https://calendly.com/jane',
    themeKey: 'default',
    ctas: [
      { key: 'lets_connect', label: "Let's Connect", enabled: true, href: null },
      { key: 'save_contact', label: 'Save Contact', enabled: true, href: null },
      {
        key: 'book_appointment',
        label: 'Book Appointment',
        enabled: true,
        href: 'https://calendly.com/jane',
      },
      {
        key: 'family_report_card',
        label: 'Family Financial Report Card',
        enabled: true,
        href: '/family-assessment',
      },
    ],
    primaryConnectLabel: "Let's Connect",
    cardUrl: '/c/k/pk_live_abcdefghijklmnop',
    ...overrides,
  }
}

describe('fetchPublicCard', () => {
  it('loads a published card by public key', async () => {
    const card = sampleCard()
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, card }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await fetchPublicCard(
      { key: 'pk_live_abcdefghijklmnop' },
      { fetchImpl: fetchImpl as never },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.card.displayName).toBe('Jane Advisor')
      expect(result.card.primaryConnectLabel).toBe("Let's Connect")
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/digital-identity/card?key=pk_live_abcdefghijklmnop',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('loads a published card by slug', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, card: sampleCard() }), { status: 200 }),
    )
    const result = await fetchPublicCard(
      { slug: 'jane-advisor' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/digital-identity/card?slug=jane-advisor',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects both key and slug before fetch', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchPublicCard(
      { key: 'abc', slug: 'jane' } as never,
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_request')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects neither key nor slug before fetch', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchPublicCard({} as never, { fetchImpl: fetchImpl as never })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_request')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps unavailable (404) safely', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, code: 'unavailable' }), { status: 404 }),
    )
    const result = await fetchPublicCard(
      { key: 'pk_live_abcdefghijklmnop' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unavailable')
      expect(result.message).toMatch(/not published|no longer available/i)
      expect(result.message).not.toMatch(/supabase|postgres|stack/i)
    }
  })

  it('maps invalid_request (400) safely', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, code: 'invalid_request' }), { status: 400 }),
    )
    const result = await fetchPublicCard(
      { key: 'bad' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_request')
  })

  it('maps network failures safely', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const result = await fetchPublicCard(
      { slug: 'jane-advisor' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('network')
      expect(result.message).toMatch(/connection/i)
    }
  })

  it('rejects malformed 200 payloads', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, card: { displayName: 'Nope' } }), {
          status: 200,
        }),
    )
    const result = await fetchPublicCard(
      { slug: 'jane-advisor' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('malformed_response')
  })

  it('declares no analytics or CRM side effects', () => {
    expect(publicCardFetchSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      createsTask: false,
      createsActivity: false,
      createsCase: false,
    })
  })
})
