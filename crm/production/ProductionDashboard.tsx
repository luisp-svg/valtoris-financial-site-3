import { formatCents } from './productionApi'
import { formatSignedCents } from './compensationView'
import ProductionPeriodToggle from './ProductionPeriodToggle'
import type { AdvisorCompensationDashboardModel } from './advisorCompensationView'
import type { DashboardReportingPeriod } from './dashboardPeriod'
import {
  DASHBOARD_PIPELINE_STAGES,
  pipelineStageLabel,
  type ProductionDashboardModel,
  type StageMoneyTotals,
} from './dashboardView'

type ProductionDashboardProps = {
  model: ProductionDashboardModel
  compensation: AdvisorCompensationDashboardModel
  productionPeriod: DashboardReportingPeriod
  compensationPeriod: DashboardReportingPeriod
  onProductionPeriodChange: (next: DashboardReportingPeriod) => void
  onCompensationPeriodChange: (next: DashboardReportingPeriod) => void
  loading: boolean
}

function caseLabel(count: number): string {
  return count === 1 ? '1 case' : `${count} cases`
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
              <p className="crm-production-kpi-caption">
                {compensation.totals.reviewCount === 1
                  ? '1 expected row needs review'
                  : `${compensation.totals.reviewCount} expected rows need review`}
              </p>
            ) : null}
            {compensation.rows.length === 0 ? (
              <p className="crm-muted">No advisor compensation in this period.</p>
            ) : (
              <div className="crm-table-wrap">
                <table className="crm-table crm-production-compensation-table">
                  <thead>
                    <tr>
                      <th>Advisor</th>
                      <th>Expected</th>
                      <th>Outstanding</th>
                      <th>Paid</th>
                      <th>Chargebacks</th>
                      <th>Net Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compensation.rows.map((row) => (
                      <tr key={row.advisorId ?? 'unattributed'}>
                        <td>
                          {row.advisorName}
                          {row.reviewCount > 0
                            ? ` · ${row.reviewCount} need review`
                            : ''}
                        </td>
                        <td>{formatCents(row.expectedCents)}</td>
                        <td>{formatCents(row.outstandingCents)}</td>
                        <td>{formatCents(row.paidCents)}</td>
                        <td>{formatSignedCents(row.chargebackCents)}</td>
                        <td>{formatCents(row.netPaidCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
