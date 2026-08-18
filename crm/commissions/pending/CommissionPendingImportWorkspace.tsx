import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import { formatCents, formatProductionDate } from '../../production/productionApi'
import { formatSignedCents } from '../../production/compensationView'
import type { CanonicalImportRow } from '../import/commissionImportCsv'
import type { CsvCellError } from '../import/commissionImportCsv'
import {
  COMMISSION_PENDING_IMPORT_PASTED_FILENAME,
  COMMISSION_PENDING_IMPORT_SOURCE_LABEL,
} from './commissionPendingConstants'
import {
  canStageIntoPendingBatch,
  formatPendingBatchSourceLabel,
  formatPendingReviewReason,
  formatPendingReviewStatus,
  formatPendingSectionLabel,
  rowsForPendingBucket,
  summarizePendingRowAmounts,
  type CommissionPendingBatchView,
  type CommissionPendingRowBucket,
  type CommissionPendingRowView,
} from './commissionPendingView'

export type PendingImportWorkspaceTab = 'summary' | CommissionPendingRowBucket

const TABS: Array<{ id: PendingImportWorkspaceTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'accepted', label: 'Accepted Pending' },
  { id: 'review', label: 'Needs Review' },
  { id: 'ignored', label: 'Ignored' },
  { id: 'duplicate', label: 'Duplicates' },
]

type CommissionPendingImportWorkspaceProps = {
  presentation: 'table' | 'cards'
  loading: boolean
  error: string | null
  onRetry: () => void
  batches: readonly CommissionPendingBatchView[]
  selectedBatch: CommissionPendingBatchView | null
  selectedRows: readonly CommissionPendingRowView[]
  rowsLoading: boolean
  onSelectBatch: (batch: CommissionPendingBatchView | null) => void
  create: {
    statementIdentifier: string
    fsCode: string
    statementDate: string
    sourceCreatedAt: string
    payeeName: string
    statementAmount: string
    escrow: string
    fileName: string | null
    pasteText: string
    submitting: boolean
    error: string | null
    onStatementIdentifierChange: (value: string) => void
    onFsCodeChange: (value: string) => void
    onStatementDateChange: (value: string) => void
    onSourceCreatedAtChange: (value: string) => void
    onPayeeNameChange: (value: string) => void
    onStatementAmountChange: (value: string) => void
    onEscrowChange: (value: string) => void
    onFileChange: (file: File | null) => void
    onPasteChange: (value: string) => void
    onDownloadTemplate: () => void
    onPreview: () => void
  }
  preview: {
    rows: readonly CanonicalImportRow[]
    warnings: readonly CsvCellError[]
    fileName: string
    sha256: string
    statementAmountCents: number | null
    escrowCents: number | null
    onCancel: () => void
    onConfirm: () => void
    confirming: boolean
    confirmLabel?: string
    retryNote?: string | null
  } | null
  duplicateNotice: {
    original: CommissionPendingBatchView | null
    duplicate: CommissionPendingBatchView
    onOpenOriginal: () => void
    onDismiss: () => void
  } | null
  tab: PendingImportWorkspaceTab
  onTabChange: (tab: PendingImportWorkspaceTab) => void
}

