import { describe, expect, it, vi } from 'vitest'
import {
  downloadPublicCardVCard,
  publicCardVCardDownloadSideEffects,
} from './downloadPublicCardVCard'

const SAMPLE_VCARD =
  'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Luis Perez\r\nEND:VCARD\r\n'

describe('downloadPublicCardVCard', () => {
  it('downloads a vCard by public key', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(SAMPLE_VCARD, {
        status: 200,
        headers: {
          'Content-Type': 'text/vcard; charset=utf-8',
          'Content-Disposition': 'attachment; filename="Luis-Perez.vcf"',
        },
      }),
    )

    const result = await downloadPublicCardVCard(
      { key: 'pk_live_abcdefghijklmnop' },
      { fetchImpl: fetchImpl as never },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.filename).toBe('Luis-Perez.vcf')
      expect(result.body).toContain('BEGIN:VCARD')
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/digital-identity/card/vcard?key=pk_live_abcdefghijklmnop',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('downloads a vCard by slug', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(SAMPLE_VCARD, {
          status: 200,
          headers: { 'Content-Type': 'text/vcard; charset=utf-8' },
        }),
    )
    const result = await downloadPublicCardVCard(
      { slug: 'luis-perez' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/digital-identity/card/vcard?slug=luis-perez',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('rejects both key and slug before fetch', async () => {
    const fetchImpl = vi.fn()
    const result = await downloadPublicCardVCard(
      { key: 'a', slug: 'b' } as never,
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_request')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps unavailable cards safely', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, code: 'unavailable' }), { status: 404 }),
    )
    const result = await downloadPublicCardVCard(
      { key: 'pk_live_abcdefghijklmnop' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unavailable')
      expect(result.message).not.toMatch(/supabase|postgres|stack/i)
    }
  })

  it('maps network failures safely', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const result = await downloadPublicCardVCard(
      { slug: 'luis-perez' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('network')
  })

  it('rejects malformed 200 payloads', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('not-a-vcard', {
          status: 200,
          headers: { 'Content-Type': 'text/vcard; charset=utf-8' },
        }),
    )
    const result = await downloadPublicCardVCard(
      { key: 'pk_live_abcdefghijklmnop' },
      { fetchImpl: fetchImpl as never },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('malformed_response')
  })

  it('declares no analytics or CRM side effects', () => {
    expect(publicCardVCardDownloadSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      createsTask: false,
      createsActivity: false,
      createsCase: false,
      importsAdminClient: false,
    })
  })
})
