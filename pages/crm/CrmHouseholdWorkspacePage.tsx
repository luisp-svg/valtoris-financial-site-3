import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import HouseholdActivityPanel from '../../crm/households/HouseholdActivityPanel'
import HouseholdMemberFormPanel from '../../crm/households/HouseholdMemberFormPanel'
import { WORKSPACE_TABS, type WorkspaceTabId } from '../../crm/households/activityTabConfig'
import {
  formatActivityTypeLabel,
  formatSupabaseError,
  fetchHouseholdWorkspace,
  getAdvisorLabel,
  getMemberDisplayName,
  getRelationshipLabel,
  getStageLabel,
  getStatusLabel,
  softDeleteHouseholdMember,
} from '../../crm/households/householdsApi'
import type {
  CrmHouseholdWorkspace,
  HouseholdAssessmentSummary,
  HouseholdMemberSummary,
} from '../../crm/households/types'
import { ROUTES, crmOpportunityPath } from '../../constants/routes'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

type MemberFormState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; member: HouseholdMemberSummary }

type DeleteConfirmState = HouseholdMemberSummary | null

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

function displayOptional(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
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

function PrimaryContactBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="crm-status-chip" title="Primary contact">
      {compact ? 'Primary' : 'Primary contact'}
    </span>
  )
}

type MembersTableProps = {
  members: HouseholdMemberSummary[]
  showActions?: boolean
  onEdit?: (member: HouseholdMemberSummary) => void
  onDelete?: (member: HouseholdMemberSummary) => void
  dense?: boolean
}

