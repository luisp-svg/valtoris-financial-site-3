import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type DashboardSectionProps = {
  title: string
  actionHref?: string
  actionLabel?: string
  loading?: boolean
  error?: string | null
  warning?: string | null
  empty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  children?: ReactNode
  className?: string
  wide?: boolean
}

export default function DashboardSection({
  title,
  actionHref,
  actionLabel = 'View all',
  loading = false,
  error = null,
  warning = null,
  empty = false,
  emptyMessage = 'Nothing here yet.',
  onRetry,
  children,
  className = '',
  wide = false,
}: DashboardSectionProps) {
  return (
    <section
      className={`crm-dashboard-panel${wide ? ' crm-dashboard-panel-wide' : ''} ${className}`.trim()}
    >
      <div className="crm-panel-head">
        <h2>{title}</h2>
        {actionHref ? (
          <Link to={actionHref} className="crm-text-btn">
            {actionLabel}
          </Link>
        ) : null}
      </div>

      {loading ? <p className="crm-muted">Loading…</p> : null}

      {!loading && error ? (
        <div className="crm-dashboard-section-error">
          <p className="crm-banner crm-banner-error" role="alert">
            {error}
          </p>
          {onRetry ? (
            <button type="button" className="crm-text-btn" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && warning ? (
        <div className="crm-dashboard-section-error">
          <p className="crm-banner crm-banner-warning" role="status">
            {warning}
          </p>
          {onRetry ? (
            <button type="button" className="crm-text-btn" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && empty ? <p className="crm-muted">{emptyMessage}</p> : null}

      {!loading && !error && !empty ? children : null}
    </section>
  )
}
