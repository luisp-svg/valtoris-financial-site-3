import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import DashboardSection from '../dashboard/DashboardSection'
import type { WorkloadRow } from './types'

type Props = {
  rows: WorkloadRow[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

export default function AdvisorWorkloadSection({ rows, loading, error, onRetry }: Props) {
  return (
    <DashboardSection
      title="Advisor Workload"
      wide
      loading={loading}
      error={error}
      empty={!loading && !error && rows.length === 0}
      emptyMessage="No advisors or open work to show."
      onRetry={onRetry}
      className="crm-owner-ops-workload"
    >
      <p className="crm-dashboard-footnote">
        Sorted by needs attention. Unassigned is included when work has no advisor. Tasks roll up
        by household assignment; opportunities by opportunity assignment.
      </p>
      <div className="crm-owner-ops-table-wrap">
        <table className="crm-owner-ops-table">
          <thead>
            <tr>
              <th scope="col">Advisor</th>
              <th scope="col">Households</th>
              <th scope="col">Open opps</th>
              <th scope="col">Tasks due</th>
              <th scope="col">Overdue</th>
              <th scope="col">Needs attn</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.isUnassigned ? 'is-unassigned' : undefined}>
                <td>
                  <Link to={ROUTES.crmHouseholds} className="crm-owner-ops-advisor-link">
                    {row.displayName}
                  </Link>
                </td>
                <td>{row.households}</td>
                <td>{row.openOpportunities}</td>
                <td>{row.tasksDueToday}</td>
                <td>{row.overdueTasks}</td>
                <td>
                  <strong>{row.needsAttention}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardSection>
  )
}
