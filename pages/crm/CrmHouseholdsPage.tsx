import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchHouseholdDirectory,
  HOUSEHOLD_DIRECTORY_PAGE_SIZE,
  formatSupabaseError,
  getAdvisorLabel,
  getPrimaryContactLabel,
  getStageLabel,
} from '../../crm/households/householdsApi'
import type {
  CrmHouseholdListItem,
  HouseholdAssignmentFilter,
} from '../../crm/households/types'
import type { HouseholdDirectoryOption } from '../../crm/households/householdsApi'
import { crmHouseholdPath } from '../../constants/routes'
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

export default function CrmHouseholdsPage() {
  const navigate = useNavigate()
  const [households, setHouseholds] = useState<CrmHouseholdListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [advisorFilter, setAdvisorFilter] = useState('all')
  const [assignmentFilter, setAssignmentFilter] =
    useState<HouseholdAssignmentFilter>('all')

  function openHousehold(householdId: string) {
    navigate(crmHouseholdPath(householdId))
  }

  const [stageOptions, setStageOptions] = useState<HouseholdDirectoryOption[]>([])
  const [advisorOptions, setAdvisorOptions] = useState<HouseholdDirectoryOption[]>([])
  const [requestedPage, setRequestedPage] = useState(1)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setTotal(null)
    // Keep typing responsive; discard results from superseded requests.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchHouseholdDirectory(createSupabaseBrowserClient(), {
            search, stageId: stageFilter, advisorId: advisorFilter,
            assignment: assignmentFilter, page: requestedPage,
          })
          if (cancelled) return
          setHouseholds(result.rows)
          setTotal(result.total)
          setPage(result.page)
          setStageOptions(result.stages)
          setAdvisorOptions(result.advisors)
        } catch (err) {
          if (!cancelled) {
            setHouseholds([])
            setError('Unable to load households. Please try again.')
            if (import.meta.env.DEV) {
              console.error('[crm/households]', formatSupabaseError('households', err))
            }
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, search.trim() ? 250 : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, stageFilter, advisorFilter, assignmentFilter, requestedPage, retry])

  const hasActiveFilters =
    search.trim() !== '' ||
    stageFilter !== 'all' ||
    advisorFilter !== 'all' ||
    assignmentFilter !== 'all'

  function resetFilters() {
    setRequestedPage(1)
    setSearch('')
    setStageFilter('all')
    setAdvisorFilter('all')
    setAssignmentFilter('all')
  }

  return (
    <div className="crm-households-page">
      <header className="crm-page-header">
        <p className="crm-page-eyebrow">Client relationships</p>
        <h1 className="crm-page-title">Households</h1>
        <p className="crm-page-subtitle">
          Households are the central client relationship records in Valtoris CRM. This list shows
          households you can access.
        </p>
      <Link to="/crm/client-intakes/new" className="crm-primary-btn">Start client intake</Link>
      <Link to="/crm/archived" className="crm-secondary-btn">Archived records</Link>
      </header>

      {error ? <div className="crm-banner crm-banner-error" role="alert">
        <p>{error}</p>
        <button type="button" className="crm-text-btn" onClick={() => setRetry((value) => value + 1)}>Retry</button>
      </div> : null}

      <section className="crm-panel crm-households-filters" aria-label="Household filters">
        <div className="crm-households-filters-grid">
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
                aria-label="Search households"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setRequestedPage(1) }}
                placeholder="Household or contact name"
                maxLength={256}
                autoComplete="off"
              />
              {search ? (
                <button
                  type="button"
                  className="crm-search-clear"
                  onClick={() => { setSearch(''); setRequestedPage(1) }}
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
            Relationship stage
            <select
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setRequestedPage(1) }}
              disabled={loading}
            >
              <option value="all">All stages</option>
              {stageOptions.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </label>

          <label className="crm-field">
            Assigned advisor
            <select
              value={advisorFilter}
              onChange={(e) => { setAdvisorFilter(e.target.value); setRequestedPage(1) }}
              disabled={loading}
            >
              <option value="all">All advisors</option>
              {advisorOptions.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="crm-field">
            Assignment
            <select
              value={assignmentFilter}
              onChange={(e) => {
                setAssignmentFilter(e.target.value as HouseholdAssignmentFilter)
                setRequestedPage(1)
              }}
              disabled={loading}
            >
              <option value="all">Assigned and unassigned</option>
              <option value="assigned">Assigned only</option>
              <option value="unassigned">Unassigned only</option>
            </select>
          </label>
        </div>

        {hasActiveFilters ? (
          <div className="crm-households-filters-actions">
            <button type="button" className="crm-text-btn" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      <section className="crm-panel" aria-labelledby="crm-households-list-heading" aria-busy={loading}>
        <div className="crm-panel-head">
          <h2 id="crm-households-list-heading">
            Households ({total ?? '…'})
          </h2>
        </div>

        {loading ? <p className="crm-muted" role="status">Loading households…</p> : null}
        {!loading && !error && total !== null && total > 0 ? (
          <nav className="crm-households-pagination" aria-label="Household pages">
            <p className="crm-muted" role="status">
              Showing {(page - 1) * HOUSEHOLD_DIRECTORY_PAGE_SIZE + 1}–{Math.min(page * HOUSEHOLD_DIRECTORY_PAGE_SIZE, total)} of {total} households
              {' · '}Page {page} of {Math.ceil(total / HOUSEHOLD_DIRECTORY_PAGE_SIZE)}
            </p>
            <div className="crm-households-pagination-buttons">
            <button type="button" className="crm-text-btn" disabled={page === 1}
              onClick={() => setRequestedPage(page - 1)}>Previous</button>
            <button type="button" className="crm-text-btn" disabled={page * HOUSEHOLD_DIRECTORY_PAGE_SIZE >= total}
              onClick={() => setRequestedPage(page + 1)}>Next</button>
            </div>
          </nav>
        ) : null}


        {!loading && !error && total === 0 && !hasActiveFilters ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No households available</p>
            <p>
              No households are available for your account. If you are an advisor, this usually
              means none are currently assigned to you.
            </p>
          </div>
        ) : null}

        {!loading && !error && total === 0 && hasActiveFilters ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No matching households</p>
            <p>
              {search.trim()
                ? `No households match “${search.trim()}” with the current filters.`
                : 'No households match the selected filters.'}
            </p>
            <button type="button" className="crm-text-btn" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        ) : null}

        {!loading && !error && households.length > 0 ? (
          <>
            <div className="crm-households-table-wrap" role="region" aria-label="Households table">
              <table className="crm-households-table">
                <thead>
                  <tr>
                    <th scope="col">Household</th>
                    <th scope="col">Primary contact</th>
                    <th scope="col">Relationship stage</th>
                    <th scope="col">Assigned advisor</th>
                    <th scope="col">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {households.map((household) => (
                    <tr
                      key={household.id}
                      className="crm-households-row"
                      tabIndex={0}
                      aria-label={`Open ${household.display_name}`}
                      onClick={() => openHousehold(household.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openHousehold(household.id)
                        }
                      }}
                    >
                      <td>
                        <Link
                          to={crmHouseholdPath(household.id)}
                          className="crm-households-name-link"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {household.display_name}
                        </Link>
                      </td>
                      <td>{getPrimaryContactLabel(household)}</td>
                      <td>
                        <span className="crm-status-chip">{getStageLabel(household)}</span>
                      </td>
                      <td>{getAdvisorLabel(household)}</td>
                      <td>{formatUpdatedAt(household.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="crm-households-card-list">
              {households.map((household) => (
                <li key={household.id}>
                  <Link
                    to={crmHouseholdPath(household.id)}
                    className="crm-households-card crm-households-card-link"
                    aria-label={`Open ${household.display_name}`}
                  >
                    <p className="crm-households-name">{household.display_name}</p>
                    <dl className="crm-households-card-meta">
                      <div>
                        <dt>Contact</dt>
                        <dd>{getPrimaryContactLabel(household)}</dd>
                      </div>
                      <div>
                        <dt>Stage</dt>
                        <dd>
                          <span className="crm-status-chip">{getStageLabel(household)}</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Advisor</dt>
                        <dd>{getAdvisorLabel(household)}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatUpdatedAt(household.updated_at)}</dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  )
}
