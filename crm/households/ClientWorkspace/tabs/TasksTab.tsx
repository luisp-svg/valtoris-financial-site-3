import { Link } from 'react-router-dom'
import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { ClientWorkspaceTabProps } from '../types'
import { formatWorkspaceDate } from '../format'

export default function TasksTab({ workspace, householdId }: ClientWorkspaceTabProps) {
  const tasks = workspace.openTasks

  return (
    <div
      id="crm-client-workspace-tab-tasks-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-tasks"
      className="crm-household-workspace-tab-panel"
    >
      <Panel labelledBy="crm-tasks-heading">
        <SectionHeader
          title="Tasks"
          titleId="crm-tasks-heading"
          meta={<span className="crm-count-pill">{tasks.length}</span>}
        />
        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks"
            description="Open tasks for this household will appear here."
          />
        ) : (
          <ul className="crm-household-overview-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <p className="crm-task-title">{task.title}</p>
                <Link to={`/crm/tasks?household=${householdId}&task=${task.id}`}>Open task actions</Link>
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
      </Panel>
    </div>
  )
}
