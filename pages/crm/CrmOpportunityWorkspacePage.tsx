import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { normalizeActivityToTimelineItem } from '../../crm/households/timeline'
import HouseholdTimelineItemView from '../../crm/households/HouseholdTimelineItemView'
import type { HouseholdActivityRecord, HouseholdTimelineItem } from '../../crm/households/types'
import OpportunityFormDialog from '../../crm/opportunities/OpportunityFormDialog'
import ConvertOpportunityToCaseDialog from '../../crm/opportunities/ConvertOpportunityToCaseDialog'
import OpportunityLifecycleDialog, {
  type OpportunityLifecycleMode,
} from '../../crm/opportunities/OpportunityLifecycleDialog'
import {
  buildLifecycleReloadFailureUi,
  buildLifecycleReloadRetryUi,
} from '../../crm/opportunities/lifecyclePartialSuccess'
import OpportunityAttentionFlagList from '../../crm/opportunities/OpportunityAttentionFlagList'
import CaseCreatedBadge from '../../crm/opportunities/CaseCreatedBadge'
import {
  fetchOpportunityStageOptions,
  fetchOpportunityWorkspace,
  formatOpportunityStageChangeBody,
  formatOpportunityStatusLabel,
  formatSupabaseError,
  getOpportunityHouseholdLabel,
  getOpportunityLifecycleActions,
  getOpportunityOwnerLabel,
  getOpportunityPipelineLabel,
  getOpportunityStageLabel,
} from '../../crm/opportunities/opportunitiesApi'
import {
  formatOpportunityAttentionLabels,
  formatOpportunityNextActionDueLabel,
  getOpportunityPrimaryProductLabel,
  opportunityAttentionFlags,
} from '../../crm/opportunities/pipelineView'
import {
  linkedApplicationLabel,
  opportunityAllowsCreateCase,
} from '../../crm/opportunities/convertOpportunityView'
import { formatProductionStageLabel } from '../../crm/production/labels'
import {
  getOpportunityActivityViewState,
  getOpportunityWorkspaceViewState,
} from '../../crm/opportunities/listLoadState'
import type {
  OpportunityDetail,
  OpportunityStageOption,
  OpportunityWorkspace,
} from '../../crm/opportunities/types'
import { ROUTES, crmHouseholdPath, crmProductionPath } from '../../constants/routes'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

type WorkspaceTabId = 'overview' | 'activity'

const WORKSPACE_TABS: { id: WorkspaceTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
]

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

function toHouseholdActivityRecord(
  record: OpportunityWorkspace['activities']['value'][number],
): HouseholdActivityRecord {
  return {
    id: record.id,
    household_id: record.household_id,
    actor_user_id: record.actor_user_id,
    actor_display_name: record.actor_display_name,
    activity_type: record.activity_type,
    title: record.title,
    body: record.body,
    metadata: record.metadata,
    occurred_at: record.occurred_at,
    created_at: record.created_at,
  }
}

function buildOpportunityActivityTimeline(
  workspace: OpportunityWorkspace,
  stageNameById: Map<string, string>,
): HouseholdTimelineItem[] {
  if (!workspace.activities.ok) return []
  return workspace.activities.value
    .map((row) => {
      const item = normalizeActivityToTimelineItem(toHouseholdActivityRecord(row))
      if (row.activity_type === 'stage_changed') {
        const body = formatOpportunityStageChangeBody(row, stageNameById)
        return body ? { ...item, body } : item
      }
      return item
    })
    .sort((a, b) => {
      const byTime = b.occurredAt.localeCompare(a.occurredAt)
      if (byTime !== 0) return byTime
      return b.id.localeCompare(a.id)
    })
}

