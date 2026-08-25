import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { IntakeArchiveReason } from './types'
import {
  INTAKE_ARCHIVE_CONFIRM_COPY,
  INTAKE_ARCHIVE_REASON_OPTIONS,
} from './intakeArchiveUi'

export type IntakeArchiveConfirmDialogProps = {
  prospectName: string
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (reason: IntakeArchiveReason) => void | Promise<void>
}

export default function IntakeArchiveConfirmDialog({
  prospectName,
  submitting,
  error,
  onCancel,
  onConfirm,
}: IntakeArchiveConfirmDialogProps) {
  const titleId = useId()
  const reasonGroupId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [reason, setReason] = useState<IntakeArchiveReason | null>(null)

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
    if (submitting || !reason) return
    void onConfirm(reason)
  }

  const selectedHelp = INTAKE_ARCHIVE_REASON_OPTIONS.find((option) => option.value === reason)?.help

  return (
    <div className="crm-intake-dialog-backdrop" role="presentation">
      <div
        className="crm-panel crm-intake-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>Archive / Dismiss</h2>
        <p className="crm-muted">
          Prospect: <strong>{prospectName}</strong>
        </p>
        <p>{INTAKE_ARCHIVE_CONFIRM_COPY}</p>
        <form onSubmit={handleSubmit}>
          <fieldset className="crm-field crm-intake-archive-reasons" disabled={submitting}>
            <legend id={reasonGroupId}>Archive reason</legend>
            {INTAKE_ARCHIVE_REASON_OPTIONS.map((option) => (
              <label key={option.value} className="crm-intake-archive-reason">
                <input
                  type="radio"
                  name="intake-archive-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  disabled={submitting}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span className="crm-muted">{option.help}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {selectedHelp ? <p className="crm-muted">{selectedHelp}</p> : null}
          {error ? (
            <p className="crm-banner crm-banner-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="crm-intake-resolution-actions">
            <button
              type="button"
              className="platform-btn platform-btn-outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="submit"
              className="platform-btn platform-btn-outline"
              disabled={submitting || !reason}
              aria-busy={submitting}
            >
              {submitting ? 'Archiving…' : 'Archive Intake'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
