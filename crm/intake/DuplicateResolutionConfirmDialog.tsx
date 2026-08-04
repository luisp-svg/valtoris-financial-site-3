import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { DuplicateResolutionWriteAction } from './types'

export type DuplicateResolutionConfirmDialogProps = {
  action: DuplicateResolutionWriteAction
  prospectName: string
  candidateName: string | null
  submitting: boolean
  error: string | null
  /** When true, copy refers to Digital Identity / Let's Connect (no assessment). */
  isDigitalIdentity?: boolean
  onCancel: () => void
  onConfirm: (notes: string) => void | Promise<void>
}

function dialogCopy(action: DuplicateResolutionWriteAction, isDigitalIdentity: boolean) {
  if (action === 'confirm_same_household') {
    return {
      title: 'Confirm same household',
      body: isDigitalIdentity
        ? [
            'The Digital Identity / Let’s Connect lead will be linked to the candidate household.',
            'Canonical household contact information will not be changed.',
            'The provisional household will be marked merged and removed from active household lists.',
            'Lead history will be preserved. No assessment is created or moved.',
          ]
        : [
            'The lead and Initial Financial Diagnostic will be linked to the candidate household.',
            'Canonical household contact information will not be changed.',
            'The provisional household will be marked merged and removed from active household lists.',
            'Historical assessment and lead records will be preserved as a public self-report.',
          ],
      confirmLabel: 'Confirm Same Household',
    }
  }
  return {
    title: 'Keep as separate household',
    body: [
      'The provisional household will remain a separate active prospect.',
      'The candidate household will not be modified.',
      'The duplicate review will be closed as not a duplicate.',
    ],
    confirmLabel: 'Keep as Separate Household',
  }
}

/**
 * Consequential confirmation for owner duplicate resolution.
 * Does not mutate until the explicit confirm button is pressed.
 */
export default function DuplicateResolutionConfirmDialog({
  action,
  prospectName,
  candidateName,
  submitting,
  error,
  isDigitalIdentity = false,
  onCancel,
  onConfirm,
}: DuplicateResolutionConfirmDialogProps) {
  const titleId = useId()
  const notesId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [notes, setNotes] = useState('')
  const copy = dialogCopy(action, isDigitalIdentity)

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
    void onConfirm(notes)
  }

  return (
    <div className="crm-intake-dialog-backdrop" role="presentation">
      <div
        className="crm-panel crm-intake-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{copy.title}</h2>
        <p className="crm-muted">
          Prospect: <strong>{prospectName}</strong>
          {action === 'confirm_same_household' && candidateName
            ? ` · Candidate: ${candidateName}`
            : null}
        </p>
        <ul className="crm-intake-confirm-list">
          {copy.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <form onSubmit={handleSubmit}>
          <label className="crm-field" htmlFor={notesId}>
            <span>Resolution notes (optional)</span>
            <textarea
              id={notesId}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={2000}
              disabled={submitting}
            />
          </label>
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
              className="platform-btn platform-btn-primary"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? 'Resolving…' : copy.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
