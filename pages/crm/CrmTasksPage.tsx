import { useEffect, useState, type FormEvent } from 'react'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import {
  createTask,
  fetchAssigneeOptions,
  fetchHouseholdOptions,
  fetchLeadOptions,
  fetchOpportunityOptions,
  fetchVisibleTasks,
  formatSupabaseError,
} from '../../crm/tasks/tasksApi'
import type {
  AssigneeOption,
  CreateTaskInput,
  CrmTask,
  HouseholdOption,
  LeadOption,
  OpportunityOption,
  TaskPriority,
} from '../../crm/tasks/types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

const EMPTY_FORM: CreateTaskInput & { lead_id: string } = {
  title: '',
  description: '',
  due_date: '',
  priority: 'medium',
  assigned_user_id: null,
  household_id: '',
  opportunity_id: null,
  lead_id: '',
}

function formatDueDate(value: string | null): string {
  if (!value) return 'No due date'
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function priorityLabel(priority: TaskPriority): string {
  return priority.replace('_', ' ')
}

export default function CrmTasksPage() {
  const { profile, role } = useCrmAuth()
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [households, setHouseholds] = useState<HouseholdOption[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([])
  const [assignees, setAssignees] = useState<AssigneeOption[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formWarning, setFormWarning] = useState<string | null>(null)
  const [opportunityWarning, setOpportunityWarning] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadTasks() {
    const supabase = createSupabaseBrowserClient()
    const rows = await fetchVisibleTasks(supabase)
    setTasks(rows)
  }

  async function loadFormOptions() {
    if (!profile || !role) return
    const supabase = createSupabaseBrowserClient()
    setFormLoading(true)
    setOptionsError(null)
    setSubmitError(null)
    setFormWarning(null)

    const [householdResult, assigneeResult, leadResult] = await Promise.allSettled([
      fetchHouseholdOptions(supabase),
      fetchAssigneeOptions(supabase, role, profile.id),
      fetchLeadOptions(supabase),
    ])

    const hardFailures: string[] = []
    const softFailures: string[] = []

    if (householdResult.status === 'fulfilled') {
      setHouseholds(householdResult.value)
    } else {
      setHouseholds([])
      const message = formatSupabaseError('households', householdResult.reason)
      hardFailures.push(message)
      if (import.meta.env.DEV) console.error('[crm/tasks] households', householdResult.reason)
    }

    if (assigneeResult.status === 'fulfilled') {
      setAssignees(assigneeResult.value)
      setForm((prev) => ({
        ...prev,
        assigned_user_id: prev.assigned_user_id ?? profile.id,
      }))
    } else {
      setAssignees([])
      const message = formatSupabaseError('assignees', assigneeResult.reason)
      hardFailures.push(message)
      if (import.meta.env.DEV) console.error('[crm/tasks] assignees', assigneeResult.reason)
    }

    if (leadResult.status === 'fulfilled') {
      setLeads(leadResult.value)
    } else {
      setLeads([])
      const message = formatSupabaseError('leads', leadResult.reason)
      softFailures.push(message)
      if (import.meta.env.DEV) console.error('[crm/tasks] leads', leadResult.reason)
    }

    if (hardFailures.length > 0) {
      setOptionsError(hardFailures.join('\n'))
    }
    if (softFailures.length > 0) {
      setFormWarning(
        `Optional link data unavailable (form still usable):\n${softFailures.join('\n')}`,
      )
    }

    setFormLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        await loadTasks()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load tasks.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showForm) return
    void loadFormOptions()
  }, [showForm, profile?.id, role])

  useEffect(() => {
    if (!form.household_id) {
      setOpportunities([])
      setOpportunityWarning(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchOpportunityOptions(supabase, form.household_id)
        if (!cancelled) {
          setOpportunities(rows)
          setOpportunityWarning(null)
        }
      } catch (err) {
        if (!cancelled) {
          setOpportunities([])
          const message = formatSupabaseError('opportunities', err)
          if (import.meta.env.DEV) console.error('[crm/tasks] opportunities', err)
          setOpportunityWarning(
            `Optional link data unavailable (form still usable):\n${message}`,
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form.household_id])

  function openForm() {
    setSuccess(null)
    setOptionsError(null)
    setSubmitError(null)
    setFormWarning(null)
    setOpportunityWarning(null)
    setForm({
      ...EMPTY_FORM,
      assigned_user_id: profile?.id ?? null,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setOptionsError(null)
    setSubmitError(null)
    setFormWarning(null)
    setOpportunityWarning(null)
  }

  function onLeadChange(leadId: string) {
    const lead = leads.find((row) => row.id === leadId)
    setForm((prev) => ({
      ...prev,
      lead_id: leadId,
      household_id: lead?.household_id ?? prev.household_id,
      opportunity_id: null,
    }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile) return

    const title = form.title.trim()
    if (!title) {
      setSubmitError('Title is required.')
      return
    }
    if (!form.household_id) {
      setSubmitError('Household is required (tasks are always scoped to a household).')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    setSuccess(null)
    try {
      const supabase = createSupabaseBrowserClient()
      await createTask(
        supabase,
        {
          title,
          description: form.description,
          due_date: form.due_date || null,
          priority: form.priority,
          assigned_user_id: form.assigned_user_id,
          household_id: form.household_id,
          opportunity_id: form.opportunity_id,
        },
        profile.id,
      )
      await loadTasks()
      setSuccess('Task created.')
      setShowForm(false)
      setForm({
        ...EMPTY_FORM,
        assigned_user_id: profile.id,
      })
    } catch (err) {
      setSubmitError(formatSupabaseError('create_task', err))
      if (import.meta.env.DEV) console.error('[crm/tasks] create_task', err)
    } finally {
      setSubmitting(false)
    }
  }

  const requiredOptionsReady = !optionsError && !formLoading

  return (
    <div className="crm-tasks-page">
      <header className="crm-page-header crm-tasks-header">
        <div>
          <p className="crm-page-eyebrow">Work queue</p>
          <h1 className="crm-page-title">Tasks</h1>
          <p className="crm-page-subtitle">
            Open and in-progress tasks you can access. Owners see household-wide work; advisors see
            tasks for households they can access.
          </p>
        </div>
        <button type="button" className="crm-primary-btn" onClick={openForm}>
          Add Task
        </button>
      </header>

      {success ? <p className="crm-banner crm-banner-success">{success}</p> : null}
      {error ? <p className="crm-banner crm-banner-error">{error}</p> : null}

      {showForm ? (
        <section className="crm-panel crm-task-form-panel" aria-labelledby="crm-add-task-heading">
          <div className="crm-panel-head">
            <h2 id="crm-add-task-heading">Add Task</h2>
            <button type="button" className="crm-text-btn" onClick={closeForm} disabled={submitting}>
              Cancel
            </button>
          </div>

          {formLoading ? <p className="crm-muted">Loading form options…</p> : null}
          {optionsError ? (
            <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }}>
              {optionsError}
            </p>
          ) : null}
          {submitError ? (
            <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }}>
              {submitError}
            </p>
          ) : null}
          {formWarning ? (
            <p className="crm-banner crm-banner-warning" style={{ whiteSpace: 'pre-wrap' }}>
              {formWarning}
            </p>
          ) : null}
          {opportunityWarning ? (
            <p className="crm-banner crm-banner-warning" style={{ whiteSpace: 'pre-wrap' }}>
              {opportunityWarning}
            </p>
          ) : null}

          <form className="crm-task-form" onSubmit={onSubmit}>
            <label className="crm-field">
              Title
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
                maxLength={200}
                placeholder="Follow up on coverage review"
                disabled={submitting}
              />
            </label>

            <label className="crm-field">
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Optional notes"
                disabled={submitting}
              />
            </label>

            <div className="crm-form-grid">
              <label className="crm-field">
                Due date
                <input
                  type="date"
                  value={form.due_date ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  disabled={submitting}
                />
              </label>

              <label className="crm-field">
                Priority
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))
                  }
                  disabled={submitting}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabel(priority)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-field">
                Assigned user
                <select
                  value={form.assigned_user_id ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      assigned_user_id: e.target.value || null,
                    }))
                  }
                  disabled={submitting || assignees.length === 0}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email}
                      {user.role ? ` (${user.role})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="crm-form-grid">
              <label className="crm-field">
                Household
                <select
                  value={form.household_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      household_id: e.target.value,
                      opportunity_id: null,
                      lead_id: '',
                    }))
                  }
                  required
                  disabled={submitting}
                >
                  <option value="">Select household…</option>
                  {households.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.display_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="crm-field">
                Link lead (optional)
                <select
                  value={form.lead_id}
                  onChange={(e) => onLeadChange(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">None</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.label}
                    </option>
                  ))}
                </select>
                <span className="crm-field-hint">
                  Sets the household only — tasks have no lead_id column.
                </span>
              </label>

              <label className="crm-field">
                Opportunity (optional)
                <select
                  value={form.opportunity_id ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      opportunity_id: e.target.value || null,
                    }))
                  }
                  disabled={submitting || !form.household_id}
                >
                  <option value="">None</option>
                  {opportunities.map((opportunity) => (
                    <option key={opportunity.id} value={opportunity.id}>
                      {opportunity.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="crm-form-actions">
              <button
                type="submit"
                className="crm-primary-btn"
                disabled={submitting || formLoading || !requiredOptionsReady}
              >
                {submitting ? 'Saving…' : 'Create task'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="crm-panel">
        <div className="crm-panel-head">
          <h2>Open tasks</h2>
          <span className="crm-count-pill">{loading ? '…' : `${tasks.length}`}</span>
        </div>

        {loading ? <p className="crm-muted">Loading tasks…</p> : null}

        {!loading && !error && tasks.length === 0 ? (
          <div className="crm-empty-state">
            <p>No open tasks yet.</p>
            <button type="button" className="crm-primary-btn" onClick={openForm}>
              Add your first task
            </button>
          </div>
        ) : null}

        {!loading && tasks.length > 0 ? (
          <ul className="crm-task-list">
            {tasks.map((task) => (
              <li key={task.id} className="crm-task-row">
                <div className="crm-task-row-main">
                  <p className="crm-task-title">{task.title}</p>
                  <p className="crm-task-meta">
                    {task.household?.display_name ?? 'Household'}
                    {' · '}
                    {task.assignee?.full_name || task.assignee?.email || 'Unassigned'}
                    {' · '}
                    {formatDueDate(task.due_date)}
                  </p>
                  {task.description ? (
                    <p className="crm-task-description">{task.description}</p>
                  ) : null}
                </div>
                <div className="crm-task-row-side">
                  <span className={`crm-priority-chip is-${task.priority}`}>
                    {priorityLabel(task.priority)}
                  </span>
                  <span className="crm-status-chip">{task.status.replace('_', ' ')}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
