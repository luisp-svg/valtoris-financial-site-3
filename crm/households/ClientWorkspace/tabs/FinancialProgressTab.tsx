import CategoryBreakdown from '../financialProgress/CategoryBreakdown'
import OverallProgressCard from '../financialProgress/OverallProgressCard'
import ProgressSnapshotCard from '../financialProgress/ProgressSnapshotCard'
import RecommendationsList from '../financialProgress/RecommendationsList'
import type { ClientWorkspaceTabProps } from '../types'

export default function FinancialProgressTab({ workspace }: ClientWorkspaceTabProps) {
  const { financialProgress } = workspace

  return (
    <div
      id="crm-client-workspace-tab-financial_progress-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-financial_progress"
      className="crm-household-workspace-tab-panel"
    >
      <OverallProgressCard progress={financialProgress} />
      <CategoryBreakdown categories={financialProgress.categories} />
      <RecommendationsList recommendations={financialProgress.recommendations} />
      <ProgressSnapshotCard progress={financialProgress} />
    </div>
  )
}
