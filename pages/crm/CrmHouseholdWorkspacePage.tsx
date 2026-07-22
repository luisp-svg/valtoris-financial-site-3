import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  formatActivityTypeLabel,
  formatSupabaseError,
  fetchHouseholdWorkspace,
  getAdvisorLabel,
  getMemberDisplayName,
  getRelationshipLabel,
  getStageLabel,
  getStatusLabel,
} from '../../crm/households/householdsApi'
import type {
  CrmHouseholdWorkspace,
  HouseholdAssessmentSummary,
} from '../../crm/households/types'
import { ROUTES } from '../../constants/routes'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview', enabled: true },
  { id: 'members', label: 'Members', enabled: false },
  { id: 'tasks', label: 'Tasks', enabled: false },
  { id: 'notes', label: 'Notes', enabled: false },
  { id: 'documents', label: 'Documents', enabled: false },
  { id: 'timeline', label: 'Timeline', enabled: false },
] as const

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatScore(assessment: HouseholdAssessmentSummary): string {
  if (assessment.overall_grade) return assessment.overall_grade
  if (assessment.overall_score != null && !Number.isNaN(assessment.overall_score)) {
    return String(assessment.overall_score)
  }
  return '—'
}

function ActivityEmptyIcon() {
  return (
    <svg
      className="crm-household-activity-empty-icon"
      viewBox="0 0 48 48"
      width="40"
      height="40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.08" />
      <path
        d="M24 12v12l7 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 34h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function CrmHouseholdWorkspacePage() {
  const { householdId } = useParams<{ householdId: string }>()
  const [workspace, setWorkspace] = useState<CrmHouseholdWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!householdId) {
      setLoading(false)
      setNotFound(true)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setNotFound(false)
      try {
        const supabase = createSupabaseBrowserClient()
        const data = await fetchHouseholdWorkspace(supabase, householdId)
        if (cancelled) return
        if (!data) {
          setWorkspace(null)
          setNotFound(true)
          return
        }
        setWorkspace(data)
      } catch (err) {
        if (!cancelled) {
          setError('Unable to load household workspace. Please try again.')
          if (import.meta.env.DEV) {
            console.error(
              '[crm/households/workspace]',
              formatSupabaseError('household_workspace', err),
            )
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [householdId])

  const household = workspace?.household

  return (
    <div className="crm-household-workspace-page">
      <div className="crm-household-workspace-nav">
        <Link to={ROUTES.crmHouseholds} className="crm-text-btn">
          ← Back to households
        </Link>
      </div>

      {loading ? <p className="crm-muted">Loading household workspace…</p> : null}

      {error ? <p className="crm-banner crm-banner-error">{error}</p> : null}

      {!loading && notFound ? (
        <section className="crm-panel">
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">Household not found</p>
            <p>
              This household is unavailable or you do not have access. Return to the households list
              to continue.
            </p>
            <Link to={ROUTES.crmHouseholds} className="crm-text-btn">
              View households
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && !error && household && workspace ? (
        <>
          <header className="crm-household-workspace-header">
            <h1 className="crm-page-title crm-household-workspace-title">
              {household.display_name}
            </h1>
            <div className="crm-household-workspace-chips" aria-label="Household status">
              <span className="crm-status-chip" title="Pipeline stage">
                {getStageLabel(household)}
              </span>
              <span
                className="crm-status-chip crm-status-chip-soft"
                title="Household status"
              >
                {getStatusLabel(household.status)}
              </span>
              <span
                className="crm-status-chip crm-status-chip-soft"
                title="Assigned advisor"
              >
                {getAdvisorLabel(household)}
              </span>
            </div>
          </header>

          <div
            className="crm-household-workspace-tabs"
            role="tablist"
            aria-label="Household workspace sections"
          >
            {WORKSPACE_TABS.map((tab) =>
              tab.enabled ? (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`crm-household-tab-${tab.id}`}
                  aria-selected="true"
                  aria-controls="crm-household-tab-overview-panel"
                  className="crm-household-workspace-tab is-active"
                >
                  {tab.label}
                </button>
              ) : (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`crm-household-tab-${tab.id}`}
                  aria-selected="false"
                  aria-disabled="true"
                  disabled
                  className="crm-household-workspace-tab is-disabled"
                  title="Coming soon"
                >
                  {tab.label}
                </button>
              ),
            )}
          </div>

          <div
            id="crm-household-tab-overview-panel"
            role="tabpanel"
            aria-labelledby="crm-household-tab-overview"
            className="crm-household-workspace-tab-panel"
          >
            <section aria-labelledby="crm-household-overview-heading">
              <div className="crm-panel-head crm-household-overview-head">
                <h2 id="crm-household-overview-heading">Overview</h2>
              </div>
              <div className="crm-household-overview-grid">
                <article className="crm-panel crm-household-overview-card">
                  <h3>Open Tasks</h3>
                  <p className="crm-household-overview-metric">{workspace.openTasks.length}</p>
                  {workspace.openTasks.length === 0 ? (
                    <p className="crm-household-overview-caption">No open tasks.</p>
                  ) : (
                    <ul className="crm-household-overview-list">
                      {workspace.openTasks.map((task) => (
                        <li key={task.id}>
                          <p className="crm-task-title">{task.title}</p>
                          <p className="crm-task-meta">
                            {task.status.replace(/_/g, ' ')}
                            {' · '}
                            {task.priority}
                            {' · '}
                            {task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="crm-panel crm-household-overview-card">
                  <h3>Open Opportunities</h3>
                  <p className="crm-household-overview-metric">
                    {workspace.openOpportunities.length}
                  </p>
                  {workspace.openOpportunities.length === 0 ? (
                    <p className="crm-household-overview-caption">No open opportunities.</p>
                  ) : (
                    <ul className="crm-household-overview-list">
                      {workspace.openOpportunities.map((opportunity) => (
                        <li key={opportunity.id}>
                          <p className="crm-task-title">{opportunity.title}</p>
                          <p className="crm-task-meta">
                            {opportunity.stage?.name ?? 'Stage unavailable'}
                            {opportunity.next_action ? ` · ${opportunity.next_action}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="crm-panel crm-household-overview-card">
                  <h3>Family Report Card</h3>
                  {workspace.familyAssessment ? (
                    <>
                      <p className="crm-household-overview-metric">
                        {formatScore(workspace.familyAssessment)}
                      </p>
                      <p className="crm-household-overview-caption">
                        Completed {formatDate(workspace.familyAssessment.completed_at)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="crm-household-overview-metric crm-household-overview-metric-empty">
                        —
                      </p>
                      <p className="crm-household-overview-caption">
                        No family report card on file yet.
                      </p>
                    </>
                  )}
                </article>

                <article className="crm-panel crm-household-overview-card">
                  <h3>Business Report Card</h3>
                  {workspace.businessAssessment ? (
                    <>
                      <p className="crm-household-overview-metric">
                        {formatScore(workspace.businessAssessment)}
                      </p>
                      <p className="crm-household-overview-caption">
                        Completed {formatDate(workspace.businessAssessment.completed_at)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="crm-household-overview-metric crm-household-overview-metric-empty">
                        —
                      </p>
                      <p className="crm-household-overview-caption">
                        No business report card on file yet.
                      </p>
                    </>
                  )}
                </article>

                <article className="crm-panel crm-household-overview-card">
                  <h3>Protection Review</h3>
                  {workspace.protectionAssessment ? (
                    <>
                      <p className="crm-household-overview-metric">
                        {formatScore(workspace.protectionAssessment)}
                      </p>
                      <p className="crm-household-overview-caption">
                        Completed {formatDate(workspace.protectionAssessment.completed_at)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="crm-household-overview-metric crm-household-overview-metric-empty">
                        —
                      </p>
                      <p className="crm-household-overview-caption">
                        No protection review on file yet.
                      </p>
                    </>
                  )}
                </article>

                <article className="crm-panel crm-household-overview-card">
                  <h3>Annual Review</h3>
                  {workspace.annualReview ? (
                    <>
                      <p className="crm-household-overview-metric">
                        {workspace.annualReview.completed_at
                          ? formatDate(workspace.annualReview.completed_at)
                          : workspace.annualReview.scheduled_for
                            ? formatDate(workspace.annualReview.scheduled_for)
                            : 'On file'}
                      </p>
                      <p className="crm-household-overview-caption">
                        {workspace.annualReview.summary?.trim() ||
                          (workspace.annualReview.completed_at
                            ? 'Completed annual review'
                            : workspace.annualReview.scheduled_for
                              ? 'Scheduled annual review'
                              : 'Annual review on file')}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="crm-household-overview-metric crm-household-overview-metric-empty">
                        —
                      </p>
                      <p className="crm-household-overview-caption">
                        No annual review scheduled or completed yet.
                      </p>
                    </>
                  )}
                </article>
              </div>
            </section>

            <section className="crm-panel" aria-labelledby="crm-household-members-heading">
              <div className="crm-panel-head">
                <h2 id="crm-household-members-heading">Members</h2>
                <span className="crm-count-pill">{household.members.length}</span>
              </div>

              {household.members.length === 0 ? (
                <div className="crm-empty-state crm-household-members-empty">
                  <p className="crm-empty-state-title">No household members yet.</p>
                  <button type="button" className="crm-secondary-btn" disabled>
                    + Add Member
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="crm-household-members-table-wrap"
                    role="region"
                    aria-label="Household members table"
                  >
                    <table className="crm-household-members-table">
                      <thead>
                        <tr>
                          <th scope="col">Name</th>
                          <th scope="col">Relationship</th>
                          <th scope="col">Primary contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {household.members.map((member) => (
                          <tr key={member.id}>
                            <td>
                              <span className="crm-households-name">
                                {getMemberDisplayName(member)}
                              </span>
                            </td>
                            <td>{getRelationshipLabel(member.relationship)}</td>
                            <td>
                              {member.is_primary_contact ? (
                                <span className="crm-status-chip">Primary</span>
                              ) : (
                                <span className="crm-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="crm-household-members-card-list">
                    {household.members.map((member) => (
                      <li key={member.id} className="crm-household-members-card">
                        <p className="crm-households-name">{getMemberDisplayName(member)}</p>
                        <dl className="crm-households-card-meta">
                          <div>
                            <dt>Relationship</dt>
                            <dd>{getRelationshipLabel(member.relationship)}</dd>
                          </div>
                          <div>
                            <dt>Primary</dt>
                            <dd>
                              {member.is_primary_contact ? (
                                <span className="crm-status-chip">Primary contact</span>
                              ) : (
                                'No'
                              )}
                            </dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="crm-panel" aria-labelledby="crm-household-activity-heading">
              <div className="crm-panel-head">
                <h2 id="crm-household-activity-heading">Recent Activity</h2>
                <span className="crm-count-pill">{workspace.recentActivities.length}</span>
              </div>

              {workspace.recentActivities.length === 0 ? (
                <div className="crm-empty-state crm-household-activity-empty">
                  <ActivityEmptyIcon />
                  <p className="crm-empty-state-title">No recent activity</p>
                  <p>
                    Future activity will appear here as advisors work with this household.
                  </p>
                </div>
              ) : (
                <ul className="crm-household-activity-list">
                  {workspace.recentActivities.map((activity) => (
                    <li key={activity.id}>
                      <div className="crm-household-activity-item">
                        <p className="crm-task-title">{activity.title}</p>
                        <p className="crm-task-meta">
                          {formatActivityTypeLabel(activity.activity_type)}
                          {' · '}
                          {formatDateTime(activity.occurred_at)}
                        </p>
                        {activity.body ? (
                          <p className="crm-household-activity-body">{activity.body}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
