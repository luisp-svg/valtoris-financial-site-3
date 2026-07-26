import StatCard from '../../../components/ui/StatCard'
import {
  getAdvisorLabel,
  getStageLabel,
  getStatusLabel,
} from '../../householdsApi'
import type { ClientWorkspaceModel } from '../financialProgress/attachFinancialProgress'
import FinancialProgressKpiCard from '../financialProgress/FinancialProgressKpiCard'
import {
  formatWorkspaceDate,
  getNextReviewLabel,
  getReviewDueLabel,
} from '../format'

type WorkspaceHeaderProps = {
  workspace: ClientWorkspaceModel
}

export default function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  const { household, financialProgress, openTasks, activePolicies, annualReview } = workspace
  const reviewDue = getReviewDueLabel(annualReview)
  const nextReview = getNextReviewLabel(annualReview)

  return (
    <header className="crm-client-workspace-header">
      <div className="crm-client-workspace-header-main">
        <h1 className="crm-page-title crm-household-workspace-title">{household.display_name}</h1>
        <div className="crm-household-workspace-chips" aria-label="Household status">
          <span className="crm-status-chip" title="Pipeline stage">
            {getStageLabel(household)}
          </span>
          <span className="crm-status-chip crm-status-chip-soft" title="Household status">
            {getStatusLabel(household.status)}
          </span>
        </div>
        <dl className="crm-client-workspace-meta">
          <div>
            <dt>Assigned Advisor</dt>
            <dd>{getAdvisorLabel(household)}</dd>
          </div>
          <div>
            <dt>Client Since</dt>
            <dd>{formatWorkspaceDate(household.created_at)}</dd>
          </div>
          <div>
            <dt>Review Due</dt>
            <dd>{reviewDue}</dd>
          </div>
        </dl>
      </div>

      <div className="crm-client-workspace-kpi-strip" aria-label="Workspace KPIs">
        <FinancialProgressKpiCard progress={financialProgress} />
        <StatCard
          label="Open Cases"
          value={workspace.openCasesCount}
          caption={workspace.openCasesCount === 0 ? 'No open cases' : undefined}
          empty={workspace.openCasesCount === 0}
        />
        <StatCard
          label="Active Policies"
          value={activePolicies.length}
          caption={activePolicies.length === 0 ? 'No active policies' : undefined}
          empty={activePolicies.length === 0}
        />
        <StatCard
          label="Open Tasks"
          value={openTasks.length}
          caption={openTasks.length === 0 ? 'No open tasks' : undefined}
          empty={openTasks.length === 0}
        />
        <StatCard
          label="Next Review"
          value={nextReview}
          caption={nextReview === '—' ? 'No review scheduled' : 'Scheduled'}
          empty={nextReview === '—'}
        />
      </div>
    </header>
  )
}