export default function CommissionPendingImportWorkspace({
  presentation,
  loading,
  error,
  onRetry,
  batches,
  selectedBatch,
  selectedRows,
  rowsLoading,
  onSelectBatch,
  create,
  preview,
  duplicateNotice,
  tab,
  onTabChange,
}: CommissionPendingImportWorkspaceProps) {
  return (
    <div className="crm-page crm-opportunities-page crm-commissions-page crm-commissions-import-page">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Commissions</p>
          <h1 className="crm-page-title">Pending commission import</h1>
          <p className="crm-page-subtitle">
            Stage an Experior Pending Report from a prepared Valtoris CSV. This classifies
            writing-advisor Pending source facts only. It does not post Paid events, change
            Expected, or mix into paid-report batches. Review and accept controls are not in this
            phase.
          </p>
        </div>
        <div className="crm-production-header-actions">
          <Link to={ROUTES.crmCommissions} className="crm-secondary-btn">
            Back to commissions
          </Link>
        </div>
      </header>

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}{' '}
          <button type="button" className="crm-text-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {duplicateNotice ? (
        <section className="crm-banner crm-banner-warning" role="status">
          <p>
            This pending import file has already been processed. File identity is based on this
            prepared import file.
          </p>
          {duplicateNotice.original ? (
            <p>
              Original statement {duplicateNotice.original.statement_identifier} imported{' '}
              {formatProductionDate(duplicateNotice.original.created_at.slice(0, 10))} ·{' '}
              {duplicateNotice.original.row_count} rows · {duplicateNotice.original.import_status}.
            </p>
          ) : (
            <p>The original open batch is listed below.</p>
          )}
          <div className="crm-form-actions">
            {duplicateNotice.original ? (
              <button type="button" className="crm-primary-btn" onClick={duplicateNotice.onOpenOriginal}>
                Open original batch
              </button>
            ) : null}
            <button type="button" className="crm-secondary-btn" onClick={duplicateNotice.onDismiss}>
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {preview ? (
        <PendingImportPreview
          rows={preview.rows}
          warnings={preview.warnings}
          fileName={preview.fileName}
          sha256={preview.sha256}
          statementAmountCents={preview.statementAmountCents}
          escrowCents={preview.escrowCents}
          confirming={preview.confirming}
          confirmLabel={preview.confirmLabel}
          retryNote={preview.retryNote}
          onCancel={preview.onCancel}
          onConfirm={preview.onConfirm}
        />
      ) : null}

      <section className="crm-panel" aria-labelledby="crm-commissions-pending-import-create-heading">
        <div className="crm-panel-head">
          <h2 id="crm-commissions-pending-import-create-heading">Import Pending Statement</h2>
        </div>
        <p className="crm-muted">
          Source: {COMMISSION_PENDING_IMPORT_SOURCE_LABEL}. Income is the Pending amount. Statement
          amount and escrow are header metadata only. Do not upload the original PDF.
        </p>
        <PendingImportCreateForm create={create} />
      </section>

      <section className="crm-panel" aria-labelledby="crm-commissions-pending-import-batches-heading">
        <div className="crm-panel-head">
          <h2 id="crm-commissions-pending-import-batches-heading">Pending import batches</h2>
        </div>
        {loading ? <p>Loading pending import batches…</p> : null}
        {!loading && batches.length === 0 ? (
          <p className="crm-muted">No pending commission import batches yet.</p>
        ) : null}
        {!loading && batches.length > 0 && presentation === 'table' ? (
          <BatchTable batches={batches} selectedId={selectedBatch?.id ?? null} onSelect={onSelectBatch} />
        ) : null}
        {!loading && batches.length > 0 && presentation === 'cards' ? (
          <BatchCards batches={batches} selectedId={selectedBatch?.id ?? null} onSelect={onSelectBatch} />
        ) : null}
      </section>

      {selectedBatch ? (
        <BatchDetail
          batch={selectedBatch}
          rows={selectedRows}
          loading={rowsLoading}
          tab={tab}
          presentation={presentation}
          onTabChange={onTabChange}
          onClose={() => onSelectBatch(null)}
        />
      ) : null}
    </div>
  )
}

