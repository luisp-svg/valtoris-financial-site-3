import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import BrandLogo from '../../components/BrandLogo'
import BrandWordmark from '../../components/BrandWordmark'
import { getCrmSidebarNavItems } from '../../platform/registry'
import { useCrmAuth } from '../auth/CrmAuthContext'
import { CrmNavigationGuardProvider } from '../navigation/CrmNavigationGuardContext'
import CrmUserMenu from './CrmUserMenu'

/** Registry-driven sidebar; evaluated once per module load (static catalog). */
const CRM_SIDEBAR_NAV = getCrmSidebarNavItems()

type CrmShellProps = {
  children: ReactNode
}

export default function CrmShell({ children }: CrmShellProps) {
  const { pathname } = useLocation()
  const { role } = useCrmAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const nav = (
    <nav className="crm-nav" aria-label="CRM">
      {CRM_SIDEBAR_NAV.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/crm'}
          className={({ isActive }) => {
            const pipelineSectionActive =
              item.path === '/crm/pipeline' &&
              (pathname === '/crm/pipeline' || pathname.startsWith('/crm/opportunities/'))
            const contactsSectionActive =
              item.path === '/crm/contacts' && pathname.startsWith('/crm/contacts')
            const productionSectionActive =
              item.path === '/crm/production' && pathname.startsWith('/crm/production')
            return `crm-nav-link${
              isActive ||
              pipelineSectionActive ||
              contactsSectionActive ||
              productionSectionActive
                ? ' is-active'
                : ''
            }`
          }}
        >
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="crm-shell" ref={shellRef}>
      <CrmNavigationGuardProvider rootRef={shellRef}>
        <aside className="crm-sidebar" aria-label="CRM sidebar">
          <div className="crm-brand">
            {!logoFailed ? (
              <BrandLogo className="crm-brand-logo" onMissing={() => setLogoFailed(true)} />
            ) : (
              <BrandWordmark variant="header" />
            )}
            <p className="crm-brand-tag">Valtoris CRM</p>
          </div>
          {nav}
          {role ? <p className="crm-sidebar-role">Role: {role}</p> : null}
        </aside>

        <div className="crm-main">
          <header className="crm-topbar">
            <button
              type="button"
              className="crm-menu-toggle"
              aria-expanded={mobileOpen}
              aria-controls="crm-mobile-nav"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <span className="crm-menu-toggle-bars" aria-hidden="true" />
              <span className="crm-sr-only">Menu</span>
            </button>

            <div className="crm-topbar-brand">
              {!logoFailed ? (
                <BrandLogo className="crm-topbar-logo" onMissing={() => setLogoFailed(true)} />
              ) : (
                <span className="crm-topbar-wordmark">Valtoris Financial</span>
              )}
            </div>

            <CrmUserMenu />
          </header>

          {mobileOpen ? (
            <div className="crm-mobile-nav-wrap" id="crm-mobile-nav">
              <div className="crm-mobile-nav">{nav}</div>
            </div>
          ) : null}

          <div className="crm-content">{children}</div>
        </div>
      </CrmNavigationGuardProvider>
    </div>
  )
}
