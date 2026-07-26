import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import DashboardSection from '../dashboard/DashboardSection'
import type { AgencySnapshot, StageHealthRow } from './types'

type Props = {
  rows: StageHealthRow[]
  snapshot: AgencySnapshot
  loading: boolean
  error: string | null
  onRetry: () => void
}

export default function PipelineHealthSection({
  rows,
  snapshot,
  loading,
  error,
  onRetry,
}: Props) {
  const max = rows.reduce((n, row) => Math.max(n, row.count), 0) || 1

  return (
    <DashboardSection
      title="Pipeline Health"
      actionHref={`${ROUTES.crmPipeline}?statusGroup=open`}
      actionLabel="View pipeline"
      loading={loading}
      error={error}
      empty={!loading && !error && rows.length === 0}
      emptyMessage="No open opportunities in the agency pipeline."
      onRetry={onRetry}
    >
      <ul className="crm-owner-ops-health-stats">
        <li>
          <span>Open</span>
          <strong>{snapshot.openOpportunities}</strong>
        </li>
        <li>
          <span>No next action</span>
          <strong>{snapshot.opportunitiesWithoutNextAction}</strong>
        </li>
        <li>
          <span>Stale</span>
          <strong>{snapshot.staleOpportunities}</strong>
        </li>
        <li>
          <span>Unassigned</span>
          <strong>{snapshot.unassignedOpportunities}</strong>
        </li>
      </ul>
      <ul className="crm-dashboard-stage-list">
        {rows.map((row) => (
          <li key={row.stageId}>
            <Link to={`${ROUTES.crmPipeline}?statusGroup=open`} className="crm-dashboard-stage-row">
              <div className="crm-dashboard-stage-meta">
                <span className="crm-dashboard-stage-name">{row.stageName}</span>
                {row.pipelineName ? (
                  <span className="crm-dashboard-stage-pipeline">{row.pipelineName}</span>
                ) : null}
              </div>
              <div className="crm-dashboard-stage-bar-wrap" aria-hidden="true">
                <span
                  className="crm-dashboard-stage-bar"
                  style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }}
                />
              </div>
              <span className="crm-dashboard-stage-count">{row.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
