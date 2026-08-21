import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { POLICY_LIFECYCLE_CHARGEBACK_NOTE } from './policyLifecycle'
import {
  defaultPostPlacementDraft,
  formatPostPlacementOutcomeLabel,
  POST_PLACEMENT_OUTCOMES,
  POST_PLACEMENT_REASON_MAX,
  validatePostPlacementDraft,
  type PostPlacementDraft,
  type PostPlacementFieldErrors,
  type PostPlacementRpcArgs,
} from './policyLifecycleView'

type RecordPostPlacementOutcomeDialogProps = {
  applicationId: string
  submitting: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (args: PostPlacementRpcArgs) => void
}

export default function RecordPostPlacementOutcomeDialog({
  applicationId,
  submitting,
  error,
  onCancel,
  onConfirm,
}: RecordPostPlacementOutcomeDialogProps) {
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [draft, setDraft] = useState<PostPlacementDraft>(() => defaultPostPlacementDraft())
  const [fieldErrors, setFieldErrors] = useState<PostPlacementFieldErrors>({})

  useEffect(() => {
    closeRef.current?.focus()
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
    const result = validatePostPlacementDraft({ applicationId, draft })
    if (!result.ok) {
      setFieldErrors(result.errors)
      return
    }
    setFieldErrors({})
    onConfirm(result.args)
  }

  const blocked = submitting

  return (
    <section
      className="crm-panel crm-opportunity-form-panel crm-catalog-dialog crm-policy-lifecycle-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-busy={submitting || undefined}
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>Record policy outcome</h2>
        <button
          ref={closeRef}
          type="button"
          className="crm-text-btn"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
      <p className="crm-muted">
        This updates the linked in-force policy only. The Case stays Placed. Production stage stays
        in force.
      </p>
      <p className="crm-production-kpi-caption">{POLICY_LIFECYCLE_CHARGEBACK_NOTE}</p>
      {error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="crm-policy-lifecycle-form">
        <fieldset className="crm-application-entry-fieldset">
          <legend>Outcome</legend>
          {POST_PLACEMENT_OUTCOMES.map((outcome) => (
            <label key={outcome} className="crm-radio-field">
              <input
                type="radio"
                name="post-placement-outcome"
                value={outcome}
                checked={draft.outcome === outcome}
                disabled={submitting}
                onChange={() => setDraft((current) => ({ ...current, outcome }))}
              />
              <span>{formatPostPlacementOutcomeLabel(outcome)}</span>
            </label>
          ))}
        </fieldset>
        {fieldErrors.outcome ? (
          <p className="crm-field-error" role="alert">
            {fieldErrors.outcome}
          </p>
        ) : null}

        <label className="crm-field">
          <span>Termination date (optional)</span>
          <input
            type="date"
            value={draft.terminatedOn}
            onChange={(event) =>
              setDraft((current) => ({ ...current, terminatedOn: event.target.value }))
            }
            disabled={submitting}
          />
        </label>
        {fieldErrors.terminatedOn ? (
          <p className="crm-field-error" role="alert">
            {fieldErrors.terminatedOn}
          </p>
        ) : null}
        <p className="crm-muted">
          Leave blank if the exact day is unknown. If a date is supplied, the server checks it
          against the selected outcome.
        </p>

        <label className="crm-field">
          <span>Termination reason</span>
          <textarea
            value={draft.reason}
            onChange={(event) =>
              setDraft((current) => ({ ...current, reason: event.target.value }))
            }
            disabled={submitting}
            required
            rows={3}
            maxLength={POST_PLACEMENT_REASON_MAX}
          />
        </label>
        {fieldErrors.reason ? (
          <p className="crm-field-error" role="alert">
            {fieldErrors.reason}
          </p>
        ) : null}

        <div className="crm-form-actions crm-policy-lifecycle-actions">
          <button type="button" className="crm-secondary-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="crm-primary-btn" disabled={blocked}>
            {submitting ? 'Recording…' : 'Record outcome'}
          </button>
        </div>
      </form>
    </section>
  )
}
