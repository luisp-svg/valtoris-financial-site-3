import { useId, useState, type FormEvent } from 'react'
import {
  assertValidNoteBody,
  createHouseholdNote,
  formatSupabaseError,
  HouseholdNoteValidationError,
} from './notesApi'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

type HouseholdNoteComposerProps = {
  householdId: string
  authorUserId: string
  disabled?: boolean
  disabledReason?: string | null
  onSaved: () => void | Promise<void>
  onSaveFailed?: () => void | Promise<void>
}

export default function HouseholdNoteComposer({
  householdId,
  authorUserId,
  disabled = false,
  disabledReason = null,
  onSaved,
  onSaveFailed,
}: HouseholdNoteComposerProps) {
  const headingId = useId()
  const [body, setBody] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (disabled || submitting) return

    setSubmitError(null)
    setFieldError(null)

    let normalized: string
    try {
      normalized = assertValidNoteBody(body)
    } catch (err) {
      setFieldError(
        err instanceof HouseholdNoteValidationError ? err.message : 'Note body is required.',
      )
      return
    }

    setSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      await createHouseholdNote(
        supabase,
        { household_id: householdId, body: normalized },
        authorUserId,
      )
      setBody('')
      await onSaved()
    } catch (err) {
      setSubmitError(formatSupabaseError('create_note', err))
      try {
        await onSaveFailed?.()
      } catch {
        // Parent refresh errors are logged by the page.
      }
    } finally {
      setSubmitting(false)
    }
  }

  const controlsDisabled = disabled || submitting

  return (
    <section className="crm-panel crm-note-composer-panel" aria-labelledby={headingId}>
      <div className="crm-panel-head">
        <h2 id={headingId}>Add note</h2>
      </div>

      {disabled && disabledReason ? (
        <p className="crm-banner crm-banner-warning">{disabledReason}</p>
      ) : null}

      {submitError ? (
        <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }}>
          {submitError}
        </p>
      ) : null}

      <form className="crm-task-form crm-note-composer-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label className="crm-field">
          Internal note
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={8000}
            disabled={controlsDisabled}
            placeholder="Write a household note…"
            aria-invalid={Boolean(fieldError)}
          />
          {fieldError ? <span className="crm-field-error">{fieldError}</span> : null}
        </label>

        <div className="crm-form-actions">
          <button type="submit" className="crm-primary-btn" disabled={controlsDisabled}>
            {submitting ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </form>
    </section>
  )
}
