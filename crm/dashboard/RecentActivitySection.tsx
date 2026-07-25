import { Link } from 'react-router-dom'
import { crmHouseholdPath, crmOpportunityPath } from '../../constants/routes'
import { formatActivityTypeLabel } from './activityLabels'
import { formatDateTimeLabel } from './dates'
import DashboardSection from './DashboardSection'
import type { DashboardActivityItem } from './types'

type Props = {
  items: DashboardActivityItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

function activityHref(item: DashboardActivityItem): string {
  if (item.opportunity_id) return crmOpportunityPath(item.opportunity_id)
  return crmHouseholdPath(item.household_id)
}

export default function RecentActivitySection({ items, loading, error, onRetry }: Props) {
  return (
    <DashboardSection
      title="Recent Activity"
      loading={loading}
      error={error}
      empty={!loading && !error && items.length === 0}
      emptyMessage="No recent stage, assignment, or conversion activity yet."
      onRetry={onRetry}
    >
      <p className="crm-dashboard-footnote">
        Shows logged CRM events (stage changes, assignments, recommendation conversions).
      </p>
      <ul className="crm-dashboard-activity-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={activityHref(item)} className="crm-dashboard-activity-item">
              <span className="crm-dashboard-activity-type">
                {formatActivityTypeLabel(item.activity_type)}
              </span>
              <span className="crm-dashboard-activity-title">{item.title}</span>
              <span className="crm-dashboard-activity-meta">
                {item.household_name ?? 'Household'}
                {item.body ? ` · ${item.body}` : ''}
                {' · '}
                {formatDateTimeLabel(item.occurred_at)}
                {item.actor_display_name ? ` · ${item.actor_display_name}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
