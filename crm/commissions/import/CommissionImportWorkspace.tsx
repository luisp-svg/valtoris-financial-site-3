import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import { formatCents, formatProductionDate } from '../../production/productionApi'
import { formatCommissionEventTypeLabel } from '../../production/compensationLabels'
import { formatSignedCents } from '../../production/compensationView'
import type { CanonicalImportRow } from './commissionImportCsv'
import {
  COMMISSION_IMPORT_PASTED_FILENAME,
  COMMISSION_IMPORT_SOURCE_LABEL,
} from './commissionImportConstants'
import type { CsvCellError } from './commissionImportCsv'
import {
  canStageIntoBatch,
  formatImportBatchSourceLabel,
  formatImportReviewReason,
  formatImportReviewStatus,
  formatImportSectionLabel,
  ignoredSafetyCopy,
  importRowBucket,
  isOverrideSourceType,
  isPaidOver12Section,
  negativeTransactionCopy,
  overrideSafetyCopy,
  rowsForBucket,
  summarizeImportRowAmounts,
  type CommissionImportBatchView,
  type CommissionImportRowBucket,
  type CommissionImportRowView,
  type ResolvedImportContext,
} from './commissionImportView'

export type ImportWorkspaceTab = 'summary' | CommissionImportRowBucket

const TABS: Array<{ id: ImportWorkspaceTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'ready', label: 'Ready' },
  { id: 'review', label: 'Needs Review' },
  { id: 'ignored', label: 'Ignored' },
  { id: 'duplicate', label: 'Duplicates' },
  { id: 'posted', label: 'Posted' },
]

type CommissionImportWorkspaceProps = {
  presentation: 'table' | 'cards'
  loading: boolean
  error: string | null
  onRetry: () => void
  batches: readonly CommissionImportBatchView[]
  selectedBatch: CommissionImportBatchView | null
  selectedRows: readonly CommissionImportRowView[]
  resolvedContext: Map<string, ResolvedImportContext>
  rowsLoading: boolean
  onSelectBatch: (batch: CommissionImportBatchView | null) => void
  create: {
    statementIdentifier: string
    fsCode: string
    statementDate: string
    sourceCreatedAt: string
    payeeName: string
    fileName: string | null
    pasteText: string
    submitting: boolean
    error: string | null
    onStatementIdentifierChange: (value: string) => void
    onFsCodeChange: (value: string) => void
    onStatementDateChange: (value: string) => void
    onSourceCreatedAtChange: (value: string) => void
    onPayeeNameChange: (value: string) => void
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
    onCancel: () => void
    onConfirm: () => void
    confirming: boolean
    confirmLabel?: string
    retryNote?: string | null
  } | null
  duplicateNotice: {
    original: CommissionImportBatchView | null
    duplicate: CommissionImportBatchView
    onOpenOriginal: () => void
    onDismiss: () => void
  } | null
  tab: ImportWorkspaceTab
  onTabChange: (tab: ImportWorkspaceTab) => void
}

