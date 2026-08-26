import { Link } from 'react-router-dom'
import { formatCommissionBpsPercent, formatWritingContractLevel } from '../../production/compensationLabels'
import { formatProductionStageLabel } from '../../production/labels'
import { formatProductionDate } from '../../production/productionApi'
import { formatSignedCents } from '../../production/compensationView'
import {
  PENDING_IS_NOT_PAID_COPY,
  RECORD_PAYMENT_ACTION_LABEL,
  acceptedPendingRecordPaymentPath,
} from '../commissionPendingPayment'
import type {
  ImportAllocationCandidate,
  ImportApplicationCandidate,
} from '../import/commissionImportApi'
import type { PendingDuplicatePeerView } from './commissionPendingApi'
import {
  canConfirmPendingDistinct,
  canConfirmPendingDuplicate,
  canResolvePendingRow,
  isExcludedFromPendingAcceptance,
  pendingExclusionCopy,
} from './commissionPendingReview'
import {
  formatPendingSectionLabel,
  type CommissionPendingBatchView,
  type CommissionPendingRowView,
} from './commissionPendingView'

export type PendingReviewMode = 'review' | 'distinct' | null

export type PendingWorkflowState = {
  applications: readonly ImportApplicationCandidate[]
  allocations: readonly ImportAllocationCandidate[]
  applicationsLoading: boolean
  allocationsLoading: boolean
  peers: readonly PendingDuplicatePeerView[]
  peersLoading: boolean
  reviewRowId: string | null
  reviewMode: PendingReviewMode
  applicationId: string | null
  allocationId: string | null
  reviewReason: string
  actionError: string | null
  submitting: boolean
  onStartReview: (row: CommissionPendingRowView) => void
  onStartDistinct: (row: CommissionPendingRowView) => void
  onOpenDuplicate: (row: CommissionPendingRowView) => void
  onCancelReview: () => void
  onApplicationChange: (id: string) => void
  onAllocationChange: (id: string) => void
  onReviewReasonChange: (reason: string) => void
  onSubmitAccept: () => void
  onConfirmDuplicate: (row: CommissionPendingRowView) => void
}

