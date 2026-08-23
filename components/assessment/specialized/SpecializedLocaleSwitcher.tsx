import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { withSpecializedLocale } from './locale'
import type { SpecializedLocale } from './types'

export function useSpecializedDocumentLang(locale: SpecializedLocale): void {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.lang
    root.lang = locale
    return () => {
      root.lang = previous || 'en'
    }
  }, [locale])
}

type SpecializedLocaleSwitcherProps = {
  locale: SpecializedLocale
  groupLabel: string
  englishLabel: string
  spanishLabel: string
}

export default function SpecializedLocaleSwitcher({
  locale,
  groupLabel,
  englishLabel,
  spanishLabel,
}: SpecializedLocaleSwitcherProps) {
  const location = useLocation()
  const navigate = useNavigate()

  function selectLocale(next: SpecializedLocale) {
    if (next === locale) return
    navigate(withSpecializedLocale(location.pathname, next, location.search), { replace: true })
  }

  return (
    <div className="specialized-locale-switcher" role="group" aria-label={groupLabel}>
      <button
        type="button"
        className={`specialized-locale-option${locale === 'en' ? ' is-current' : ''}`}
        aria-pressed={locale === 'en'}
        aria-current={locale === 'en' ? 'true' : undefined}
        onClick={() => selectLocale('en')}
      >
        {englishLabel}
      </button>
      <span className="specialized-locale-divider" aria-hidden="true">
        |
      </span>
      <button
        type="button"
        className={`specialized-locale-option${locale === 'es' ? ' is-current' : ''}`}
        aria-pressed={locale === 'es'}
        aria-current={locale === 'es' ? 'true' : undefined}
        onClick={() => selectLocale('es')}
      >
        {spanishLabel}
      </button>
    </div>
  )
}
