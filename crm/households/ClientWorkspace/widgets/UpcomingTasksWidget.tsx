import EmptyState from '../../../components/ui/EmptyState'
import Widget from '../../../components/ui/Widget'
import type { CrmHouseholdWorkspace } from '../../types'
import { formatWorkspaceDate } from '../format'
import type { ClientWorkspaceTabId } from '../types'

type Props = {
  workspace: CrmHouseholdWorkspace
  onNavigateTab: (tab: ClientWorkspaceTabId) => void
}

export default function UpcomingTasksWidget({ workspace, onNavigateTab }: Props) {
  const tasks = workspace.openTasks

  return (
    <Widget
      title="Upcoming Tasks"
      titleId="crm-widget-tasks"
      meta={<span className="crm-count-pill">{tasks.length}</span>}
      actions={
        <button type="button" className="crm-text-btn" onClick={() => onNavigateTab('tasks')}>
          View tasks
        </button>
      }
    >
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks"
          description="Open tasks for this household will show up here."
          action={
            <button
              type="button"
              className="crm-secondary-btn"
              onClick={() => onNavigateTab('tasks')}
            >
              View Tasks
            </button>
          }
        />
      ) : (
        <ul className="crm-household-overview-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <p className="crm-task-title">{task.title}</p>
              <p className="crm-task-meta">
                {task.status.replace(/_/g, ' ')}
                {' · '}
                {task.priority}
                {' · '}
                {task.due_date ? `Due ${formatWorkspaceDate(task.due_date)}` : 'No due date'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  )
}
