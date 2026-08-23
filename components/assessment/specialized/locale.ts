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

export function withSpecializedLocale(path: string, locale: SpecializedLocale): string {
  const query = specializedLocaleQuery(locale)
  return query ? `${path}${query}` : path
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
