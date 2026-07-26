import { Link } from 'react-router-dom'
import DashboardSection from '../dashboard/DashboardSection'
import type { OwnerAlert } from './types'

type Props = {
  alerts: OwnerAlert[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

export default function OperationalAlertsSection({ alerts, loading, error, onRetry }: Props) {
  return (
    <DashboardSection
      title="Operational Alerts"
      loading={loading}
      error={error}
      empty={!loading && !error && alerts.length === 0}
      emptyMessage="No operational alerts right now."
      onRetry={onRetry}
    >
      <ul className="crm-owner-ops-alert-list">
        {alerts.map((alert) => (
          <li key={alert.id}>
            <Link
              to={alert.href}
              className={`crm-owner-ops-alert crm-owner-ops-alert--${alert.severity}`}
            >
              <span className="crm-owner-ops-alert-count">{alert.count}</span>
              <span className="crm-owner-ops-alert-body">
                <span className="crm-owner-ops-alert-title">{alert.title}</span>
                <span className="crm-owner-ops-alert-detail">{alert.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
