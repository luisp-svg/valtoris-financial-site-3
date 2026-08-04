import { describe, expect, it, vi } from 'vitest'
import {
  generatePublishedCardQr,
  publishedCardQrSideEffects,
} from './generatePublishedCardQr'
import type { PublicCardLookupResult } from './types'
import { LETS_CONNECT_CTA_LABEL } from '../../modules/digital-identity'

const found: PublicCardLookupResult = {
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
    headshotUrl: null,
    phone: null,
    email: null,
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

describe('generatePublishedCardQr', () => {
  it('generates SVG QR pointing at the public_key route', async () => {
    const toString = vi.fn(async (text: string) => {
      expect(text).toBe('https://valtoris.example/c/k/pk_test_public_key01')
      expect(text).not.toContain('/c/luis-perez')
      return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    })
    const result = await generatePublishedCardQr(
      {
        key: 'pk_test_public_key01',
        format: 'svg',
        origin: 'https://valtoris.example',
      },
      {
        lookupByKey: async () => found,
        qrcode: { toString, toBuffer: vi.fn() },
      },
    )

    expect(result.status).toBe('found')
    if (result.status === 'found') {
      expect(result.format).toBe('svg')
      expect(result.filename).toBe('Luis-Perez-QR.svg')
      expect(result.destinationUrl).toBe(
        'https://valtoris.example/c/k/pk_test_public_key01',
      )
      expect(String(result.body)).toContain('<svg')
    }
    expect(toString).toHaveBeenCalledWith(
      'https://valtoris.example/c/k/pk_test_public_key01',
      expect.objectContaining({
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 4,
      }),
    )
  })

  it('generates PNG and print PNG with correct widths', async () => {
    const toBuffer = vi.fn(async (_text: string, options: { width?: number }) => {
      expect(options.width).toBeDefined()
      return Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Buffer.alloc(40)])
    })

    const png = await generatePublishedCardQr(
      {
        key: 'pk_test_public_key01',
        format: 'png',
        origin: 'https://valtoris.example',
      },
      {
        lookupByKey: async () => found,
        qrcode: { toString: vi.fn(), toBuffer },
      },
    )
    expect(png.status).toBe('found')
    if (png.status === 'found') {
      expect(png.filename).toBe('Luis-Perez-QR.png')
      expect(Buffer.isBuffer(png.body)).toBe(true)
    }
    expect(toBuffer).toHaveBeenLastCalledWith(
      'https://valtoris.example/c/k/pk_test_public_key01',
      expect.objectContaining({ width: 512, errorCorrectionLevel: 'H' }),
    )

    const hires = await generatePublishedCardQr(
      {
        key: 'pk_test_public_key01',
        format: 'png-hires',
        origin: 'https://valtoris.example',
      },
      {
        lookupByKey: async () => found,
        qrcode: { toString: vi.fn(), toBuffer },
      },
    )
    expect(hires.status).toBe('found')
    if (hires.status === 'found') {
      expect(hires.filename).toBe('Luis-Perez-QR-Print.png')
    }
    expect(toBuffer).toHaveBeenLastCalledWith(
      'https://valtoris.example/c/k/pk_test_public_key01',
      expect.objectContaining({ width: 2048 }),
    )
  })

  it('rejects invalid keys and unknown formats', async () => {
    const lookupByKey = vi.fn()
    const badKey = await generatePublishedCardQr(
      { key: 'bad', format: 'svg', origin: 'https://valtoris.example' },
      { lookupByKey },
    )
    expect(badKey.status).toBe('invalid_request')
    expect(lookupByKey).not.toHaveBeenCalled()

    const badFormat = await generatePublishedCardQr(
      {
        key: 'pk_test_public_key01',
        format: 'pdf',
        origin: 'https://valtoris.example',
      },
      { lookupByKey },
    )
    expect(badFormat.status).toBe('invalid_request')
  })

  it('returns unavailable for unpublished cards', async () => {
    const result = await generatePublishedCardQr(
      {
        key: 'pk_test_public_key01',
        format: 'svg',
        origin: 'https://valtoris.example',
      },
      { lookupByKey: async () => ({ status: 'unavailable' }) },
    )
    expect(result.status).toBe('unavailable')
  })

  it('declares no analytics or CRM side effects', () => {
    expect(publishedCardQrSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      tracksCampaign: false,
      tracksEvent: false,
    })
  })
})