function PendingImportCreateForm({
  create,
}: {
  create: CommissionPendingImportWorkspaceProps['create']
}) {
  return (
    <form
      className="crm-commissions-import-create"
      onSubmit={(event) => {
        event.preventDefault()
        create.onPreview()
      }}
    >
      <label className="crm-field">
        <span>Source</span>
        <input value={COMMISSION_PENDING_IMPORT_SOURCE_LABEL} readOnly />
      </label>
      <label className="crm-field">
        <span>Statement identifier</span>
        <input
          value={create.statementIdentifier}
          onChange={(event) => create.onStatementIdentifierChange(event.target.value)}
          required
          disabled={create.submitting}
        />
      </label>
      <label className="crm-field">
        <span>Statement date (optional)</span>
        <input
          type="date"
          value={create.statementDate}
          onChange={(event) => create.onStatementDateChange(event.target.value)}
          disabled={create.submitting}
        />
      </label>
      <label className="crm-field">
        <span>Statement amount (optional)</span>
        <input
          value={create.statementAmount}
          onChange={(event) => create.onStatementAmountChange(event.target.value)}
          placeholder="3371.05"
          disabled={create.submitting}
        />
      </label>
      <label className="crm-field">
        <span>Escrow (optional)</span>
        <input
          value={create.escrow}
          onChange={(event) => create.onEscrowChange(event.target.value)}
          placeholder="34.05"
          disabled={create.submitting}
        />
      </label>
      <label className="crm-field">
        <span>FS code (optional)</span>
        <input
          value={create.fsCode}
          onChange={(event) => create.onFsCodeChange(event.target.value)}
          disabled={create.submitting}
        />
      </label>
      <label className="crm-field">
        <span>Payee name (optional)</span>
        <input
          value={create.payeeName}
          onChange={(event) => create.onPayeeNameChange(event.target.value)}
          disabled={create.submitting}
        />
      </label>
      <label className="crm-field">
        <span>Source created at (optional)</span>
        <input
          value={create.sourceCreatedAt}
          onChange={(event) => create.onSourceCreatedAtChange(event.target.value)}
          placeholder="2026-08-17T15:57:28Z"
          disabled={create.submitting}
        />
      </label>
      <label className="crm-field">
        <span>Prepared CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => create.onFileChange(event.target.files?.[0] ?? null)}
          disabled={create.submitting}
        />
        {create.fileName ? <span className="crm-muted">{create.fileName}</span> : null}
      </label>
      <label className="crm-field crm-commissions-import-paste">
        <span>Or paste the same CSV (optional)</span>
        <textarea
          value={create.pasteText}
          onChange={(event) => create.onPasteChange(event.target.value)}
          rows={6}
          disabled={create.submitting}
          spellCheck={false}
        />
        <span className="crm-muted">
          Paste uses the same parser as file upload. Pasted identity filename is{' '}
          {COMMISSION_PENDING_IMPORT_PASTED_FILENAME}.
        </span>
      </label>
      {create.error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {create.error}
        </p>
      ) : null}
      <div className="crm-form-actions">
        <button type="button" className="crm-secondary-btn" onClick={create.onDownloadTemplate}>
          Download CSV headers
        </button>
        <button type="submit" className="crm-primary-btn" disabled={create.submitting}>
          Preview rows
        </button>
      </div>
      <details className="crm-commissions-import-help">
        <summary>Template instructions</summary>
        <ul>
          <li>Required columns: Section, Ordinal, Income. Same row columns as the Paid template.</li>
          <li>Statement ID, date, amount, escrow, FS code, and payee are batch metadata, not CSV columns.</li>
          <li>Income is the Pending amount. Rates, premium, and split do not calculate Pending.</li>
          <li>Type Override is ignored. Additional commissions are ignored.</li>
        </ul>
      </details>
    </form>
  )
}

