import type {
  SpecializedCopyCatalog,
  SpecializedCopySection,
  SpecializedProductCopy,
} from './types'
import { SPECIALIZED_LOCALES } from './types'
import {
  isPublicLocale,
  publicLocaleQuery,
  readPublicLocale,
  withPublicLocale,
  type PublicLocale,
} from '../../publicSite/locale'

export type SpecializedLocale = PublicLocale

export const isSpecializedLocale = isPublicLocale
export const readSpecializedLocale = readPublicLocale
export const specializedLocaleQuery = publicLocaleQuery
export const withSpecializedLocale = withPublicLocale

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
