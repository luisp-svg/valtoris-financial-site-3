import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import BrandLogo from '../../components/BrandLogo'
import BrandWordmark from '../../components/BrandWordmark'
import { getCrmSidebarNavItems } from '../../platform/registry'
import { ROUTES } from '../../constants/routes'
import { academyPilotEnabled } from '../academy/pilotFlag'
import { useCrmAuth } from '../auth/CrmAuthContext'
import { CrmNavigationGuardProvider } from '../navigation/CrmNavigationGuardContext'
import CrmUserMenu from './CrmUserMenu'
import './crmNavigation.css'

/** Registry-driven sidebar; evaluated once per module load (static catalog). */
const CRM_SIDEBAR_NAV = getCrmSidebarNavItems()
const NAV_GROUPS = [
  { label: 'Your day', paths: ['/crm', '/crm/tasks', '/crm/appointments'] },
  { label: 'Clients & leads', paths: ['/crm/contacts', '/crm/households', '/crm/intake', '/crm/campaigns'] },
  { label: 'Business', paths: ['/crm/pipeline', '/crm/production', '/crm/commissions'] },
  { label: 'Team & operations', paths: ['/crm/recruiting', '/crm/operations'] },
]
const groupedPaths = new Set(NAV_GROUPS.flatMap(group => group.paths))
const upcomingItems = CRM_SIDEBAR_NAV.filter(item => item.placeholder)
const otherItems = CRM_SIDEBAR_NAV.filter(item => !item.placeholder && !groupedPaths.has(item.path))

type CrmShellProps = {
  children: ReactNode
}

export default function CrmShell({ children }: CrmShellProps) {
  const { pathname, search } = useLocation()
  const { role, profile } = useCrmAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, search])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {setMobileOpen(false);menuToggleRef.current?.focus()}
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function renderLink(item: (typeof CRM_SIDEBAR_NAV)[number]) {
    return (
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
            const commissionsSectionActive =
              item.path === '/crm/commissions' && pathname.startsWith('/crm/commissions')
            return `crm-nav-link${
              isActive ||
              pipelineSectionActive ||
              contactsSectionActive ||
              productionSectionActive ||
              commissionsSectionActive
                ? ' is-active'
                : ''
            }`
          }}
        >
          <span>{item.path === '/crm' ? 'Dashboard' : item.path === '/crm/intake' ? 'Incoming Leads' : item.label}{item.placeholder ? ' · Coming soon' : ''}</span>
        </NavLink>
    )
  }
  const nav = (
    <nav className="crm-nav" aria-label="TAC navigation">
      {NAV_GROUPS.map(group => <section className="tac-nav-group" key={group.label} aria-label={group.label}>
        <h2>{group.label}</h2>
        {group.paths.flatMap(path => CRM_SIDEBAR_NAV.filter(item => item.path === path && !item.placeholder)).map(renderLink)}
      </section>)}
      {otherItems.length > 0 && <section className="tac-nav-group" aria-label="More"><h2>More</h2>{otherItems.map(renderLink)}</section>}
      {academyPilotEnabled && profile?.is_active && (role === 'owner' || role === 'advisor') &&
        <section className="tac-nav-group" aria-label="Learning"><h2>Learning</h2>
          {renderLink({ path: ROUTES.crmAcademy, label: 'Academy pilot' })}
        </section>}
      {upcomingItems.length > 0 && <details className="tac-nav-upcoming" open={upcomingItems.some(item => pathname.startsWith(item.path)) || undefined}>
        <summary>Coming soon</summary>{upcomingItems.map(renderLink)}
      </details>}
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
            <p className="crm-brand-tag">TAC · Agency workspace</p>
          </div>
          {nav}
          {role ? <p className="crm-sidebar-role">Role: {role}</p> : null}
        </aside>

        <div className="crm-main">
          <header className="crm-topbar">
            <button
              type="button"
              className="crm-menu-toggle"
              ref={menuToggleRef}
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
