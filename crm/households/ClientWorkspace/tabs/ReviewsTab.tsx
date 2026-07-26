import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { ClientWorkspaceTabProps } from '../types'
import {
  formatWorkspaceDate,
  getLastReviewLabel,
  getNextReviewLabel,
} from '../format'

export default function ReviewsTab({ workspace }: ClientWorkspaceTabProps) {
  const review = workspace.annualReview

  return (
    <div
      id="crm-client-workspace-tab-reviews-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-reviews"
      className="crm-household-workspace-tab-panel"
    >
      <Panel labelledBy="crm-reviews-heading">
        <SectionHeader title="Reviews" titleId="crm-reviews-heading" />
        {!review ? (
          <EmptyState
            title="No reviews on file"
            description="Annual reviews will appear here when scheduled or completed."
          />
        ) : (
          <dl className="crm-client-workspace-info-list">
            <div>
              <dt>Last Review</dt>
              <dd>{getLastReviewLabel(review)}</dd>
            </div>
            <div>
              <dt>Next Review</dt>
              <dd>{getNextReviewLabel(review)}</dd>
            </div>
            <div>
              <dt>Scheduled For</dt>
              <dd>{formatWorkspaceDate(review.scheduled_for)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{formatWorkspaceDate(review.completed_at)}</dd>
            </div>
            <div>
              <dt>Summary</dt>
              <dd>{review.summary?.trim() || '—'}</dd>
            </div>
          </dl>
        )}
      </Panel>
    </div>
  )
}
