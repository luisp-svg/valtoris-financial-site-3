import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import type { CrmHouseholdWorkspace } from '../../types'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function FinancialProgressSummaryWidget({
  workspace,
  onNavigateTab,
}: Props) {
  const { financialProgress } = workspace

  return (
    <Widget
      title="Financial Progress Summary"
      titleId="crm-widget-financial-progress"
      actions={
        <button
          type="button"
          className="crm-text-btn"
          onClick={() => onNavigateTab('financial_progress')}
        >
          View details
        </button>
      }
    >
      {financialProgress.score == null ? (
        <EmptyState
          title="Progress not scored yet"
          description="Financial Progress scoring will appear here when the engine is connected."
        />
      ) : (
        <>
          <p className="crm-stat-card-value">{financialProgress.score}</p>
          <p className="crm-stat-card-caption">{financialProgress.label}</p>
        </>
      )}
    </Widget>
  )
}
