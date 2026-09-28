import { EMPTY_PIPELINE_FILTERS, filterPipelineScope, pipelineFilterOptions, pipelineStageSummary } from '../../crm/opportunities/pipelineFilters'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import OpportunityFormDialog from '../../crm/opportunities/OpportunityFormDialog'
import OpportunityPipelineCard from '../../crm/opportunities/OpportunityPipelineCard'
import PipelineViewBar from '../../crm/opportunities/PipelineViewBar'
import CaseCreatedBadge from '../../crm/opportunities/CaseCreatedBadge'
import OpportunityAttentionFlagList from '../../crm/opportunities/OpportunityAttentionFlagList'
import {
  fetchCurrentAdvisorProfileId,
  fetchPipelineOpportunities,
  opportunityMatchesSearch,
  formatSupabaseError,
  getOpportunityHouseholdLabel,
  getOpportunityOwnerLabel,
  getOpportunityStageLabel,
} from '../../crm/opportunities/opportunitiesApi'
import { getOpportunityListViewState } from '../../crm/opportunities/listLoadState'
import {
  applyPipelineView,
  countPipelineViews,
  formatOpportunityNextActionDueLabel,
  pipelineEmptyCopy,
  pipelineViewFromSearchParams,
  pipelineViewLabel,
  pipelineCardCopy,
  writePipelineViewSearchParams,
  type PipelineView,
} from '../../crm/opportunities/pipelineView'
import type { OpportunityDetail, OpportunityListItem } from '../../crm/opportunities/types'
import { crmOpportunityPath } from '../../constants/routes'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export default function CrmOpportunitiesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([])
  const [assignedAdvisorId, setAssignedAdvisorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_PIPELINE_FILTERS)
  const [view, setView] = useState<PipelineView>(() => pipelineViewFromSearchParams(searchParams))
  const [reloadKey, setReloadKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  function openOpportunity(opportunityId: string) {
    navigate(crmOpportunityPath(opportunityId))
  }

  function onCreated(opportunity: OpportunityDetail) {
    setShowCreate(false)
    setSuccess(`Opportunity “${opportunity.title}” created.`)
    navigate(crmOpportunityPath(opportunity.id))
  }

  useEffect(() => {
    setView(pipelineViewFromSearchParams(searchParams))
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const [rows, advisorId] = await Promise.all([
          fetchPipelineOpportunities(supabase),
          user?.id ? fetchCurrentAdvisorProfileId(supabase, user.id) : Promise.resolve(null),
        ])
        if (!cancelled) {
          setOpportunities(rows)
          setAssignedAdvisorId(advisorId)
        }
      } catch (err) {
        if (!cancelled) {
          setOpportunities([])
          setAssignedAdvisorId(null)
          setError('Unable to load opportunities. Please try again.')
          if (import.meta.env.DEV) {
            console.error('[crm/opportunities]', formatSupabaseError('opportunities', err))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const filterOptions = useMemo(() => pipelineFilterOptions(opportunities), [opportunities])
  const scopedOpportunities = useMemo(() => filterPipelineScope(opportunities, filters).filter(item => opportunityMatchesSearch(item, search)), [opportunities, filters, search])

  const viewCounts = useMemo(
    () => countPipelineViews(scopedOpportunities, assignedAdvisorId),
    [scopedOpportunities, assignedAdvisorId],
  )

  const viewItems = useMemo(
    () => applyPipelineView(opportunities, { view, assignedAdvisorId }),
    [opportunities, view, assignedAdvisorId],
  )

  const filteredOpportunities = useMemo(
    () => applyPipelineView(scopedOpportunities, { view, search, assignedAdvisorId }),
    [scopedOpportunities, view, search, assignedAdvisorId],
  )

  const viewState = getOpportunityListViewState({
    loading,
    error,
    totalCount: viewItems.length,
    filteredCount: filteredOpportunities.length,
  })

  const stageSummary = useMemo(() => pipelineStageSummary(filteredOpportunities), [filteredOpportunities])
  const hasActiveFilters = search.trim() !== '' || view !== 'active' || Object.values(filters).some(Boolean)
  const emptyCopy = pipelineEmptyCopy(view)

  function applyView(next: PipelineView) {
    setView(next)
    setSearchParams(writePipelineViewSearchParams(searchParams, next), { replace: true })
  }

  function resetFilters() {
    setSearch('')
    setFilters(EMPTY_PIPELINE_FILTERS)
    applyView('active')
  }

  return (
    <div className="crm-opportunities-page crm-sales-pipeline">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Sales pipeline</p>
          <h1 className="crm-page-title">Pipeline</h1>
          <p className="crm-page-subtitle">
            Review each deal’s sales stage, product, advisor, and next step.
          </p>
        </div>
        <button
          type="button"
          className="crm-primary-btn"
          onClick={() => {
            setSuccess(null)
            setShowCreate(true)
          }}
        >
          New Opportunity
        </button>
      </header>

      {success ? <p className="crm-banner crm-banner-success">{success}</p> : null}

      {showCreate ? (
        <OpportunityFormDialog
          mode="create"
          onCancel={() => setShowCreate(false)}
          onSaved={onCreated}
        />
      ) : null}

      {viewState.kind === 'error' ? (
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
      ) : null}

      <section className="crm-panel crm-opportunities-filters" aria-label="Pipeline filters">
        <PipelineViewBar
          value={view}
          onChange={applyView}
          counts={viewCounts}
          disabled={loading}
        />

        <p className="crm-muted">Counts reflect the selected filters. Refresh to include recent changes.</p>
        <button type="button" className="crm-text-btn" disabled={loading} onClick={() => setReloadKey(key => key + 1)}>Refresh pipeline</button>
        <div className="crm-opportunities-filters-grid">
          {([
            ['serviceId', 'Service', filterOptions.services],
            ['stageId', 'Sales stage', filterOptions.stages],
            ['advisorId', 'Advisor', filterOptions.advisors],
          ] as const).map(([key, label, options]) => (
            <label className="crm-field" key={key}>
              {label}
              <select value={filters[key]} disabled={loading || Boolean(error)} onChange={event => setFilters(previous => ({ ...previous, [key]: event.target.value }))}>
                <option value="">All</option>
                {options.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}
              </select>
            </label>
          ))}
          <label className="crm-field">
            Search
            <span className="crm-search-field">
              <svg
                className="crm-search-icon"
                viewBox="0 0 20 20"
                width="16"
                height="16"
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  cx="8.5"
                  cy="8.5"
                  r="5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <path
                  d="M12.75 12.75 16.5 16.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Household, product, stage, or advisor"
                disabled={loading || Boolean(error)}
                autoComplete="off"
              />
              {search ? (
                <button
                  type="button"
                  className="crm-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : null}
            </span>
          </label>
        </div>

        {hasActiveFilters ? (
          <div className="crm-opportunities-filters-actions">
            <button type="button" className="crm-text-btn" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      {!loading && !error && stageSummary.length > 0 ? (
        <section className="crm-panel" aria-label="Sales stage summary">
          <div className="crm-panel-head"><h2>Sales stages in this view</h2></div>
          <ul>{stageSummary.map(stage => <li key={stage.id}>{stage.name}: <strong>{stage.count}</strong></li>)}</ul>
        </section>
      ) : null}

      <section className="crm-panel" aria-labelledby="crm-opportunities-list-heading">
        <div className="crm-panel-head">
          <h2 id="crm-opportunities-list-heading">
            {pipelineViewLabel(view)} ({loading ? '…' : filteredOpportunities.length})
          </h2>
        </div>

        {viewState.kind === 'loading' ? (
          <p className="crm-muted">Loading opportunities…</p>
        ) : null}

        {viewState.kind === 'empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">{emptyCopy.title}</p>
            <p>{emptyCopy.body}</p>
            {view === 'active' ? (
              <button
                type="button"
                className="crm-secondary-btn"
                onClick={() => {
                  setSuccess(null)
                  setShowCreate(true)
                }}
              >
                New Opportunity
              </button>
            ) : (
              <button type="button" className="crm-text-btn" onClick={resetFilters}>
                View Active
              </button>
            )}
          </div>
        ) : null}

        {viewState.kind === 'filtered_empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No matching opportunities</p>
            <p>
              {search.trim()
                ? `No opportunities match “${search.trim()}” in ${pipelineViewLabel(view)}.`
                : 'No opportunities match the selected filters.'}
            </p>
            <button type="button" className="crm-text-btn" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        ) : null}

        {viewState.kind === 'ready' ? (
          <>
            <div
              className="crm-opportunities-table-wrap"
              role="region"
              aria-label="Pipeline table"
            >
              <table className="crm-opportunities-table">
                <thead>
                  <tr>
                    <th scope="col">Household</th>
                    <th scope="col">Product / Service</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Case</th>
                    <th scope="col">Advisor</th>
                    <th scope="col">Next action</th>
                    <th scope="col">Due</th>
                    <th scope="col">Attention</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.map((opportunity) => {
                    const copy = pipelineCardCopy(opportunity)
                    return (
                      <tr
                        key={opportunity.id}
                        className="crm-opportunities-row"
                        tabIndex={0}
                        aria-label={`Open ${copy.householdName}`}
                        onClick={() => openOpportunity(opportunity.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openOpportunity(opportunity.id)
                          }
                        }}
                      >
                        <td>
                          <Link
                            to={crmOpportunityPath(opportunity.id)}
                            className="crm-opportunities-name-link"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {getOpportunityHouseholdLabel(opportunity)}
                          </Link>
                        </td>
                        <td>{copy.primaryProduct}<br /><span className="crm-muted">{opportunity.service_vertical?.name ?? 'Service unavailable'}</span></td>
                        <td>
                          <span className="crm-status-chip">
                            {getOpportunityStageLabel(opportunity)}
                          </span>
                        </td>
                        <td>
                          {copy.caseCreated ? (
                            <CaseCreatedBadge
                              productionStage={opportunity.linkedApplication?.production_stage}
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{getOpportunityOwnerLabel(opportunity)}</td>
                        <td>{copy.nextAction}</td>
                        <td>
                          <span
                            className={
                              copy.attention.includes('Overdue next action')
                                ? 'crm-pipeline-overdue'
                                : undefined
                            }
                          >
                            {formatOpportunityNextActionDueLabel(opportunity.next_action_due_at)}
                          </span>
                        </td>
                        <td>
                          <OpportunityAttentionFlagList labels={copy.attention} />
                          {copy.attention.length === 0 ? '—' : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="crm-opportunities-card-list" aria-label="Pipeline cards">
              {filteredOpportunities.map((opportunity) => (
                <li key={opportunity.id}>
                  <OpportunityPipelineCard opportunity={opportunity} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  )
}
