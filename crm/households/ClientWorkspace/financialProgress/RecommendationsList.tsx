import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { Recommendation } from '../../../financial-progress'
import { FINANCIAL_PROGRESS_CATEGORY_LABELS } from '../../../financial-progress'

type RecommendationsListProps = {
  recommendations: Recommendation[]
}

export default function RecommendationsList({ recommendations }: RecommendationsListProps) {
  return (
    <Panel labelledBy="crm-fp-recommendations-heading">
      <SectionHeader
        title="Recommendations"
        titleId="crm-fp-recommendations-heading"
        meta={
          recommendations.length > 0 ? (
            <span className="crm-count-pill">{recommendations.length}</span>
          ) : null
        }
      />

      {recommendations.length === 0 ? (
        <EmptyState title="No recommendations available." />
      ) : (
        <ul className="crm-household-overview-list">
          {recommendations.map((recommendation) => (
            <li key={recommendation.id}>
              <p className="crm-task-title">{recommendation.title}</p>
              <p className="crm-task-meta">
                {FINANCIAL_PROGRESS_CATEGORY_LABELS[recommendation.categoryId]}
                {' · '}
                {recommendation.priority}
              </p>
              <p className="crm-household-activity-body">{recommendation.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
