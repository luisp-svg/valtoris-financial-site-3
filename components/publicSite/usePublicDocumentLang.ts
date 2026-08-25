import { useEffect } from 'react'
import type { PublicLocale } from './locale'

/** Sets <html lang> to the active public locale for marketing chrome and funnels. */
export function usePublicDocumentLang(locale: PublicLocale): void {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.lang
    root.lang = locale
    return () => {
      root.lang = previous || 'en'
    }
  }, [locale])
}
