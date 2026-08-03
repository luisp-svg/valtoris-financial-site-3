import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import DuplicateResolutionConfirmDialog from '../../crm/intake/DuplicateResolutionConfirmDialog'
import IntakeDetailPanel from '../../crm/intake/IntakeDetailPanel'
import {
  fetchCandidateHouseholdSummary,
  fetchCurrentAdvisorProfileId,
  fetchIntakeQueueSafe,
  formatIntakeError,
  resolveDuplicateReview,
  retryPublicFamilyFollowUpTask,
} from '../../crm/intake/intakeApi'
import {
  buildIntakeCounts,
  mapMatchStatusLabel,
  mapSheetsSyncLabel,
  matchesIntakeFilter,
} from '../../crm/intake/intakeFormatters'
import { intakeTaskIndicatorLabel } from '../../crm/intake/intakeTaskAutomation'
import {
  emptyStateCopy,
  getIntakeListPresentation,
  getIntakeListViewState,
  INTAKE_FILTER_OPTIONS,
} from '../../crm/intake/listLoadState'
import type {
  DuplicateResolutionWriteAction,
  IntakeFilterId,
  IntakeHouseholdSummary,
  IntakeQueueItem,
} from '../../crm/intake/types'
import { crmHouseholdPath } from '../../constants/routes'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

