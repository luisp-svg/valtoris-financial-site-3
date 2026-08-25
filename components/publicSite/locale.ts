/**
 * Shared public-site locale helpers.
 * Lifted from the Student Loan / Credit specialized locale contract.
 * English is default (no ?lang=). Spanish uses ?lang=es.
 * Existing ?locale= aliases remain supported.
 * Query mutation preserves UTM / card / campaign attribution.
 */

export const PUBLIC_LOCALES = ['en', 'es'] as const
export type PublicLocale = (typeof PUBLIC_LOCALES)[number]

export function isPublicLocale(value: unknown): value is PublicLocale {
  return value === 'en' || value === 'es'
}

/**
 * Locale may be chosen by `?lang=` / `?locale=` or a UI selector.
 * Unknown or missing values default to English.
 */
export function readPublicLocale(search: string): PublicLocale {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const raw = params.get('lang') ?? params.get('locale')
  return isPublicLocale(raw) ? raw : 'en'
}

export function publicLocaleQuery(locale: PublicLocale): string {
  return locale === 'en' ? '' : `?lang=${locale}`
}

/**
 * Builds a path with the public locale while preserving existing
 * campaign / card / UTM query params. English omits `lang` (default).
 */
export function withPublicLocale(
  path: string,
  locale: PublicLocale,
  currentSearch = '',
): string {
  const hashIndex = path.indexOf('#')
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : ''
  const pathOnly = hashIndex >= 0 ? path.slice(0, hashIndex) : path
  const raw = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
  const params = new URLSearchParams(raw)
  params.delete('locale')
  if (locale === 'en') {
    params.delete('lang')
  } else {
    params.set('lang', locale)
  }
  const query = params.toString()
  return `${pathOnly}${query ? `?${query}` : ''}${hash}`
}
