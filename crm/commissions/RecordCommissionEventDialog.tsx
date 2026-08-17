import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formatCents } from '../production/productionApi'
import { formatSignedCents } from '../production/compensationView'
import type { CommissionWorkItem } from './commissionWorkView'
import {
  defaultRecordCommissionDraft,
  MANUAL_RECORD_EVENT_TYPES,
} from './commissionWriteView'
import { validateRecordCommissionDraft } from './commissionRecordDraft'
import type { RecordCommissionEventArgs } from './commissionWriteApi'
import { formatCommissionEventTypeLabel } from '../production/compensationLabels'

type RecordCommissionEventDialogProps = {
  item: CommissionWorkItem
  preIssue: boolean
  idempotencyKey: string
  today: string
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (args: RecordCommissionEventArgs) => void
}

export default function RecordCommissionEventDialog({
  item,
  preIssue,
  idempotencyKey,
  today,
  submitting,
  error,
  onCancel,
  onConfirm,
}: RecordCommissionEventDialogProps) {
  const headingId = useId()
  const amountRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(() => defaultRecordCommissionDraft(today))
  const [showDetails, setShowDetails] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    const result = validateRecordCommissionDraft({
      item,
      draft,
      idempotencyKey,
      preIssue,
      includeCarrierId: true,
    })
    if (!result.ok) {
      setFieldErrors(result.errors)
      return
    }
    setFieldErrors({})
    onConfirm(result.args)
  }

  const title = preIssue ? 'Record pre-issue actual' : 'Record actual commission'
  const confirmLabel = submitting
    ? 'Recording…'
    : preIssue
      ? 'Record pre-issue actual'
      : 'Record actual'

  return (
    <div className="crm-production-review-overlay crm-commissions-write-overlay">
      <section
        className="crm-panel crm-opportunity-form-panel crm-catalog-dialog crm-commissions-write-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-busy={submitting || undefined}
      >
        <div className="crm-panel-head">
          <h2 id={headingId}>{title}</h2>
          <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
            Close
          </button>
        </div>
        {preIssue ? (
          <p className="crm-banner crm-banner-warning" role="note">
            Use only when real compensation has already been received before the normal
            issued/in-force posting gate. This does not change Production stage.
          </p>
        ) : (
          <p className="crm-muted">
            Posts a writing-advisor actual commission event for this allocation only. If posting is
            rejected because the record is not issued, use Record pre-issue actual instead.
          </p>
        )}

        <dl className="crm-production-detail-grid crm-commissions-write-context">
          <div>
            <dt>Client</dt>
            <dd>{item.clientLabel}</dd>
          </div>
          <div>
            <dt>Policy / Application #</dt>
            <dd>{item.referenceLabel}</dd>
          </div>
          <div>
            <dt>Carrier</dt>
            <dd>{item.providerLabel}</dd>
          </div>
          <div>
            <dt>Product</dt>
            <dd>{item.productServiceLabel}</dd>
          </div>
          <div>
            <dt>Writing advisor</dt>
            <dd>{item.advisorName}</dd>
          </div>
          <div>
            <dt>Current expected</dt>
            <dd className="crm-production-money">
              {item.expectedCents == null ? '—' : formatCents(item.expectedCents)}
            </dd>
          </div>
          <div>
            <dt>Current outstanding</dt>
            <dd className="crm-production-money">{formatCents(item.outstandingCents)}</dd>
          </div>
          <div>
            <dt>Current paid</dt>
            <dd className="crm-production-money">{formatCents(item.paidCents)}</dd>
          </div>
        </dl>

        {error ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <label className="crm-field">
            <span>Event type</span>
            <select
              value={draft.eventType}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  eventType: event.target.value as (typeof MANUAL_RECORD_EVENT_TYPES)[number],
                }))
              }
              disabled={submitting}
            >
              {MANUAL_RECORD_EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatCommissionEventTypeLabel(type)}
                </option>
              ))}
            </select>
            {fieldErrors.eventType ? (
              <span className="crm-field-error">{fieldErrors.eventType}</span>
            ) : null}
          </label>

          <label className="crm-field">
            <span>Amount</span>
            <input
              ref={amountRef}
              inputMode="decimal"
              value={draft.amountInput}
              onChange={(event) =>
                setDraft((current) => ({ ...current, amountInput: event.target.value }))
              }
              placeholder="0.00"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.amount) || undefined}
            />
            {fieldErrors.amount ? (
              <span className="crm-field-error">{fieldErrors.amount}</span>
            ) : (
              <span className="crm-muted">
                Enter a positive dollar amount. Chargebacks are posted as negative cents
                automatically.
              </span>
            )}
          </label>

          {draft.eventType === 'adjustment' ? (
            <fieldset className="crm-field">
              <legend>Adjustment direction</legend>
              <label>
                <input
                  type="radio"
                  name="adjustment-direction"
                  checked={draft.adjustmentDirection === 'increase'}
                  onChange={() =>
                    setDraft((current) => ({ ...current, adjustmentDirection: 'increase' }))
                  }
                  disabled={submitting}
                />
                Increase
              </label>
              <label>
                <input
                  type="radio"
                  name="adjustment-direction"
                  checked={draft.adjustmentDirection === 'decrease'}
                  onChange={() =>
                    setDraft((current) => ({ ...current, adjustmentDirection: 'decrease' }))
                  }
                  disabled={submitting}
                />
                Decrease
              </label>
            </fieldset>
          ) : null}

          <label className="crm-field">
            <span>Transaction date</span>
            <input
              type="date"
              value={draft.transactionDate}
              onChange={(event) =>
                setDraft((current) => ({ ...current, transactionDate: event.target.value }))
              }
              disabled={submitting}
              required
              aria-invalid={Boolean(fieldErrors.transactionDate) || undefined}
            />
            {fieldErrors.transactionDate ? (
              <span className="crm-field-error">{fieldErrors.transactionDate}</span>
            ) : null}
          </label>

          <label className="crm-field">
            <span>Reason / source</span>
            <textarea
              value={draft.reason}
              onChange={(event) =>
                setDraft((current) => ({ ...current, reason: event.target.value }))
              }
              disabled={submitting}
              required
              rows={3}
              maxLength={500}
              placeholder="Carrier commission statement"
              aria-invalid={Boolean(fieldErrors.reason) || undefined}
            />
            {fieldErrors.reason ? (
              <span className="crm-field-error">{fieldErrors.reason}</span>
            ) : null}
          </label>

          <button
            type="button"
            className="crm-text-btn"
            onClick={() => setShowDetails((open) => !open)}
            disabled={submitting}
          >
            {showDetails ? 'Hide details' : 'More details'}
          </button>

          {showDetails ? (
            <div className="crm-commissions-write-details">
              <label className="crm-field">
                <span>Statement identifier</span>
                <input
                  value={draft.statementIdentifier}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      statementIdentifier: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  autoComplete="off"
                />
              </label>
              <label className="crm-field">
                <span>Statement date</span>
                <input
                  type="date"
                  value={draft.statementDate}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, statementDate: event.target.value }))
                  }
                  disabled={submitting}
                />
              </label>
              <label className="crm-field">
                <span>Carrier transaction ID</span>
                <input
                  value={draft.carrierTransactionId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      carrierTransactionId: event.target.value,
                    }))
                  }
                  disabled={submitting}
                  autoComplete="off"
                />
              </label>
              <label className="crm-field">
                <span>Policy reference</span>
                <input
                  value={draft.policyReference}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, policyReference: event.target.value }))
                  }
                  disabled={submitting}
                  autoComplete="off"
                />
              </label>
              <label className="crm-field">
                <span>Source file / label</span>
                <input
                  value={draft.sourceFile}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, sourceFile: event.target.value }))
                  }
                  disabled={submitting}
                  autoComplete="off"
                />
              </label>
              <label className="crm-field">
                <span>Raw description</span>
                <textarea
                  value={draft.rawDescription}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, rawDescription: event.target.value }))
                  }
                  disabled={submitting}
                  rows={2}
                  maxLength={2000}
                />
              </label>
            </div>
          ) : null}

          <div className="crm-form-actions">
            <button
              type="button"
              className="crm-secondary-btn"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="crm-primary-btn" disabled={submitting}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function recordDialogPreviewCents(
  eventType: (typeof MANUAL_RECORD_EVENT_TYPES)[number],
  signedCents: number,
): string {
  return `${formatCommissionEventTypeLabel(eventType)} ${formatSignedCents(signedCents)}`
}
