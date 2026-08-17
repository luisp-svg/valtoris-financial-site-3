import { useMemo, useState } from 'react'
import type { AdvisorCompensationDashboardModel } from './advisorCompensationView'
import { formatSignedCents } from './compensationView'
import type { DashboardReportingPeriod } from './dashboardPeriod'
import {
  DASHBOARD_PIPELINE_STAGES,
  pipelineStageLabel,
  type ProductionDashboardModel,
  type StageMoneyTotals,
} from './dashboardView'
import ExpectedReviewDialog from './ExpectedReviewDialog'
import ProductionPeriodToggle from './ProductionPeriodToggle'
import { formatCents } from './productionApi'

type ProductionDashboardProps = {
  model: ProductionDashboardModel
  compensation: AdvisorCompensationDashboardModel
  productionPeriod: DashboardReportingPeriod
  compensationPeriod: DashboardReportingPeriod
  onProductionPeriodChange: (next: DashboardReportingPeriod) => void
  onCompensationPeriodChange: (next: DashboardReportingPeriod) => void
  loading: boolean
}

type ReviewScope = 'all' | { advisorId: string | null }

function caseLabel(count: number): string {
  return count === 1 ? '1 case' : `${count} cases`
}

function reviewCountLabel(count: number): string {
  return count === 1 ? '1 needs review' : `${count} need review`
}

function StageKpiCard({
  title,
  totals,
}: {
  title: string
  totals: StageMoneyTotals
}) {
  return (
    <article className="crm-production-kpi-card">
      <h3 className="crm-production-kpi-label">{title}</h3>
      <p className="crm-production-kpi-value">{caseLabel(totals.caseCount)}</p>
      <dl className="crm-production-kpi-money">
        <div>
          <dt>Annual life premium</dt>
          <dd>{formatCents(totals.lifePremiumCents)}</dd>
        </div>
        <div>
          <dt>Annuity deposits</dt>
          <dd>{formatCents(totals.annuityDepositCents)}</dd>
        </div>
      </dl>
      {totals.unannualizableLifeCount > 0 ? (
        <p className="crm-production-kpi-caption">
          {totals.unannualizableLifeCount === 1
            ? '1 life case omitted — premium mode not annualizable'
            : `${totals.unannualizableLifeCount} life cases omitted — premium mode not annualizable`}
        </p>
      ) : null}
    </article>
  )
}

function ReviewCountButton({
  count,
  onClick,
}: {
  count: number
  onClick: () => void
}) {
  if (count <= 0) return null
  return (
    <button type="button" className="crm-production-review-btn" onClick={onClick}>
      {reviewCountLabel(count)}
    </button>
  )
}

