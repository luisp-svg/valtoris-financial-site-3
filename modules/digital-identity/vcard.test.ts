import { describe, expect, it } from 'vitest'
import { buildVCard, escapeVCardText, sanitizeVCardFilename } from './vcard'

describe('escapeVCardText', () => {
  it('escapes backslash, semicolon, comma, and newlines', () => {
    expect(escapeVCardText('A;B,C\\D\nE')).toBe('A\\;B\\,C\\\\D\\nE')
  })
})

describe('sanitizeVCardFilename', () => {
  it('produces a safe .vcf filename', () => {
    expect(sanitizeVCardFilename('Jane Doe')).toBe('Valtoris-Jane-Doe.vcf')
    expect(sanitizeVCardFilename('   ')).toBe('Valtoris-contact.vcf')
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
    expect(result.filename).toBe('Valtoris-Ada-Lovelace.vcf')
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
})
