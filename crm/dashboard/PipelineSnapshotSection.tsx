import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import DashboardSection from './DashboardSection'
import type { StageSnapshotRow } from './types'

type Props = {
  rows: StageSnapshotRow[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

export default function PipelineSnapshotSection({ rows, loading, error, onRetry }: Props) {
  const max = rows.reduce((n, row) => Math.max(n, row.count), 0) || 1

  return (
    <DashboardSection
      title="Pipeline Snapshot"
      actionHref={ROUTES.crmPipeline}
      actionLabel="View pipeline"
      loading={loading}
      error={error}
      empty={!loading && !error && rows.length === 0}
      emptyMessage="No open opportunities in stages you can access."
      onRetry={onRetry}
    >
      <ul className="crm-dashboard-stage-list">
        {rows.map((row) => (
          <li key={row.stageId}>
            <Link to={ROUTES.crmPipeline} className="crm-dashboard-stage-row">
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
