import type {
  SpecializedCopyCatalog,
  SpecializedCopySection,
  SpecializedLocale,
  SpecializedProductCopy,
} from './types'
import { SPECIALIZED_LOCALES } from './types'

export function isSpecializedLocale(value: unknown): value is SpecializedLocale {
  return value === 'en' || value === 'es'
}

/**
 * Locale may later be chosen by `?lang=` / `?locale=` or a UI selector.
 * Spanish copy is a content-only fill-in; missing keys fall back to English.
 */
export function readSpecializedLocale(search: string): SpecializedLocale {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const raw = params.get('lang') ?? params.get('locale')
  return isSpecializedLocale(raw) ? raw : 'en'
}

export function specializedLocaleQuery(locale: SpecializedLocale): string {
  return locale === 'en' ? '' : `?lang=${locale}`
}

/**
 * Builds a path with the specialized locale while preserving existing
 * campaign / card / UTM query params. English omits `lang` (default).
 */
export function withSpecializedLocale(
  path: string,
  locale: SpecializedLocale,
  currentSearch = '',
): string {
  const raw = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
  const params = new URLSearchParams(raw)
  params.delete('locale')
  if (locale === 'en') {
    params.delete('lang')
  } else {
    params.set('lang', locale)
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function resolveSpecializedCopy(
  catalogs: SpecializedProductCopy,
  locale: SpecializedLocale,
  section: SpecializedCopySection,
  key: string,
): string {
  const primary = catalogs[locale]
  const fallback = catalogs.en
  return primary?.[section][key] ?? fallback?.[section][key] ?? key
}

export function formatSpecializedTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key]
    return value == null ? match : String(value)
  })
}

export function catalogForLocale(
  catalogs: SpecializedProductCopy,
  locale: SpecializedLocale,
): SpecializedCopyCatalog {
  const primary = catalogs[locale]
  if (primary) return primary
  const english = catalogs.en
  if (!english) {
    throw new Error('Specialized copy catalog is missing the required English catalog.')
  }
  return english
}

export { SPECIALIZED_LOCALES }
