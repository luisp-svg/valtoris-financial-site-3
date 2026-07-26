import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCrmAuth } from '../../auth/CrmAuthContext'
import { ROUTES, crmOpportunityPath } from '../../../constants/routes'
import { createSupabaseBrowserClient } from '../../../lib/supabase/client'
import {
  formatSupabaseError,
  softDeleteHouseholdMember,
} from '../householdsApi'
import type { HouseholdMemberSummary } from '../types'
import type { OpportunityDetail } from '../../opportunities/types'
import WorkspaceHeader from './components/WorkspaceHeader'
import WorkspaceSidebar from './components/WorkspaceSidebar'
import WorkspaceTabs from './components/WorkspaceTabs'
import { useHouseholdWorkspace } from './hooks/useHouseholdWorkspace'
import {
  tabIdFromSearchParams,
  withWorkspaceTabParam,
} from './tabConfig'
import CasesTab from './tabs/CasesTab'
import DocumentsTab from './tabs/DocumentsTab'
import FinancialProgressTab from './tabs/FinancialProgressTab'
import HouseholdTab from './tabs/HouseholdTab'
import NotesTab from './tabs/NotesTab'
import OverviewTab from './tabs/OverviewTab'
import PoliciesTab from './tabs/PoliciesTab'
import ReviewsTab from './tabs/ReviewsTab'
import TasksTab from './tabs/TasksTab'
import TimelineTab from './tabs/TimelineTab'
import type { ClientWorkspaceTabId, QuickActionId } from './types'

type MemberFormState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; member: HouseholdMemberSummary }

type ClientWorkspaceProps = {
  householdId: string | undefined
}

/**
 * Advisor Client Workspace shell for a household.
 * Fetches workspace data once and shares it across header, sidebar, and tabs.
 * Active tab is driven by the `?tab=` search param (URL is source of truth).
 */
