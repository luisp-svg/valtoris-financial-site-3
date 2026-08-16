import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { StageTransitionAction } from './stageTransitionView'

type StageTransitionConfirmDialogProps = {
  action: StageTransitionAction
  submitting: boolean
  error: string | null
  initialPolicyNumber?: string
  onCancel: () => void
  onConfirm: (input: { reason: string; policyNumber: string }) => void
}

export default function StageTransitionConfirmDialog({
  action,
  submitting,
  error,
  initialPolicyNumber = '',
  onCancel,
  onConfirm,
}: StageTransitionConfirmDialogProps) {
  const headingId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [reason, setReason] = useState('')
  const [policyNumber, setPolicyNumber] = useState(initialPolicyNumber)

  useEffect(() => {
    confirmRef.current?.focus()
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
    if (action.needsReason && !reason.trim()) return
    if (action.needsPolicyNumber && !policyNumber.trim()) return
    onConfirm({ reason: reason.trim(), policyNumber: policyNumber.trim() })
  }

  const missingReason = action.needsReason && !reason.trim()
  const missingPolicy = action.needsPolicyNumber && !policyNumber.trim()
  const blocked = submitting || missingReason || missingPolicy

  return (
    <section
      className="crm-panel crm-opportunity-form-panel crm-catalog-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-busy={submitting || undefined}
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>{action.confirmTitle}</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
      {action.confirmBody.map((paragraph) => (
        <p key={paragraph} className="crm-muted">
          {paragraph}
        </p>
      ))}
      {error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit}>
        {action.needsPolicyNumber ? (
          <label className="crm-field">
            <span>Policy number</span>
            <input
              value={policyNumber}
              onChange={(event) => setPolicyNumber(event.target.value)}
              disabled={submitting}
              autoComplete="off"
              required
            />
          </label>
        ) : null}
        {action.needsReason ? (
          <label className="crm-field">
            <span>Reason</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={submitting}
              required
              rows={3}
            />
          </label>
        ) : null}
        <div className="crm-form-actions">
          <button type="button" className="crm-secondary-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className="crm-primary-btn"
            disabled={blocked}
          >
            {submitting ? 'Updating stage…' : action.confirmLabel}
          </button>
        </div>
      </form>
    </section>
  )
}
