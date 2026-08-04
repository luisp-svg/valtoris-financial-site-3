import { describe, expect, it } from 'vitest'
import {
  buildQrDestinationPath,
  buildQrDestinationUrl,
  buildQrPdfPlaceholder,
  getQrRenderSpec,
  isKeyBasedQrDestination,
  parsePublicCardQrFormat,
  qrGenerationSideEffects,
  sanitizeQrFilename,
} from './qr'

describe('parsePublicCardQrFormat', () => {
  it('defaults empty to svg and accepts known formats', () => {
    expect(parsePublicCardQrFormat(undefined)).toBe('svg')
    expect(parsePublicCardQrFormat('')).toBe('svg')
    expect(parsePublicCardQrFormat('svg')).toBe('svg')
    expect(parsePublicCardQrFormat('PNG')).toBe('png')
    expect(parsePublicCardQrFormat('png-hires')).toBe('png-hires')
  })

  it('rejects unknown formats including pdf', () => {
    expect(parsePublicCardQrFormat('pdf')).toBeNull()
    expect(parsePublicCardQrFormat('gif')).toBeNull()
    expect(parsePublicCardQrFormat('slug')).toBeNull()
  })
})

describe('QR destination URL', () => {
  it('always uses durable public_key path — never slug', () => {
    expect(buildQrDestinationPath('pk_live_abcdefghijklmnop')).toBe(
      '/c/k/pk_live_abcdefghijklmnop',
    )
    expect(buildQrDestinationPath('pk_live_abcdefghijklmnop')).not.toMatch(
      /^\/c\/[^k]/,
    )

    const absolute = buildQrDestinationUrl(
      'https://valtoris.example',
      'pk_live_abcdefghijklmnop',
    )
    expect(absolute).toBe('https://valtoris.example/c/k/pk_live_abcdefghijklmnop')
    expect(isKeyBasedQrDestination(absolute!)).toBe(true)
    expect(isKeyBasedQrDestination('/c/jane-advisor')).toBe(false)
    expect(isKeyBasedQrDestination('https://valtoris.example/c/jane-advisor')).toBe(
      false,
    )
  })
})

describe('QR render specs', () => {
  it('uses high error correction, quiet zone, and black-on-white', () => {
    for (const format of ['svg', 'png', 'png-hires'] as const) {
      const spec = getQrRenderSpec(format)
      expect(spec.errorCorrectionLevel).toBe('H')
      expect(spec.margin).toBeGreaterThanOrEqual(4)
      expect(spec.color.dark).toBe('#000000')
      expect(spec.color.light).toBe('#ffffff')
    }
    expect(getQrRenderSpec('png').width).toBe(512)
    expect(getQrRenderSpec('png-hires').width).toBe(2048)
    expect(getQrRenderSpec('svg').width).toBeNull()
  })
})

describe('sanitizeQrFilename', () => {
  it('builds safe download names', () => {
    expect(sanitizeQrFilename('Luis Perez', 'svg')).toBe('Luis-Perez-QR.svg')
    expect(sanitizeQrFilename('Luis Perez', 'png')).toBe('Luis-Perez-QR.png')
    expect(sanitizeQrFilename('Luis Perez', 'png-hires')).toBe('Luis-Perez-QR-Print.png')
  })
})

describe('PDF placeholder + side effects', () => {
  it('exposes a future PDF hook without implementing it', () => {
    expect(buildQrPdfPlaceholder()).toEqual({
      status: 'not_implemented',
      format: 'pdf',
      message: 'PDF QR export is not available yet.',
    })
  })

  it('declares no analytics or CRM side effects', () => {
    expect(qrGenerationSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      createsTask: false,
      createsActivity: false,
      createsCase: false,
      tracksCampaign: false,
      tracksEvent: false,
    })
  })
})
