import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import DuplicateResolutionConfirmDialog from '../../crm/intake/DuplicateResolutionConfirmDialog'
import IntakeArchiveConfirmDialog from '../../crm/intake/IntakeArchiveConfirmDialog'
import IntakeAssignAdvisorDialog from '../../crm/intake/IntakeAssignAdvisorDialog'
import IntakeDetailPanel from '../../crm/intake/IntakeDetailPanel'
import { archiveIntakeLead } from '../../crm/intake/intakeArchive'
import {
  INTAKE_ARCHIVE_SUCCESS_COPY,
  INTAKE_ARCHIVE_TASK_COMPLETED_COPY,
  intakeArchiveVisibilityForItem,
} from '../../crm/intake/intakeArchiveUi'
import { assignIntakeHousehold } from '../../crm/intake/intakeAssignment'
import {
  INTAKE_ASSIGN_SUCCESS_COPY,
  intakeAssignVisibilityForItem,
} from '../../crm/intake/intakeAssignmentUi'
import { buildIntakeOpportunityPrefill } from '../../crm/intake/intakeOpportunityPrefill'
import {
  INTAKE_CREATE_OPPORTUNITY_SUCCESS_COPY,
  intakeCreateOpportunityVisibilityForItem,
} from '../../crm/intake/intakeOpportunityUi'
import OpportunityFormDialog from '../../crm/opportunities/OpportunityFormDialog'
import type { OpportunityDetail } from '../../crm/opportunities/types'
import {
  fetchCandidateHouseholdSummary,
  fetchCurrentAdvisorProfileId,
  fetchIntakeQueueSafe,
  formatIntakeError,
  resolveDigitalIdentityDuplicateReview,
  resolveDuplicateReview,
  retryDigitalIdentityFollowUpTask,
  retryPublicFamilyFollowUpTask,
} from '../../crm/intake/intakeApi'
import {
  buildIntakeCounts,
  intakeProductLabel,
  isDigitalIdentityLead,
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
  IntakeArchiveReason,
  IntakeFilterId,
  IntakeHouseholdSummary,
  IntakeQueueItem,
} from '../../crm/intake/types'
import { crmHouseholdPath, crmOpportunityPath } from '../../constants/routes'
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
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveDialogError, setArchiveDialogError] = useState<string | null>(null)
  const [archiveSuccess, setArchiveSuccess] = useState<{
    followUpTaskCompleted: boolean
  } | null>(null)
  const archivingRef = useRef(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignDialogError, setAssignDialogError] = useState<string | null>(null)
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null)
  const assigningRef = useRef(false)
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false)
  const [createdOpportunity, setCreatedOpportunity] = useState<OpportunityDetail | null>(null)

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
    setArchiveDialogOpen(false)
    setArchiveDialogError(null)
    setArchiveSuccess(null)
    setAssignDialogOpen(false)
    setAssignDialogError(null)
    setAssignSuccess(null)
    setShowCreateOpportunity(false)
    setCreatedOpportunity(null)
  }

  async function handleRetryFollowUpTask() {
    if (!selectedItem || retryingTask || role !== 'owner') return
    const isDi = isDigitalIdentityLead(selectedItem)
    if (!isDi && !selectedItem.diagnostic?.assessmentId) return

    setRetryingTask(true)
    setRetryTaskMessage(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = isDi
        ? await retryDigitalIdentityFollowUpTask(supabase, {
            leadId: selectedItem.leadId,
            matchStatus: selectedItem.ingestMatchStatus,
            duplicateReviewPending: selectedItem.duplicateReview?.status === 'pending',
            existingTaskId: selectedItem.followUpTask?.taskId ?? null,
            existingTaskSourceType: selectedItem.followUpTask?.sourceType ?? null,
          })
        : await retryPublicFamilyFollowUpTask(supabase, {
            assessmentId: selectedItem.diagnostic!.assessmentId,
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
      const result = isDigitalIdentityLead(selectedItem)
        ? await resolveDigitalIdentityDuplicateReview(supabase, {
            duplicateReviewId: selectedItem.duplicateReview.id,
            action: pendingAction,
            notes,
          })
        : await resolveDuplicateReview(supabase, {
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

  async function handleConfirmArchive(reason: IntakeArchiveReason) {
    if (!selectedItem || archivingRef.current) return
    archivingRef.current = true
    setArchiving(true)
    setArchiveDialogError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const result = await archiveIntakeLead(supabase, {
        leadId: selectedItem.leadId,
        reason,
      })
      if (!result.ok) {
        setArchiveDialogError(result.message)
        return
      }
      setArchiveSuccess({
        followUpTaskCompleted: result.follow_up_task_completed,
      })
      setArchiveDialogOpen(false)
      setArchiveDialogError(null)
      setReloadToken((token) => token + 1)
    } catch (err) {
      setArchiveDialogError('Unable to archive this Intake. Please try again.')
      if (import.meta.env.DEV) {
        console.error('[crm/intake]', formatIntakeError('intake archive', err))
      }
    } finally {
      archivingRef.current = false
      setArchiving(false)
    }
  }

  async function handleConfirmAssign(advisorId: string, advisorName: string) {
    if (!selectedItem?.household?.id || assigningRef.current) return
    assigningRef.current = true
    setAssigning(true)
    setAssignDialogError(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const result = await assignIntakeHousehold(supabase, {
        householdId: selectedItem.household.id,
        advisorId,
      })
      if (!result.ok) {
        setAssignDialogError(result.message)
        return
      }
      setAssignSuccess(advisorName.trim() ? `${INTAKE_ASSIGN_SUCCESS_COPY} Assigned to ${advisorName}.` : INTAKE_ASSIGN_SUCCESS_COPY)
      setAssignDialogOpen(false)
      setAssignDialogError(null)
      setReloadToken((token) => token + 1)
    } catch (err) {
      setAssignDialogError('Unable to assign this household. Please try again.')
      if (import.meta.env.DEV) {
        console.error('[crm/intake]', formatIntakeError('assign household', err))
      }
    } finally {
      assigningRef.current = false
      setAssigning(false)
    }
  }

  function handleOpportunityCreated(opportunity: OpportunityDetail) {
    setCreatedOpportunity(opportunity)
    setShowCreateOpportunity(false)
    setReloadToken((token) => token + 1)
  }

  const emptyCopy = emptyStateCopy(filter)
  const archiveVisibility = selectedItem
    ? intakeArchiveVisibilityForItem(selectedItem, {
        isOwner: role === 'owner',
        currentAdvisorProfileId: advisorProfileId,
      })
    : { canPresent: false, blockedByDuplicate: false }
  const assignVisibility = selectedItem
    ? intakeAssignVisibilityForItem(selectedItem, { isOwner: role === 'owner' })
    : { canPresent: false, blockedByDuplicate: false }
  const createOpportunityVisibility = selectedItem
    ? intakeCreateOpportunityVisibilityForItem(selectedItem, {
        isOwner: role === 'owner',
        currentAdvisorProfileId: advisorProfileId,
      })
    : { canPresent: false, blockedByDuplicate: false }
  const opportunityPrefill = selectedItem ? buildIntakeOpportunityPrefill(selectedItem) : null

  return (
    <div className="crm-page crm-intake-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-muted">CRM intake</p>
          <h1>Incoming Leads</h1>
          <p className="crm-page-subtitle">
            Public Report Card, Protection Gap, and Digital Identity / Let’s Connect leads. These
            are not Household Financial Progress scores.
          </p>
        </div>
      </header>

      <p className="crm-banner crm-banner-warning" role="status">
        Public release remains blocked until the Privacy Policy at /privacy receives legal review.
        The current page describes application behavior and is not attorney-approved legal coverage.
      </p>

      {archiveSuccess ? (
        <p className="crm-banner crm-banner-success" role="status">
          {INTAKE_ARCHIVE_SUCCESS_COPY}
          {archiveSuccess.followUpTaskCompleted ? ` ${INTAKE_ARCHIVE_TASK_COMPLETED_COPY}` : ''}
        </p>
      ) : null}

      {assignSuccess ? (
        <p className="crm-banner crm-banner-success" role="status">
          {assignSuccess}
        </p>
      ) : null}

      {createdOpportunity ? (
        <p className="crm-banner crm-banner-success" role="status">
          {INTAKE_CREATE_OPPORTUNITY_SUCCESS_COPY}{' '}
          <Link to={crmOpportunityPath(createdOpportunity.id)}>Open Opportunity</Link>
        </p>
      ) : null}

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
                  <th scope="col">Product</th>
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
                      {isDigitalIdentityLead(item) ? (
                        <>
                          <div>Let’s Connect</div>
                          <div className="crm-muted">{intakeProductLabel(item)}</div>
                        </>
                      ) : (
                        <>
                          <div>
                            {item.overallScore ?? '—'}
                            {item.overallGrade ? ` · ${item.overallGrade}` : ''}
                          </div>
                          <div className="crm-muted">{intakeProductLabel(item)}</div>
                        </>
                      )}
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
                    {isDigitalIdentityLead(item) ? (
                      <>
                        {intakeProductLabel(item)}: <strong>Let’s Connect</strong>
                      </>
                    ) : (
                      <>
                        {intakeProductLabel(item)}:{' '}
                        <strong>
                          {item.overallScore ?? '—'}
                          {item.overallGrade ? ` · ${item.overallGrade}` : ''}
                        </strong>
                      </>
                    )}
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
            setArchiveDialogOpen(false)
            setArchiveDialogError(null)
            setAssignDialogOpen(false)
            setAssignDialogError(null)
            setShowCreateOpportunity(false)
          }}
          onRequestResolve={(action) => {
            setResolveError(null)
            setDialogError(null)
            setPendingAction(action)
          }}
          onRetryFollowUpTask={
            role === 'owner' ? () => void handleRetryFollowUpTask() : undefined
          }
          canPresentArchive={archiveVisibility.canPresent}
          archiveBlockedByDuplicate={archiveVisibility.blockedByDuplicate}
          canPresentAssignAdvisor={assignVisibility.canPresent}
          assignBlockedByDuplicate={assignVisibility.blockedByDuplicate}
          canPresentCreateOpportunity={createOpportunityVisibility.canPresent}
          createBlockedByDuplicate={createOpportunityVisibility.blockedByDuplicate}
          onRequestArchive={
            archiveVisibility.canPresent
              ? () => {
                  if (archiveVisibility.blockedByDuplicate || archiving) return
                  setArchiveDialogError(null)
                  setArchiveDialogOpen(true)
                }
              : undefined
          }
          onRequestAssignAdvisor={
            assignVisibility.canPresent
              ? () => {
                  if (assignVisibility.blockedByDuplicate || assigning) return
                  setAssignDialogError(null)
                  setAssignDialogOpen(true)
                }
              : undefined
          }
          onRequestCreateOpportunity={
            createOpportunityVisibility.canPresent
              ? () => {
                  if (createOpportunityVisibility.blockedByDuplicate) return
                  setShowCreateOpportunity(true)
                }
              : undefined
          }
        />
      ) : null}

      {archiveDialogOpen && selectedItem ? (
        <IntakeArchiveConfirmDialog
          prospectName={selectedItem.submittedFullName}
          submitting={archiving}
          error={archiveDialogError}
          onCancel={() => {
            if (archiving) return
            setArchiveDialogOpen(false)
            setArchiveDialogError(null)
          }}
          onConfirm={handleConfirmArchive}
        />
      ) : null}

      {assignDialogOpen && selectedItem?.household ? (
        <IntakeAssignAdvisorDialog
          householdName={selectedItem.household.displayName}
          currentAdvisorName={
            selectedItem.household.assignedAdvisor?.displayName ??
            selectedItem.assignedAdvisor?.displayName ??
            null
          }
          currentAdvisorId={
            selectedItem.household.assignedAdvisor?.id ??
            selectedItem.assignedAdvisor?.id ??
            null
          }
          submitting={assigning}
          error={assignDialogError}
          onCancel={() => {
            if (assigning) return
            setAssignDialogOpen(false)
            setAssignDialogError(null)
          }}
          onConfirm={handleConfirmAssign}
        />
      ) : null}

      {showCreateOpportunity && selectedItem && opportunityPrefill?.householdId ? (
        <div className="crm-intake-dialog-backdrop" role="presentation">
          <div className="crm-intake-opportunity-dialog">
            <OpportunityFormDialog
              mode="create"
              defaultHouseholdId={opportunityPrefill.householdId}
              defaultHouseholdLabel={opportunityPrefill.householdLabel}
              defaultTitle={opportunityPrefill.title}
              defaultServiceVerticalId={opportunityPrefill.serviceVerticalId}
              defaultAssignedAdvisorId={opportunityPrefill.assignedAdvisorId}
              onCancel={() => setShowCreateOpportunity(false)}
              onSaved={handleOpportunityCreated}
            />
          </div>
        </div>
      ) : null}

      {pendingAction && selectedItem ? (
        <DuplicateResolutionConfirmDialog
          action={pendingAction}
          prospectName={selectedItem.submittedFullName}
          candidateName={candidateHousehold?.displayName ?? null}
          submitting={resolving}
          error={dialogError}
          isDigitalIdentity={isDigitalIdentityLead(selectedItem)}
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