export default function ClientWorkspace({ householdId }: ClientWorkspaceProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile } = useCrmAuth()
  const addMemberButtonRef = useRef<HTMLButtonElement>(null)
  const { workspace, loading, error, notFound, reload, setError } =
    useHouseholdWorkspace(householdId)

  const activeTab = tabIdFromSearchParams(searchParams)

  const [memberForm, setMemberForm] = useState<MemberFormState>({ open: false })
  const [deleteConfirm, setDeleteConfirm] = useState<HouseholdMemberSummary | null>(null)
  const [deletingMember, setDeletingMember] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false)
  const [focusComposerRequestId, setFocusComposerRequestId] = useState(0)

  const navigateTab = useCallback(
    (tab: ClientWorkspaceTabId) => {
      setActionSuccess(null)
      setSearchParams(withWorkspaceTabParam(searchParams, tab), { replace: false })
    },
    [searchParams, setSearchParams],
  )

  async function refreshWorkspaceFromDb(options?: { clearSuccess?: boolean }) {
    await reload({ clearError: true })
    if (options?.clearSuccess) setActionSuccess(null)
  }

  async function refreshAfterMutation(successMessage: string) {
    await refreshWorkspaceFromDb()
    setActionSuccess(successMessage)
  }

  function openCreateMemberForm() {
    setDeleteConfirm(null)
    setDeleteError(null)
    setActionSuccess(null)
    setShowCreateOpportunity(false)
    navigateTab('household')
    setMemberForm({ open: true, mode: 'create' })
  }

  function openEditMemberForm(member: HouseholdMemberSummary) {
    setDeleteConfirm(null)
    setDeleteError(null)
    setActionSuccess(null)
    navigateTab('household')
    setMemberForm({ open: true, mode: 'edit', member })
  }

  function closeMemberForm() {
    setMemberForm({ open: false })
    queueMicrotask(() => addMemberButtonRef.current?.focus())
  }

  function openCreateOpportunityForm() {
    setDeleteConfirm(null)
    setDeleteError(null)
    setActionSuccess(null)
    setMemberForm({ open: false })
    setShowCreateOpportunity(true)
    navigateTab('overview')
  }

  function handleQuickAction(actionId: QuickActionId) {
    switch (actionId) {
      case 'add_note':
        setFocusComposerRequestId((value) => value + 1)
        navigateTab('notes')
        return
      case 'add_task':
        navigateTab('tasks')
        return
      case 'upload_document':
        navigateTab('documents')
        return
      case 'create_opportunity':
        openCreateOpportunityForm()
        return
      case 'create_case':
      case 'schedule_review':
        return
      default:
        return
    }
  }

  async function onOpportunityCreated(opportunity: OpportunityDetail) {
    setShowCreateOpportunity(false)
    try {
      await refreshWorkspaceFromDb()
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error(
          '[crm/households/workspace]',
          formatSupabaseError('refresh_after_opportunity_create', err),
        )
      }
    }
    navigate(crmOpportunityPath(opportunity.id))
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
    setDeletingMember(true)
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
      setDeletingMember(false)
    }
  }

  const tabProps = workspace
    ? {
        workspace,
        householdId: workspace.household.id,
        onNavigateTab: navigateTab,
      }
    : null

  return (
    <div className="crm-household-workspace-page crm-client-workspace-page">
      <div className="crm-household-workspace-nav">
        <Link to={ROUTES.crmHouseholds} className="crm-text-btn">
          ← Back to households
        </Link>
      </div>

      {loading ? <p className="crm-muted">Loading household workspace…</p> : null}

      {error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {error}
        </p>
      ) : null}

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

      {!loading && !error && workspace && tabProps ? (
        <>
          <WorkspaceHeader workspace={workspace} />

          <div className="crm-client-workspace-layout">
            <WorkspaceSidebar workspace={workspace} onQuickAction={handleQuickAction} />

            <div className="crm-client-workspace-main">
              <WorkspaceTabs activeTab={activeTab} onChange={navigateTab} />

              {activeTab === 'overview' ? (
                <OverviewTab
                  {...tabProps}
                  showCreateOpportunity={showCreateOpportunity}
                  onOpenCreateOpportunity={openCreateOpportunityForm}
                  onCancelCreateOpportunity={() => setShowCreateOpportunity(false)}
                  onOpportunityCreated={(opportunity) => void onOpportunityCreated(opportunity)}
                />
              ) : null}

              {activeTab === 'financial_progress' ? (
                <FinancialProgressTab {...tabProps} />
              ) : null}

              {activeTab === 'cases' ? <CasesTab {...tabProps} /> : null}

              {activeTab === 'policies' ? <PoliciesTab {...tabProps} /> : null}

              {activeTab === 'timeline' && profile ? (
                <TimelineTab
                  {...tabProps}
                  authorUserId={profile.id}
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

              {activeTab === 'tasks' ? <TasksTab {...tabProps} /> : null}

              {activeTab === 'notes' && profile ? (
                <NotesTab
                  {...tabProps}
                  authorUserId={profile.id}
                  actionSuccess={actionSuccess}
                  focusComposerRequestId={focusComposerRequestId}
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
                />
              ) : null}

              {activeTab === 'documents' ? <DocumentsTab {...tabProps} /> : null}

              {activeTab === 'reviews' ? <ReviewsTab {...tabProps} /> : null}

              {activeTab === 'household' ? (
                <HouseholdTab
                  {...tabProps}
                  memberForm={memberForm}
                  deleteConfirm={deleteConfirm}
                  deletingMember={deletingMember}
                  deleteError={deleteError}
                  actionSuccess={actionSuccess}
                  addMemberButtonRef={addMemberButtonRef}
                  onOpenCreateMember={openCreateMemberForm}
                  onOpenEditMember={openEditMemberForm}
                  onCloseMemberForm={closeMemberForm}
                  onRequestDeleteMember={requestDelete}
                  onMemberSaved={onMemberSaved}
                  onMemberSaveFailed={onMemberSaveFailed}
                  onConfirmDeleteMember={confirmDelete}
                  onCancelDeleteMember={cancelDelete}
                />
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
