import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formatCommissionEventTypeLabel } from '../production/compensationLabels'
import { formatCents, formatProductionDate } from '../production/productionApi'
import { formatSignedCents, type WritingCommissionEvent } from '../production/compensationView'
import { formatCommissionEventSourceLabel } from './commissionEventSource'
import { validateReverseReason } from './commissionRecordDraft'
import type { CommissionWorkItem } from './commissionWorkView'

type ReverseCommissionEventDialogProps = {
  item: CommissionWorkItem
  event: WritingCommissionEvent
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (input: { eventId: string; reason: string }) => void
}

export default function ReverseCommissionEventDialog({
  item,
  event,
  submitting,
  error,
  onCancel,
  onConfirm,
}: ReverseCommissionEventDialogProps) {
  const headingId = useId()
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    reasonRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(keyboard: KeyboardEvent) {
      if (keyboard.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault()
    if (submitting) return
    const missing = validateReverseReason(reason)
    if (missing) {
      setFieldError(missing)
      return
    }
    setFieldError(null)
    onConfirm({ eventId: event.id, reason: reason.trim() })
  }

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
          <h2 id={headingId}>Reverse this commission event?</h2>
          <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
            Close
          </button>
        </div>
        <p>
          This creates an immutable correcting event. The original event remains in history.
        </p>
        <dl className="crm-production-detail-grid">
          <div>
            <dt>Original event</dt>
            <dd>{formatCommissionEventTypeLabel(event.event_type)}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd className="crm-production-money">{formatSignedCents(event.amount_cents)}</dd>
          </div>
          <div>
            <dt>Transaction date</dt>
            <dd>{formatProductionDate(event.transaction_date)}</dd>
          </div>
          <div>
            <dt>Advisor</dt>
            <dd>{item.advisorName}</dd>
          </div>
          <div>
            <dt>Source / reference</dt>
            <dd>{formatCommissionEventSourceLabel(event)}</dd>
          </div>
        </dl>
        <p className="crm-muted">
          The reversal amount is {formatCents(Math.abs(event.amount_cents))} with the opposite
          sign. It cannot be edited.
        </p>
        {error ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {error}
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <label className="crm-field">
            <span>Reason</span>
            <textarea
              ref={reasonRef}
              value={reason}
              onChange={(change) => setReason(change.target.value)}
              disabled={submitting}
              required
              rows={3}
              maxLength={500}
              aria-invalid={Boolean(fieldError) || undefined}
            />
            {fieldError ? <span className="crm-field-error">{fieldError}</span> : null}
          </label>
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
              {submitting ? 'Reversing…' : 'Reverse event'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
