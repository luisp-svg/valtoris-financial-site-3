import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import BrandWordmark from './BrandWordmark'
import { chromeCopy } from './publicSite/chromeCopy'
import { readPublicLocale } from './publicSite/locale'
import PublicLink from './publicSite/PublicLink'
import PublicLocaleSwitcher from './publicSite/PublicLocaleSwitcher'
import SiteMobileNav from './publicSite/SiteMobileNav'
import SiteNavDropdown from './publicSite/SiteNavDropdown'
import { usePublicDocumentLang } from './publicSite/usePublicDocumentLang'
import {
  AUDIENCE_NAV_LINKS,
  BOOK_NAV,
  HOME_NAV,
  TOOLS_NAV_LINKS,
} from './publicSite/navConfig'

export default function SiteHeader() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)
  const copy = chromeCopy[locale]
  usePublicDocumentLang(locale)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<'tools' | null>(null)
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const setToolsOpen = useCallback((open: boolean) => setOpenMenu(open ? 'tools' : null), [])

  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const canonical = existing ?? document.createElement('link')
    const previousHref = existing?.getAttribute('href')
    canonical.rel = 'canonical'
    canonical.href = `https://www.valtorisfinancial.com${location.pathname}${locale === 'es' ? '?lang=es' : ''}`
    if (!existing) document.head.appendChild(canonical)
    return () => {
      if (!existing) canonical.remove()
      else if (previousHref) canonical.setAttribute('href', previousHref)
      else canonical.removeAttribute('href')
    }
  }, [location.pathname, locale])

  useEffect(() => {
    setMobileOpen(false)
    setOpenMenu(null)
  }, [location.pathname])

  const toolItems = TOOLS_NAV_LINKS.map((item) => ({
    to: item.to,
    label: copy[item.labelKey],
  }))

  return (
    <header className="header site-header">
      <div className="container header-inner site-header-inner">
        <PublicLink to={ROUTES.home} className="logo-link">
          <BrandWordmark variant="header" />
        </PublicLink>

        <div className="site-header-desktop">
          <nav className="site-nav-primary" aria-label={copy.primaryNavLabel}>
            <PublicLink className="site-nav-text-link" to={HOME_NAV.to}>{copy.navHome}</PublicLink>
            {AUDIENCE_NAV_LINKS.map(item => <PublicLink key={item.id} className="site-nav-text-link" to={item.to}>{copy[item.labelKey]}</PublicLink>)}
            <SiteNavDropdown
              label={locale === 'es' ? 'Soluciones y Report Cards' : 'Solutions & Report Cards'}
              items={[{ to: ROUTES.solutions, label: locale === 'es' ? 'Explorar todas las prioridades' : 'Explore All Priorities' }, { to: ROUTES.amazeHealth, label: 'Amaze Health' }, ...toolItems]}
              open={openMenu === 'tools'}
              onOpenChange={setToolsOpen}
            />

          </nav>

          <div className="site-header-utilities">
            <PublicLocaleSwitcher
              className="site-locale-switcher"
              locale={locale}
              groupLabel={copy.languageGroup}
              englishLabel={copy.languageEnglish}
              spanishLabel={copy.languageSpanish}
            />
            <PublicLink
              className="platform-btn platform-btn-primary site-header-book"
              to={BOOK_NAV.to}
            >
              {copy.bookMeeting}
            </PublicLink>
            <Link
              className="platform-btn platform-btn-ghost site-header-advisor"
              to={ROUTES.crmLogin}
            >
              {copy.advisorLogin}
            </Link>
          </div>
        </div>

        <button
          type="button"
          className="site-menu-toggle"
          aria-expanded={mobileOpen}
          aria-controls="site-mobile-nav"
          onClick={() => setMobileOpen((current) => !current)}
        >
          <span className="site-menu-toggle-bars" aria-hidden="true" />
          <span className="sr-only">{mobileOpen ? copy.menuClose : copy.menuOpen}</span>
        </button>
      </div>

      <SiteMobileNav open={mobileOpen} onClose={closeMobile} locale={locale} copy={copy} />
    </header>
  )
}