function PendingImportPreview({
  rows,
  warnings,
  fileName,
  sha256,
  statementAmountCents,
  escrowCents,
  confirming,
  confirmLabel,
  retryNote,
  onCancel,
  onConfirm,
}: {
  rows: readonly CanonicalImportRow[]
  warnings: readonly CsvCellError[]
  fileName: string
  sha256: string
  statementAmountCents: number | null
  escrowCents: number | null
  confirming: boolean
  confirmLabel?: string
  retryNote?: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const total = rows.reduce((sum, row) => sum + row.source_income_cents, 0)
  return (
    <section
      className="crm-panel crm-commissions-import-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crm-commissions-pending-import-preview-heading"
    >
      <div className="crm-panel-head">
        <h2 id="crm-commissions-pending-import-preview-heading">Preview pending import rows</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={confirming}>
          Close
        </button>
      </div>
      <p>
        {rows.length} rows from {fileName}. Income is the Pending amount. Statement amount and
        escrow stay on the batch.
      </p>
      <p className="crm-muted">
        File identity SHA-256 {sha256}. This is the prepared import file, not the original Experior
        PDF.
      </p>
      <p>
        Source Income total: <strong className="crm-production-money">{formatSignedCents(total)}</strong>
        {' · '}
        Statement amount:{' '}
        <strong className="crm-production-money">
          {statementAmountCents == null ? '—' : formatCents(statementAmountCents)}
        </strong>
        {' · '}
        Escrow:{' '}
        <strong className="crm-production-money">
          {escrowCents == null ? '—' : formatCents(escrowCents)}
        </strong>
      </p>
      {retryNote ? (
        <p className="crm-banner crm-banner-warning" role="status">
          {retryNote}
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <p className="crm-banner crm-banner-warning" role="status">
          {warnings[0].message}
        </p>
      ) : null}
      <div className="crm-commissions-import-preview-table-wrap">
        <table className="crm-opportunities-table">
          <thead>
            <tr>
              <th scope="col">Section</th>
              <th scope="col">Ordinal</th>
              <th scope="col">Date</th>
              <th scope="col">Company</th>
              <th scope="col">Policy</th>
              <th scope="col">Writing Associate</th>
              <th scope="col">Type</th>
              <th scope="col">Income</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.source_section}-${row.source_row_ordinal}`}>
                <td>{formatPendingSectionLabel(row.source_section)}</td>
                <td>{row.source_row_ordinal}</td>
                <td>{formatProductionDate(row.transaction_date)}</td>
                <td>{row.source_company || '—'}</td>
                <td>{row.source_policy_number || '—'}</td>
                <td>{row.source_writing_associate || '—'}</td>
                <td>{row.source_type || '—'}</td>
                <td className="crm-production-money">{formatSignedCents(row.source_income_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="crm-form-actions">
        <button type="button" className="crm-secondary-btn" onClick={onCancel} disabled={confirming}>
          Cancel
        </button>
        <button type="button" className="crm-primary-btn" onClick={onConfirm} disabled={confirming}>
          {confirming ? 'Staging…' : confirmLabel || 'Stage rows'}
        </button>
      </div>
    </section>
  )
}

function BatchTable({
  batches,
  selectedId,
  onSelect,
}: {
  batches: readonly CommissionPendingBatchView[]
  selectedId: string | null
  onSelect: (batch: CommissionPendingBatchView) => void
}) {
  return (
    <table className="crm-opportunities-table crm-commissions-import-batch-table">
      <thead>
        <tr>
          <th scope="col">Source</th>
          <th scope="col">Statement ID</th>
          <th scope="col">Statement date</th>
          <th scope="col">Statement amount</th>
          <th scope="col">Escrow</th>
          <th scope="col">Source file</th>
          <th scope="col">Imported</th>
          <th scope="col">Status</th>
          <th scope="col">Rows</th>
          <th scope="col">Accepted</th>
          <th scope="col">Review</th>
          <th scope="col">Duplicates</th>
          <th scope="col">Ignored</th>
          <th scope="col">Failed</th>
        </tr>
      </thead>
      <tbody>
        {batches.map((batch) => (
          <tr key={batch.id} className={selectedId === batch.id ? 'is-selected' : undefined}>
            <td>
              <button type="button" className="crm-commissions-queue-open" onClick={() => onSelect(batch)}>
                {formatPendingBatchSourceLabel(batch.source_type)}
              </button>
            </td>
            <td>{batch.statement_identifier}</td>
            <td>{formatProductionDate(batch.statement_date)}</td>
            <td className="crm-production-money">
              {batch.statement_amount_cents == null ? '—' : formatCents(batch.statement_amount_cents)}
            </td>
            <td className="crm-production-money">
              {batch.escrow_cents == null ? '—' : formatCents(batch.escrow_cents)}
            </td>
            <td>{batch.source_file}</td>
            <td>{formatProductionDate(batch.created_at.slice(0, 10))}</td>
            <td>
              {batch.import_status === 'duplicate_file' ? 'Duplicate file' : 'Open'}
              {batch.duplicate_of_batch_id ? ' · original on file' : ''}
            </td>
            <td>{batch.row_count}</td>
            <td>{batch.accepted_count}</td>
            <td>{batch.review_count}</td>
            <td>{batch.duplicate_count}</td>
            <td>{batch.ignored_count}</td>
            <td>{batch.failed_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BatchCards({
  batches,
  selectedId,
  onSelect,
}: {
  batches: readonly CommissionPendingBatchView[]
  selectedId: string | null
  onSelect: (batch: CommissionPendingBatchView) => void
}) {
  return (
    <div className="crm-commissions-import-batch-cards">
      {batches.map((batch) => (
        <article
          key={batch.id}
          className={`crm-panel crm-commissions-card${selectedId === batch.id ? ' is-selected' : ''}`}
        >
          <button type="button" className="crm-commissions-queue-open" onClick={() => onSelect(batch)}>
            {formatPendingBatchSourceLabel(batch.source_type)} · {batch.statement_identifier}
          </button>
          <p className="crm-muted">{batch.source_file}</p>
          <p>
            {batch.import_status === 'duplicate_file' ? 'Duplicate file' : 'Open'} · {batch.row_count}{' '}
            rows
          </p>
        </article>
      ))}
    </div>
  )
}

function BatchDetail({
  batch,
  rows,
  loading,
  tab,
  presentation,
  onTabChange,
  onClose,
}: {
  batch: CommissionPendingBatchView
  rows: readonly CommissionPendingRowView[]
  loading: boolean
  tab: PendingImportWorkspaceTab
  presentation: 'table' | 'cards'
  onTabChange: (tab: PendingImportWorkspaceTab) => void
  onClose: () => void
}) {
  const amounts = summarizePendingRowAmounts(rows)
  const visibleRows = tab === 'summary' ? [] : rowsForPendingBucket(rows, tab)
  return (
    <section className="crm-panel" aria-labelledby="crm-commissions-pending-import-detail-heading">
      <div className="crm-panel-head">
        <h2 id="crm-commissions-pending-import-detail-heading">
          {batch.statement_identifier} · {batch.source_file}
        </h2>
        <button type="button" className="crm-text-btn" onClick={onClose}>
          Close batch
        </button>
      </div>
      {!canStageIntoPendingBatch(batch) ? (
        <p className="crm-banner crm-banner-warning" role="status">
          This is a duplicate-file batch. Staging is not available. Open the original batch instead.
        </p>
      ) : null}
      <div className="crm-commissions-import-tabs" role="tablist" aria-label="Pending classification">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`crm-secondary-btn${tab === item.id ? ' is-selected' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'summary' ? (
        <PendingImportSummary batch={batch} amounts={amounts} />
      ) : loading ? (
        <p>Loading rows…</p>
      ) : visibleRows.length === 0 ? (
        <p className="crm-muted">No rows in this view.</p>
      ) : presentation === 'table' ? (
        <RowTable rows={visibleRows} />
      ) : (
        <RowCards rows={visibleRows} />
      )}
    </section>
  )
}

