import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import ProductionQueueCards from '../../crm/production/ProductionQueueCards'
import ProductionQueueTable from '../../crm/production/ProductionQueueTable'
import {
  getProductionListPresentation,
  getProductionListViewState,
} from '../../crm/production/listLoadState'
import {
  fetchProductionAdvisorOptions,
  fetchProductionApplications,
  fetchProductionCarrierOptions,
  formatProductionSupabaseError,
} from '../../crm/production/productionApi'
import {
  applyProductionQueueView,
  defaultProductionQueueFilters,
} from '../../crm/production/queueView'
import {
  PRODUCTION_PRODUCT_LINES,
  PRODUCTION_STAGES,
  PRODUCTION_STALE_DAYS_IN_STAGE,
  type ProductionAdvisorOption,
  type ProductionApplicationListItem,
  type ProductionCarrierOption,
  type ProductionProductLine,
  type ProductionQueueFilters,
  type ProductionStage,
} from '../../crm/production/types'
import { formatProductionProductLineLabel, formatProductionStageLabel } from '../../crm/production/labels'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

function useViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1200 : window.innerWidth,
  )
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

export default function CrmProductionPage() {
  const { role } = useCrmAuth()
  const isOwner = role === 'owner'
  const viewportWidth = useViewportWidth()
  const presentation = getProductionListPresentation(viewportWidth)

  const [items, setItems] = useState<ProductionApplicationListItem[]>([])
  const [carriers, setCarriers] = useState<ProductionCarrierOption[]>([])
  const [advisors, setAdvisors] = useState<ProductionAdvisorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ProductionQueueFilters>(() =>
    defaultProductionQueueFilters(),
  )
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const [rows, carrierRows] = await Promise.all([
          fetchProductionApplications(supabase, { includeDeleted: false }),
          fetchProductionCarrierOptions(supabase),
        ])
        if (!cancelled) {
          setItems(rows)
          setCarriers(carrierRows)
        }
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setError('Unable to load production applications. Please try again.')
          if (import.meta.env.DEV) {
            console.error(
              '[crm/production]',
              formatProductionSupabaseError('production-list', err),
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
  }, [reloadKey])

  useEffect(() => {
    if (!isOwner) {
      setAdvisors([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchProductionAdvisorOptions(supabase)
        if (!cancelled) setAdvisors(rows)
      } catch {
        if (!cancelled) setAdvisors([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwner])

  const filteredItems = useMemo(
    () => applyProductionQueueView(items, filters),
    [items, filters],
  )

  const viewState = getProductionListViewState({
    loading,
    error,
    totalCount: items.length,
    filteredCount: filteredItems.length,
  })

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.stages !== 'all' ||
    filters.productLine !== 'all' ||
    filters.carrierId !== 'all' ||
    filters.writingAdvisorId !== 'all' ||
    filters.followUpOverdueOnly ||
    filters.staleOnly

  function resetFilters() {
    setFilters(defaultProductionQueueFilters())
  }

  function updateFilter<K extends keyof ProductionQueueFilters>(
    key: K,
    value: ProductionQueueFilters[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="crm-page crm-opportunities-page crm-production-page">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Production</p>
          <h1 className="crm-page-title">Life / IUL / FIA production</h1>
          <p className="crm-page-subtitle">
            Track applications through underwriting, delivery, and in force. Creating and editing
            cases arrives in the next production slice.
          </p>
        </div>
      </header>

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}{' '}
          <button type="button" className="crm-text-btn" onClick={() => setReloadKey((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      <section
        className="crm-panel crm-opportunities-filters-grid"
        aria-label="Production filters"
      >
        <label className="crm-field">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Household, app #, policy #, carrier, product"
            disabled={loading}
          />
        </label>

        <label className="crm-field">
          <span>Stage</span>
          <select
            value={filters.stages === 'all' ? 'all' : filters.stages[0] ?? 'all'}
            onChange={(e) => {
              const value = e.target.value
              updateFilter(
                'stages',
                value === 'all' ? 'all' : [value as ProductionStage],
              )
            }}
            disabled={loading}
          >
            <option value="all">All stages</option>
            {PRODUCTION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {formatProductionStageLabel(stage)}
              </option>
            ))}
          </select>
        </label>

        <label className="crm-field">
          <span>Product line</span>
          <select
            value={filters.productLine}
            onChange={(e) =>
              updateFilter(
                'productLine',
                e.target.value === 'all'
                  ? 'all'
                  : (e.target.value as ProductionProductLine),
              )
            }
            disabled={loading}
          >
            <option value="all">All lines</option>
            {PRODUCTION_PRODUCT_LINES.map((line) => (
              <option key={line} value={line}>
                {formatProductionProductLineLabel(line)}
              </option>
            ))}
          </select>
        </label>

        <label className="crm-field">
          <span>Carrier</span>
          <select
            value={filters.carrierId}
            onChange={(e) => updateFilter('carrierId', e.target.value)}
            disabled={loading}
          >
            <option value="all">All carriers</option>
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
        </label>

        {isOwner ? (
          <label className="crm-field">
            <span>Writing advisor</span>
            <select
              value={filters.writingAdvisorId}
              onChange={(e) => updateFilter('writingAdvisorId', e.target.value)}
              disabled={loading}
            >
              <option value="all">All advisors</option>
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.display_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="crm-field crm-production-check-field">
          <span>Follow-up overdue</span>
          <input
            type="checkbox"
            checked={filters.followUpOverdueOnly}
            onChange={(e) => updateFilter('followUpOverdueOnly', e.target.checked)}
            disabled={loading}
          />
        </label>

        <label className="crm-field crm-production-check-field">
          <span>{PRODUCTION_STALE_DAYS_IN_STAGE}+ days in stage</span>
          <input
            type="checkbox"
            checked={filters.staleOnly}
            onChange={(e) => updateFilter('staleOnly', e.target.checked)}
            disabled={loading}
          />
        </label>

        {hasActiveFilters ? (
          <div className="crm-opportunities-filters-actions">
            <button type="button" className="crm-text-btn" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      <section className="crm-panel" aria-labelledby="crm-production-list-heading">
        <div className="crm-panel-head">
          <h2 id="crm-production-list-heading">
            Applications ({loading ? '…' : filteredItems.length})
          </h2>
        </div>

        {viewState.kind === 'loading' ? (
          <p className="crm-muted">Loading production applications…</p>
        ) : null}

        {viewState.kind === 'empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No production applications yet</p>
            <p>
              When Life, IUL, or FIA cases are entered, they will appear here. Catalog setup and
              case creation ship in the next Production slice.
            </p>
            <p className="crm-muted">
              Issued book placeholder remains at <Link to="/crm/policies">/crm/policies</Link>.
            </p>
          </div>
        ) : null}

        {viewState.kind === 'filtered_empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No matching applications</p>
            <p>
              {filters.search.trim()
                ? `No applications match “${filters.search.trim()}” with the current filters.`
                : 'No applications match the selected filters.'}
            </p>
            <button type="button" className="crm-text-btn" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        ) : null}

        {viewState.kind === 'ready' ? (
          presentation === 'table' ? (
            <ProductionQueueTable items={filteredItems} />
          ) : (
            <ProductionQueueCards items={filteredItems} />
          )
        ) : null}
      </section>
    </div>
  )
}
