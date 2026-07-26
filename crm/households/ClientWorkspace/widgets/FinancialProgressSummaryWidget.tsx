import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import type { ClientWorkspaceModel } from '../financialProgress/attachFinancialProgress'
import {
  formatLastCalculated,
  formatProgressScoreValue,
  isProgressPlaceholder,
} from '../financialProgress/formatProgressDisplay'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: ClientWorkspaceModel
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function FinancialProgressSummaryWidget({
  workspace,
  onNavigateTab,
}: Props) {
  const { financialProgress } = workspace
  const placeholder = isProgressPlaceholder(financialProgress)

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
      {placeholder ? (
        <EmptyState
          title="Not Yet Calculated"
          description="Complete household assessment to generate score."
        />
      ) : (
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>Progress Score</dt>
            <dd className="crm-financial-progress-score-emphasis">
              {formatProgressScoreValue(financialProgress.overall.score)}
            </dd>
          </div>
          <div>
            <dt>Grade</dt>
            <dd>{financialProgress.overall.grade ?? '—'}</dd>
          </div>
          <div>
            <dt>Last Calculated</dt>
            <dd>{formatLastCalculated(financialProgress)}</dd>
          </div>
          <div>
            <dt>Methodology</dt>
            <dd>{financialProgress.methodologyVersion}</dd>
          </div>
        </dl>
      )}
    </Widget>
  )
}
