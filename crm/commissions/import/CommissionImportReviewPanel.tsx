import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import {
  formatCommissionBpsPercent,
  formatCommissionEventTypeLabel,
  formatWritingContractLevel,
} from '../../production/compensationLabels'
import { formatProductionStageLabel } from '../../production/labels'
import { formatProductionDate } from '../../production/productionApi'
import { formatSignedCents } from '../../production/compensationView'
import type {
  DuplicatePeerView,
  ImportAllocationCandidate,
  ImportApplicationCandidate,
  PostedImportEventView,
} from './commissionImportApi'
import {
  IMPORT_POSTABLE_EVENT_TYPES,
  POST_LEDGER_WARNING_COPY,
  POSTED_CORRECTION_COPY,
  canConfirmDistinct,
  canConfirmDuplicate,
  canPostImportRow,
  canReviewImportRow,
  eventTypeAllowedForIncome,
  eventTypeSignError,
  isExcludedFromWritingCompensation,
  resultingSignedAmountCents,
  writingExclusionCopy,
} from './commissionImportReview'
import {
  formatImportSectionLabel,
  type CommissionImportBatchView,
  type CommissionImportRowView,
  type ResolvedImportContext,
} from './commissionImportView'

export type ImportReviewMode = 'review' | 'distinct' | null

export type ImportWorkflowState = {
  applications: readonly ImportApplicationCandidate[]
  allocations: readonly ImportAllocationCandidate[]
  applicationsLoading: boolean
  allocationsLoading: boolean
  peers: readonly DuplicatePeerView[]
  peersLoading: boolean
  postedEvents: Map<string, PostedImportEventView>
  reviewRowId: string | null
  reviewMode: ImportReviewMode
  applicationId: string | null
  allocationId: string | null
  eventType: string | null
  reviewReason: string
  postRowId: string | null
  postReason: string
  actionError: string | null
  submitting: boolean
  onStartReview: (row: CommissionImportRowView) => void
  onStartDistinct: (row: CommissionImportRowView) => void
  onOpenDuplicate: (row: CommissionImportRowView) => void
  onCancelReview: () => void
  onApplicationChange: (id: string) => void
  onAllocationChange: (id: string) => void
  onEventTypeChange: (type: string) => void
  onReviewReasonChange: (reason: string) => void
  onSubmitReady: () => void
  onConfirmDuplicate: (row: CommissionImportRowView) => void
  onRequestPost: (row: CommissionImportRowView) => void
  onPostReasonChange: (reason: string) => void
  onConfirmPost: () => void
  onCancelPost: () => void
}

