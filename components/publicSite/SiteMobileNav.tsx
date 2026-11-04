import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import type { ChromeCopyCatalog } from './chromeCopy'
import PublicLink from './PublicLink'
import PublicLocaleSwitcher from './PublicLocaleSwitcher'
import type { PublicLocale } from './locale'
import {
  AUDIENCE_NAV_LINKS,
  BOOK_NAV,
  COMPANY_FOOTER_LINKS,
  HOME_NAV,
  TOOLS_NAV_LINKS,
  type PublicNavGroup,
  type PublicNavLink,
} from './navConfig'

type SiteMobileNavProps = {
  open: boolean
  onClose: () => void
  locale: PublicLocale
  copy: ChromeCopyCatalog
}

function MobileAccordion({
  id,
  label,
  items,
  groups,
  copy,
  onNavigate,
  children,
}: {
  id: string
  label: string
  items?: readonly PublicNavLink[]
  groups?: readonly PublicNavGroup[]
  copy: ChromeCopyCatalog
  onNavigate: () => void
  children?: ReactNode
}) {
  return (
    <details className="site-mobile-accordion">
      <summary className="site-mobile-accordion-trigger">{label}</summary>
      <div className="site-mobile-accordion-panel" id={id}>
        {children}
        {groups
          ? groups.map((group) => (
              <div key={group.id} className="site-mobile-nav-group">
                <p className="site-mobile-nav-group-heading">{copy[group.headingKey]}</p>
                {group.links.map((item) => (
                  <PublicLink
                    key={`${item.id}-${item.to}`}
                    className="site-mobile-link"
                    to={item.to}
                    onClick={onNavigate}
                  >
                    {copy[item.labelKey]}
                  </PublicLink>
                ))}
              </div>
            ))
          : items?.map((item) => (
              <PublicLink
                key={`${item.id}-${item.to}`}
                className="site-mobile-link"
                to={item.to}
                onClick={onNavigate}
              >
                {copy[item.labelKey]}
              </PublicLink>
            ))}
      </div>
    </details>
  )
}

export default function SiteMobileNav({ open, onClose, locale, copy }: SiteMobileNavProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('site-mobile-nav-open')
    closeRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const root = drawerRef.current
      if (!root) return
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary'),
      ).filter((node) => !node.hasAttribute('disabled') && node.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    function onResize() {
      if (window.innerWidth >= 1200) onClose()
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('site-mobile-nav-open')
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open, onClose])

  const privacyLink = COMPANY_FOOTER_LINKS.find((item) => item.id === 'privacy')

  return (
    <>
      <div
        className={`site-mobile-overlay${open ? ' is-open' : ''}`}
        hidden={!open}
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className={`site-mobile-drawer${open ? ' is-open' : ''}`}
        id="site-mobile-nav"
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label={copy.mobileMenuLabel}
      >
        <div className="site-mobile-drawer-header">
          <button
            ref={closeRef}
            type="button"
            className="site-mobile-close"
            onClick={onClose}
          >
            {copy.menuClose}
          </button>
        </div>

        <PublicLink
          className="platform-btn platform-btn-primary site-mobile-book"
          to={BOOK_NAV.to}
          onClick={onClose}
        >
          {copy.bookMeeting}
        </PublicLink>

        <nav className="site-mobile-nav" aria-label={copy.primaryNavLabel}>
          <PublicLink className="site-mobile-link site-mobile-top-link" to={HOME_NAV.to} onClick={onClose}>{copy.navHome}</PublicLink>
          {AUDIENCE_NAV_LINKS.map(item => <PublicLink key={item.id} className="site-mobile-link site-mobile-top-link" to={item.to} onClick={onClose}>{copy[item.labelKey]}</PublicLink>)}
          <MobileAccordion
            id="site-mobile-tools"
            label={locale === 'es' ? 'Soluciones y Report Cards' : 'Solutions & Report Cards'}
            items={TOOLS_NAV_LINKS}
            copy={copy}
            onNavigate={onClose}
          >
            <PublicLink className="site-mobile-link" to={ROUTES.solutions} onClick={onClose}>{locale === 'es' ? 'Explorar todas las prioridades' : 'Explore All Priorities'}</PublicLink>
            <PublicLink className="site-mobile-link" to={ROUTES.amazeHealth} onClick={onClose}>Amaze Health</PublicLink>
          </MobileAccordion>

        </nav>

        <div className="site-mobile-utilities">
          <PublicLocaleSwitcher
            className="site-locale-switcher"
            locale={locale}
            groupLabel={copy.languageGroup}
            englishLabel={copy.languageEnglish}
            spanishLabel={copy.languageSpanish}
          />
          {privacyLink ? (
            <PublicLink className="site-mobile-link" to={privacyLink.to} onClick={onClose}>
              {copy.footerPrivacy}
            </PublicLink>
          ) : null}
          <Link className="site-mobile-link site-mobile-advisor" to={ROUTES.crmLogin} onClick={onClose}>
            {copy.advisorLogin}
          </Link>
        </div>
      </div>
    </>
  )
}