export default function ProductionDashboard({
  model,
  compensation,
  productionPeriod,
  compensationPeriod,
  onProductionPeriodChange,
  onCompensationPeriodChange,
  loading,
}: ProductionDashboardProps) {
  const { summary, protection, pipeline } = model
  const [reviewScope, setReviewScope] = useState<ReviewScope | null>(null)

  const reviewItems = useMemo(() => {
    if (reviewScope == null) return []
    if (reviewScope === 'all') return compensation.reviewItems
    return compensation.reviewItems.filter((item) => item.advisorId === reviewScope.advisorId)
  }, [compensation.reviewItems, reviewScope])

  const reviewTitle =
    reviewScope === 'all'
      ? 'Expected compensation needing review'
      : 'Advisor expected compensation needing review'

  return (
    <section className="crm-panel crm-production-dashboard" aria-label="Production dashboard">
      <div className="crm-panel-head crm-production-dashboard-head">
        <h2>Production dashboard</h2>
        <ProductionPeriodToggle
          value={productionPeriod}
          onChange={onProductionPeriodChange}
          options={['lifetime', 'ytd', 'this_month']}
          ariaLabel="Production reporting period"
        />
      </div>
      {loading ? (
        <p className="crm-muted">Loading production totals…</p>
      ) : (
        <div className="crm-production-dashboard-stack">
          <p className="crm-production-kpi-caption">
            Current-stage snapshot. Production period uses application submission date. Active Life
            Protection period uses in-force date. Queue filters still apply; this control does not
            change the applications list.
          </p>
          <div className="crm-production-kpi-grid crm-production-kpi-grid-summary">
            <article className="crm-production-kpi-card crm-production-kpi-card-hero">
              <h3 className="crm-production-kpi-label">Active Life Protection</h3>
              <p className="crm-production-kpi-value">{formatCents(protection.knownFaceCents)}</p>
              <p className="crm-production-kpi-caption">
                In-force life face amount
                {protection.inForceLifeCount === 1
                  ? ' · 1 in-force life policy'
                  : ` · ${protection.inForceLifeCount} in-force life policies`}
              </p>
              <p className="crm-production-kpi-caption">
                {protection.unknownFaceCount === 1
                  ? '1 in-force life policy with unknown face amount'
                  : `${protection.unknownFaceCount} in-force life policies with unknown face amount`}
              </p>
            </article>
            <article className="crm-production-kpi-card">
              <h3 className="crm-production-kpi-label">Annual Life Premium</h3>
              <p className="crm-production-kpi-value">{formatCents(summary.lifePremiumCents)}</p>
              <p className="crm-production-kpi-caption">Annualized submitted life premium</p>
              {summary.unannualizableLifeCount > 0 ? (
                <p className="crm-production-kpi-caption">
                  {summary.unannualizableLifeCount === 1
                    ? '1 life case omitted — premium mode not annualizable'
                    : `${summary.unannualizableLifeCount} life cases omitted — premium mode not annualizable`}
                </p>
              ) : null}
            </article>
            <article className="crm-production-kpi-card">
              <h3 className="crm-production-kpi-label">Annuity / FIA Deposits</h3>
              <p className="crm-production-kpi-value">{formatCents(summary.annuityDepositCents)}</p>
              <p className="crm-production-kpi-caption">Visible FIA applications</p>
            </article>
          </div>

          <div className="crm-production-kpi-grid crm-production-kpi-grid-pipeline">
            {DASHBOARD_PIPELINE_STAGES.map((stage) => (
              <StageKpiCard
                key={stage}
                title={pipelineStageLabel(stage)}
                totals={pipeline[stage]}
              />
            ))}
          </div>

          <section className="crm-production-compensation" aria-label="Advisor Compensation">
            <div className="crm-production-dashboard-head">
              <h3>Advisor Compensation</h3>
              <ProductionPeriodToggle
                value={compensationPeriod}
                onChange={onCompensationPeriodChange}
                options={['this_month', 'ytd', 'lifetime']}
                ariaLabel="Advisor compensation reporting period"
              />
            </div>
            <p className="crm-production-kpi-caption">
              Writing-advisor compensation from the expected-compensation and commission ledger —
              not a production stage. Expected and Outstanding use application submission date, else
              issue date. Paid, Chargebacks, and Net Paid use commission transaction date.
            </p>
            {compensation.totals.reviewCount > 0 ? (
              <ReviewCountButton
                count={compensation.totals.reviewCount}
                onClick={() => setReviewScope('all')}
              />
            ) : null}
            {compensation.rows.length === 0 ? (
              <p className="crm-muted">No advisor compensation in this period.</p>
            ) : (
              <div
                className="crm-production-comp-grid"
                role="table"
                aria-label="Advisor compensation by writing advisor"
              >
                <div className="crm-production-comp-row is-head" role="row">
                  <div className="is-name" role="columnheader">
                    Advisor
                  </div>
                  <div className="is-money" role="columnheader">
                    Expected
                  </div>
                  <div className="is-money" role="columnheader">
                    Outstanding
                  </div>
                  <div className="is-money" role="columnheader">
                    Paid
                  </div>
                  <div className="is-money" role="columnheader">
                    Chargebacks
                  </div>
                  <div className="is-money" role="columnheader">
                    Net Paid
                  </div>
                </div>
                {compensation.rows.map((row) => {
                  const unresolved = row.expectedCents === 0 && row.reviewCount > 0
                  return (
                    <div
                      key={row.advisorId ?? 'unattributed'}
                      className="crm-production-comp-row"
                      role="row"
                    >
                      <div className="is-name" role="cell">
                        <span className="crm-production-comp-advisor">{row.advisorName}</span>
                        <ReviewCountButton
                          count={row.reviewCount}
                          onClick={() => setReviewScope({ advisorId: row.advisorId })}
                        />
                      </div>
                      <div
                        className={unresolved ? 'is-money is-unresolved' : 'is-money'}
                        role="cell"
                        data-label="Expected"
                      >
                        {formatCents(row.expectedCents)}
                        {unresolved ? (
                          <span className="crm-production-comp-incomplete">Incomplete</span>
                        ) : null}
                      </div>
                      <div className="is-money" role="cell" data-label="Outstanding">
                        {formatCents(row.outstandingCents)}
                      </div>
                      <div className="is-money" role="cell" data-label="Paid">
                        {formatCents(row.paidCents)}
                      </div>
                      <div className="is-money" role="cell" data-label="Chargebacks">
                        {formatSignedCents(row.chargebackCents)}
                      </div>
                      <div className="is-money" role="cell" data-label="Net Paid">
                        {formatCents(row.netPaidCents)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
      {reviewScope ? (
        <ExpectedReviewDialog
          items={reviewItems}
          title={reviewTitle}
          onClose={() => setReviewScope(null)}
        />
      ) : null}
    </section>
  )
}
