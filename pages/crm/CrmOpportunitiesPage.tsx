import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchOpportunities,
  filterOpportunityListItems,
  formatOpportunityStatusLabel,
  formatSupabaseError,
  getOpportunityHouseholdLabel,
  getOpportunityOwnerLabel,
  getOpportunityPipelineLabel,
  getOpportunityStageLabel,
  getOpportunityVerticalLabel,
} from '../../crm/opportunities/opportunitiesApi'
import { getOpportunityListViewState } from '../../crm/opportunities/listLoadState'
import type { OpportunityListItem, OpportunityStatusGroup } from '../../crm/opportunities/types'
import { crmHouseholdPath, crmOpportunityPath } from '../../constants/routes'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function CrmOpportunitiesPage() {
  const navigate = useNavigate()
  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusGroup, setStatusGroup] = useState<OpportunityStatusGroup>('open')
  const [reloadKey, setReloadKey] = useState(0)

  function openOpportunity(opportunityId: string) {
    navigate(crmOpportunityPath(opportunityId))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchOpportunities(supabase, { statusGroup })
        if (!cancelled) setOpportunities(rows)
      } catch (err) {
        if (!cancelled) {
          setOpportunities([])
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
  }, [statusGroup, reloadKey])

  const filteredOpportunities = useMemo(
    () => filterOpportunityListItems(opportunities, { search }),
    [opportunities, search],
  )

  const viewState = getOpportunityListViewState({
    loading,
    error,
    totalCount: opportunities.length,
    filteredCount: filteredOpportunities.length,
  })

  const hasActiveFilters = search.trim() !== '' || statusGroup !== 'open'

  function resetFilters() {
    setSearch('')
    setStatusGroup('open')
  }

  return (
    <div className="crm-opportunities-page">
      <header className="crm-page-header">
        <p className="crm-page-eyebrow">Service pipeline</p>
        <h1 className="crm-page-title">Opportunities</h1>
        <p className="crm-page-subtitle">
          Service opportunities linked to households you can access. Stages come from each
          opportunity&apos;s pipeline — they are not hard-coded in the UI.
        </p>
      </header>

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

      <section className="crm-panel crm-opportunities-filters" aria-label="Opportunity filters">
        <div className="crm-opportunities-filters-grid">
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
                placeholder="Title, household, stage, or owner"
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

          <label className="crm-field">
            Status
            <select
              value={statusGroup}
              onChange={(e) => setStatusGroup(e.target.value as OpportunityStatusGroup)}
              disabled={loading}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All statuses</option>
            </select>
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

      <section className="crm-panel" aria-labelledby="crm-opportunities-list-heading">
        <div className="crm-panel-head">
          <h2 id="crm-opportunities-list-heading">
            Opportunities ({loading ? '…' : filteredOpportunities.length})
          </h2>
        </div>

        {viewState.kind === 'loading' ? (
          <p className="crm-muted">Loading opportunities…</p>
        ) : null}

        {viewState.kind === 'empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No opportunities available</p>
            <p>
              No opportunities are available for your account with the selected status. If you are
              an advisor, this usually means none are currently assigned to you or your households.
            </p>
          </div>
        ) : null}

        {viewState.kind === 'filtered_empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No matching opportunities</p>
            <p>
              {search.trim()
                ? `No opportunities match “${search.trim()}” with the current filters.`
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
              aria-label="Opportunities table"
            >
              <table className="crm-opportunities-table">
                <thead>
                  <tr>
                    <th scope="col">Opportunity</th>
                    <th scope="col">Household</th>
                    <th scope="col">Pipeline</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Service</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.map((opportunity) => (
                    <tr
                      key={opportunity.id}
                      className="crm-opportunities-row"
                      tabIndex={0}
                      aria-label={`Open ${opportunity.title}`}
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
                          {opportunity.title}
                        </Link>
                      </td>
                      <td>
                        <Link
                          to={crmHouseholdPath(opportunity.household_id)}
                          className="crm-opportunities-secondary-link"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {getOpportunityHouseholdLabel(opportunity)}
                        </Link>
                      </td>
                      <td>{getOpportunityPipelineLabel(opportunity)}</td>
                      <td>
                        <span className="crm-status-chip">
                          {getOpportunityStageLabel(opportunity)}
                        </span>
                      </td>
                      <td>{getOpportunityVerticalLabel(opportunity)}</td>
                      <td>{getOpportunityOwnerLabel(opportunity)}</td>
                      <td>{formatOpportunityStatusLabel(opportunity.status)}</td>
                      <td>{formatUpdatedAt(opportunity.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="crm-opportunities-card-list">
              {filteredOpportunities.map((opportunity) => (
                <li key={opportunity.id}>
                  <article className="crm-opportunities-card">
                    <Link
                      to={crmOpportunityPath(opportunity.id)}
                      className="crm-opportunities-card-link"
                    >
                      <p className="crm-opportunities-name">{opportunity.title}</p>
                      <dl className="crm-opportunities-card-meta">
                        <div>
                          <dt>Household</dt>
                          <dd>{getOpportunityHouseholdLabel(opportunity)}</dd>
                        </div>
                        <div>
                          <dt>Stage</dt>
                          <dd>{getOpportunityStageLabel(opportunity)}</dd>
                        </div>
                        <div>
                          <dt>Service</dt>
                          <dd>{getOpportunityVerticalLabel(opportunity)}</dd>
                        </div>
                        <div>
                          <dt>Owner</dt>
                          <dd>{getOpportunityOwnerLabel(opportunity)}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>{formatOpportunityStatusLabel(opportunity.status)}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatUpdatedAt(opportunity.updated_at)}</dd>
                        </div>
                      </dl>
                    </Link>
                    <p className="crm-opportunities-card-footer">
                      <Link
                        to={crmHouseholdPath(opportunity.household_id)}
                        className="crm-opportunities-secondary-link"
                      >
                        Open household
                      </Link>
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  )
}