function MembersTable({
  members,
  showActions = false,
  onEdit,
  onDelete,
  dense = false,
}: MembersTableProps) {
  return (
    <>
      <div
        className="crm-household-members-table-wrap"
        role="region"
        aria-label="Household members table"
      >
        <table className={`crm-household-members-table${dense ? ' is-dense' : ''}`}>
          <thead>
            <tr>
              {dense ? (
                <>
                  <th scope="col">Name</th>
                  <th scope="col">Relationship</th>
                  <th scope="col">Primary contact</th>
                </>
              ) : (
                <>
                  <th scope="col">First Name</th>
                  <th scope="col">Last Name</th>
                  <th scope="col">Relationship</th>
                  <th scope="col">Primary Contact</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Date of Birth</th>
                  {showActions ? <th scope="col">Actions</th> : null}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                {dense ? (
                  <>
                    <td>
                      <span className="crm-households-name">
                        {getMemberDisplayName(member)}
                      </span>
                    </td>
                    <td>{getRelationshipLabel(member.relationship)}</td>
                    <td>
                      {member.is_primary_contact ? (
                        <PrimaryContactBadge compact />
                      ) : (
                        <span className="crm-muted">—</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td>
                      <span className="crm-households-name">{member.first_name}</span>
                    </td>
                    <td>
                      <span className="crm-households-name">{member.last_name}</span>
                    </td>
                    <td>{getRelationshipLabel(member.relationship)}</td>
                    <td>
                      {member.is_primary_contact ? (
                        <PrimaryContactBadge />
                      ) : (
                        <span className="crm-muted">No</span>
                      )}
                    </td>
                    <td>{displayOptional(member.email)}</td>
                    <td>{displayOptional(member.phone)}</td>
                    <td>{formatDate(member.date_of_birth)}</td>
                    {showActions ? (
                      <td>
                        <div className="crm-member-row-actions">
                          <button
                            type="button"
                            className="crm-text-btn"
                            onClick={() => onEdit?.(member)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="crm-text-btn crm-text-btn-danger"
                            onClick={() => onDelete?.(member)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="crm-household-members-card-list">
        {members.map((member) => (
          <li key={member.id} className="crm-household-members-card">
            {dense ? (
              <>
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
                        <PrimaryContactBadge />
                      ) : (
                        'No'
                      )}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="crm-households-name">{getMemberDisplayName(member)}</p>
                <dl className="crm-households-card-meta crm-household-members-card-meta-full">
                  <div>
                    <dt>First Name</dt>
                    <dd>{member.first_name}</dd>
                  </div>
                  <div>
                    <dt>Last Name</dt>
                    <dd>{member.last_name}</dd>
                  </div>
                  <div>
                    <dt>Relationship</dt>
                    <dd>{getRelationshipLabel(member.relationship)}</dd>
                  </div>
                  <div>
                    <dt>Primary Contact</dt>
                    <dd>
                      {member.is_primary_contact ? <PrimaryContactBadge /> : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{displayOptional(member.email)}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{displayOptional(member.phone)}</dd>
                  </div>
                  <div>
                    <dt>Date of Birth</dt>
                    <dd>{formatDate(member.date_of_birth)}</dd>
                  </div>
                </dl>
                {showActions ? (
                  <div className="crm-member-row-actions">
                    <button
                      type="button"
                      className="crm-text-btn"
                      onClick={() => onEdit?.(member)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="crm-text-btn crm-text-btn-danger"
                      onClick={() => onDelete?.(member)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

export default function CrmHouseholdWorkspacePage() {
  const { householdId } = useParams<{ householdId: string }>()
  const { profile } = useCrmAuth()
  const addMemberButtonRef = useRef<HTMLButtonElement>(null)
  const deleteHeadingId = useId()

  const [workspace, setWorkspace] = useState<CrmHouseholdWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('overview')
  const [memberForm, setMemberForm] = useState<MemberFormState>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const loadWorkspace = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient()
    const data = await fetchHouseholdWorkspace(supabase, id)
    return data
  }, [])

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
        const data = await loadWorkspace(householdId)
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
  }, [householdId, loadWorkspace])

  const household = workspace?.household
  const members = household?.members ?? []
  const hasPrimary = members.some((member) => member.is_primary_contact)

  function openCreateMemberForm() {
    setDeleteConfirm(null)
    setDeleteError(null)
    setActionSuccess(null)
    setActiveTab('members')
    setMemberForm({ open: true, mode: 'create' })
  }

  function openEditMemberForm(member: HouseholdMemberSummary) {
    setDeleteConfirm(null)
    setDeleteError(null)
    setActionSuccess(null)
    setActiveTab('members')
    setMemberForm({ open: true, mode: 'edit', member })
  }

  function closeMemberForm() {
    setMemberForm({ open: false })
    queueMicrotask(() => addMemberButtonRef.current?.focus())
  }

  async function refreshWorkspaceFromDb(options?: { clearSuccess?: boolean }) {
    if (!householdId) return
    const data = await loadWorkspace(householdId)
    if (!data) {
      setWorkspace(null)
      setNotFound(true)
      return
    }
    setWorkspace(data)
    if (options?.clearSuccess) setActionSuccess(null)
  }

  async function refreshAfterMutation(successMessage: string) {
    await refreshWorkspaceFromDb()
    setActionSuccess(successMessage)
  }

  async function onMemberSaved(mode: 'create' | 'edit') {
    closeMemberForm()
    try {
      await refreshAfterMutation(mode === 'edit' ? 'Member updated.' : 'Member added.')
    } catch (err) {
      setError('Member saved, but the workspace could not be refreshed. Reload the page.')
      if (import.meta.env.DEV) {
        console.error('[crm/households/workspace]', formatSupabaseError('refresh_after_save', err))
      }
    }
  }

  async function onMemberSaveFailed() {
    try {
      await refreshWorkspaceFromDb({ clearSuccess: true })
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error(
          '[crm/households/workspace]',
          formatSupabaseError('refresh_after_failed_save', err),
        )
      }
    }
  }

  function requestDelete(member: HouseholdMemberSummary) {
    setMemberForm({ open: false })
    setDeleteError(null)
    setActionSuccess(null)
    setDeleteConfirm(member)
  }

  function cancelDelete() {
    setDeleteConfirm(null)
    setDeleteError(null)
    queueMicrotask(() => addMemberButtonRef.current?.focus())
  }

  async function confirmDelete() {
    if (!deleteConfirm || !householdId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      await softDeleteHouseholdMember(supabase, deleteConfirm.id, householdId)
      setDeleteConfirm(null)
      await refreshAfterMutation('Member deleted.')
    } catch (err) {
      setDeleteError(formatSupabaseError('delete_member', err))
      try {
        await refreshWorkspaceFromDb({ clearSuccess: true })
      } catch (reloadError) {
        if (import.meta.env.DEV) {
          console.error(
            '[crm/households/workspace]',
            formatSupabaseError('refresh_after_failed_delete', reloadError),
          )
        }
      }
    } finally {
      setDeleting(false)
    }
  }

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
                  aria-selected={activeTab === tab.id}
                  aria-controls={`crm-household-tab-${tab.id}-panel`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  className={`crm-household-workspace-tab${activeTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => {
                    setActionSuccess(null)
                    setActiveTab(tab.id as WorkspaceTabId)
                  }}
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

          {actionSuccess && activeTab === 'members' ? (
            <p className="crm-banner crm-banner-success">{actionSuccess}</p>
          ) : null}

          {activeTab === 'overview' ? (
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
                            <p className="crm-task-title">
                              <Link
                                to={crmOpportunityPath(opportunity.id)}
                                className="crm-opportunities-name-link"
                              >
                                {opportunity.title}
                              </Link>
                            </p>
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
                  <span className="crm-count-pill">{members.length}</span>
                </div>

                {members.length === 0 ? (
                  <div className="crm-empty-state crm-household-members-empty">
                    <p className="crm-empty-state-title">No household members yet.</p>
                    <button
                      type="button"
                      className="crm-secondary-btn"
                      onClick={openCreateMemberForm}
                    >
                      + Add Member
                    </button>
                  </div>
                ) : (
                  <>
                    <MembersTable members={members} dense />
                    <div className="crm-member-preview-actions">
                      <button
                        type="button"
                        className="crm-secondary-btn"
                        onClick={openCreateMemberForm}
                      >
                        + Add Member
                      </button>
                    </div>
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
          ) : null}

          {activeTab === 'members' ? (
            <div
              id="crm-household-tab-members-panel"
              role="tabpanel"
              aria-labelledby="crm-household-tab-members"
              className="crm-household-workspace-tab-panel"
            >
              {memberForm.open ? (
                <HouseholdMemberFormPanel
                  key={
                    memberForm.mode === 'edit'
                      ? `edit-${memberForm.member.id}`
                      : 'create'
                  }
                  mode={memberForm.mode}
                  householdId={household.id}
                  member={memberForm.mode === 'edit' ? memberForm.member : null}
                  defaultPrimary={members.length === 0 || !hasPrimary}
                  onCancel={closeMemberForm}
                  onSaved={() => void onMemberSaved(memberForm.mode)}
                  onSaveFailed={() => onMemberSaveFailed()}
                />
              ) : null}

              {deleteConfirm ? (
                <section
                  className="crm-panel crm-member-delete-panel"
                  aria-labelledby={deleteHeadingId}
                >
                  <div className="crm-panel-head">
                    <h2 id={deleteHeadingId}>Delete member</h2>
                    <button
                      type="button"
                      className="crm-text-btn"
                      onClick={cancelDelete}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="crm-muted">
                    Soft-delete{' '}
                    <strong>{getMemberDisplayName(deleteConfirm)}</strong> from this household?
                    This removes them from active lists. Related policies keep their historical
                    member references when possible.
                  </p>
                  {deleteConfirm.is_primary_contact ? (
                    <p className="crm-banner crm-banner-warning">
                      This member is the primary contact. Deleting them leaves the household with
                      no primary contact until you assign another member.
                    </p>
                  ) : null}
                  {deleteError ? (
                    <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }}>
                      {deleteError}
                    </p>
                  ) : null}
                  <div className="crm-form-actions">
                    <button
                      type="button"
                      className="crm-primary-btn crm-danger-btn"
                      onClick={() => void confirmDelete()}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting…' : 'Confirm delete'}
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="crm-panel" aria-labelledby="crm-members-tab-heading">
                <div className="crm-panel-head">
                  <h2 id="crm-members-tab-heading">Members</h2>
                  <div className="crm-members-tab-head-actions">
                    <span className="crm-count-pill">{members.length}</span>
                    {!memberForm.open && !deleteConfirm ? (
                      <button
                        ref={addMemberButtonRef}
                        type="button"
                        className="crm-primary-btn crm-members-add-btn"
                        onClick={openCreateMemberForm}
                      >
                        + Add Member
                      </button>
                    ) : null}
                  </div>
                </div>

                {members.length === 0 && !memberForm.open ? (
                  <div className="crm-empty-state crm-household-members-empty">
                    <p className="crm-empty-state-title">No household members yet.</p>
                    <p>Add the first household member to track contacts and relationships.</p>
                    <button
                      ref={addMemberButtonRef}
                      type="button"
                      className="crm-secondary-btn"
                      onClick={openCreateMemberForm}
                    >
                      + Add Member
                    </button>
                  </div>
                ) : members.length > 0 ? (
                  <MembersTable
                    members={members}
                    showActions={!memberForm.open && !deleteConfirm}
                    onEdit={openEditMemberForm}
                    onDelete={requestDelete}
                  />
                ) : null}
              </section>
            </div>
          ) : null}

          {activeTab === 'activity' && profile ? (
            <HouseholdActivityPanel
              householdId={household.id}
              authorUserId={profile.id}
              workspace={workspace}
              actionSuccess={actionSuccess}
              onRefreshAfterMutation={async (successMessage) => {
                try {
                  await refreshAfterMutation(successMessage)
                } catch (err) {
                  setError(
                    'Note saved, but the workspace could not be refreshed. Reload the page.',
                  )
                  if (import.meta.env.DEV) {
                    console.error(
                      '[crm/households/workspace]',
                      formatSupabaseError('refresh_after_note_mutation', err),
                    )
                  }
                }
              }}
              onRefreshAfterFailure={async () => {
                try {
                  await refreshWorkspaceFromDb({ clearSuccess: true })
                } catch (err) {
                  if (import.meta.env.DEV) {
                    console.error(
                      '[crm/households/workspace]',
                      formatSupabaseError('refresh_after_note_failure', err),
                    )
                  }
                }
              }}
              onRetryLoad={async () => {
                setActionSuccess(null)
                try {
                  await refreshWorkspaceFromDb({ clearSuccess: true })
                } catch (err) {
                  setError('Unable to reload household workspace. Please try again.')
                  if (import.meta.env.DEV) {
                    console.error(
                      '[crm/households/workspace]',
                      formatSupabaseError('activity_retry', err),
                    )
                  }
                }
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