function PendingImportSummary({
  batch,
  amounts,
}: {
  batch: CommissionPendingBatchView
  amounts: ReturnType<typeof summarizePendingRowAmounts>
}) {
  return (
    <div className="crm-commissions-import-summary">
      <p className="crm-muted">
        These are source Pending totals, not Valtoris Paid and not Expected. Statement amount and
        escrow are header metadata and are not added into writing Pending.
      </p>
      <dl className="crm-production-detail-grid">
        <div>
          <dt>Source Income</dt>
          <dd className="crm-production-money">{formatSignedCents(amounts.sourceIncomeCents)}</dd>
        </div>
        <div>
          <dt>Accepted Pending</dt>
          <dd className="crm-production-money">{formatSignedCents(amounts.acceptedIncomeCents)}</dd>
        </div>
        <div>
          <dt>Needs review</dt>
          <dd className="crm-production-money">{formatSignedCents(amounts.reviewIncomeCents)}</dd>
        </div>
        <div>
          <dt>Excluded / ignored</dt>
          <dd className="crm-production-money">{formatSignedCents(amounts.ignoredIncomeCents)}</dd>
        </div>
        <div>
          <dt>Duplicate</dt>
          <dd className="crm-production-money">{formatSignedCents(amounts.duplicateIncomeCents)}</dd>
        </div>
        <div>
          <dt>Statement amount</dt>
          <dd className="crm-production-money">
            {batch.statement_amount_cents == null ? '—' : formatCents(batch.statement_amount_cents)}
          </dd>
        </div>
        <div>
          <dt>Escrow</dt>
          <dd className="crm-production-money">
            {batch.escrow_cents == null ? '—' : formatCents(batch.escrow_cents)}
          </dd>
        </div>
        <div>
          <dt>Rows</dt>
          <dd>{batch.row_count}</dd>
        </div>
        <div>
          <dt>Accepted / review / ignored</dt>
          <dd>
            {batch.accepted_count} / {batch.review_count} / {batch.ignored_count}
          </dd>
        </div>
      </dl>
      <p className="crm-banner" role="note">
        Classification is read-only in this phase. Override, additional-commission, and duplicate
        rows cannot become accepted Pending. There is no ledger post.
      </p>
    </div>
  )
}

