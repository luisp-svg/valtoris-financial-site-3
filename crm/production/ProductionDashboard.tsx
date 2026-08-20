import { useMemo, useState } from 'react'
import type { AdvisorCompensationDashboardModel } from './advisorCompensationView'
import { formatSignedCents } from './compensationView'
import type { DashboardReportingPeriod } from './dashboardPeriod'
import {
  DASHBOARD_PIPELINE_STAGES,
  formatPlacementRate,
  pipelineStageLabel,
  type LineFunnelMetrics,
  type ProductionDashboardModel,
  type ProductionFunnelMetrics,
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

function protectionPeriodCaption(period: DashboardReportingPeriod): string {
  if (period === 'ytd') {
    return 'YTD = policies entering in-force this year. Lifetime is the entire current in-force book.'
  }
  if (period === 'this_month') {
    return 'This Month = policies entering in-force this month. Lifetime is the entire current in-force book.'
  }
  return 'Lifetime = entire current in-force book. YTD / This Month = policies entering in-force during that period.'
}

function missingInForceDateNote(
  period: DashboardReportingPeriod,
  missingCount: number,
): string | null {
  if (missingCount <= 0) return null
  const noun = missingCount === 1 ? 'in-force life policy has' : 'in-force life policies have'
  if (period === 'lifetime') {
    return `${missingCount} ${noun} no in-force date. They are included in Lifetime and omitted from YTD / This Month.`
  }
  return `${missingCount} ${noun} no in-force date and ${missingCount === 1 ? 'is' : 'are'} omitted from this period.`
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

function FunnelCount({ value }: { value: number }) {
  return <span>{value}</span>
}

function FunnelRate({ rate }: { rate: number | null }) {
  return <span>{formatPlacementRate(rate)}</span>
}

function FunnelRow({
  label,
  life,
  fia,
  all,
  kind,
}: {
  label: string
  life: LineFunnelMetrics
  fia: LineFunnelMetrics
  all: LineFunnelMetrics
  kind:
    | 'applied'
    | 'placed'
    | 'declined'
    | 'notTaken'
    | 'withdrawn'
    | 'incomplete'
    | 'pending'
    | 'gross'
    | 'resolved'
}) {
  const isRate = kind === 'gross' || kind === 'resolved'
  return (
    <div className="crm-production-funnel-row" role="row">
      <div className="is-metric" role="rowheader">{label}</div>
      <div className="is-num" role="cell" data-label="Life">
        {isRate ? (
          <FunnelRate rate={kind === 'gross' ? life.grossPlacementRate : life.resolvedPlacementRate} />
        ) : (
          <FunnelCount value={life[kind]} />
        )}
      </div>
      <div className="is-num" role="cell" data-label="FIA">
        {isRate ? (
          <FunnelRate rate={kind === 'gross' ? fia.grossPlacementRate : fia.resolvedPlacementRate} />
        ) : (
          <FunnelCount value={fia[kind]} />
        )}
      </div>
      <div className="is-num" role="cell" data-label="Total">
        {isRate ? (
          <FunnelRate rate={kind === 'gross' ? all.grossPlacementRate : all.resolvedPlacementRate} />
        ) : (
          <FunnelCount value={all[kind]} />
        )}
      </div>
    </div>
  )
}

function ProductionFunnelTable({ funnel }: { funnel: ProductionFunnelMetrics }) {
  const { life, fia, all } = funnel
  return (
    <div
      className="crm-production-funnel-grid"
      role="table"
      aria-label="Production performance by Life and FIA"
    >
      <div className="crm-production-funnel-row is-head" role="row">
        <div className="is-metric" role="columnheader">Metric</div>
        <div className="is-num" role="columnheader">Life</div>
        <div className="is-num" role="columnheader">FIA</div>
        <div className="is-num" role="columnheader">Total</div>
      </div>
      <FunnelRow label="Applied" kind="applied" life={life} fia={fia} all={all} />
      <FunnelRow label="Placed / In Force" kind="placed" life={life} fia={fia} all={all} />
      <FunnelRow label="Declined" kind="declined" life={life} fia={fia} all={all} />
      <FunnelRow label="Not Taken" kind="notTaken" life={life} fia={fia} all={all} />
      <FunnelRow label="Withdrawn" kind="withdrawn" life={life} fia={fia} all={all} />
      <FunnelRow label="Pending" kind="pending" life={life} fia={fia} all={all} />
      <FunnelRow label="Gross Placement Rate" kind="gross" life={life} fia={fia} all={all} />
      <FunnelRow label="Resolved Placement Rate" kind="resolved" life={life} fia={fia} all={all} />
    </div>
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
  const { summary, protection, pipeline, funnel } = model
  const [reviewScope, setReviewScope] = useState<ReviewScope | null>(null)
  const dateNote = missingInForceDateNote(productionPeriod, protection.missingInForceDateCount)

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
            Production Performance uses application submission date. Current Case Pipeline is the
            current stage of that submitted cohort. Active Life Protection uses in-force date.
            Queue filters still apply; this control does not change the applications list.
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
                {protectionPeriodCaption(productionPeriod)}
              </p>
              {protection.unknownFaceCount > 0 ? (
                <p className="crm-production-kpi-caption">
                  {protection.unknownFaceCount === 1
                    ? '1 in-force life policy with unknown face amount'
                    : `${protection.unknownFaceCount} in-force life policies with unknown face amount`}
                </p>
              ) : null}
              {dateNote ? <p className="crm-production-kpi-caption">{dateNote}</p> : null}
            </article>
            <article className="crm-production-kpi-card">
              <h3 className="crm-production-kpi-label">Annual Life Premium</h3>
              <p className="crm-production-kpi-value">{formatCents(summary.lifePremiumCents)}</p>
              <p className="crm-production-kpi-caption">
                Annualized submitted life premium in the submission cohort
              </p>
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
              <p className="crm-production-kpi-caption">
                FIA deposit amounts in the submission cohort — not life premium
              </p>
            </article>
          </div>

          <section className="crm-production-funnel" aria-label="Production Performance">
            <h3>Production Performance</h3>
            <p className="crm-production-kpi-caption">
              How much we wrote and placed. Applied is cumulative submitted applications for this
              period, including later stages. Placement rates are case counts, not dollars.
              Postponed stays pending.
            </p>
            <ProductionFunnelTable funnel={funnel} />
          </section>

          <section className="crm-production-pipeline" aria-label="Current Case Pipeline">
            <h3>Current Case Pipeline</h3>
            <p className="crm-production-kpi-caption">
              Where open cases are right now, within the selected submission cohort. Submitted is
              the current stage — not Applied.
            </p>
            <div className="crm-production-kpi-grid crm-production-kpi-grid-pipeline">
              {DASHBOARD_PIPELINE_STAGES.map((stage) => (
                <StageKpiCard
                  key={stage}
                  title={pipelineStageLabel(stage)}
                  totals={pipeline[stage]}
                />
              ))}
            </div>
          </section>

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
