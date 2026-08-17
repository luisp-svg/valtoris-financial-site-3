import { formatSignedCents } from '../production/compensationView'
import type { DashboardReportingPeriod } from '../production/dashboardPeriod'
import ProductionPeriodToggle from '../production/ProductionPeriodToggle'
import { formatCents } from '../production/productionApi'
import type { AdvisorCompensationDashboardModel } from '../production/advisorCompensationView'

type CommissionSummaryProps = {
  compensation: AdvisorCompensationDashboardModel
  period: DashboardReportingPeriod
  onPeriodChange: (next: DashboardReportingPeriod) => void
  loading: boolean
  onReviewAll: () => void
}

function MetricCard({
  label,
  cents,
  signed = false,
}: {
  label: string
  cents: number
  signed?: boolean
}) {
  const display = signed ? formatSignedCents(cents) : formatCents(cents)
  return (
    <article className="crm-production-kpi-card">
      <h3 className="crm-production-kpi-label">{label}</h3>
      <p
        className={`crm-production-kpi-value crm-production-money${
          cents < 0 ? ' is-negative' : ''
        }`}
      >
        {display}
      </p>
    </article>
  )
}

export default function CommissionSummary({
  compensation,
  period,
  onPeriodChange,
  loading,
  onReviewAll,
}: CommissionSummaryProps) {
  const { totals } = compensation
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
            Writing-advisor compensation from expected compensation and the actual commission
            ledger. Expected and Outstanding use application submission date, else issue date.
            Paid, Chargebacks, and Net Paid use commission transaction date. Pending, Eligible,
            and Released are not tracked yet.
          </p>
          <div className="crm-production-kpi-grid crm-commissions-kpi-grid">
            <MetricCard label="Expected" cents={totals.expectedCents} />
            <MetricCard label="Outstanding" cents={totals.outstandingCents} />
            <MetricCard label="Paid" cents={totals.paidCents} />
            <MetricCard label="Chargebacks" cents={totals.chargebackCents} signed />
            <MetricCard label="Net Paid" cents={totals.netPaidCents} signed />
          </div>
          {totals.reviewCount > 0 ? (
            <button type="button" className="crm-production-review-btn" onClick={onReviewAll}>
              {totals.reviewCount === 1
                ? '1 expected row needs review'
                : `${totals.reviewCount} expected rows need review`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}
