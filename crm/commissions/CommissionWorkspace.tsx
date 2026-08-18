import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import type {
  AdvisorCompensationDashboardModel,
  ExpectedReviewListItem,
} from '../production/advisorCompensationView'
import { formatSignedCents, type WritingCommissionEvent } from '../production/compensationView'
import type { WritingCommissionSnapshotView } from '../production/compensationApi'
import type { DashboardReportingPeriod } from '../production/dashboardPeriod'
import ExpectedReviewDialog from '../production/ExpectedReviewDialog'
import { formatProductionProductLineLabel, formatProductionStageLabel } from '../production/labels'
import { getProductionListPresentation } from '../production/listLoadState'
import type {
  CompensationViewer,
  ProductionAdvisorOption,
  ProductionCarrierOption,
  ProductionProductLine,
  ProductionStage,
} from '../production/types'
import { PRODUCTION_PRODUCT_LINES, PRODUCTION_STAGES } from '../production/types'
import CommissionAdvisorBreakdown from './CommissionAdvisorBreakdown'
import CommissionQueueCards from './CommissionQueueCards'
import CommissionQueueTable from './CommissionQueueTable'
import CommissionSummary from './CommissionSummary'
import CommissionWorkItemDetail from './CommissionWorkItemDetail'
import type { CommissionAdvisorPendingRow } from './commissionPendingRead'
import {
  defaultCommissionQueueFilters,
  hasActiveCommissionFilters,
  type CommissionQueueFilters,
} from './commissionFilters'
import {
  COMMISSION_WORK_DERIVED_STATUSES,
  formatCommissionWorkStatusLabel,
  type CommissionWorkDerivedStatus,
  type CommissionWorkItem,
  type UnattributedCommissionSummary,
} from './commissionWorkView'

type ReviewScope = 'all' | { advisorId: string | null }

type CommissionWorkspaceProps = {
  viewer: CompensationViewer
  isOwner: boolean
  loading: boolean
  error: string | null
  expectedError: string | null
  paidError: string | null
  pendingError: string | null
  capWarning: string | null
  compensation: AdvisorCompensationDashboardModel
  pendingCents: number
  pendingReviewCopy: string | null
  advisorRows: readonly CommissionAdvisorPendingRow[]
  period: DashboardReportingPeriod
  onPeriodChange: (next: DashboardReportingPeriod) => void
  workItems: readonly CommissionWorkItem[]
  filteredWorkItems: readonly CommissionWorkItem[]
  filters: CommissionQueueFilters
  onFiltersChange: (next: CommissionQueueFilters) => void
  carriers: readonly ProductionCarrierOption[]
  advisors: readonly ProductionAdvisorOption[]
  unattributed: UnattributedCommissionSummary | null
  viewportWidth: number
  reviewScope: ReviewScope | null
  reviewItems: readonly ExpectedReviewListItem[]
  onReviewScopeChange: (scope: ReviewScope | null) => void
  selectedItem: CommissionWorkItem | null
  onSelectItem: (item: CommissionWorkItem | null) => void
  snapshot: WritingCommissionSnapshotView | null
  snapshotLoading: boolean
  snapshotError: string | null
  onRetry: () => void
  onRecord: (item: CommissionWorkItem) => void
  onPreIssue: (item: CommissionWorkItem) => void
  onReverse: (item: CommissionWorkItem, event: WritingCommissionEvent) => void
  onAttribute: (item: CommissionWorkItem, event: WritingCommissionEvent) => void
  writeDialogOpen?: boolean
}

