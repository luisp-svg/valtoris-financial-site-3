import { Link } from 'react-router-dom'
import { crmHouseholdPath, ROUTES } from '../../constants/routes'
import { formatDateTimeLabel } from './dates'
import DashboardSection from './DashboardSection'
import type { DashboardHouseholdItem } from './types'

type Props = {
  items: DashboardHouseholdItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

export default function RecentHouseholdsSection({ items, loading, error, onRetry }: Props) {
  return (
    <DashboardSection
      title="Recently Added Households"
      actionHref={ROUTES.crmHouseholds}
      actionLabel="View households"
      loading={loading}
      error={error}
      empty={!loading && !error && items.length === 0}
      emptyMessage="No households to show yet."
      onRetry={onRetry}
    >
      <ul className="crm-dashboard-household-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={crmHouseholdPath(item.id)} className="crm-dashboard-household-item">
              <span className="crm-dashboard-household-name">{item.display_name}</span>
              <span className="crm-dashboard-household-meta">
                Added {formatDateTimeLabel(item.created_at)}
                {item.status ? ` · ${item.status}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
