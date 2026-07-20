import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrmAuth } from '../auth/CrmAuthContext'
import { fetchVisibleTasks, localDateString } from '../tasks/tasksApi'
import type { CrmTask } from '../tasks/types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

function formatDueLabel(value: string | null): string {
  if (!value) return 'No due date'
  return 'Due today'
}

export default function CrmTodayTasksCard() {
  const { profile } = useCrmAuth()
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const today = localDateString()
        // Prefer tasks assigned to the signed-in user due today; fall back to all due today.
        let rows = await fetchVisibleTasks(supabase, {
          dueOn: today,
          assignedUserId: profile?.id,
          limit: 8,
        })
        if (rows.length === 0) {
          rows = await fetchVisibleTasks(supabase, { dueOn: today, limit: 8 })
        }
        if (!cancelled) setTasks(rows)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load today’s tasks.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  return (
    <section className="crm-placeholder-panel crm-today-tasks-card">
      <div className="crm-panel-head">
        <h2>Today’s Tasks</h2>
        <Link to="/crm/tasks" className="crm-text-btn">
          View all
        </Link>
      </div>

      {loading ? <p className="crm-muted">Loading today’s tasks…</p> : null}
      {error ? <p className="crm-banner crm-banner-error">{error}</p> : null}

      {!loading && !error && tasks.length === 0 ? (
        <p className="crm-muted">No tasks due today.</p>
      ) : null}

      {!loading && tasks.length > 0 ? (
        <ul className="crm-today-task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <p className="crm-task-title">{task.title}</p>
              <p className="crm-task-meta">
                {task.household?.display_name ?? 'Household'}
                {' · '}
                {formatDueLabel(task.due_date)}
                {' · '}
                {task.priority}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