export default function CommissionWorkspace({
  viewer,
  isOwner,
  loading,
  error,
  expectedError,
  paidError,
  pendingError,
  capWarning,
  compensation,
  pendingCents,
  pendingReviewCopy,
  advisorRows,
  period,
  onPeriodChange,
  workItems,
  filteredWorkItems,
  filters,
  onFiltersChange,
  carriers,
  advisors,
  unattributed,
  viewportWidth,
  reviewScope,
  reviewItems,
  onReviewScopeChange,
  selectedItem,
  onSelectItem,
  snapshot,
  snapshotLoading,
  snapshotError,
  onRetry,
  onRecord,
  onPreIssue,
  onReverse,
  onAttribute,
  writeDialogOpen = false,
}: CommissionWorkspaceProps) {
  const presentation = getProductionListPresentation(viewportWidth)
  const reviewTitle =
    reviewScope === 'all'
      ? 'Expected compensation needing review'
      : 'Advisor expected compensation needing review'

  const viewState = useMemo(() => {
    if (loading) return 'loading' as const
    if (error) return 'error' as const
    if (workItems.length === 0) return 'empty' as const
    if (filteredWorkItems.length === 0) return 'filtered_empty' as const
    return 'ready' as const
  }, [loading, error, workItems.length, filteredWorkItems.length])

  function updateFilter<K extends keyof CommissionQueueFilters>(
    key: K,
    value: CommissionQueueFilters[K],
  ) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="crm-page crm-opportunities-page crm-commissions-page">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Commissions</p>
          <h1 className="crm-page-title">Commission workspace</h1>
          <p className="crm-page-subtitle">
            Track writing-advisor expected compensation, outstanding amounts, and actual paid
            commission. Production underwriting stages stay on Production.
          </p>
        </div>
        {isOwner ? (
          <div className="crm-production-header-actions">
            <Link to={ROUTES.crmCommissionsImport} className="crm-primary-btn">
              Import Statement
            </Link>
            <Link to={ROUTES.crmCommissionsPendingImport} className="crm-secondary-btn">
              Import Pending Statement
            </Link>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}{' '}
          <button type="button" className="crm-text-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}
      {expectedError ? (
        <div className="crm-banner crm-banner-warning" role="status">
          {expectedError}{' '}
          <button type="button" className="crm-text-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}
      {paidError ? (
        <div className="crm-banner crm-banner-warning" role="status">
          {paidError}{' '}
          <button type="button" className="crm-text-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}
      {isOwner && pendingError ? (
        <div className="crm-banner crm-banner-warning" role="status">
          {pendingError}{' '}
          <button type="button" className="crm-text-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}
      {capWarning ? (
        <div className="crm-banner crm-banner-warning" role="status">
          {capWarning}
        </div>
      ) : null}

      <CommissionSummary
        compensation={compensation}
        pendingCents={pendingCents}
        pendingReviewCopy={pendingReviewCopy}
        isOwner={isOwner}
        period={period}
        onPeriodChange={onPeriodChange}
        loading={loading}
        onReviewAll={() => onReviewScopeChange('all')}
      />

      {unattributed && isOwner ? (
        <div className="crm-banner crm-banner-warning" role="status">
          Unattributed / needs attribution: {unattributed.eventCount}{' '}
          {unattributed.eventCount === 1 ? 'event' : 'events'} across {unattributed.applicationCount}{' '}
          {unattributed.applicationCount === 1 ? 'record' : 'records'} ·{' '}
          <span className="crm-production-money">{formatSignedCents(unattributed.netCents)}</span>
          {' · '}
          <button
            type="button"
            className="crm-text-btn"
            onClick={() => updateFilter('advisorId', 'unattributed')}
          >
            Show in queue
          </button>
        </div>
      ) : null}

      <CommissionAdvisorBreakdown
        rows={advisorRows}
        isOwner={isOwner}
        selectedAdvisorId={filters.advisorId}
        onSelectAdvisor={(advisorId) => updateFilter('advisorId', advisorId)}
        onReviewAdvisor={(advisorId) => onReviewScopeChange({ advisorId })}
      />

      <section className="crm-panel crm-opportunities-filters-grid" aria-label="Commission filters">
        <label className="crm-field">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Client, reference, provider, product, advisor"
            disabled={loading}
          />
        </label>
        {isOwner ? (
          <label className="crm-field">
            <span>Advisor</span>
            <select
              value={filters.advisorId}
              onChange={(e) =>
                updateFilter('advisorId', e.target.value as CommissionQueueFilters['advisorId'])
              }
              disabled={loading}
            >
              <option value="all">All advisors</option>
              {unattributed ? <option value="unattributed">Unattributed</option> : null}
              {advisors.map((advisor) => (
                <option key={advisor.id} value={advisor.id}>
                  {advisor.display_name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="crm-field">
          <span>Provider</span>
          <select
            value={filters.providerId}
            onChange={(e) => updateFilter('providerId', e.target.value)}
            disabled={loading}
          >
            <option value="all">All providers</option>
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="crm-field">
          <span>Product / Service</span>
          <select
            value={filters.productLine}
            onChange={(e) =>
              updateFilter(
                'productLine',
                e.target.value === 'all' ? 'all' : (e.target.value as ProductionProductLine),
              )
            }
            disabled={loading}
          >
            <option value="all">All products / services</option>
            {PRODUCTION_PRODUCT_LINES.map((line) => (
              <option key={line} value={line}>
                {formatProductionProductLineLabel(line)}
              </option>
            ))}
          </select>
        </label>
        <label className="crm-field">
          <span>Production stage</span>
          <select
            value={filters.productionStage}
            onChange={(e) =>
              updateFilter(
                'productionStage',
                e.target.value === 'all' ? 'all' : (e.target.value as ProductionStage),
              )
            }
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
          <span>Commission status</span>
          <select
            value={filters.derivedStatus}
            onChange={(e) =>
              updateFilter(
                'derivedStatus',
                e.target.value === 'all'
                  ? 'all'
                  : (e.target.value as CommissionWorkDerivedStatus),
              )
            }
            disabled={loading}
          >
            <option value="all">All statuses</option>
            {COMMISSION_WORK_DERIVED_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatCommissionWorkStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="crm-field crm-production-check-field">
          <span>Needs review</span>
          <input
            type="checkbox"
            checked={filters.needsReviewOnly}
            onChange={(e) => updateFilter('needsReviewOnly', e.target.checked)}
            disabled={loading}
          />
        </label>
        {hasActiveCommissionFilters(filters) ? (
          <div className="crm-opportunities-filters-actions">
            <button
              type="button"
              className="crm-text-btn"
              onClick={() => onFiltersChange(defaultCommissionQueueFilters())}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      <section className="crm-panel" aria-labelledby="crm-commissions-queue-heading">
        <div className="crm-panel-head">
          <h2 id="crm-commissions-queue-heading">
            Work queue ({loading ? '…' : filteredWorkItems.length})
          </h2>
        </div>
        {viewState === 'loading' ? <p className="crm-muted">Loading commission records…</p> : null}
        {viewState === 'empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No commission records yet</p>
            <p>
              Writing-advisor expected compensation and actual paid events will appear here.
              Carrier statement import is not staged from this workspace.
            </p>
          </div>
        ) : null}
        {viewState === 'filtered_empty' ? (
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">No matching commission records</p>
            <p>
              {filters.search.trim()
                ? `No records match “${filters.search.trim()}” with the current filters.`
                : 'No records match the selected filters.'}
            </p>
            <button
              type="button"
              className="crm-text-btn"
              onClick={() => onFiltersChange(defaultCommissionQueueFilters())}
            >
              Clear filters
            </button>
          </div>
        ) : null}
        {viewState === 'ready' ? (
          presentation === 'table' ? (
            <CommissionQueueTable
              items={filteredWorkItems}
              isOwner={isOwner}
              onOpenItem={onSelectItem}
              onRecord={onRecord}
              onPreIssue={onPreIssue}
            />
          ) : (
            <CommissionQueueCards
              items={filteredWorkItems}
              isOwner={isOwner}
              onOpenItem={onSelectItem}
              onRecord={onRecord}
              onPreIssue={onPreIssue}
            />
          )
        ) : null}
      </section>

      {reviewScope ? (
        <ExpectedReviewDialog
          items={[...reviewItems]}
          title={reviewTitle}
          onClose={() => onReviewScopeChange(null)}
        />
      ) : null}

      {selectedItem ? (
        <CommissionWorkItemDetail
          item={selectedItem}
          viewer={viewer}
          isOwner={isOwner}
          snapshot={snapshot}
          loading={snapshotLoading}
          error={snapshotError}
          closeOnEscape={!writeDialogOpen}
          onClose={() => onSelectItem(null)}
          onRecord={onRecord}
          onPreIssue={onPreIssue}
          onReverse={onReverse}
          onAttribute={onAttribute}
        />
      ) : null}
    </div>
  )
}