export default function CommissionImportWorkspace({
  presentation,
  loading,
  error,
  onRetry,
  batches,
  selectedBatch,
  selectedRows,
  resolvedContext,
  rowsLoading,
  onSelectBatch,
  create,
  preview,
  duplicateNotice,
  tab,
  onTabChange,
}: CommissionImportWorkspaceProps) {
  return (
    <div className="crm-page crm-opportunities-page crm-commissions-page crm-commissions-import-page">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Commissions</p>
          <h1 className="crm-page-title">Commission import</h1>
          <p className="crm-page-subtitle">
            Stage an Experior Paid Report from a prepared Valtoris CSV. File identity is based on
            this prepared import file, not the original PDF. This phase classifies rows only —
            nothing is posted to the commission ledger.
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
            This import file has already been processed. File identity is based on this prepared
            import file.
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
        <ImportPreview
          rows={preview.rows}
          warnings={preview.warnings}
          fileName={preview.fileName}
          sha256={preview.sha256}
          confirming={preview.confirming}
          confirmLabel={preview.confirmLabel}
          retryNote={preview.retryNote}
          onCancel={preview.onCancel}
          onConfirm={preview.onConfirm}
        />
      ) : null}

      <section className="crm-panel" aria-labelledby="crm-commissions-import-create-heading">
        <div className="crm-panel-head">
          <h2 id="crm-commissions-import-create-heading">Import Experior Paid Report</h2>
        </div>
        <p className="crm-muted">
          Source: {COMMISSION_IMPORT_SOURCE_LABEL}. Income is the source amount. Rates are reference
          only. Do not upload the original PDF.
        </p>
        <ImportCreateForm create={create} />
      </section>

      <section className="crm-panel" aria-labelledby="crm-commissions-import-batches-heading">
        <div className="crm-panel-head">
          <h2 id="crm-commissions-import-batches-heading">Import batches</h2>
        </div>
        {loading ? <p>Loading import batches…</p> : null}
        {!loading && batches.length === 0 ? (
          <p className="crm-muted">No commission import batches yet.</p>
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
          resolvedContext={resolvedContext}
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

function ImportCreateForm({
  create,
}: {
  create: CommissionImportWorkspaceProps['create']
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
        <input value={COMMISSION_IMPORT_SOURCE_LABEL} readOnly />
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
        <span>FS code (optional)</span>
        <input
          value={create.fsCode}
          onChange={(event) => create.onFsCodeChange(event.target.value)}
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
        <span>Source created at (optional)</span>
        <input
          value={create.sourceCreatedAt}
          onChange={(event) => create.onSourceCreatedAtChange(event.target.value)}
          placeholder="2026-08-13T15:57:28Z"
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
          {COMMISSION_IMPORT_PASTED_FILENAME}.
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
          <li>Required columns: Section, Ordinal, Income.</li>
          <li>Section values: Insurance, Paid over 12 months, Additional commissions.</li>
          <li>Income is signed dollars (100.00 or -25.00). Rates are not used to calculate Income.</li>
          <li>Chargeback Visual: true/yes/1, false/no/0, or blank. Blank negatives are not chargebacks.</li>
          <li>Dates use YYYY-MM-DD. Policy numbers are imported exactly, including L vs LS.</li>
        </ul>
      </details>
    </form>
  )
}

function ImportPreview({
  rows,
  warnings,
  fileName,
  sha256,
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
      aria-labelledby="crm-commissions-import-preview-heading"
    >
      <div className="crm-panel-head">
        <h2 id="crm-commissions-import-preview-heading">Preview import rows</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={confirming}>
          Close
        </button>
      </div>
      <p>
        {rows.length} rows from {fileName}. Income is the source amount. Rates are reference only.
      </p>
      <p className="crm-muted">
        File identity SHA-256 {sha256}. This is the prepared import file, not the original Experior
        PDF.
      </p>
      <p>
        Source Income total: <strong className="crm-production-money">{formatSignedCents(total)}</strong>
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
              <th scope="col">Transaction Type</th>
              <th scope="col">Income</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.source_section}-${row.source_row_ordinal}`}>
                <td>{formatImportSectionLabel(row.source_section)}</td>
                <td>{row.source_row_ordinal}</td>
                <td>{formatProductionDate(row.transaction_date)}</td>
                <td>{row.source_company || '—'}</td>
                <td>{row.source_policy_number || '—'}</td>
                <td>{row.source_writing_associate || '—'}</td>
                <td>{row.source_type || '—'}</td>
                <td>{row.source_transaction_type || '—'}</td>
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
  batches: readonly CommissionImportBatchView[]
  selectedId: string | null
  onSelect: (batch: CommissionImportBatchView) => void
}) {
  return (
    <table className="crm-opportunities-table crm-commissions-import-batch-table">
      <thead>
        <tr>
          <th scope="col">Source</th>
          <th scope="col">Statement ID</th>
          <th scope="col">Statement date</th>
          <th scope="col">Source file</th>
          <th scope="col">FS</th>
          <th scope="col">Imported</th>
          <th scope="col">Status</th>
          <th scope="col">Rows</th>
          <th scope="col">Ready</th>
          <th scope="col">Review</th>
          <th scope="col">Duplicates</th>
          <th scope="col">Ignored</th>
          <th scope="col">Posted</th>
          <th scope="col">Failed</th>
        </tr>
      </thead>
      <tbody>
        {batches.map((batch) => (
          <tr key={batch.id} className={selectedId === batch.id ? 'is-selected' : undefined}>
            <td>
              <button type="button" className="crm-commissions-queue-open" onClick={() => onSelect(batch)}>
                {formatImportBatchSourceLabel(batch.source_type)}
              </button>
            </td>
            <td>{batch.statement_identifier}</td>
            <td>{formatProductionDate(batch.statement_date)}</td>
            <td>{batch.source_file}</td>
            <td>{batch.fs_code || '—'}</td>
            <td>{formatProductionDate(batch.created_at.slice(0, 10))}</td>
            <td>
              {batch.import_status === 'duplicate_file' ? 'Duplicate file' : 'Open'}
              {batch.duplicate_of_batch_id ? ' · original on file' : ''}
            </td>
            <td>{batch.row_count}</td>
            <td>{batch.ready_count}</td>
            <td>{batch.review_count}</td>
            <td>{batch.duplicate_count}</td>
            <td>{batch.ignored_count}</td>
            <td>{batch.posted_count}</td>
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
  batches: readonly CommissionImportBatchView[]
  selectedId: string | null
  onSelect: (batch: CommissionImportBatchView) => void
}) {
  return (
    <div className="crm-commissions-import-batch-cards">
      {batches.map((batch) => (
        <article
          key={batch.id}
          className={`crm-panel crm-commissions-card${selectedId === batch.id ? ' is-selected' : ''}`}
        >
          <button type="button" className="crm-commissions-queue-open" onClick={() => onSelect(batch)}>
            {formatImportBatchSourceLabel(batch.source_type)} · {batch.statement_identifier}
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
  resolvedContext,
  loading,
  tab,
  presentation,
  onTabChange,
  onClose,
}: {
  batch: CommissionImportBatchView
  rows: readonly CommissionImportRowView[]
  resolvedContext: Map<string, ResolvedImportContext>
  loading: boolean
  tab: ImportWorkspaceTab
  presentation: 'table' | 'cards'
  onTabChange: (tab: ImportWorkspaceTab) => void
  onClose: () => void
}) {
  const amounts = summarizeImportRowAmounts(rows)
  const visibleRows = tab === 'summary' ? [] : rowsForBucket(rows, tab)
  return (
    <section className="crm-panel" aria-labelledby="crm-commissions-import-detail-heading">
      <div className="crm-panel-head">
        <h2 id="crm-commissions-import-detail-heading">
          {batch.statement_identifier} · {batch.source_file}
        </h2>
        <button type="button" className="crm-text-btn" onClick={onClose}>
          Close batch
        </button>
      </div>
      {!canStageIntoBatch(batch) ? (
        <p className="crm-banner crm-banner-warning" role="status">
          This is a duplicate-file batch. Staging is not available. Open the original batch instead.
        </p>
      ) : null}
      <div className="crm-commissions-import-tabs" role="tablist" aria-label="Import classification">
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
        <ImportSummary batch={batch} amounts={amounts} />
      ) : loading ? (
        <p>Loading rows…</p>
      ) : visibleRows.length === 0 ? (
        <p className="crm-muted">No rows in this view.</p>
      ) : presentation === 'table' ? (
        <RowTable rows={visibleRows} resolvedContext={resolvedContext} />
      ) : (
        <RowCards rows={visibleRows} resolvedContext={resolvedContext} />
      )}
    </section>
  )
}

function ImportSummary({
  batch,
  amounts,
}: {
  batch: CommissionImportBatchView
  amounts: ReturnType<typeof summarizeImportRowAmounts>
}) {
  return (
    <div className="crm-commissions-import-summary">
      <p className="crm-muted">
        These are source reconciliation totals, not Valtoris writing-advisor Paid. Ignored and
        duplicate amounts are excluded from writing income.
      </p>
      <dl className="crm-production-detail-grid">
        <div>
          <dt>Source Income</dt>
          <dd className="crm-production-money">{formatSignedCents(amounts.sourceIncomeCents)}</dd>
        </div>
        <div>
          <dt>Ready writing income</dt>
          <dd className="crm-production-money">{formatSignedCents(amounts.readyIncomeCents)}</dd>
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
          <dt>Posted to ledger</dt>
          <dd className="crm-production-money">{formatSignedCents(amounts.postedIncomeCents)}</dd>
        </div>
        <div>
          <dt>Rows</dt>
          <dd>{batch.row_count}</dd>
        </div>
        <div>
          <dt>Ready / review / ignored</dt>
          <dd>
            {batch.ready_count} / {batch.review_count} / {batch.ignored_count}
          </dd>
        </div>
      </dl>
      <p className="crm-banner" role="note">
        Posting will be enabled in Commission Phase 3B after review workflow approval.
      </p>
    </div>
  )
}

function RowTable({
  rows,
  resolvedContext,
}: {
  rows: readonly CommissionImportRowView[]
  resolvedContext: Map<string, ResolvedImportContext>
}) {
  return (
    <table className="crm-opportunities-table crm-commissions-import-row-table">
      <thead>
        <tr>
          <th scope="col">Status</th>
          <th scope="col">Income</th>
          <th scope="col">Date</th>
          <th scope="col">Company</th>
          <th scope="col">Policy</th>
          <th scope="col">Writing Associate</th>
          <th scope="col">Type</th>
          <th scope="col">Details</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <ImportStatusCell row={row} />
            </td>
            <td className="crm-production-money">{formatSignedCents(row.source_income_cents)}</td>
            <td>{formatProductionDate(row.transaction_date)}</td>
            <td>{row.source_company || '—'}</td>
            <td>{row.source_policy_number || '—'}</td>
            <td>{row.source_writing_associate || '—'}</td>
            <td>{row.source_type || '—'}</td>
            <td>
              <RowEvidence row={row} resolved={row.resolved_application_id ? resolvedContext.get(row.resolved_application_id) : undefined} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RowCards({
  rows,
  resolvedContext,
}: {
  rows: readonly CommissionImportRowView[]
  resolvedContext: Map<string, ResolvedImportContext>
}) {
  return (
    <div className="crm-commissions-import-row-cards">
      {rows.map((row) => (
        <article key={row.id} className="crm-panel crm-commissions-card">
          <ImportStatusCell row={row} />
          <p className="crm-production-money">{formatSignedCents(row.source_income_cents)}</p>
          <p>
            {row.source_company || '—'} · {row.source_policy_number || '—'}
          </p>
          <RowEvidence
            row={row}
            resolved={row.resolved_application_id ? resolvedContext.get(row.resolved_application_id) : undefined}
          />
        </article>
      ))}
    </div>
  )
}

function ImportStatusCell({ row }: { row: CommissionImportRowView }) {
  const overrideCopy = overrideSafetyCopy(row)
  const ignoredCopy = ignoredSafetyCopy(row)
  const negativeCopy = negativeTransactionCopy(row)
  const reason = formatImportReviewReason(row.review_reason)
  return (
    <div>
      <div>{formatImportReviewStatus(row.review_status)}</div>
      {importRowBucket(row) === 'ready' ? (
        <p className="crm-muted">
          Posting will be enabled in Commission Phase 3B after review workflow approval.
        </p>
      ) : null}
      {overrideCopy ? <p className="crm-commissions-import-override">{overrideCopy}</p> : null}
      {ignoredCopy && ignoredCopy !== overrideCopy ? <p>{ignoredCopy}</p> : null}
      {negativeCopy ? <p>{negativeCopy}</p> : null}
      {row.review_status === 'review_split_attribution' ? (
        <p>Multiple writing allocations exist. Split % is not used to choose a writer.</p>
      ) : null}
      {row.review_status === 'review_duplicate_candidate' ? (
        <p>Possible duplicate. The fingerprint matched another source transaction.</p>
      ) : null}
      {row.review_status === 'duplicate' ? <p>This source transaction is blocked as a duplicate.</p> : null}
      {reason ? <p className="crm-muted">{reason}</p> : null}
    </div>
  )
}

function RowEvidence({
  row,
  resolved,
}: {
  row: CommissionImportRowView
  resolved?: ResolvedImportContext
}) {
  return (
    <details>
      <summary>Source evidence</summary>
      <dl className="crm-production-detail-grid">
        <div>
          <dt>Client</dt>
          <dd>{row.source_client || '—'}</dd>
        </div>
        <div>
          <dt>Transaction type</dt>
          <dd>{row.source_transaction_type || '—'}</dd>
        </div>
        {isPaidOver12Section(row.source_section) ? (
          <div>
            <dt>Payment number</dt>
            <dd>{row.payment_number || '—'}</dd>
          </div>
        ) : null}
        <div>
          <dt>Section / ordinal</dt>
          <dd>
            {formatImportSectionLabel(row.source_section)} · {row.source_row_ordinal}
          </dd>
        </div>
        <div>
          <dt>Product</dt>
          <dd>{row.source_product || '—'}</dd>
        </div>
        <div>
          <dt>Agent entered premium</dt>
          <dd>{row.agent_entered_premium_cents == null ? '—' : formatCents(row.agent_entered_premium_cents)}</dd>
        </div>
        <div>
          <dt>Company calculated premium</dt>
          <dd>
            {row.company_calculated_premium_cents == null
              ? '—'
              : formatCents(row.company_calculated_premium_cents)}
          </dd>
        </div>
        <div>
          <dt>Gross % / Factor % / Net % / Split</dt>
          <dd>
            {row.source_gross_rate ?? '—'} / {row.source_factor_rate ?? '—'} / {row.source_net_rate ?? '—'} /{' '}
            {row.source_split_rate ?? '—'}
          </dd>
        </div>
        <div>
          <dt>Chargeback visual</dt>
          <dd>{row.source_is_chargeback_visual ? 'Yes' : 'No'}</dd>
        </div>
        {row.resolved_event_type ? (
          <div>
            <dt>Resolved event type</dt>
            <dd>{formatCommissionEventTypeLabel(row.resolved_event_type)}</dd>
          </div>
        ) : null}
        {resolved ? (
          <>
            <div>
              <dt>Resolved client / application</dt>
              <dd>
                {resolved.clientName || '—'} · {resolved.applicationNumber || resolved.applicationId}
              </dd>
            </div>
            <div>
              <dt>Resolved writing advisor</dt>
              <dd>{resolved.advisorName || '—'}</dd>
            </div>
          </>
        ) : null}
        {isOverrideSourceType(row.source_type) ? (
          <div>
            <dt>Override</dt>
            <dd>Source Type is Override.</dd>
          </div>
        ) : null}
      </dl>
    </details>
  )
}