export function ImportRowActions({
  row,
  batch,
  resolved,
  workflow,
}: {
  row: CommissionImportRowView
  batch: CommissionImportBatchView
  resolved?: ResolvedImportContext
  workflow: ImportWorkflowState
}) {
  const excluded = isExcludedFromWritingCompensation(row)
  const exclusion = writingExclusionCopy(row)
  const posted = row.posted_commission_event_id
    ? workflow.postedEvents.get(row.posted_commission_event_id)
    : undefined
  const isReviewing = workflow.reviewRowId === row.id
  const isPosting = workflow.postRowId === row.id

  return (
    <div className="crm-commissions-import-row-actions">
      {excluded ? (
        <p className="crm-commissions-import-override">{exclusion}</p>
      ) : null}

      {canReviewImportRow(row) ? (
        <button
          type="button"
          className="crm-secondary-btn"
          onClick={() => workflow.onStartReview(row)}
          disabled={workflow.submitting}
        >
          Resolve for posting
        </button>
      ) : null}

      {canConfirmDuplicate(row) ? (
        <button
          type="button"
          className="crm-secondary-btn"
          onClick={() => workflow.onOpenDuplicate(row)}
          disabled={workflow.submitting}
        >
          Review possible duplicate
        </button>
      ) : null}

      {canPostImportRow(row) ? (
        <button
          type="button"
          className="crm-primary-btn"
          onClick={() => workflow.onRequestPost(row)}
          disabled={workflow.submitting}
        >
          Post to Ledger
        </button>
      ) : null}

      {row.review_status === 'duplicate' ? (
        <p>This source transaction is preserved as a duplicate. It is not posted.</p>
      ) : null}

      {isReviewing && canConfirmDuplicate(row) ? (
        <DuplicateComparison
          row={row}
          batch={batch}
          peers={workflow.peers}
          loading={workflow.peersLoading}
        />
      ) : null}

      {isReviewing && canConfirmDuplicate(row) && workflow.reviewMode !== 'distinct' ? (
        <div className="crm-form-actions">
          <button
            type="button"
            className="crm-secondary-btn"
            onClick={() => workflow.onConfirmDuplicate(row)}
            disabled={workflow.submitting}
          >
            Confirm Duplicate
          </button>
          {canConfirmDistinct(row) ? (
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
        <ImportResolutionForm row={row} workflow={workflow} />
      ) : null}

      {isPosting && canPostImportRow(row) ? (
        <PostToLedgerDialog row={row} batch={batch} resolved={resolved} workflow={workflow} />
      ) : null}

      {posted ? <PostedEventFacts row={row} posted={posted} resolved={resolved} /> : null}

      {workflow.actionError && (isReviewing || isPosting) ? (
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
  row: CommissionImportRowView
  batch: CommissionImportBatchView
  peers: readonly DuplicatePeerView[]
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
}: {
  title: string
  row: CommissionImportRowView
  statementIdentifier?: string | null
  sourceFile?: string | null
}) {
  return (
    <article className="crm-panel crm-commissions-import-peer">
      <h4>{title}</h4>
      <dl className="crm-production-detail-grid">
        <div>
          <dt>Statement</dt>
          <dd>{statementIdentifier || '—'}</dd>
        </div>
        <div>
          <dt>Source file</dt>
          <dd>{sourceFile || '—'}</dd>
        </div>
        <div>
          <dt>Transaction date</dt>
          <dd>{formatProductionDate(row.transaction_date)}</dd>
        </div>
        <div>
          <dt>Company / carrier</dt>
          <dd>{row.source_company || '—'}</dd>
        </div>
        <div>
          <dt>Policy #</dt>
          <dd>{row.source_policy_number || '—'}</dd>
        </div>
        <div>
          <dt>Writing associate</dt>
          <dd>{row.source_writing_associate || '—'}</dd>
        </div>
        <div>
          <dt>Payment number</dt>
          <dd>{row.payment_number || '—'}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{row.source_type || '—'}</dd>
        </div>
        <div>
          <dt>Transaction type</dt>
          <dd>{row.source_transaction_type || '—'}</dd>
        </div>
        <div>
          <dt>Income</dt>
          <dd className="crm-production-money">{formatSignedCents(row.source_income_cents)}</dd>
        </div>
        <div>
          <dt>Source section</dt>
          <dd>{formatImportSectionLabel(row.source_section)}</dd>
        </div>
      </dl>
    </article>
  )
}

function ImportResolutionForm({
  row,
  workflow,
}: {
  row: CommissionImportRowView
  workflow: ImportWorkflowState
}) {
  const selectedAllocation = workflow.allocations.find((item) => item.id === workflow.allocationId) ?? null
  const signError = eventTypeSignError(workflow.eventType, row.source_income_cents)
  const heading =
    workflow.reviewMode === 'distinct'
      ? 'Confirm this row is distinct'
      : 'Resolve application, writing allocation, and event type'

  return (
    <form
      className="crm-commissions-import-resolve"
      onSubmit={(event) => {
        event.preventDefault()
        if (!workflow.submitting) workflow.onSubmitReady()
      }}
    >
      <h3>{heading}</h3>
      <p className="crm-muted">
        Source Income is immutable. Experior Income is the financial fact. Split % is not used to
        calculate amount.
      </p>
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
              name={`import-application-${row.id}`}
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
                name={`import-allocation-${row.id}`}
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
        <span>Resolved event type</span>
        <select
          value={workflow.eventType ?? ''}
          onChange={(event) => workflow.onEventTypeChange(event.target.value)}
          disabled={workflow.submitting}
        >
          <option value="">Select event type</option>
          {IMPORT_POSTABLE_EVENT_TYPES.map((type) => (
            <option
              key={type}
              value={type}
              disabled={!eventTypeAllowedForIncome(type, row.source_income_cents)}
            >
              {formatCommissionEventTypeLabel(type)}
            </option>
          ))}
        </select>
      </label>
      {signError && workflow.eventType ? <p className="crm-banner crm-banner-error">{signError}</p> : null}
      {row.source_income_cents < 0 && !row.source_is_chargeback_visual ? (
        <p>Negative transaction needs classification. It is not a confirmed chargeback.</p>
      ) : null}

      <label className="crm-field">
        <span>Owner reason</span>
        <textarea
          value={workflow.reviewReason}
          onChange={(event) => workflow.onReviewReasonChange(event.target.value)}
          disabled={workflow.submitting}
        />
      </label>

      {selectedAllocation ? (
        <p className="crm-muted">
          Posting grain is allocation {selectedAllocation.id} for {selectedAllocation.advisorName}.
        </p>
      ) : null}

      <div className="crm-form-actions">
        <button type="submit" className="crm-primary-btn" disabled={workflow.submitting}>
          {workflow.reviewMode === 'distinct' ? 'Confirm distinct resolution' : 'Confirm resolution'}
        </button>
        <button type="button" className="crm-secondary-btn" onClick={workflow.onCancelReview} disabled={workflow.submitting}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function PostToLedgerDialog({
  row,
  batch,
  resolved,
  workflow,
}: {
  row: CommissionImportRowView
  batch: CommissionImportBatchView
  resolved?: ResolvedImportContext
  workflow: ImportWorkflowState
}) {
  const allocation = workflow.allocations.find((item) => item.id === row.resolved_allocation_id)
  return (
    <section className="crm-panel crm-commissions-import-post-dialog" role="dialog" aria-labelledby={`post-ledger-${row.id}`}>
      <h3 id={`post-ledger-${row.id}`}>Post this row to the ledger?</h3>
      <p>{POST_LEDGER_WARNING_COPY}</p>
      <dl className="crm-production-detail-grid">
        <div>
          <dt>Client</dt>
          <dd>{resolved?.clientName || row.source_client || '—'}</dd>
        </div>
        <div>
          <dt>Carrier</dt>
          <dd>{resolved?.carrierName || row.source_company || '—'}</dd>
        </div>
        <div>
          <dt>Product</dt>
          <dd>{resolved?.productName || row.source_product || '—'}</dd>
        </div>
        <div>
          <dt>Policy #</dt>
          <dd>{resolved?.policyNumber || row.source_policy_number || '—'}</dd>
        </div>
        <div>
          <dt>Application #</dt>
          <dd>{resolved?.applicationNumber || row.resolved_application_id || '—'}</dd>
        </div>
        <div>
          <dt>Writing advisor</dt>
          <dd>{allocation?.advisorName || resolved?.advisorName || '—'}</dd>
        </div>
        <div>
          <dt>Writing allocation / split %</dt>
          <dd>
            {row.resolved_allocation_id || '—'}
            {allocation ? ` · ${formatCommissionBpsPercent(allocation.commissionBps)}` : ''}
          </dd>
        </div>
        <div>
          <dt>Source transaction date</dt>
          <dd>{formatProductionDate(row.transaction_date)}</dd>
        </div>
        <div>
          <dt>Source Income</dt>
          <dd className="crm-production-money">{formatSignedCents(row.source_income_cents)}</dd>
        </div>
        <div>
          <dt>Resolved event type</dt>
          <dd>{formatCommissionEventTypeLabel(row.resolved_event_type)}</dd>
        </div>
        <div>
          <dt>Resulting signed 035 amount</dt>
          <dd className="crm-production-money">{formatSignedCents(resultingSignedAmountCents(row))}</dd>
        </div>
        <div>
          <dt>Statement identifier</dt>
          <dd>{batch.statement_identifier}</dd>
        </div>
        <div>
          <dt>Source filename</dt>
          <dd>{batch.source_file}</dd>
        </div>
      </dl>
      <label className="crm-field">
        <span>Posting reason</span>
        <textarea
          value={workflow.postReason}
          onChange={(event) => workflow.onPostReasonChange(event.target.value)}
          disabled={workflow.submitting}
          required
        />
      </label>
      <div className="crm-form-actions">
        <button
          type="button"
          className="crm-primary-btn"
          onClick={workflow.onConfirmPost}
          disabled={workflow.submitting}
        >
          Post to Ledger
        </button>
        <button type="button" className="crm-secondary-btn" onClick={workflow.onCancelPost} disabled={workflow.submitting}>
          Cancel
        </button>
      </div>
    </section>
  )
}

function PostedEventFacts({
  row,
  posted,
  resolved,
}: {
  row: CommissionImportRowView
  posted: PostedImportEventView
  resolved?: ResolvedImportContext
}) {
  return (
    <div className="crm-commissions-import-posted">
      <h3>Posted ledger event</h3>
      <p>{POSTED_CORRECTION_COPY}</p>
      <dl className="crm-production-detail-grid">
        <div>
          <dt>Source transaction</dt>
          <dd>
            {formatProductionDate(row.transaction_date)} · {formatSignedCents(row.source_income_cents)} ·{' '}
            {row.source_type || '—'}
          </dd>
        </div>
        <div>
          <dt>Resolution</dt>
          <dd>
            {resolved?.clientName || '—'} · {resolved?.applicationNumber || row.resolved_application_id || '—'} ·{' '}
            allocation {row.resolved_allocation_id || '—'}
          </dd>
        </div>
        <div>
          <dt>Posted 035 event</dt>
          <dd>{posted.id}</dd>
        </div>
        <div>
          <dt>Posted event type</dt>
          <dd>{formatCommissionEventTypeLabel(posted.eventType)}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd className="crm-production-money">{formatSignedCents(posted.amountCents)}</dd>
        </div>
        <div>
          <dt>Event date</dt>
          <dd>{formatProductionDate(posted.transactionDate)}</dd>
        </div>
        <div>
          <dt>Statement / source</dt>
          <dd>
            {posted.statementIdentifier || '—'} · {posted.sourceFile || '—'}
          </dd>
        </div>
      </dl>
      <p>
        <Link to={ROUTES.crmCommissions}>Open commissions workspace</Link> to reverse if correction is
        required.
      </p>
    </div>
  )
}