function RowTable({ rows }: { rows: readonly CommissionPendingRowView[] }) {
  return (
    <table className="crm-opportunities-table crm-commissions-import-row-table">
      <thead>
        <tr>
          <th scope="col">Status</th>
          <th scope="col">Reason</th>
          <th scope="col">Section</th>
          <th scope="col">Company</th>
          <th scope="col">Policy</th>
          <th scope="col">Writing Associate</th>
          <th scope="col">Type</th>
          <th scope="col">Income</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{formatPendingReviewStatus(row.pending_review_status)}</td>
            <td>{formatPendingReviewReason(row.pending_review_reason) ?? '—'}</td>
            <td>{formatPendingSectionLabel(row.source_section)}</td>
            <td>{row.source_company || '—'}</td>
            <td>{row.source_policy_number || '—'}</td>
            <td>{row.source_writing_associate || '—'}</td>
            <td>{row.source_type || '—'}</td>
            <td className="crm-production-money">{formatSignedCents(row.source_income_cents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RowCards({ rows }: { rows: readonly CommissionPendingRowView[] }) {
  return (
    <div className="crm-commissions-import-row-cards">
      {rows.map((row) => (
        <article key={row.id} className="crm-panel crm-commissions-card">
          <p>
            {formatPendingReviewStatus(row.pending_review_status)} · {row.source_type || '—'}
          </p>
          <p className="crm-muted">
            {row.source_company || '—'} · {row.source_policy_number || '—'}
          </p>
          <p className="crm-production-money">{formatSignedCents(row.source_income_cents)}</p>
          {formatPendingReviewReason(row.pending_review_reason) ? (
            <p className="crm-muted">{formatPendingReviewReason(row.pending_review_reason)}</p>
          ) : null}
        </article>
      ))}
    </div>
  )
}
