import { useId, useState } from 'react'
import { formatSupabaseError, softDeleteHouseholdNote } from './notesApi'
import type { HouseholdTimelineItem } from './types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

type HouseholdNoteDeletePanelProps = {
  item: HouseholdTimelineItem
  onCancel: () => void
  onDeleted: () => void | Promise<void>
  onDeleteFailed?: () => void | Promise<void>
}

export default function HouseholdNoteDeletePanel({
  item,
  onCancel,
  onDeleted,
  onDeleteFailed,
}: HouseholdNoteDeletePanelProps) {
  const headingId = useId()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function confirmDelete() {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      await softDeleteHouseholdNote(supabase, item.sourceEntityId)
      await onDeleted()
    } catch (err) {
      setDeleteError(formatSupabaseError('delete_note', err))
      try {
        await onDeleteFailed?.()
      } catch {
        // Parent handles refresh logging.
      }
    } finally {
      setDeleting(false)
    }
  }

  const preview = item.body?.trim() || 'This note'

  return (
    <section className="crm-panel crm-note-delete-panel" aria-labelledby={headingId}>
      <div className="crm-panel-head">
        <h2 id={headingId}>Delete note</h2>
        <button type="button" className="crm-text-btn" onClick={onCancel} disabled={deleting}>
          Cancel
        </button>
      </div>

      <p className="crm-muted">
        Soft-delete this note from the household activity timeline? It will be hidden from active
        lists.
      </p>
      <p className="crm-note-delete-preview">{preview}</p>

      {deleteError ? (
        <p className="crm-banner crm-banner-error" style={{ whiteSpace: 'pre-wrap' }}>
          {deleteError}
        </p>
      ) : null}

      <div className="crm-form-actions">
        <button
          type="button"
          className="crm-primary-btn crm-danger-btn"
          onClick={() => void confirmDelete()}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Confirm delete'}
        </button>
      </div>
    </section>
  )
}
