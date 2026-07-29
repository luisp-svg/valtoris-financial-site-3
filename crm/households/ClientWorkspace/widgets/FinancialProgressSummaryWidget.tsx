import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import type { ClientWorkspaceModel } from '../financialProgress/attachFinancialProgress'
import {
  formatCategoriesCalculatedCaption,
  formatLastCalculated,
  formatProgressScoreValue,
  isOverallProgressAvailable,
  isProgressPartial,
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
  const partial = isProgressPartial(financialProgress)

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
          <div>
            <dt>Methodology</dt>
            <dd>{financialProgress.methodologyVersion}</dd>
          </div>
          <div>
            <dt>Engine</dt>
            <dd>{financialProgress.engineVersion}</dd>
          </div>
        </dl>
      ) : (
        <>
          <EmptyState
            title={partial ? 'Overall Score Withheld' : 'Overall Progress Not Yet Available'}
            description={PARTIAL_PROGRESS_MESSAGE}
          />
          <dl className="crm-client-workspace-info-list">
            <div>
              <dt>Categories Calculated</dt>
              <dd>{formatCategoriesCalculatedCaption(financialProgress)}</dd>
            </div>
            <div>
              <dt>Methodology</dt>
              <dd>{financialProgress.methodologyVersion}</dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd>{financialProgress.engineVersion}</dd>
            </div>
          </dl>
        </>
      )}
    </Widget>
  )
}
