import StatCard from '../../../components/ui/StatCard'
import {
  getAdvisorLabel,
  getStageLabel,
  getStatusLabel,
} from '../../householdsApi'
import type { ClientWorkspaceModel } from '../financialProgress/attachFinancialProgress'
import FinancialProgressKpiCard from '../financialProgress/FinancialProgressKpiCard'
import {
  getNextReviewLabel,
} from '../format'

type WorkspaceHeaderProps = {
  workspace: ClientWorkspaceModel
  onViewProgress?: () => void
}

export default function WorkspaceHeader({ workspace, onViewProgress }: WorkspaceHeaderProps) {
  const { household, financialProgress, openTasks, activePolicies, annualReview } = workspace
  const nextReview = getNextReviewLabel(annualReview)

  return (
    <header className="crm-client-workspace-header">
      <div className="crm-client-workspace-header-main">
        <h1 className="crm-page-title crm-household-workspace-title">{household.display_name}</h1>
        <div className="crm-household-workspace-chips" aria-label="Household status">
          <span className="crm-status-chip" title="Pipeline stage">
            {getStageLabel(household)}
          </span>
          {getStageLabel(household) !== getStatusLabel(household.status) && <span className="crm-status-chip crm-status-chip-soft" title="Household status">
            {getStatusLabel(household.status)}
          </span>}
        </div>
        <dl className="crm-client-workspace-meta">
          <div>
            <dt>Assigned Advisor</dt>
            <dd>{getAdvisorLabel(household)}</dd>
          </div>

        </dl>
      </div>

      {onViewProgress && <button type="button" className="crm-text-btn tac-household-review-link" onClick={onViewProgress}>Open financial review →</button>}
      <details className="tac-household-section tac-household-summary"><summary>Scores, policies & review summary</summary>
      <div className="crm-client-workspace-kpi-strip" aria-label="Workspace KPIs">
        <FinancialProgressKpiCard progress={financialProgress} onViewProgress={onViewProgress} />
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
      </details>
    </header>
  )
}