export default function CrmOpportunityWorkspacePage() {
  const { opportunityId = '' } = useParams<{ opportunityId: string }>()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<OpportunityWorkspace | null>(null)
  const [pipelineStages, setPipelineStages] = useState<OpportunityStageOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('overview')
  const [reloadKey, setReloadKey] = useState(0)
  const [showEdit, setShowEdit] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [lifecycleMode, setLifecycleMode] = useState<OpportunityLifecycleMode | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [reloadWarning, setReloadWarning] = useState<string | null>(null)

  async function onEdited(opportunity: OpportunityDetail) {
    setShowEdit(false)
    setSuccess(`Opportunity “${opportunity.title}” updated.`)
    setReloadWarning(null)
    setReloadKey((key) => key + 1)
  }

  async function onLifecycleMoved(opportunity: OpportunityDetail) {
    setLifecycleMode(null)
    setSuccess(
      `Opportunity moved to ${getOpportunityStageLabel(opportunity)} (${formatOpportunityStatusLabel(opportunity.status)}).`,
    )
    setReloadWarning(null)
    setReloadKey((key) => key + 1)
  }

  function onLifecycleReloadFailed(message: string) {
    const ui = buildLifecycleReloadFailureUi(message)
    setLifecycleMode(ui.lifecycleMode)
    setSuccess(ui.success)
    setReloadWarning(ui.reloadWarning)
    // ui.bumpReloadKey is always false — Retry owns authoritative reload.
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!opportunityId) {
        setNotFound(true)
        setWorkspace(null)
        setPipelineStages([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setNotFound(false)
      try {
        const supabase = createSupabaseBrowserClient()
        const result = await fetchOpportunityWorkspace(supabase, opportunityId)
        if (cancelled) return
        if (!result) {
          setNotFound(true)
          setWorkspace(null)
          setPipelineStages([])
          return
        }
        setWorkspace(result)
        // Authoritative reload succeeded — clear partial-success reload warning.
        setReloadWarning(null)
        try {
          const stages = await fetchOpportunityStageOptions(
            supabase,
            result.opportunity.pipeline_id,
          )
          if (!cancelled) setPipelineStages(stages)
        } catch (stageErr) {
          if (!cancelled) {
            setPipelineStages([])
            if (import.meta.env.DEV) {
              console.error(
                '[crm/opportunities/workspace]',
                formatSupabaseError('opportunity_pipeline_stages', stageErr),
              )
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          // Keep last known row for this id (partial-success Retry must not wipe stale UI).
          setWorkspace((prev) =>
            prev?.opportunity.id === opportunityId ? prev : null,
          )
          setError('Unable to load this opportunity. Please try again.')
          // Keep reloadWarning if present — Retry failed, mutation still succeeded.
          if (import.meta.env.DEV) {
            console.error(
              '[crm/opportunities/workspace]',
              formatSupabaseError('opportunity_workspace', err),
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
  }, [opportunityId, reloadKey])

  const viewState = getOpportunityWorkspaceViewState({
    // Keep last-known workspace visible during refresh / partial-success Retry.
    loading: loading && !workspace,
    // Reload-failure warning owns the messaging when mutation already succeeded.
    error: workspace && reloadWarning ? null : error,
    notFound,
    hasOpportunity: Boolean(workspace),
  })

  const activityView = workspace
    ? getOpportunityActivityViewState(workspace.activities)
    : { kind: 'empty' as const }

  const stageNameById = new Map<string, string>()
  for (const stage of pipelineStages) stageNameById.set(stage.id, stage.name)
  if (workspace?.opportunity.stage) {
    stageNameById.set(workspace.opportunity.stage.id, workspace.opportunity.stage.name)
  }

  const activityTimeline = workspace
    ? buildOpportunityActivityTimeline(workspace, stageNameById)
    : []

  const lifecycleActions = workspace
    ? getOpportunityLifecycleActions(workspace.opportunity, pipelineStages)
    : null

  return (
    <div className="crm-opportunity-workspace-page">
      <header className="crm-page-header crm-opportunity-workspace-header">
        <div className="crm-opportunity-workspace-nav">
          <Link to={ROUTES.crmPipeline} className="crm-text-btn">
            ← Pipeline
          </Link>
          {workspace ? (
            <Link
              to={crmHouseholdPath(workspace.opportunity.household_id)}
              className="crm-text-btn"
            >
              Open household
            </Link>
          ) : null}
        </div>

        {viewState.kind === 'loading' ? (
          <>
            <p className="crm-page-eyebrow">Opportunity</p>
            <h1 className="crm-page-title">Loading…</h1>
          </>
        ) : null}

        {viewState.kind === 'error' ? (
          <>
            <p className="crm-page-eyebrow">Opportunity</p>
            <h1 className="crm-page-title">Unable to load</h1>
            <div className="crm-banner crm-banner-error" role="alert">
              <p>{viewState.message}</p>
              <button
                type="button"
                className="crm-text-btn"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Retry
              </button>
            </div>
          </>
        ) : null}

        {viewState.kind === 'not_found' ? (
          <>
            <p className="crm-page-eyebrow">Opportunity</p>
            <h1 className="crm-page-title">Opportunity not found</h1>
            <p className="crm-page-subtitle">
              This opportunity may not exist, may have been removed, or you may not have access.
            </p>
            <Link to={ROUTES.crmPipeline} className="crm-text-btn">
              Back to pipeline
            </Link>
          </>
        ) : null}

        {viewState.kind === 'ready' && workspace ? (
          <>
            <div className="crm-opportunity-workspace-title-row">
              <div>
                <p className="crm-page-eyebrow">Opportunity</p>
                <h1 className="crm-page-title">{workspace.opportunity.title}</h1>
                <p className="crm-page-subtitle">
                  {getOpportunityHouseholdLabel(workspace.opportunity)}
                  {' · '}
                  {getOpportunityPrimaryProductLabel(workspace.opportunity)}
                </p>
              </div>
              <button
                type="button"
                className="crm-secondary-btn"
                disabled={showConvert || Boolean(lifecycleMode)}
                onClick={() => {
                  setSuccess(null)
                  setLifecycleMode(null)
                  setShowConvert(false)
                  setShowEdit(true)
                }}
              >
                Edit
              </button>
            </div>
            <div className="crm-opportunity-workspace-chips" aria-label="Opportunity summary">
              <span className="crm-status-chip">
                {formatOpportunityStatusLabel(workspace.opportunity.status)}
              </span>
              <span className="crm-status-chip">
                {getOpportunityStageLabel(workspace.opportunity)}
              </span>
              <span className="crm-status-chip">
                {getOpportunityOwnerLabel(workspace.opportunity)}
              </span>
              <OpportunityAttentionFlagList
                labels={formatOpportunityAttentionLabels(
                  opportunityAttentionFlags(workspace.opportunity),
                )}
              />
            </div>
          </>
        ) : null}
      </header>

      {success ? <p className="crm-banner crm-banner-success">{success}</p> : null}
      {reloadWarning ? (
        <div className="crm-banner crm-banner-warning" role="status">
          <p>{reloadWarning}</p>
          <button
            type="button"
            className="crm-text-btn"
            onClick={() => {
              const retry = buildLifecycleReloadRetryUi()
              if (retry.callMoveOpportunityStage) return
              if (retry.bumpReloadKey) setReloadKey((key) => key + 1)
              // clearReloadWarningImmediately is false — cleared only after successful load.
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {showEdit && workspace ? (
        <OpportunityFormDialog
          mode="edit"
          opportunity={workspace.opportunity}
          onCancel={() => setShowEdit(false)}
          onSaved={onEdited}
        />
      ) : null}

      {lifecycleMode && workspace ? (
        <OpportunityLifecycleDialog
          mode={lifecycleMode}
          opportunity={workspace.opportunity}
          onCancel={() => setLifecycleMode(null)}
          onMoved={onLifecycleMoved}
          onMovedReloadFailed={onLifecycleReloadFailed}
        />
      ) : null}

      {showConvert && workspace ? (
        <ConvertOpportunityToCaseDialog
          opportunity={workspace.opportunity}
          onCancel={() => setShowConvert(false)}
          onConverted={(result) => {
            setShowConvert(false)
            navigate(crmProductionPath(result.applicationId))
          }}
        />
      ) : null}

      {viewState.kind === 'ready' && workspace ? (
        <>
          <nav className="crm-household-workspace-tabs" aria-label="Opportunity sections">
            {WORKSPACE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  activeTab === tab.id
                    ? 'crm-household-workspace-tab is-active'
                    : 'crm-household-workspace-tab'
                }
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'overview' ? (
            <>
              <section
                className="crm-panel crm-opportunity-lifecycle"
                aria-labelledby="crm-opportunity-lifecycle-heading"
              >
                <div className="crm-panel-head">
                  <h2 id="crm-opportunity-lifecycle-heading">Lifecycle</h2>
                </div>
                <p className="crm-muted">
                  Stage, status, and closed date are updated only through the database lifecycle RPC.
                </p>
                <div className="crm-opportunity-lifecycle-actions">
                  <button
                    type="button"
                    className="crm-secondary-btn"
                    disabled={!lifecycleActions?.canMove || Boolean(lifecycleMode) || showEdit || showConvert}
                    onClick={() => {
                      setSuccess(null)
                      setShowEdit(false)
                      setLifecycleMode('move')
                    }}
                  >
                    Move Stage
                  </button>
                  <button
                    type="button"
                    className="crm-secondary-btn"
                    disabled={!lifecycleActions?.canCloseWon || Boolean(lifecycleMode) || showEdit || showConvert}
                    onClick={() => {
                      setSuccess(null)
                      setShowEdit(false)
                      setLifecycleMode('close_won')
                    }}
                  >
                    Close as Won
                  </button>
                  <button
                    type="button"
                    className="crm-secondary-btn"
                    disabled={!lifecycleActions?.canCloseLost || Boolean(lifecycleMode) || showEdit || showConvert}
                    onClick={() => {
                      setSuccess(null)
                      setShowEdit(false)
                      setLifecycleMode('close_lost')
                    }}
                  >
                    Close as Lost
                  </button>
                  {lifecycleActions?.canReopen ? (
                    <button
                      type="button"
                      className="crm-secondary-btn"
                      disabled={Boolean(lifecycleMode) || showEdit || showConvert}
                      onClick={() => {
                        setSuccess(null)
                        setShowEdit(false)
                        setShowConvert(false)
                        setLifecycleMode('reopen')
                      }}
                    >
                      Reopen Opportunity
                    </button>
                  ) : null}
                  {workspace.linkedApplication ? (
                    <Link
                      to={crmProductionPath(workspace.linkedApplication.id)}
                      className="crm-secondary-btn crm-opportunity-convert-open"
                    >
                      Open Case
                    </Link>
                  ) : opportunityAllowsCreateCase(workspace.opportunity) ? (
                    <button
                      type="button"
                      className="crm-primary-btn"
                      disabled={Boolean(lifecycleMode) || showEdit || showConvert}
                      onClick={() => {
                        setSuccess(null)
                        setShowEdit(false)
                        setLifecycleMode(null)
                        setShowConvert(true)
                      }}
                    >
                      Create Case
                    </button>
                  ) : null}
                </div>
              </section>

              {workspace.linkedApplication ? (
                <section
                  className="crm-panel crm-opportunity-linked-case"
                  aria-labelledby="crm-opportunity-linked-case-heading"
                >
                  <div className="crm-panel-head">
                    <h2 id="crm-opportunity-linked-case-heading">Linked Case</h2>
                    <CaseCreatedBadge
                      productionStage={workspace.linkedApplication.production_stage}
                    />
                  </div>
                  <dl className="crm-opportunity-overview-grid">
                    <div>
                      <dt>Application / product</dt>
                      <dd>{linkedApplicationLabel(workspace.linkedApplication)}</dd>
                    </div>
                    <div>
                      <dt>Production stage</dt>
                      <dd>{formatProductionStageLabel(workspace.linkedApplication.production_stage)}</dd>
                    </div>
                  </dl>
                </section>
              ) : null}

              <section
                className="crm-panel crm-opportunity-overview"
                aria-labelledby="crm-opportunity-overview-heading"
              >
                <div className="crm-panel-head">
                  <h2 id="crm-opportunity-overview-heading">Overview</h2>
                </div>

                <dl className="crm-opportunity-overview-grid">
                  <div>
                    <dt>Title</dt>
                    <dd>{workspace.opportunity.title}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{formatOpportunityStatusLabel(workspace.opportunity.status)}</dd>
                  </div>
                  <div>
                    <dt>Pipeline</dt>
                    <dd>{getOpportunityPipelineLabel(workspace.opportunity)}</dd>
                  </div>
                  <div>
                    <dt>Current stage</dt>
                    <dd>{getOpportunityStageLabel(workspace.opportunity)}</dd>
                  </div>
                  <div>
                    <dt>Household</dt>
                    <dd>
                      <Link
                        to={crmHouseholdPath(workspace.opportunity.household_id)}
                        className="crm-opportunities-secondary-link"
                      >
                        {getOpportunityHouseholdLabel(workspace.opportunity)}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>Advisor</dt>
                    <dd>{getOpportunityOwnerLabel(workspace.opportunity)}</dd>
                  </div>
                  <div>
                    <dt>Primary Product / Service</dt>
                    <dd>{getOpportunityPrimaryProductLabel(workspace.opportunity)}</dd>
                  </div>
                  <div>
                    <dt>Need identified</dt>
                    <dd>{workspace.opportunity.need_identified ? 'Yes' : 'No'}</dd>
                  </div>
                  <div>
                    <dt>Next action</dt>
                    <dd>{workspace.opportunity.next_action ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Next-action due</dt>
                    <dd>{formatOpportunityNextActionDueLabel(workspace.opportunity.next_action_due_at)}</dd>
                  </div>
                  <div>
                    <dt>Stage entered</dt>
                    <dd>{formatDateTime(workspace.opportunity.stage_entered_at)}</dd>
                  </div>
                  <div>
                    <dt>Closed</dt>
                    <dd>{formatDateTime(workspace.opportunity.closed_at)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(workspace.opportunity.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDateTime(workspace.opportunity.updated_at)}</dd>
                  </div>
                </dl>
              </section>
            </>
          ) : null}

          {activeTab === 'activity' ? (
            <section
              className="crm-panel crm-opportunity-activity"
              aria-labelledby="crm-opportunity-activity-heading"
            >
              <div className="crm-panel-head">
                <h2 id="crm-opportunity-activity-heading">Activity</h2>
              </div>

              {activityView.kind === 'load_error' ? (
                <div className="crm-banner crm-banner-error" role="alert">
                  <p>{activityView.message}</p>
                  <button
                    type="button"
                    className="crm-text-btn"
                    onClick={() => setReloadKey((key) => key + 1)}
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {activityView.kind === 'empty' ? (
                <div className="crm-empty-state">
                  <p className="crm-empty-state-title">No opportunity activity yet</p>
                  <p>
                    Only activity records linked to this opportunity are shown here. Household-wide
                    notes and events without an opportunity link stay on the household Activity tab.
                  </p>
                </div>
              ) : null}

              {activityView.kind === 'ready' ? (
                <ul className="crm-household-activity-list crm-timeline-list">
                  {activityTimeline.map((item) => (
                    <li key={item.id}>
                      <HouseholdTimelineItemView item={item} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
