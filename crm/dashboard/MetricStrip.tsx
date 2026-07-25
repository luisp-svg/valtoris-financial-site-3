import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import type { OpportunityStatusCounts } from './types'

type Props = {
  counts: OpportunityStatusCounts
  loading: boolean
  error: string | null
  onRetry: () => void
}

const METRICS = [
  {
    key: 'open' as const,
    label: 'Open',
    href: `${ROUTES.crmPipeline}?statusGroup=open`,
    ariaSuffix: 'open opportunities',
  },
  {
    key: 'won' as const,
    label: 'Won',
    href: `${ROUTES.crmPipeline}?status=won`,
    ariaSuffix: 'won opportunities',
  },
  {
    key: 'lost' as const,
    label: 'Lost',
    href: `${ROUTES.crmPipeline}?status=lost`,
    ariaSuffix: 'lost opportunities',
  },
]

export default function MetricStrip({ counts, loading, error, onRetry }: Props) {
  return (
    <section className="crm-dashboard-metrics" aria-label="Opportunity counts">
      <div className="crm-panel-head">
        <h2>Pipeline pulse</h2>
        <Link to={`${ROUTES.crmPipeline}?statusGroup=open`} className="crm-text-btn">
          Open pipeline
        </Link>
      </div>

      {loading ? <p className="crm-muted">Loading counts…</p> : null}

      {!loading && error ? (
        <div className="crm-dashboard-section-error">
          <p className="crm-banner crm-banner-error" role="alert">
            {error}
          </p>
          <button type="button" className="crm-text-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="crm-dashboard-metric-row">
          {METRICS.map((metric) => (
            <Link
              key={metric.key}
              to={metric.href}
              className="crm-dashboard-metric"
              aria-label={`${counts[metric.key]} ${metric.ariaSuffix}`}
            >
              <span className="crm-dashboard-metric-value" aria-hidden="true">
                {counts[metric.key]}
              </span>
              <span className="crm-dashboard-metric-label" aria-hidden="true">
                {metric.label}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