function formatSubmittedAt(value: string): string {
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

export default function CrmIntakePage() {
  const { profile, role } = useCrmAuth()
  const [items, setItems] = useState<IntakeQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<IntakeFilterId>('all')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [advisorProfileId, setAdvisorProfileId] = useState<string | null>(null)
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1200 : window.innerWidth,
  )
  const [candidateHousehold, setCandidateHousehold] = useState<IntakeHouseholdSummary | null>(null)
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [candidateError, setCandidateError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<DuplicateResolutionWriteAction | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [resolveSuccess, setResolveSuccess] = useState<{
    action: DuplicateResolutionWriteAction
    resultingHouseholdId: string
    alreadyResolved: boolean
  } | null>(null)
  const resolvingRef = useRef(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [retryingTask, setRetryingTask] = useState(false)
  const [retryTaskMessage, setRetryTaskMessage] = useState<string | null>(null)

  useEffect(() => {
    function onResize() {
      setViewportWidth(window.innerWidth)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        if (profile?.id) {
          const advisorId = await fetchCurrentAdvisorProfileId(supabase, profile.id)
          if (!cancelled) setAdvisorProfileId(advisorId)
        }
        const result = await fetchIntakeQueueSafe(supabase)
        if (cancelled) return
        if (!result.ok) {
          setError(result.error)
          setItems([])
          return
        }
        setItems(result.value)
      } catch (err) {
        if (!cancelled) {
          setError('Unable to load incoming leads. Please try again.')
          if (import.meta.env.DEV) {
            console.error('[crm/intake]', formatIntakeError('intake page', err))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.id, reloadToken])

  const filteredItems = useMemo(
    () => items.filter((item) => matchesIntakeFilter(item, filter, advisorProfileId)),
    [items, filter, advisorProfileId],
  )

  const counts = useMemo(
    () => buildIntakeCounts(items, advisorProfileId),
    [items, advisorProfileId],
  )

  const viewState = getIntakeListViewState({
    loading,
    error,
    totalCount: items.length,
    filteredCount: filteredItems.length,
  })

  const presentation = getIntakeListPresentation(viewportWidth)
  const selectedItem = selectedLeadId
    ? items.find((item) => item.leadId === selectedLeadId) ?? null
    : null

  const candidateHouseholdId = selectedItem?.duplicateReview?.candidateHouseholdId ?? null

  useEffect(() => {
    if (!candidateHouseholdId) {
      setCandidateHousehold(null)
      setCandidateError(null)
      setCandidateLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setCandidateLoading(true)
      setCandidateError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const summary = await fetchCandidateHouseholdSummary(supabase, candidateHouseholdId)
        if (!cancelled) setCandidateHousehold(summary)
      } catch (err) {
        if (!cancelled) {
          setCandidateHousehold(null)
          setCandidateError('Unable to load the candidate household summary.')
          if (import.meta.env.DEV) {
            console.error('[crm/intake]', formatIntakeError('candidate household', err))
          }
        }
      } finally {
        if (!cancelled) setCandidateLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [candidateHouseholdId])

  function selectLead(leadId: string) {
    setSelectedLeadId(leadId)
    setResolveError(null)
    setResolveSuccess(null)
    setPendingAction(null)
    setDialogError(null)
    setRetryTaskMessage(null)
  }

  async function handleRetryFollowUpTask() {
    if (!selectedItem?.diagnostic?.assessmentId || retryingTask || role !== 'owner') return
    setRetryingTask(true)
    setRetryTaskMessage(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await retryPublicFamilyFollowUpTask(supabase, {
        assessmentId: selectedItem.diagnostic.assessmentId,
        matchStatus: selectedItem.ingestMatchStatus,
        duplicateReviewPending: selectedItem.duplicateReview?.status === 'pending',
        leadId: selectedItem.leadId,
        existingTaskId: selectedItem.followUpTask?.taskId ?? null,
        existingTaskSourceType: selectedItem.followUpTask?.sourceType ?? null,
      })
      if (!result.ok) {
        setRetryTaskMessage(result.message)
        return
      }
      setReloadToken((token) => token + 1)
    } catch (err) {
      setRetryTaskMessage('Unable to retry follow-up task. Please try again.')
      if (import.meta.env.DEV) {
        console.error('[crm/intake]', formatIntakeError('follow-up task retry', err))
      }
    } finally {
      setRetryingTask(false)
    }
  }

  async function handleConfirmResolve(notes: string) {
    if (!selectedItem?.duplicateReview?.id || !pendingAction || resolvingRef.current) return
    resolvingRef.current = true
    setResolving(true)
    setDialogError(null)
    setResolveError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const result = await resolveDuplicateReview(supabase, {
        duplicateReviewId: selectedItem.duplicateReview.id,
        action: pendingAction,
        notes,
      })

      if (!result.ok) {
        setDialogError(result.message)
        return
      }

      setResolveSuccess({
        action: result.action,
        resultingHouseholdId: result.resultingHouseholdId,
        alreadyResolved: result.alreadyResolved,
      })
      setPendingAction(null)
      setDialogError(null)
      setReloadToken((token) => token + 1)
    } catch (err) {
      setDialogError('Unable to resolve this duplicate review. Please try again.')
      if (import.meta.env.DEV) {
        console.error('[crm/intake]', formatIntakeError('duplicate resolution', err))
      }
    } finally {
      resolvingRef.current = false
      setResolving(false)
    }
  }

  const emptyCopy = emptyStateCopy(filter)

  return (
    <div className="crm-page crm-intake-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-muted">CRM intake</p>
          <h1>Incoming Leads</h1>
          <p className="crm-page-subtitle">
            Public Family Report Card submissions captured as Initial Financial Diagnostics. These
            are not Household Financial Progress scores.
          </p>
        </div>
      </header>

      <p className="crm-banner crm-banner-warning" role="status">
        Public release remains blocked until the Privacy Policy at /privacy receives legal review.
        The current page describes application behavior and is not attorney-approved legal coverage.
      </p>

      <div className="crm-panel crm-intake-filters" role="toolbar" aria-label="Intake filters">
        {INTAKE_FILTER_OPTIONS.map((option) => {
          const selected = filter === option.id
          return (
            <button
              key={option.id}
              type="button"
              className={`crm-intake-filter-chip${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => setFilter(option.id)}
            >
              <span>{option.label}</span>
              <span className="crm-intake-filter-count">{counts[option.id]}</span>
            </button>
          )
        })}
      </div>

      {viewState.kind === 'loading' ? (
        <p className="crm-muted" role="status">
          Loading incoming leads…
        </p>
      ) : null}

      {viewState.kind === 'error' ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {viewState.message}
        </p>
      ) : null}

      {viewState.kind === 'empty' || viewState.kind === 'filtered_empty' ? (
        <div className="crm-empty-state">
          <h2 className="crm-empty-state-title">{emptyCopy.title}</h2>
          <p>{emptyCopy.body}</p>
          {viewState.kind === 'filtered_empty' ? (
            <button
              type="button"
              className="platform-btn platform-btn-outline"
              onClick={() => setFilter('all')}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {viewState.kind === 'ready' ? (
        presentation === 'table' ? (
          <div className="crm-households-table-wrap crm-intake-table-wrap">
            <table className="crm-households-table crm-intake-table">
              <thead>
                <tr>
                  <th scope="col">Prospect</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Diagnostic</th>
                  <th scope="col">Match</th>
                  <th scope="col">Task</th>
                  <th scope="col">Assignment</th>
                  <th scope="col">Consent</th>
                  <th scope="col">Sheets</th>
                  <th scope="col">Household</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.leadId}
                    className={selectedLeadId === item.leadId ? 'is-selected' : undefined}
                    onClick={() => selectLead(item.leadId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectLead(item.leadId)
                      }
                    }}
                    tabIndex={0}
                    aria-selected={selectedLeadId === item.leadId}
                  >
                    <td>
                      <strong>{item.submittedFullName}</strong>
                      <div className="crm-muted">{item.submittedEmail || 'No email'}</div>
                      <div className="crm-muted">{item.submittedPhone || 'No phone'}</div>
                    </td>
                    <td>{formatSubmittedAt(item.submittedAt)}</td>
                    <td>
                      <div>
                        {item.overallScore ?? '—'}
                        {item.overallGrade ? ` · ${item.overallGrade}` : ''}
                      </div>
                      <div className="crm-muted">Initial Financial Diagnostic</div>
                    </td>
                    <td>
                      <span className="crm-intake-chip">{mapMatchStatusLabel(item.ingestMatchStatus)}</span>
                    </td>
                    <td>
                      {item.taskIndicators
                        .filter((indicator) => indicator !== 'no_contact_permission')
                        .slice(0, 2)
                        .map((indicator) => (
                          <span key={indicator} className="crm-intake-chip">
                            {intakeTaskIndicatorLabel(indicator)}
                          </span>
                        ))}
                      {item.taskIndicators.filter((i) => i !== 'no_contact_permission').length ===
                      0 ? (
                        <span className="crm-muted">—</span>
                      ) : null}
                    </td>
                    <td>{item.assignedAdvisor?.displayName ?? 'Unassigned'}</td>
                    <td>
                      {item.consent.contactPermission ? (
                        <span className="crm-intake-chip is-positive">Contact permitted</span>
                      ) : (
                        <span className="crm-intake-chip is-warning">No contact permission</span>
                      )}
                    </td>
                    <td>{mapSheetsSyncLabel(item.sheetsSyncStatus)}</td>
                    <td>
                      {item.household ? (
                        <Link
                          to={crmHouseholdPath(item.household.id)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {item.household.displayName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="crm-intake-card-list">
            {filteredItems.map((item) => (
              <article
                key={item.leadId}
                className={`crm-panel crm-intake-card${selectedLeadId === item.leadId ? ' is-selected' : ''}`}
              >
                <button
                  type="button"
                  className="crm-intake-card-button"
                  onClick={() => selectLead(item.leadId)}
                >
                  <h2>{item.submittedFullName}</h2>
                  <p className="crm-muted">{formatSubmittedAt(item.submittedAt)}</p>
                  <p>
                    Initial Financial Diagnostic:{' '}
                    <strong>
                      {item.overallScore ?? '—'}
                      {item.overallGrade ? ` · ${item.overallGrade}` : ''}
                    </strong>
                  </p>
                  <p>{mapMatchStatusLabel(item.ingestMatchStatus)}</p>
                  <p>{item.assignedAdvisor?.displayName ?? 'Unassigned'}</p>
                  <p>
                    {item.consent.contactPermission ? 'Contact permitted' : 'No contact permission'}
                  </p>
                  <p>
                    Task:{' '}
                    {item.taskIndicators
                      .filter((indicator) => indicator !== 'no_contact_permission')
                      .map((indicator) => intakeTaskIndicatorLabel(indicator))
                      .join(' · ') || '—'}
                  </p>
                  <p>Sheets: {mapSheetsSyncLabel(item.sheetsSyncStatus)}</p>
                </button>
                {item.household ? (
                  <Link className="crm-intake-card-link" to={crmHouseholdPath(item.household.id)}>
                    Open household
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )
      ) : null}

      {selectedItem ? (
        <IntakeDetailPanel
          item={selectedItem}
          candidateHousehold={candidateHousehold}
          candidateLoading={candidateLoading}
          candidateError={candidateError}
          isOwner={role === 'owner'}
          resolving={resolving}
          resolveError={resolveError}
          resolveSuccess={resolveSuccess}
          retryingTask={retryingTask}
          retryTaskMessage={retryTaskMessage}
          onClose={() => {
            setSelectedLeadId(null)
            setResolveError(null)
            setResolveSuccess(null)
            setPendingAction(null)
            setDialogError(null)
            setRetryTaskMessage(null)
          }}
          onRequestResolve={(action) => {
            setResolveError(null)
            setDialogError(null)
            setPendingAction(action)
          }}
          onRetryFollowUpTask={
            role === 'owner' ? () => void handleRetryFollowUpTask() : undefined
          }
        />
      ) : null}

      {pendingAction && selectedItem ? (
        <DuplicateResolutionConfirmDialog
          action={pendingAction}
          prospectName={selectedItem.submittedFullName}
          candidateName={candidateHousehold?.displayName ?? null}
          submitting={resolving}
          error={dialogError}
          onCancel={() => {
            if (resolving) return
            setPendingAction(null)
            setDialogError(null)
          }}
          onConfirm={handleConfirmResolve}
        />
      ) : null}
    </div>
  )
}
