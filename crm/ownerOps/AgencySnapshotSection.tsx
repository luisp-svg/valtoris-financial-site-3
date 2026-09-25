import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import DashboardSection from '../dashboard/DashboardSection'
import type { AgencySnapshot } from './types'

type Props = {
  snapshot: AgencySnapshot
  loading: boolean
  error: string | null
  onRetry: () => void
}

const CARDS: Array<{
  key: keyof AgencySnapshot
  label: string
  href: string
}> = [
  { key: 'activeHouseholds', label: 'Active households', href: ROUTES.crmHouseholds },
  {
    key: 'openOpportunities',
    label: 'Open opportunities',
    href: `${ROUTES.crmPipeline}?statusGroup=open`,
  },
  {
    key: 'wonThisMonth',
    label: 'Won this month',
    href: `${ROUTES.crmPipeline}?status=won`,
  },
  {
    key: 'lostThisMonth',
    label: 'Lost this month',
    href: `${ROUTES.crmPipeline}?status=lost`,
  },
  { key: 'tasksDueToday', label: 'Tasks due today', href: ROUTES.crmTasks },
  { key: 'overdueTasks', label: 'Overdue tasks', href: ROUTES.crmTasks },
  {
    key: 'staleOpportunities',
    label: 'Stale opportunities',
    href: `${ROUTES.crmPipeline}?statusGroup=open`,
  },
  {
    key: 'unassignedHouseholds',
    label: 'Unassigned households',
    href: ROUTES.crmHouseholds,
  },
]

export default function AgencySnapshotSection({ snapshot, loading, error, onRetry }: Props) {
  return (
    <DashboardSection
      title="Agency Snapshot"
      wide
      loading={loading}
      error={error}
      onRetry={onRetry}
      className="crm-owner-ops-snapshot"
    >
      <p className="crm-dashboard-footnote">
        Won/lost this month use {snapshot.monthTimeZone} ({snapshot.monthKey}). Due dates use your
        local calendar day. Open opportunities include those on hold. Reopened opportunities are no longer counted as closed.
      </p>
      <div className="crm-owner-ops-metric-grid">
        {CARDS.map((card) => {
          const value = snapshot[card.key]
          if (typeof value !== 'number') return null
          return (
            <Link
              key={card.key}
              to={card.href}
              className="crm-dashboard-metric"
              aria-label={`${value} ${card.label}`}
            >
              <span className="crm-dashboard-metric-value" aria-hidden="true">
                {value}
              </span>
              <span className="crm-dashboard-metric-label" aria-hidden="true">
                {card.label}
              </span>
            </Link>
          )
        })}
      </div>
    </DashboardSection>
  )
}
