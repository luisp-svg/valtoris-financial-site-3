import { describe, expect, it } from 'vitest'
import { readPublicLocale, withPublicLocale } from './locale'
import { readSpecializedLocale, withSpecializedLocale } from '../assessment/specialized/locale'

describe('public site locale', () => {
  it('defaults English and accepts lang or locale aliases', () => {
    expect(readPublicLocale('')).toBe('en')
    expect(readPublicLocale('?lang=es')).toBe('es')
    expect(readPublicLocale('?locale=en')).toBe('en')
    expect(readPublicLocale('?locale=es')).toBe('es')
    expect(readPublicLocale('?lang=fr')).toBe('en')
  })

  it('omits lang from canonical English URLs', () => {
    expect(withPublicLocale('/solutions', 'en', '?lang=es')).toBe('/solutions')
    expect(withPublicLocale('/credit-report-card', 'en', '')).toBe('/credit-report-card')
  })

  it('switches EN → ES and ES → EN without dropping UTM params', () => {
    expect(
      withPublicLocale('/solutions', 'es', '?utm_source=flyer&utm_medium=qr&utm_campaign=spring'),
    ).toBe('/solutions?utm_source=flyer&utm_medium=qr&utm_campaign=spring&lang=es')
    expect(
      withPublicLocale(
        '/solutions',
        'en',
        '?utm_source=flyer&utm_medium=qr&utm_campaign=spring&lang=es',
      ),
    ).toBe('/solutions?utm_source=flyer&utm_medium=qr&utm_campaign=spring')
  })

  it('preserves card and campaign attribution through language changes', () => {
    expect(
      withPublicLocale(
        '/student-loan-report-card',
        'es',
        '?utm_source=card&utm_content=hero&utm_term=loans&card=abc&c=summit&e=booth&src=qr',
      ),
    ).toBe(
      '/student-loan-report-card?utm_source=card&utm_content=hero&utm_term=loans&card=abc&c=summit&e=booth&src=qr&lang=es',
    )
    expect(
      withPublicLocale(
        '/credit-report-card',
        'en',
        '?lang=es&card=crc&utm_campaign=qa',
      ),
    ).toBe('/credit-report-card?card=crc&utm_campaign=qa')
  })

  it('is the same implementation used by specialized Student Loan / Credit locale helpers', () => {
    expect(readSpecializedLocale).toBe(readPublicLocale)
    expect(withSpecializedLocale).toBe(withPublicLocale)
  })
})
