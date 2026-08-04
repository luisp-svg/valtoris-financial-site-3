import { describe, expect, it, vi } from 'vitest'
import {
  downloadPublicCardQr,
  publicCardQrDownloadSideEffects,
  qrDownloadMenuItems,
} from './downloadPublicCardQr'

describe('downloadPublicCardQr', () => {
  it('downloads SVG by public key only', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Content-Disposition': 'attachment; filename="Luis-Perez-QR.svg"',
          'X-Valtoris-QR-Destination':
            'https://valtoris.example/c/k/pk_live_abcdefghijklmnop',
        },
      }),
    )

    const result = await downloadPublicCardQr(
      { key: 'pk_live_abcdefghijklmnop', format: 'svg' },
      { fetchImpl: fetchImpl as never },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.filename).toBe('Luis-Perez-QR.svg')
      expect(result.destinationUrl).toBe(
        'https://valtoris.example/c/k/pk_live_abcdefghijklmnop',
      )
    }
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/digital-identity/card/qr?key=pk_live_abcdefghijklmnop&format=svg',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('downloads PNG and print PNG', async () => {
    for (const format of ['png', 'png-hires'] as const) {
      const fetchImpl = vi.fn(
        async () =>
          new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...Array(20).fill(1)]), {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          }),
      )
      const result = await downloadPublicCardQr(
        { key: 'pk_live_abcdefghijklmnop', format },
        { fetchImpl: fetchImpl as never },
      )
      expect(result.ok).toBe(true)
      expect(fetchImpl).toHaveBeenCalledWith(
        `/api/digital-identity/card/qr?key=pk_live_abcdefghijklmnop&format=${format}`,
        expect.objectContaining({ method: 'GET' }),
      )
    }
  })

  it('passes campaign/event codes for SVG, PNG, and print downloads on public_key destinations', async () => {
    for (const format of ['svg', 'png', 'png-hires'] as const) {
      const destination =
        'https://valtoris.example/c/k/pk_live_abcdefghijklmnop?c=rr-chamber-2026&e=breakfast-aug-12&src=qr'
      let calledUrl = ''
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        calledUrl = String(input)
        return new Response(
          format === 'svg'
            ? '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
            : new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...Array(20).fill(1)]),
          {
            status: 200,
            headers: {
              'Content-Type': format === 'svg' ? 'image/svg+xml' : 'image/png',
              'X-Valtoris-QR-Destination': destination,
            },
          },
        )
      })
      const result = await downloadPublicCardQr(
        {
          key: 'pk_live_abcdefghijklmnop',
          format,
          campaignCode: 'rr-chamber-2026',
          eventCode: 'breakfast-aug-12',
        },
        { fetchImpl: fetchImpl as never },
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.destinationUrl).toBe(destination)
        expect(result.destinationUrl).toContain('/c/k/')
        expect(result.destinationUrl).not.toContain('/c/jane')
      }
      expect(calledUrl).toContain('key=pk_live_abcdefghijklmnop')
      expect(calledUrl).toContain(`format=${format}`)
      expect(calledUrl).toContain('c=rr-chamber-2026')
      expect(calledUrl).toContain('e=breakfast-aug-12')
      expect(calledUrl).not.toContain('slug=')
      expect(calledUrl).not.toContain('camp-uuid')
    }
  })

  it('maps unavailable and network failures safely', async () => {
    const unavailable = await downloadPublicCardQr(
      { key: 'pk_live_abcdefghijklmnop', format: 'svg' },
      {
        fetchImpl: vi.fn(
          async () =>
            new Response(JSON.stringify({ ok: false, code: 'unavailable' }), {
              status: 404,
            }),
        ) as never,
      },
    )
    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.code).toBe('unavailable')

    const network = await downloadPublicCardQr(
      { key: 'pk_live_abcdefghijklmnop', format: 'svg' },
      {
        fetchImpl: vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        }) as never,
      },
    )
    expect(network.ok).toBe(false)
    if (!network.ok) expect(network.code).toBe('network')
  })

  it('exposes the Download QR menu formats', () => {
    expect(qrDownloadMenuItems().map((item) => item.label)).toEqual([
      'SVG',
      'PNG',
      'Print PNG',
    ])
  })

  it('declares no analytics or CRM side effects', () => {
    expect(publicCardQrDownloadSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      tracksCampaign: false,
      tracksEvent: false,
      importsAdminClient: false,
    })
  })
})
