import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { formatCommissionEventTypeLabel } from '../production/compensationLabels'
import { formatCents, formatProductionDate } from '../production/productionApi'
import { formatSignedCents, type WritingCommissionEvent } from '../production/compensationView'
import { centsToDollarInput } from './commissionMoney'
import { formatCommissionEventSourceLabel } from './commissionEventSource'
import {
  validateAttributionDraft,
  type AttributionDraftLine,
} from './commissionRecordDraft'
import type { CommissionWorkItem } from './commissionWorkView'
import type { WritingAttributionTarget } from './commissionWriteView'

type AttributeCommissionEventDialogProps = {
  item: CommissionWorkItem
  event: WritingCommissionEvent
  targets: readonly WritingAttributionTarget[]
  idempotencyKey: string
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (input: {
    eventId: string
    reason: string
    idempotencyKey: string
    attributions: Array<{ allocationId: string; amountCents: number }>
  }) => void
}

function initialLines(
  targets: readonly WritingAttributionTarget[],
  sourceAmountCents: number,
): AttributionDraftLine[] {
  const amount = centsToDollarInput(sourceAmountCents)
  if (targets.length === 1) {
    return [
      {
        allocationId: targets[0].allocationId,
        selected: true,
        amountInput: amount,
      },
    ]
  }
  return targets.map((target) => ({
    allocationId: target.allocationId,
    selected: false,
    amountInput: '',
  }))
}

export default function AttributeCommissionEventDialog({
  item,
  event,
  targets,
  idempotencyKey,
  submitting,
  error,
  onCancel,
  onConfirm,
}: AttributeCommissionEventDialogProps) {
  const headingId = useId()
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState(() => initialLines(targets, event.amount_cents))
  const [formError, setFormError] = useState<string | null>(null)

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

  const targetById = useMemo(
    () => new Map(targets.map((target) => [target.allocationId, target])),
    [targets],
  )

  function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault()
    if (submitting) return
    const result = validateAttributionDraft({
      sourceAmountCents: event.amount_cents,
      lines,
      reason,
    })
    if (!result.ok) {
      setFormError(result.message)
      return
    }
    setFormError(null)
    onConfirm({
      eventId: event.id,
      reason: reason.trim(),
      idempotencyKey,
      attributions: result.attributions,
    })
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
          <h2 id={headingId}>Attribute unattributed commission</h2>
          <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
            Close
          </button>
        </div>
        <p>
          {item.clientLabel} · {item.referenceLabel} · {item.providerLabel} ·{' '}
          {item.productServiceLabel}
        </p>
        <p>
          Original {formatCommissionEventTypeLabel(event.event_type)}{' '}
          <span className="crm-production-money">{formatSignedCents(event.amount_cents)}</span>
          {' · '}
          {formatProductionDate(event.transaction_date)} · {formatCommissionEventSourceLabel(event)}
        </p>
        <p className="crm-muted">
          The original event stays in history. This creates a reversal of the unattributed amount
          and new attributed events. Amounts are not filled from writing split percentages.
        </p>
        {targets.length === 0 ? (
          <p className="crm-banner crm-banner-error" role="alert">
            No writing allocations are available to attribute this event.
          </p>
        ) : null}
        {error ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {error}
          </p>
        ) : null}
        {formError ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {formError}
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <fieldset className="crm-field">
            <legend>Writing allocations</legend>
            {lines.map((line) => {
              const target = targetById.get(line.allocationId)
              if (!target) return null
              return (
                <div key={line.allocationId} className="crm-commissions-attribute-line">
                  <label>
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={(change) =>
                        setLines((current) =>
                          current.map((row) =>
                            row.allocationId === line.allocationId
                              ? { ...row, selected: change.target.checked }
                              : row,
                          ),
                        )
                      }
                      disabled={submitting || targets.length === 1}
                    />
                    {target.advisorName}
                    {target.splitLabel !== '—' ? ` · Writing split ${target.splitLabel}` : ''}
                  </label>
                  <label className="crm-field">
                    <span>Amount</span>
                    <input
                      inputMode="decimal"
                      value={line.amountInput}
                      onChange={(change) =>
                        setLines((current) =>
                          current.map((row) =>
                            row.allocationId === line.allocationId
                              ? { ...row, amountInput: change.target.value }
                              : row,
                          ),
                        )
                      }
                      disabled={submitting || !line.selected}
                      placeholder={centsToDollarInput(event.amount_cents)}
                    />
                  </label>
                </div>
              )
            })}
          </fieldset>
          <p className="crm-muted">
            Total must equal {formatCents(Math.abs(event.amount_cents))}
            {event.amount_cents < 0 ? ' as a negative (chargeback/decrease) event.' : '.'}
          </p>
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
            />
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
            <button
              type="submit"
              className="crm-primary-btn"
              disabled={submitting || targets.length === 0}
            >
              {submitting ? 'Attributing…' : 'Attribute event'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
