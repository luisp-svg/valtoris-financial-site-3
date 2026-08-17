import { formatCents } from './productionApi'
import {
  DASHBOARD_PIPELINE_STAGES,
  pipelineStageLabel,
  type ProductionDashboardModel,
  type StageMoneyTotals,
} from './dashboardView'

type ProductionDashboardProps = {
  model: ProductionDashboardModel
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
          <dt>Life premium</dt>
          <dd>{formatCents(totals.lifePremiumCents)}</dd>
        </div>
        <div>
          <dt>Annuity deposits</dt>
          <dd>{formatCents(totals.annuityDepositCents)}</dd>
        </div>
      </dl>
    </article>
  )
}

export default function ProductionDashboard({ model, loading }: ProductionDashboardProps) {
  const { summary, protection, commissionPaid, pipeline } = model

  return (
    <section className="crm-panel crm-production-dashboard" aria-label="Production dashboard">
      <div className="crm-panel-head">
        <h2>Production dashboard</h2>
      </div>
      {loading ? (
        <p className="crm-muted">Loading production totals…</p>
      ) : (
        <div className="crm-production-dashboard-stack">
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
              <h3 className="crm-production-kpi-label">Life Submitted Premium</h3>
              <p className="crm-production-kpi-value">{formatCents(summary.lifePremiumCents)}</p>
              <p className="crm-production-kpi-caption">Visible life applications</p>
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

          <div className="crm-production-kpi-grid crm-production-kpi-grid-paid">
            <article className="crm-production-kpi-card crm-production-kpi-card-paid">
              <h3 className="crm-production-kpi-label">Commission Paid</h3>
              <p className="crm-production-kpi-value">{formatCents(commissionPaid.paidCents)}</p>
              <p className="crm-production-kpi-caption">
                {commissionPaid.applicationCount === 1
                  ? '1 application with paid commission'
                  : `${commissionPaid.applicationCount} applications with paid commission`}
              </p>
              <p className="crm-production-kpi-caption">
                Compensation ledger — not a production stage
              </p>
            </article>
          </div>
        </div>
      )}
    </section>
  )
}
