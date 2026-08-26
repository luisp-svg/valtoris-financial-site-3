import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { formatSignedCents } from '../production/compensationView'
import type { DashboardReportingPeriod } from '../production/dashboardPeriod'
import ProductionPeriodToggle from '../production/ProductionPeriodToggle'
import { formatCents } from '../production/productionApi'
import type { AdvisorCompensationDashboardModel } from '../production/advisorCompensationView'
import {
  formatExceptionBucketLabel,
  visibleExceptionBuckets,
  type CommissionExceptionBucket,
  type CommissionExceptionCounts,
} from './commissionExceptionView'

type CommissionSummaryProps = {
  compensation: AdvisorCompensationDashboardModel
  pendingCents: number
  pendingReviewCopy: string | null
  remainingExpectedCents: number | null
  varianceCents: number | null
  exceptionCounts: CommissionExceptionCounts
  exceptionBucket: CommissionExceptionBucket
  onExceptionBucketChange: (bucket: CommissionExceptionBucket) => void
  needsAttentionCount: number
  isOwner: boolean
  period: DashboardReportingPeriod
  onPeriodChange: (next: DashboardReportingPeriod) => void
  loading: boolean
  onReviewAll: () => void
}

function MetricCard({
  label,
  cents,
  signed = false,
  hint,
  unavailable = false,
}: {
  label: string
  cents: number | null
  signed?: boolean
  hint?: string
  unavailable?: boolean
}) {
  const display =
    unavailable || cents == null ? '—' : signed ? formatSignedCents(cents) : formatCents(cents)
  return (
    <article className="crm-production-kpi-card">
      <h3 className="crm-production-kpi-label">{label}</h3>
      <p
        className={`crm-production-kpi-value crm-production-money${
          cents != null && cents < 0 ? ' is-negative' : ''
        }`}
      >
        {display}
      </p>
      {hint ? <p className="crm-production-kpi-hint">{hint}</p> : null}
    </article>
  )
}

export default function CommissionSummary({
  compensation,
  pendingCents,
  pendingReviewCopy,
  remainingExpectedCents,
  varianceCents,
  exceptionCounts,
  exceptionBucket,
  onExceptionBucketChange,
  needsAttentionCount,
  isOwner,
  period,
  onPeriodChange,
  loading,
  onReviewAll,
}: CommissionSummaryProps) {
  const { totals } = compensation
  const exceptionOptions = visibleExceptionBuckets(isOwner).filter((bucket) => bucket !== 'all')
  return (
    <section className="crm-panel crm-production-dashboard" aria-label="Commission summary">
      <div className="crm-panel-head crm-production-dashboard-head">
        <h2>Commission summary</h2>
        <ProductionPeriodToggle
          value={period}
          onChange={onPeriodChange}
          options={['this_month', 'ytd', 'lifetime']}
          ariaLabel="Commission reporting period"
        />
      </div>
      {loading ? (
        <p className="crm-muted">Loading commission totals…</p>
      ) : (
        <div className="crm-production-dashboard-stack">
          <p className="crm-production-kpi-caption">
            {isOwner
              ? 'Writing-advisor compensation from expected compensation, source-confirmed pending, and the actual commission ledger. Expected and Outstanding use application submission date, else issue date. Pending uses the pending statement date. Paid, Chargebacks, and Net actual use commission transaction date. Remaining expected and Variance are derived from pinned Expected vs Net actual. Eligible and Released are not tracked.'
              : 'Writing-advisor compensation from expected compensation and the actual commission ledger. Expected and Outstanding use application submission date, else issue date. Paid, Chargebacks, and Net actual use commission transaction date. Remaining expected and Variance are derived from pinned Expected vs Net actual.'}
          </p>
          <div
            className={`crm-production-kpi-grid crm-commissions-kpi-grid has-reconciliation${
              isOwner ? ' has-pending' : ''
            }`}
          >
            <MetricCard label="Expected" cents={totals.expectedCents} />
            {isOwner ? (
              <MetricCard
                label="Pending"
                cents={pendingCents}
                hint="Source-confirmed Experior pending writing compensation."
              />
            ) : null}
            <MetricCard label="Outstanding" cents={totals.outstandingCents} />
            <MetricCard label="Paid" cents={totals.paidCents} />
            <MetricCard label="Chargebacks" cents={totals.chargebackCents} signed />
            <MetricCard label="Net actual" cents={totals.netPaidCents} signed />
            <MetricCard
              label="Remaining expected"
              cents={remainingExpectedCents}
              signed
              unavailable={remainingExpectedCents == null}
              hint="Pinned Expected minus Net actual. Unavailable when Expected is unresolved."
            />
            <MetricCard
              label="Variance"
              cents={varianceCents}
              signed
              unavailable={varianceCents == null}
              hint="Net actual minus pinned Expected. Positive is overpaid."
            />
          </div>
          <div
            className="crm-commissions-exception-filters"
            role="group"
            aria-label="Exception filters"
          >
            {exceptionOptions.map((bucket) => {
              const count = exceptionCounts[bucket]
              const selected = exceptionBucket === bucket
              return (
                <button
                  key={bucket}
                  type="button"
                  className={`crm-commissions-exception-chip${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => onExceptionBucketChange(selected ? 'all' : bucket)}
                >
                  {formatExceptionBucketLabel(bucket)}
                  <span className="crm-commissions-exception-count">{count}</span>
                </button>
              )
            })}
          </div>
          {needsAttentionCount > 0 ? (
            <p className="crm-production-kpi-caption">
              {needsAttentionCount === 1
                ? '1 record needs attention.'
                : `${needsAttentionCount} records need attention.`}{' '}
              Fully reconciled rows are excluded.
            </p>
          ) : null}
          {totals.reviewCount > 0 ? (
            <button type="button" className="crm-production-review-btn" onClick={onReviewAll}>
              {totals.reviewCount === 1
                ? '1 expected row needs review'
                : `${totals.reviewCount} expected rows need review`}
            </button>
          ) : null}
          {isOwner && pendingReviewCopy ? (
            <Link to={ROUTES.crmCommissionsPendingImport} className="crm-production-review-btn">
              {pendingReviewCopy}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  )
}
