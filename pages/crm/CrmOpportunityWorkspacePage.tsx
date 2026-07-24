import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { normalizeActivityToTimelineItem } from '../../crm/households/timeline'
import HouseholdTimelineItemView from '../../crm/households/HouseholdTimelineItemView'
import type { HouseholdActivityRecord, HouseholdTimelineItem } from '../../crm/households/types'
import {
  fetchOpportunityWorkspace,
  formatOpportunityStatusLabel,
  formatSupabaseError,
  getOpportunityHouseholdLabel,
  getOpportunityOwnerLabel,
  getOpportunityPipelineLabel,
  getOpportunityStageLabel,
  getOpportunityVerticalLabel,
} from '../../crm/opportunities/opportunitiesApi'
import { getOpportunityActivityViewState, getOpportunityWorkspaceViewState } from '../../crm/opportunities/listLoadState'
import type { OpportunityWorkspace } from '../../crm/opportunities/types'
import { ROUTES, crmHouseholdPath } from '../../constants/routes'
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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
): HouseholdTimelineItem[] {
  if (!workspace.activities.ok) return []
  return workspace.activities.value
    .map((row) => normalizeActivityToTimelineItem(toHouseholdActivityRecord(row)))
    .sort((a, b) => {
      const byTime = b.occurredAt.localeCompare(a.occurredAt)
      if (byTime !== 0) return byTime
      return b.id.localeCompare(a.id)
    })
}

export default function CrmOpportunityWorkspacePage() {
  const { opportunityId = '' } = useParams<{ opportunityId: string }>()
  const [workspace, setWorkspace] = useState<OpportunityWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('overview')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!opportunityId) {
        setNotFound(true)
        setWorkspace(null)
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
          return
        }
        setWorkspace(result)
      } catch (err) {
        if (!cancelled) {
          setWorkspace(null)
          setError('Unable to load this opportunity. Please try again.')
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
    loading,
    error,
    notFound,
    hasOpportunity: Boolean(workspace),
  })

  const activityView = workspace
    ? getOpportunityActivityViewState(workspace.activities)
    : { kind: 'empty' as const }
  const activityTimeline = workspace ? buildOpportunityActivityTimeline(workspace) : []

  return (
    <div className="crm-opportunity-workspace-page">
      <header className="crm-page-header crm-opportunity-workspace-header">
        <div className="crm-opportunity-workspace-nav">
          <Link to={ROUTES.crmPipeline} className="crm-text-btn">
            ← Opportunities
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
              Back to opportunities
            </Link>
          </>
        ) : null}

        {viewState.kind === 'ready' && workspace ? (
          <>
            <p className="crm-page-eyebrow">Opportunity</p>
            <h1 className="crm-page-title">{workspace.opportunity.title}</h1>
            <p className="crm-page-subtitle">
              {getOpportunityHouseholdLabel(workspace.opportunity)}
              {' · '}
              {getOpportunityVerticalLabel(workspace.opportunity)}
            </p>
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
            </div>
          </>
        ) : null}
      </header>

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
                  <dt>Owner</dt>
                  <dd>{getOpportunityOwnerLabel(workspace.opportunity)}</dd>
                </div>
                <div>
                  <dt>Service</dt>
                  <dd>{getOpportunityVerticalLabel(workspace.opportunity)}</dd>
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
                  <dt>Next action due</dt>
                  <dd>{formatDate(workspace.opportunity.next_action_due_at)}</dd>
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

              <p className="crm-muted crm-opportunity-overview-note">
                Stage changes and assignment edits are not available in this phase.
              </p>
            </section>
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
