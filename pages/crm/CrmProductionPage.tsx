import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { crmNoteAuthorUserId } from '../../crm/households/noteAuthor'
import OperationalNotesDialog from '../../crm/households/OperationalNotesDialog'
import { localDateString } from '../../crm/dashboard/dates'
import ProductionBoard from '../../crm/production/ProductionBoard'
import ProductionDashboard from '../../crm/production/ProductionDashboard'
import ProductionQueueCards from '../../crm/production/ProductionQueueCards'
import ProductionQueueTable from '../../crm/production/ProductionQueueTable'
import ProductionViewToggle from '../../crm/production/ProductionViewToggle'
import StageTransitionConfirmDialog from '../../crm/production/StageTransitionConfirmDialog'
import { transitionPolicyApplicationStage } from '../../crm/production/applicationApi'
import { buildAdvisorCompensationDashboard } from '../../crm/production/advisorCompensationView'
import { getProductionBoardLayout } from '../../crm/production/boardView'
import {
  beginBoardMove,
  buildBoardTransitionRpcArgs,
  defaultBoardStageTransitionReason,
  interpretBoardMoveResult,
} from '../../crm/production/boardMovement'
import {
  DEFAULT_COMPENSATION_DASHBOARD_PERIOD,
  DEFAULT_PRODUCTION_DASHBOARD_PERIOD,
  type DashboardReportingPeriod,
} from '../../crm/production/dashboardPeriod'
import { buildProductionDashboard, type PaidCommissionListEvent } from '../../crm/production/dashboardView'
import {
  DEFAULT_PRODUCTION_QUEUE_VIEW,
  getProductionListPresentation,
  getProductionListViewState,
  productionListCapWarning,
  type ProductionQueueViewMode,
} from '../../crm/production/listLoadState'
import {
  fetchLiveExpectedCompensations,
  fetchPaidCommissionEvents,
  formatCompensationDevError,
} from '../../crm/production/compensationApi'
import {
  EXPECTED_LIST_LOAD_ERROR,
  PAID_LIST_LOAD_ERROR,
} from '../../crm/production/compensationErrors'
import {
  fetchProductionAdvisorOptions,
  fetchProductionApplications,
  fetchProductionCarrierOptions,
  formatProductionSupabaseError,
  PRODUCTION_LIST_DEFAULT_LIMIT,
} from '../../crm/production/productionApi'
import type { CompensationViewer } from '../../crm/production/types'
import {
  applyProductionQueueView,
  defaultProductionQueueFilters,
  writtenStateFilterOptions,
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
import { type StageTransitionAction } from '../../crm/production/stageTransitionView'
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
  const { role, profile } = useCrmAuth()
  const isOwner = role === 'owner'
  const viewer: CompensationViewer = role === 'owner' ? 'owner' : 'advisor'
  const viewportWidth = useViewportWidth()
  const tablePresentation = getProductionListPresentation(viewportWidth)
  const boardLayout = getProductionBoardLayout(viewportWidth)

  const [items, setItems] = useState<ProductionApplicationListItem[]>([])
  const [carriers, setCarriers] = useState<ProductionCarrierOption[]>([])
  const [advisors, setAdvisors] = useState<ProductionAdvisorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expectedError, setExpectedError] = useState<string | null>(null)
  const [paidError, setPaidError] = useState<string | null>(null)
  const [paidEvents, setPaidEvents] = useState<PaidCommissionListEvent[]>([])
  const [filters, setFilters] = useState<ProductionQueueFilters>(() =>
    defaultProductionQueueFilters(),
  )
  const [productionPeriod, setProductionPeriod] = useState<DashboardReportingPeriod>(
    DEFAULT_PRODUCTION_DASHBOARD_PERIOD,
  )
  const [compensationPeriod, setCompensationPeriod] = useState<DashboardReportingPeriod>(
    DEFAULT_COMPENSATION_DASHBOARD_PERIOD,
  )
  const [viewMode, setViewMode] = useState<ProductionQueueViewMode>(DEFAULT_PRODUCTION_QUEUE_VIEW)
  const [reloadKey, setReloadKey] = useState(0)
  const [notesTarget, setNotesTarget] = useState<{
    householdId: string
    householdName: string
  } | null>(null)
  const [pendingMove, setPendingMove] = useState<{
    item: ProductionApplicationListItem
    action: StageTransitionAction
  } | null>(null)
  const [movementBusy, setMovementBusy] = useState(false)
  const [movementError, setMovementError] = useState<string | null>(null)
  const [boardFocusStage, setBoardFocusStage] = useState<ProductionStage | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setExpectedError(null)
      setPaidError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const [rows, carrierRows] = await Promise.all([
          fetchProductionApplications(supabase, { includeDeleted: false }),
          fetchProductionCarrierOptions(supabase),
        ])
        let expectedByApp = new Map<string, typeof rows[number]['expected_compensations']>()
        let expectedLoadError: string | null = null
        let paidRows: PaidCommissionListEvent[] = []
        let paidLoadError: string | null = null
        const applicationIds = rows.map((row) => row.id)
        const [expectedResult, paidResult] = await Promise.allSettled([
          fetchLiveExpectedCompensations(supabase, applicationIds),
          fetchPaidCommissionEvents(supabase, applicationIds),
        ])
        if (expectedResult.status === 'fulfilled') {
          expectedByApp = expectedResult.value
        } else {
          expectedLoadError = EXPECTED_LIST_LOAD_ERROR
          if (import.meta.env.DEV) {
            console.error(
              '[crm/production/expected]',
              formatCompensationDevError('production-expected-list', expectedResult.reason),
            )
          }
        }
        if (paidResult.status === 'fulfilled') {
          paidRows = paidResult.value
        } else {
          paidLoadError = PAID_LIST_LOAD_ERROR
          if (import.meta.env.DEV) {
            console.error(
              '[crm/production/paid]',
              formatCompensationDevError('production-paid-list', paidResult.reason),
            )
          }
        }
        if (!cancelled) {
          setItems(
            rows.map((row) => ({
              ...row,
              expected_compensations: expectedByApp.get(row.id) ?? [],
            })),
          )
          setPaidEvents(paidRows)
          setCarriers(carrierRows)
          setExpectedError(expectedLoadError)
          setPaidError(paidLoadError)
        }
      } catch (err) {
        if (!cancelled) {
          setItems([])
          setPaidEvents([])
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

  const today = localDateString()
  const dashboard = useMemo(
    () => buildProductionDashboard(filteredItems, { period: productionPeriod, today }),
    [filteredItems, productionPeriod, today],
  )
  const compensation = useMemo(
    () =>
      buildAdvisorCompensationDashboard({
        items: filteredItems,
        events: paidEvents,
        period: compensationPeriod,
        today,
      }),
    [filteredItems, paidEvents, compensationPeriod, today],
  )
  const writtenStates = useMemo(() => writtenStateFilterOptions(items), [items])
  const capWarning = productionListCapWarning(items.length, PRODUCTION_LIST_DEFAULT_LIMIT)

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
    filters.writtenState !== 'all' ||
    filters.submissionDateFrom.trim() !== '' ||
    filters.submissionDateTo.trim() !== '' ||
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

  async function runBoardTransition(
    item: ProductionApplicationListItem,
    action: StageTransitionAction,
    input: { reason: string; policyNumber: string },
  ) {
    if (movementBusy) return
    setMovementBusy(true)
    setMovementError(null)
    const supabase = createSupabaseBrowserClient()
    const result = await transitionPolicyApplicationStage(
      supabase,
      buildBoardTransitionRpcArgs(item, action, input),
    )
    const outcome = interpretBoardMoveResult(result.ok, result.ok ? null : result.message, action.toStage)
    if (outcome.kind !== 'success') {
      setMovementError(outcome.message)
      setMovementBusy(false)
      if (outcome.kind === 'stale') {
        setPendingMove(null)
        setReloadKey((n) => n + 1)
      }
      return
    }
    setPendingMove(null)
    setMovementBusy(false)
    setBoardFocusStage(action.toStage)
    setReloadKey((n) => n + 1)
  }

  function requestBoardMove(item: ProductionApplicationListItem, toStage: ProductionStage) {
    if (movementBusy) return
    const plan = beginBoardMove(item, toStage, role)
    if (plan.kind === 'ignore') return
    setMovementError(null)
    if (plan.kind === 'confirm') {
      setPendingMove({ item, action: plan.action })
      return
    }
    void runBoardTransition(item, plan.action, {
      reason: defaultBoardStageTransitionReason(plan.action.toStage),
      policyNumber: item.policy_number ?? '',
    })
  }

  return (
    <div className="crm-page crm-opportunities-page crm-production-page">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Production</p>
          <h1 className="crm-page-title">Life / IUL / FIA production</h1>
          <p className="crm-page-subtitle">
            Track applications through underwriting, delivery, and in force. Enter an existing
            Life, IUL, or FIA case, including cases already in underwriting.
          </p>
        </div>
        <div className="crm-production-header-actions">
          <Link to={ROUTES.crmProductionNew} className="crm-primary-btn">
            New application
          </Link>
          {isOwner ? (
            <Link to={ROUTES.crmProductionCatalog} className="crm-secondary-btn">
              Manage carriers & products
            </Link>
          ) : null}
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

      {expectedError ? (
        <div className="crm-banner crm-banner-warning" role="status">
          {expectedError}{' '}
          <button type="button" className="crm-text-btn" onClick={() => setReloadKey((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {paidError ? (
        <div className="crm-banner crm-banner-warning" role="status">
          {paidError}{' '}
          <button type="button" className="crm-text-btn" onClick={() => setReloadKey((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {movementError && !pendingMove ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {movementError}
        </div>
      ) : null}

      {capWarning ? (
        <div className="crm-banner crm-banner-warning" role="status">
          {capWarning}
        </div>
      ) : null}

      <ProductionDashboard
        model={dashboard}
        compensation={compensation}
        productionPeriod={productionPeriod}
        compensationPeriod={compensationPeriod}
        onProductionPeriodChange={setProductionPeriod}
        onCompensationPeriodChange={setCompensationPeriod}
        loading={loading}
      />

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

        <label className="crm-field">
          <span>Written state</span>
          <select
            value={filters.writtenState}
            onChange={(e) => updateFilter('writtenState', e.target.value)}
            disabled={loading}
          >
            <option value="all">All states</option>
            {writtenStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label className="crm-field">
          <span>Submitted from</span>
          <input
            type="date"
            value={filters.submissionDateFrom}
            onChange={(e) => updateFilter('submissionDateFrom', e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="crm-field">
          <span>Submitted to</span>
          <input
            type="date"
            value={filters.submissionDateTo}
            onChange={(e) => updateFilter('submissionDateTo', e.target.value)}
            disabled={loading}
          />
        </label>

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
        <div className="crm-panel-head crm-production-view-head">
          <h2 id="crm-production-list-heading">
            Applications ({loading ? '…' : filteredItems.length})
          </h2>
          <ProductionViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {viewState.kind === 'loading' ? (
          <p className="crm-muted">Loading production applications…</p>
        ) : null}

        {viewState.kind === 'empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No production applications yet</p>
            <p>
              When Life, IUL, or FIA cases are entered, they will appear here. Use New application
              to record a current case. Owners can set up carriers and products from Manage
              carriers & products.
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

        {viewState.kind === 'ready' && viewMode === 'board' ? (
          <ProductionBoard
            items={filteredItems}
            layout={boardLayout}
            stageFilter={filters.stages}
            role={role}
            movementBusy={movementBusy}
            focusStage={boardFocusStage}
            onOpenNotes={setNotesTarget}
            onRequestMove={requestBoardMove}
          />
        ) : null}

        {viewState.kind === 'ready' && viewMode === 'table' ? (
          tablePresentation === 'table' ? (
            <ProductionQueueTable items={filteredItems} viewer={viewer} />
          ) : (
            <ProductionQueueCards items={filteredItems} viewer={viewer} />
          )
        ) : null}
      </section>

      {pendingMove ? (
        <div className="crm-production-review-overlay">
          <StageTransitionConfirmDialog
            action={pendingMove.action}
            submitting={movementBusy}
            error={movementError}
            initialPolicyNumber={pendingMove.item.policy_number ?? ''}
            onCancel={() => {
              if (movementBusy) return
              setPendingMove(null)
              setMovementError(null)
            }}
            onConfirm={(input) => {
              void runBoardTransition(pendingMove.item, pendingMove.action, input)
            }}
          />
        </div>
      ) : null}

      {notesTarget ? (
        <OperationalNotesDialog
          householdId={notesTarget.householdId}
          householdName={notesTarget.householdName}
          authorUserId={crmNoteAuthorUserId(profile)}
          onClose={() => setNotesTarget(null)}
        />
      ) : null}
    </div>
  )
}
