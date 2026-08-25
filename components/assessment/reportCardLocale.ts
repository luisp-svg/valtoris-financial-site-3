import { useLocation } from 'react-router-dom'
import {
  readSpecializedLocale,
  resolveSpecializedCopy,
  withSpecializedLocale,
  type SpecializedLocale,
} from './specialized/locale'
import { useSpecializedDocumentLang } from './specialized/SpecializedLocaleSwitcher'
import type {
  SpecializedCopySection,
  SpecializedProductCopy,
} from './specialized/types'

export type ReportCardCopyFn = (section: SpecializedCopySection, key: string) => string

export function useReportCardCopy(catalogs: SpecializedProductCopy): {
  locale: SpecializedLocale
  t: ReportCardCopyFn
  withLocale: (path: string) => string
} {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(catalogs, locale, section, key)
  }

  function withLocale(path: string): string {
    return withSpecializedLocale(path, locale, location.search)
  }

  return { locale, t, withLocale }
}

export function localizedOptions<T extends { value: string; label: string }>(
  options: readonly T[],
  t: ReportCardCopyFn,
  prefix: string,
): T[] {
  return options.map((option) => ({
    ...option,
    label: t('answers', `${prefix}.${option.value}`),
  }))
}

export function scoreBand(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high'
  if (score >= 65) return 'mid'
  return 'low'
}
