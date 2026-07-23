import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  assertValidNoteBody,
  formatSupabaseError,
  HouseholdNoteValidationError,
  updateHouseholdNote,
} from './notesApi'
import type { HouseholdTimelineItem } from './types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

type HouseholdNoteEditPanelProps = {
  item: HouseholdTimelineItem
  onCancel: () => void
  onSaved: () => void | Promise<void>
  onSaveFailed?: () => void | Promise<void>
}

export default function HouseholdNoteEditPanel({
  item,
  onCancel,
  onSaved,
  onSaveFailed,
}: HouseholdNoteEditPanelProps) {
  const headingId = useId()
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState(item.body ?? '')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return

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
      await updateHouseholdNote(supabase, item.sourceEntityId, normalized)
      await onSaved()
    } catch (err) {
      setSubmitError(formatSupabaseError('update_note', err))
      try {
        await onSaveFailed?.()
      } catch {
        // Parent handles refresh logging.
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="crm-panel crm-note-edit-panel" aria-labelledby={headingId}>
      <div className="crm-panel-head">
        <h2 id={headingId}>Edit note</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>

      {submitError ? (
        <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }}>
          {submitError}
        </p>
      ) : null}

      <form className="crm-task-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label className="crm-field">
          Internal note
          <textarea
            ref={fieldRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={8000}
            disabled={submitting}
            aria-invalid={Boolean(fieldError)}
          />
          {fieldError ? <span className="crm-field-error">{fieldError}</span> : null}
        </label>

        <div className="crm-form-actions">
          <button type="submit" className="crm-primary-btn" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  )
}
