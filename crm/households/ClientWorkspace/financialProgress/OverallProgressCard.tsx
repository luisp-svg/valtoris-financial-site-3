import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { HouseholdFinancialProgressResult } from '../../../financial-progress'
import {
  formatCategoriesCalculatedCaption,
  formatLastCalculated,
  formatProgressScoreValue,
  isOverallProgressAvailable,
  isProgressPlaceholder,
} from './formatProgressDisplay'

type OverallProgressCardProps = {
  progress: HouseholdFinancialProgressResult
}

export default function OverallProgressCard({ progress }: OverallProgressCardProps) {
  const placeholder = isProgressPlaceholder(progress)
  const overallAvailable = isOverallProgressAvailable(progress)

  return (
    <Panel labelledBy="crm-fp-overall-heading" className="crm-financial-progress-overall">
      <SectionHeader title="Overall Progress" titleId="crm-fp-overall-heading" />

      {placeholder ? (
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>Progress Score</dt>
            <dd>Not Yet Calculated</dd>
          </div>
          <div>
            <dt>Grade</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Last Calculated</dt>
            <dd>{formatLastCalculated(progress)}</dd>
          </div>
          <div>
            <dt>Methodology Version</dt>
            <dd>{progress.methodologyVersion}</dd>
          </div>
        </dl>
      ) : overallAvailable ? (
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>Progress Score</dt>
            <dd className="crm-financial-progress-score-emphasis">
              {formatProgressScoreValue(progress.overall.score)}
            </dd>
          </div>
          <div>
            <dt>Grade</dt>
            <dd>{progress.overall.grade ?? '—'}</dd>
          </div>
          <div>
            <dt>Categories Calculated</dt>
            <dd>{formatCategoriesCalculatedCaption(progress)}</dd>
          </div>
          <div>
            <dt>Last Calculated</dt>
            <dd>{formatLastCalculated(progress)}</dd>
          </div>
          <div>
            <dt>Methodology Version</dt>
            <dd>{progress.methodologyVersion}</dd>
          </div>
        </dl>
      ) : (
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>Progress Score</dt>
            <dd>Overall Progress Not Yet Available</dd>
          </div>
          <div>
            <dt>Grade</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Categories Calculated</dt>
            <dd>{formatCategoriesCalculatedCaption(progress)}</dd>
          </div>
          <div>
            <dt>Last Calculated</dt>
            <dd>{formatLastCalculated(progress)}</dd>
          </div>
          <div>
            <dt>Methodology Version</dt>
            <dd>{progress.methodologyVersion}</dd>
          </div>
        </dl>
      )}
    </Panel>
  )
}