export function PendingRowActions({
  row,
  batch,
  workflow,
}: {
  row: CommissionPendingRowView
  batch: CommissionPendingBatchView
  workflow: PendingWorkflowState
}) {
  const excluded = isExcludedFromPendingAcceptance(row)
  const exclusion = pendingExclusionCopy(row)
  const isReviewing = workflow.reviewRowId === row.id
  const recordPaymentPath = acceptedPendingRecordPaymentPath(row)

  return (
    <div className="crm-commissions-import-row-actions">
      {excluded ? <p className="crm-commissions-import-override">{exclusion}</p> : null}

      {canResolvePendingRow(row) ? (
        <button
          type="button"
          className="crm-secondary-btn"
          onClick={() => workflow.onStartReview(row)}
          disabled={workflow.submitting}
        >
          Resolve
        </button>
      ) : null}

      {canConfirmPendingDuplicate(row) ? (
        <button
          type="button"
          className="crm-secondary-btn"
          onClick={() => workflow.onOpenDuplicate(row)}
          disabled={workflow.submitting}
        >
          Review possible duplicate
        </button>
      ) : null}

      {row.pending_review_status === 'duplicate' ? (
        <p>This source transaction is preserved as a duplicate. It is not accepted Pending.</p>
      ) : null}

      {row.pending_review_status === 'accepted_pending' ? (
        <div>
          <p className="crm-muted">{PENDING_IS_NOT_PAID_COPY}</p>
          {recordPaymentPath ? (
            <p>
              <Link to={recordPaymentPath} className="crm-primary-btn">
                {RECORD_PAYMENT_ACTION_LABEL}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {isReviewing && canConfirmPendingDuplicate(row) ? (
        <DuplicateComparison
          row={row}
          batch={batch}
          peers={workflow.peers}
          loading={workflow.peersLoading}
        />
      ) : null}

      {isReviewing && canConfirmPendingDuplicate(row) && workflow.reviewMode !== 'distinct' ? (
        <div className="crm-form-actions">
          <button
            type="button"
            className="crm-secondary-btn"
            onClick={() => workflow.onConfirmDuplicate(row)}
            disabled={workflow.submitting}
          >
            Confirm Duplicate
          </button>
          {canConfirmPendingDistinct(row) ? (
            <button
              type="button"
              className="crm-primary-btn"
              onClick={() => workflow.onStartDistinct(row)}
              disabled={workflow.submitting}
            >
              Confirm Distinct
            </button>
          ) : null}
          <button type="button" className="crm-text-btn" onClick={workflow.onCancelReview} disabled={workflow.submitting}>
            Cancel
          </button>
        </div>
      ) : null}

      {isReviewing && (workflow.reviewMode === 'review' || workflow.reviewMode === 'distinct') ? (
        <PendingResolutionForm row={row} batch={batch} workflow={workflow} />
      ) : null}

      {workflow.actionError && isReviewing ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {workflow.actionError}
        </p>
      ) : null}
    </div>
  )
}

function DuplicateComparison({
  row,
  batch,
  peers,
  loading,
}: {
  row: CommissionPendingRowView
  batch: CommissionPendingBatchView
  peers: readonly PendingDuplicatePeerView[]
  loading: boolean
}) {
  return (
    <div className="crm-commissions-import-duplicate-compare">
      <h3>Duplicate comparison</h3>
      {loading ? <p>Loading matching source rows…</p> : null}
      <DuplicateFactCard
        title="Current row"
        row={row}
        statementIdentifier={batch.statement_identifier}
        sourceFile={batch.source_file}
        statementDate={batch.statement_date}
      />
      {peers.length === 0 && !loading ? (
        <p className="crm-muted">No other in-memory or fingerprint matches are listed yet.</p>
      ) : null}
      {peers.map((peer) => (
        <DuplicateFactCard
          key={peer.id}
          title="Possible existing match"
          row={peer}
          statementIdentifier={peer.statementIdentifier}
          sourceFile={peer.sourceFile}
          statementDate={null}
        />
      ))}
    </div>
  )
}

function DuplicateFactCard({
  title,
  row,
  statementIdentifier,
  sourceFile,
  statementDate,
}: {
  title: string
  row: CommissionPendingRowView
  statementIdentifier: string | null
  sourceFile: string | null
  statementDate: string | null
}) {
  return (
    <article className="crm-panel">
      <h4>{title}</h4>
      <dl className="crm-production-detail-grid">
        <div>
          <dt>Source client</dt>
          <dd>{row.source_client || '—'}</dd>
        </div>
        <div>
          <dt>Source policy #</dt>
          <dd>{row.source_policy_number || '—'}</dd>
        </div>
        <div>
          <dt>Company / carrier</dt>
          <dd>{row.source_company || '—'}</dd>
        </div>
        <div>
          <dt>Writing associate</dt>
          <dd>{row.source_writing_associate || '—'}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{row.source_type || '—'}</dd>
        </div>
        <div>
          <dt>Income</dt>
          <dd className="crm-production-money">{formatSignedCents(row.source_income_cents)}</dd>
        </div>
        <div>
          <dt>Transaction date</dt>
          <dd>{formatProductionDate(row.transaction_date)}</dd>
        </div>
        <div>
          <dt>Statement</dt>
          <dd>
            {statementIdentifier || '—'}
            {statementDate ? ` · ${formatProductionDate(statementDate)}` : ''}
          </dd>
        </div>
        <div>
          <dt>Source file</dt>
          <dd>{sourceFile || '—'}</dd>
        </div>
      </dl>
    </article>
  )
}

function PendingResolutionForm({
  row,
  batch,
  workflow,
}: {
  row: CommissionPendingRowView
  batch: CommissionPendingBatchView
  workflow: PendingWorkflowState
}) {
  const heading =
    workflow.reviewMode === 'distinct'
      ? 'Confirm this row is distinct'
      : 'Resolve application and live writing allocation'
  return (
    <form
      className="crm-commissions-import-resolve"
      onSubmit={(event) => {
        event.preventDefault()
        if (!workflow.submitting) workflow.onSubmitAccept()
      }}
    >
      <h3>{heading}</h3>
      <p className="crm-muted">
        Source Income is immutable. Split % is reference only and does not calculate Pending.
      </p>
      <LockedSourceContext row={row} batch={batch} />
      <p>
        Income: <span className="crm-production-money">{formatSignedCents(row.source_income_cents)}</span>
      </p>

      <fieldset className="crm-field">
        <legend>Production application</legend>
        {workflow.applicationsLoading ? <p>Loading matching applications…</p> : null}
        {!workflow.applicationsLoading && workflow.applications.length === 0 ? (
          <p>
            No Production applications match the source policy number
            {row.resolved_carrier_id ? ' and carrier' : ''}. The full Production book is not loaded.
          </p>
        ) : null}
        {workflow.applications.map((candidate) => (
          <label key={candidate.id} className="crm-commissions-import-choice">
            <input
              type="radio"
              name={`pending-application-${row.id}`}
              checked={workflow.applicationId === candidate.id}
              onChange={() => workflow.onApplicationChange(candidate.id)}
              disabled={workflow.submitting}
            />
            <span>
              {candidate.clientName || 'Client not listed'} · {candidate.carrierName || 'Carrier not listed'} ·{' '}
              {candidate.productName || 'Product not listed'} · Policy {candidate.policyNumber || '—'} · App{' '}
              {candidate.applicationNumber || candidate.id} ·{' '}
              {formatProductionStageLabel(candidate.productionStage)}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="crm-field">
        <legend>Writing allocation</legend>
        {!workflow.applicationId ? (
          <p className="crm-muted">Select an application to load its live writing allocations.</p>
        ) : workflow.allocationsLoading ? (
          <p>Loading writing allocations…</p>
        ) : workflow.allocations.length === 0 ? (
          <p>This application has no live writing allocations.</p>
        ) : (
          workflow.allocations.map((allocation) => (
            <label key={allocation.id} className="crm-commissions-import-choice">
              <input
                type="radio"
                name={`pending-allocation-${row.id}`}
                checked={workflow.allocationId === allocation.id}
                onChange={() => workflow.onAllocationChange(allocation.id)}
                disabled={workflow.submitting}
              />
              <span>
                {allocation.advisorName} · {formatCommissionBpsPercent(allocation.commissionBps)}
                {allocation.writingContractLevel
                  ? ` · ${formatWritingContractLevel(allocation.writingContractLevel)}`
                  : ''}
              </span>
            </label>
          ))
        )}
        {workflow.reviewMode === 'distinct' ? (
          <p className="crm-muted">
            Confirm Distinct does not copy a prior row’s writing allocation. Choose the allocation for
            this source row.
          </p>
        ) : null}
        {workflow.allocations.length > 1 ? (
          <p>Multiple writing allocations exist. Split % is not used to choose a writer or amount.</p>
        ) : null}
      </fieldset>

      <label className="crm-field">
        <span>Review note</span>
        <input
          value={workflow.reviewReason}
          onChange={(event) => workflow.onReviewReasonChange(event.target.value)}
          disabled={workflow.submitting}
        />
      </label>

      <div className="crm-form-actions">
        <button type="submit" className="crm-primary-btn" disabled={workflow.submitting}>
          {workflow.reviewMode === 'distinct' ? 'Confirm Distinct' : 'Resolve'}
        </button>
        <button type="button" className="crm-text-btn" onClick={workflow.onCancelReview} disabled={workflow.submitting}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function LockedSourceContext({
  row,
  batch,
}: {
  row: CommissionPendingRowView
  batch: CommissionPendingBatchView
}) {
  return (
    <dl className="crm-production-detail-grid">
      <div>
        <dt>Source client</dt>
        <dd>{row.source_client || '—'}</dd>
      </div>
      <div>
        <dt>Source policy #</dt>
        <dd>{row.source_policy_number || '—'}</dd>
      </div>
      <div>
        <dt>Company / carrier</dt>
        <dd>{row.source_company || '—'}</dd>
      </div>
      <div>
        <dt>Writing associate</dt>
        <dd>{row.source_writing_associate || '—'}</dd>
      </div>
      <div>
        <dt>Type</dt>
        <dd>{row.source_type || '—'}</dd>
      </div>
      <div>
        <dt>Income</dt>
        <dd className="crm-production-money">{formatSignedCents(row.source_income_cents)}</dd>
      </div>
      <div>
        <dt>Transaction date</dt>
        <dd>{formatProductionDate(row.transaction_date)}</dd>
      </div>
      <div>
        <dt>Statement</dt>
        <dd>
          {batch.statement_identifier}
          {batch.statement_date ? ` · ${formatProductionDate(batch.statement_date)}` : ''}
        </dd>
      </div>
      <div>
        <dt>Section</dt>
        <dd>{formatPendingSectionLabel(row.source_section)}</dd>
      </div>
    </dl>
  )
}
