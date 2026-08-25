import { useLocation, useNavigate } from 'react-router-dom'
import { withPublicLocale, type PublicLocale } from './locale'

type PublicLocaleSwitcherProps = {
  locale: PublicLocale
  groupLabel: string
  englishLabel: string
  spanishLabel: string
  className?: string
}

export default function PublicLocaleSwitcher({
  locale,
  groupLabel,
  englishLabel,
  spanishLabel,
  className,
}: PublicLocaleSwitcherProps) {
  const location = useLocation()
  const navigate = useNavigate()

  function selectLocale(next: PublicLocale) {
    if (next === locale) return
    navigate(withPublicLocale(location.pathname, next, location.search), { replace: true })
  }

  return (
    <div
      className={`specialized-locale-switcher${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={groupLabel}
    >
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
