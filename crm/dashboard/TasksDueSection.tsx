import { Link } from 'react-router-dom'
import { crmHouseholdPath, ROUTES } from '../../constants/routes'
import { formatDateLabel } from './dates'
import DashboardSection from './DashboardSection'
import type { DashboardTaskItem } from './types'

type Props = {
  dueToday: DashboardTaskItem[]
  overdue: DashboardTaskItem[]
  loading: boolean
  error: string | null
  warning?: string | null
  onRetry: () => void
}

function TaskRows({ tasks, dueLabel }: { tasks: DashboardTaskItem[]; dueLabel: string }) {
  return (
    <ul className="crm-dashboard-task-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link to={crmHouseholdPath(task.household_id)} className="crm-dashboard-task-item">
            <p className="crm-task-title">{task.title}</p>
            <p className="crm-task-meta">
              {task.household_name ?? 'Household'}
              {' · '}
              {dueLabel}
              {task.due_date && dueLabel !== 'Due today' ? ` ${formatDateLabel(task.due_date)}` : ''}
              {' · '}
              {task.priority}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function TasksDueSection({
  dueToday,
  overdue,
  loading,
  error,
  warning = null,
  onRetry,
}: Props) {
  const empty = !loading && !error && dueToday.length === 0 && overdue.length === 0

  return (
    <DashboardSection
      title="Tasks Due"
      actionHref={ROUTES.crmTasks}
      loading={loading}
      error={error}
      warning={warning}
      empty={empty}
      emptyMessage="No tasks due today or overdue."
      onRetry={onRetry}
    >
      {overdue.length > 0 ? (
        <div className="crm-dashboard-task-group">
          <h3 className="crm-dashboard-group-label">Overdue</h3>
          <TaskRows tasks={overdue} dueLabel="Due" />
        </div>
      ) : null}
      {dueToday.length > 0 ? (
        <div className="crm-dashboard-task-group">
          <h3 className="crm-dashboard-group-label">Due today</h3>
          <TaskRows tasks={dueToday} dueLabel="Due today" />
        </div>
      ) : null}
    </DashboardSection>
  )
}
