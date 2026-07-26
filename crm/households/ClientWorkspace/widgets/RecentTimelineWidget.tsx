import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import { formatActivityTypeLabel } from '../../householdsApi'
import type { CrmHouseholdWorkspace } from '../../types'
import { formatWorkspaceDateTime } from '../format'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function RecentTimelineWidget({ workspace, onNavigateTab }: Props) {
  const items = workspace.recentActivities

  return (
    <Widget
      title="Recent Timeline"
      titleId="crm-widget-recent-timeline"
      meta={<span className="crm-count-pill">{items.length}</span>}
      actions={
        <button type="button" className="crm-text-btn" onClick={() => onNavigateTab('timeline')}>
          View timeline
        </button>
      }
      wide
    >
      {items.length === 0 ? (
        <EmptyState
          title="No recent activity"
          description="Timeline events will appear here as advisors work with this household."
          action={
            <button
              type="button"
              className="crm-secondary-btn"
              onClick={() => onNavigateTab('timeline')}
            >
              Open Timeline
            </button>
          }
        />
      ) : (
        <ul className="crm-household-activity-list">
          {items.map((activity) => (
            <li key={activity.id}>
              <div className="crm-household-activity-item">
                <p className="crm-task-title">{activity.title}</p>
                <p className="crm-task-meta">
                  {formatActivityTypeLabel(activity.activity_type)}
                  {' · '}
                  {formatWorkspaceDateTime(activity.occurred_at)}
                </p>
                {activity.body ? (
                  <p className="crm-household-activity-body">{activity.body}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}
