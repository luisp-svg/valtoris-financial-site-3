import { Link } from 'react-router-dom'
import DashboardSection from '../dashboard/DashboardSection'
import type { OwnerAlert } from './types'

type Props = {
  alerts: OwnerAlert[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

const ACTION_LABELS: Record<OwnerAlert['kind'], string> = {
  overdue_task: 'Review overdue tasks',
  task_without_assignee: 'Assign tasks',
  stale_opportunity: 'Review follow-up',
  no_next_action: 'Set next steps',
  household_without_advisor: 'Assign an advisor',
  opportunity_without_advisor: 'Assign opportunities',
}

function renderAlert(alert: OwnerAlert) {
  return (
          <li key={alert.id}>
            <Link
              to={alert.href}
              className={`crm-owner-ops-alert crm-owner-ops-alert--${alert.severity}`}
            >
              <span className="crm-owner-ops-alert-count">{alert.count}</span>
              <span className="crm-owner-ops-alert-body">
                <span className="crm-owner-ops-alert-title">{alert.title}</span>
                <span className="crm-owner-ops-alert-detail">{alert.detail}</span>
                <span className="tac-attention-action">{ACTION_LABELS[alert.kind]} →</span>
              </span>
            </Link>
          </li>
  )
}

export default function OperationalAlertsSection({ alerts, loading, error, onRetry }: Props) {
  return (
    <DashboardSection
      title="Today — what needs attention across the agency"
      wide
      loading={loading}
      error={error}
      empty={!loading && !error && alerts.length === 0}
      emptyMessage="No agency alerts right now. Review incoming leads or use the client guide below to plan your next step."
      onRetry={onRetry}
    >
      <ul className="crm-owner-ops-alert-list">
        {alerts.slice(0, 5).map(renderAlert)}
      </ul>
      {alerts.length > 5 && <details className="tac-dashboard-details"><summary>View remaining attention groups ({alerts.length - 5})</summary>
      <ul className="crm-owner-ops-alert-list">
        {alerts.slice(5).map(renderAlert)}
      </ul>
      </details>}
    </DashboardSection>
  )
}
