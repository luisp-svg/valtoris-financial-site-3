import { useLocation } from 'react-router-dom'
import { CRM_NAV_ITEMS } from '../../crm/nav'

export default function CrmPlaceholderPage() {
  const { pathname } = useLocation()
  const item = CRM_NAV_ITEMS.find((nav) => nav.path === pathname)

  return (
    <div className="crm-placeholder-page">
      <header className="crm-page-header">
        <p className="crm-page-eyebrow">Coming next</p>
        <h1 className="crm-page-title">{item?.label ?? 'CRM'}</h1>
        <p className="crm-page-subtitle">
          This section is a navigation placeholder. Feature workflows and database queries will be
          added in a later phase.
        </p>
      </header>
      <section className="crm-placeholder-panel">
        <p className="crm-placeholder-note">
          Placeholder — real data integration will be added next.
        </p>
      </section>
    </div>
  )
}
