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

  it('keeps homepage anchors after the query string', () => {
    expect(
      withPublicLocale(
        '/#home-diagnostics',
        'es',
        '?utm_source=qa&utm_campaign=sitefoundation&card=test-card',
      ),
    ).toBe('/?utm_source=qa&utm_campaign=sitefoundation&card=test-card&lang=es#home-diagnostics')
  })

  it('preserves a focused assessment priority alongside language and attribution', () => {
    const url = withPublicLocale('/financial-assessment?priorities=home_buyer', 'es', '?lang=es&utm_source=qa')
    const parsed = new URL(url, 'https://example.com')
    expect(parsed.searchParams.get('priorities')).toBe('home_buyer')
    expect(parsed.searchParams.get('lang')).toBe('es')
    expect(parsed.searchParams.get('utm_source')).toBe('qa')
    expect(url.match(/\?/g)).toHaveLength(1)
    expect(withPublicLocale('/financial-assessment?priorities=tsp', 'en')).toBe('/financial-assessment?priorities=tsp')
  })

  it('lets destination priorities override source selections while preserving anchors', () => {
    const url = withPublicLocale('/financial-assessment?priorities=retirement,protection#priorities', 'es', '?priorities=credit&card=test')
    const parsed = new URL(url, 'https://example.com')
    expect(parsed.searchParams.get('priorities')).toBe('retirement,protection')
    expect(parsed.searchParams.get('card')).toBe('test')
    expect(parsed.searchParams.get('lang')).toBe('es')
    expect(parsed.hash).toBe('#priorities')
  })

  it('is the same implementation used by specialized Student Loan / Credit locale helpers', () => {
    expect(readSpecializedLocale).toBe(readPublicLocale)
    expect(withSpecializedLocale).toBe(withPublicLocale)
  })
})
