import { describe, expect, it } from 'vitest'
import type { IdentitySurfacePublicDto } from './types'
import {
  buildAbsolutePublicCardUrl,
  buildVCard,
  buildVCardFromPublicDto,
  buildVCardNote,
  escapeVCardText,
  sanitizeVCardFilename,
  vCardGenerationSideEffects,
} from './vcard'

function sampleDto(
  overrides: Partial<IdentitySurfacePublicDto> = {},
): IdentitySurfacePublicDto {
  return {
    publicKey: 'pk_live_abcdefghijklmnop',
    slug: 'luis-perez',
    kind: 'advisor_card',
    displayName: 'Luis Perez',
    approvedTitle: 'Financial Advisor',
    approvedCompany: 'Valtoris Financial',
    headline: null,
    bio: null,
    headshotUrl: 'https://cdn.example.com/luis.jpg',
    phone: '555-0100',
    email: 'luis@example.com',
    website: 'https://example.com',
    socialLinks: [
      { key: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/luis' },
    ],
    specialties: [],
    calendlyUrl: 'https://calendly.com/luis',
    themeKey: 'default',
    ctas: [],
    primaryConnectLabel: "Let's Connect",
    cardUrl: '/c/k/pk_live_abcdefghijklmnop',
    ...overrides,
  }
}

describe('escapeVCardText', () => {
  it('escapes backslash, semicolon, comma, and newlines', () => {
    expect(escapeVCardText('A;B,C\\D\nE')).toBe('A\\;B\\,C\\\\D\\nE')
  })
})

describe('sanitizeVCardFilename', () => {
  it('produces a safe .vcf filename without brand prefix', () => {
    expect(sanitizeVCardFilename('Luis Perez')).toBe('Luis-Perez.vcf')
    expect(sanitizeVCardFilename('Jane Doe')).toBe('Jane-Doe.vcf')
    expect(sanitizeVCardFilename('   ')).toBe('contact.vcf')
  })

  it('handles UTF-8 display names by stripping unsafe filename chars', () => {
    expect(sanitizeVCardFilename('José García')).toMatch(/\.vcf$/)
    expect(sanitizeVCardFilename('José García')).not.toMatch(/[;\\"']/)
  })
})

describe('buildVCard', () => {
  it('builds vCard 3.0 with CRLF and omits missing optional fields', () => {
    const result = buildVCard({
      displayName: 'Ada Lovelace',
      organization: 'Valtoris',
      title: 'Advisor',
      phone: '555-0100',
      email: 'ada@example.com',
      url: 'https://example.com/c/ada',
    })

    expect(result.createsCrmRecord).toBe(false)
    expect(result.filename).toBe('Ada-Lovelace.vcf')
    expect(result.body.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true)
    expect(result.body.includes('FN:Ada Lovelace\r\n')).toBe(true)
    expect(result.body.includes('ORG:Valtoris\r\n')).toBe(true)
    expect(result.body.includes('TITLE:Advisor\r\n')).toBe(true)
    expect(result.body.includes('TEL;TYPE=CELL,VOICE:555-0100\r\n')).toBe(true)
    expect(result.body.includes('EMAIL;TYPE=INTERNET,WORK:ada@example.com\r\n')).toBe(true)
    expect(result.body.includes('ADR')).toBe(false)
    expect(result.body.endsWith('END:VCARD\r\n')).toBe(true)
  })

  it('omits photo for non-https URLs and escapes note text', () => {
    const result = buildVCard({
      displayName: 'Test User',
      note: 'Hello; friend, welcome',
      photoUrl: 'http://insecure.example/photo.jpg',
    })
    expect(result.body.includes('PHOTO')).toBe(false)
    expect(result.body.includes('NOTE:Hello\\; friend\\, welcome\r\n')).toBe(true)
    expect(result.createsCrmRecord).toBe(false)
  })

  it('includes https photo URI when provided', () => {
    const result = buildVCard({
      displayName: 'Test User',
      photoUrl: 'https://cdn.example.com/a.jpg',
    })
    expect(result.body.includes('PHOTO;VALUE=URI:https://cdn.example.com/a.jpg\r\n')).toBe(true)
  })

  it('includes additional URLs without duplicating the primary', () => {
    const result = buildVCard({
      displayName: 'Test User',
      url: 'https://example.com/c/k/abc',
      additionalUrls: [
        'https://example.com/c/k/abc',
        'https://calendly.com/test',
        'https://linkedin.com/in/test',
      ],
    })
    const urlLines = result.body.split('\r\n').filter((line) => line.startsWith('URL:'))
    expect(urlLines).toEqual([
      'URL:https://example.com/c/k/abc',
      'URL:https://calendly.com/test',
      'URL:https://linkedin.com/in/test',
    ])
  })
})

describe('buildVCardFromPublicDto', () => {
  it('includes visible phone and email', () => {
    const result = buildVCardFromPublicDto(sampleDto(), {
      absoluteCardUrl: 'https://valtoris.example/c/k/pk_live_abcdefghijklmnop',
    })
    expect(result.filename).toBe('Luis-Perez.vcf')
    expect(result.body.includes('TEL;TYPE=CELL,VOICE:555-0100\r\n')).toBe(true)
    expect(result.body.includes('EMAIL;TYPE=INTERNET,WORK:luis@example.com\r\n')).toBe(true)
  })

  it('omits hidden phone and email (null on public DTO)', () => {
    const result = buildVCardFromPublicDto(sampleDto({ phone: null, email: null }), {
      absoluteCardUrl: 'https://valtoris.example/c/k/pk_live_abcdefghijklmnop',
    })
    expect(result.body.includes('TEL')).toBe(false)
    expect(result.body.includes('EMAIL')).toBe(false)
  })

  it('never constructs hidden fields from other DTO properties', () => {
    const dto = sampleDto({ phone: null, email: null })
    const result = buildVCardFromPublicDto(dto, {
      absoluteCardUrl: 'https://valtoris.example/c/k/pk_live_abcdefghijklmnop',
    })
    expect(result.body).not.toMatch(/555-0100/)
    expect(result.body).not.toMatch(/luis@example.com/)
  })

  it('builds a professional NOTE with Connect URL', () => {
    const absolute = 'https://valtoris.example/c/k/pk_live_abcdefghijklmnop'
    expect(buildVCardNote(absolute)).toBe(
      'Generated by Valtoris Financial\n\nConnect:\nhttps://valtoris.example/c/k/pk_live_abcdefghijklmnop',
    )
    const result = buildVCardFromPublicDto(sampleDto(), { absoluteCardUrl: absolute })
    expect(result.body.includes('NOTE:Generated by Valtoris Financial\\n\\nConnect:\\nhttps://valtoris.example/c/k/pk_live_abcdefghijklmnop\r\n')).toBe(
      true,
    )
  })

  it('includes public card URL, website, calendly, and social URLs', () => {
    const absolute = 'https://valtoris.example/c/k/pk_live_abcdefghijklmnop'
    const result = buildVCardFromPublicDto(sampleDto(), { absoluteCardUrl: absolute })
    expect(result.body.includes(`URL:${absolute}\r\n`)).toBe(true)
    expect(result.body).toMatch(/URL:https:\/\/example\.com\/?\r\n/)
    expect(result.body.includes('URL:https://calendly.com/luis\r\n')).toBe(true)
    expect(result.body.includes('URL:https://linkedin.com/in/luis\r\n')).toBe(true)
  })

  it('preserves UTF-8 characters in FN', () => {
    const result = buildVCardFromPublicDto(sampleDto({ displayName: 'José García' }), {
      absoluteCardUrl: 'https://valtoris.example/c/k/pk_live_abcdefghijklmnop',
    })
    expect(result.body.includes('FN:José García\r\n')).toBe(true)
  })

  it('builds absolute card URLs safely', () => {
    expect(
      buildAbsolutePublicCardUrl('https://valtoris.example', '/c/k/pk_live_abcdefghijklmnop'),
    ).toBe('https://valtoris.example/c/k/pk_live_abcdefghijklmnop')
    expect(buildAbsolutePublicCardUrl('https://valtoris.example', '//evil.com')).toBeNull()
  })

  it('declares no CRM or analytics side effects', () => {
    expect(vCardGenerationSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      createsTask: false,
      createsActivity: false,
      createsCase: false,
      createsCrmRecord: false,
    })
  })
})
