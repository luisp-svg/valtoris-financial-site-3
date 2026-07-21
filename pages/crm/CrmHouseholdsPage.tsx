import { useEffect, useMemo, useState } from 'react'
import {
  fetchVisibleHouseholds,
  formatSupabaseError,
  getAdvisorLabel,
  getPrimaryContactLabel,
  getPrimaryContactName,
  getStageLabel,
} from '../../crm/households/householdsApi'
import type {
  CrmHouseholdListItem,
  HouseholdAssignmentFilter,
} from '../../crm/households/types'
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

function matchesSearch(household: CrmHouseholdListItem, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  if (household.display_name.toLowerCase().includes(normalized)) return true

  const primaryName = getPrimaryContactName(household)
  if (primaryName?.toLowerCase().includes(normalized)) return true

  return household.members.some((member) => {
    const fullName = `${member.first_name} ${member.last_name}`.trim().toLowerCase()
    return fullName.includes(normalized)
  })
}

export default function CrmHouseholdsPage() {
  const [households, setHouseholds] = useState<CrmHouseholdListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [advisorFilter, setAdvisorFilter] = useState('all')
  const [assignmentFilter, setAssignmentFilter] =
    useState<HouseholdAssignmentFilter>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchVisibleHouseholds(supabase)
        if (!cancelled) setHouseholds(rows)
      } catch (err) {
        if (!cancelled) {
          setError('Unable to load households. Please try again.')
          if (import.meta.env.DEV) {
            console.error('[crm/households]', formatSupabaseError('households', err))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const stageOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const household of households) {
      if (household.relationship_stage) {
        map.set(household.relationship_stage.id, household.relationship_stage.name)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [households])

  const advisorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const household of households) {
      if (household.assigned_advisor) {
        map.set(household.assigned_advisor.id, household.assigned_advisor.display_name)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [households])

  const filteredHouseholds = useMemo(() => {
    return households.filter((household) => {
      if (!matchesSearch(household, search)) return false

      if (stageFilter !== 'all' && household.relationship_stage_id !== stageFilter) {
        return false
      }

      if (advisorFilter !== 'all' && household.assigned_advisor_id !== advisorFilter) {
        return false
      }

      if (assignmentFilter === 'assigned' && !household.assigned_advisor_id) {
        return false
      }
      if (assignmentFilter === 'unassigned' && household.assigned_advisor_id) {
        return false
      }

      return true
    })
  }, [households, search, stageFilter, advisorFilter, assignmentFilter])

  const hasActiveFilters =
    search.trim() !== '' ||
    stageFilter !== 'all' ||
    advisorFilter !== 'all' ||
    assignmentFilter !== 'all'

  function resetFilters() {
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
      </header>

      {error ? <p className="crm-banner crm-banner-error">{error}</p> : null}

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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Household or contact name"
                disabled={loading}
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
            Relationship stage
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
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
              onChange={(e) => setAdvisorFilter(e.target.value)}
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
              onChange={(e) =>
                setAssignmentFilter(e.target.value as HouseholdAssignmentFilter)
              }
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

      <section className="crm-panel" aria-labelledby="crm-households-list-heading">
        <div className="crm-panel-head">
          <h2 id="crm-households-list-heading">
            Households ({loading ? '…' : filteredHouseholds.length})
          </h2>
        </div>

        {loading ? <p className="crm-muted">Loading households…</p> : null}

        {!loading && !error && households.length === 0 ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No households available</p>
            <p>
              No households are available for your account. If you are an advisor, this usually
              means none are currently assigned to you.
            </p>
          </div>
        ) : null}

        {!loading && !error && households.length > 0 && filteredHouseholds.length === 0 ? (
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

        {!loading && filteredHouseholds.length > 0 ? (
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
                  {filteredHouseholds.map((household) => (
                    <tr key={household.id}>
                      <td>
                        <span className="crm-households-name">{household.display_name}</span>
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
              {filteredHouseholds.map((household) => (
                <li key={household.id} className="crm-households-card">
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
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  )
}
