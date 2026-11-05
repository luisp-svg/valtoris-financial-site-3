import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import type { ClientWorkspaceModel } from '../financialProgress/attachFinancialProgress'
import {
  formatCategoriesCalculatedCaption,
  formatLastCalculated,
  formatProgressScoreValue,
  isOverallProgressAvailable,
  isProgressPlaceholder,
  PARTIAL_PROGRESS_MESSAGE,
  PLACEHOLDER_PROGRESS_MESSAGE,
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
  const overallAvailable = isOverallProgressAvailable(financialProgress)

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
          title="Not calculated yet"
          description={PLACEHOLDER_PROGRESS_MESSAGE}
        />
      ) : overallAvailable ? (
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
            <dt>Categories Calculated</dt>
            <dd>{formatCategoriesCalculatedCaption(financialProgress)}</dd>
          </div>
          <div>
            <dt>Last Calculated</dt>
            <dd>{formatLastCalculated(financialProgress)}</dd>
          </div>
        </dl>
      ) : (
        <>
          <EmptyState
            title={'More information needed'}
            description={PARTIAL_PROGRESS_MESSAGE}
          />
          <dl className="crm-client-workspace-info-list">
            <div>
              <dt>Categories Calculated</dt>
              <dd>{formatCategoriesCalculatedCaption(financialProgress)}</dd>
            </div>
          </dl>
        </>
      )}
    </Widget>
  )
}
