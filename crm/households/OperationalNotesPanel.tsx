import { useEffect, useId, useState } from 'react'
import HouseholdNoteComposer from './HouseholdNoteComposer'
import HouseholdNoteDeletePanel from './HouseholdNoteDeletePanel'
import HouseholdNoteEditPanel from './HouseholdNoteEditPanel'
import { crmNoteAuthorUserId } from './noteAuthor'
import { fetchHouseholdNotes, formatSupabaseError } from './notesApi'
import { normalizeNoteToTimelineItem } from './timeline'
import type { HouseholdNote, HouseholdTimelineItem } from './types'
import { formatWorkspaceDateTime } from './ClientWorkspace/format'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

export type OperationalNotesTarget = {
  householdId: string
  householdName: string
}

type OperationalNotesPanelProps = {
  householdId: string
  householdName: string
  authorUserId: string | null
}

export default function OperationalNotesPanel({
  householdId,
  householdName,
  authorUserId,
}: OperationalNotesPanelProps) {
  const headingId = useId()
  const [notes, setNotes] = useState<HouseholdNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState<HouseholdTimelineItem | null>(null)
  const [deleting, setDeleting] = useState<HouseholdTimelineItem | null>(null)
  const authorId = crmNoteAuthorUserId(authorUserId ? { id: authorUserId } : null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchHouseholdNotes(supabase, householdId)
        if (!cancelled) setNotes(rows)
      } catch (err) {
        if (!cancelled) {
          setNotes([])
          setError(formatSupabaseError('household-notes', err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [householdId, reloadKey])

  function refresh() {
    setEditing(null)
    setDeleting(null)
    setReloadKey((n) => n + 1)
  }

  return (
    <div className="crm-operational-notes-panel">
      <p className="crm-muted">Private household notes — not policy-specific.</p>
      <h3 id={headingId} className="crm-operational-notes-client">
        {householdName}
      </h3>

      {authorId ? (
        <HouseholdNoteComposer
          householdId={householdId}
          authorUserId={authorId}
          onSaved={refresh}
        />
      ) : (
        <p className="crm-banner crm-banner-warning">
          Sign in to add an operational note. Author is your CRM profile.
        </p>
      )}

      {editing ? (
        <HouseholdNoteEditPanel item={editing} onCancel={() => setEditing(null)} onSaved={refresh} />
      ) : null}
      {deleting ? (
        <HouseholdNoteDeletePanel
          item={deleting}
          onCancel={() => setDeleting(null)}
          onDeleted={refresh}
        />
      ) : null}

      {loading ? <p className="crm-muted">Loading operational notes…</p> : null}
      {error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && notes.length === 0 ? (
        <p className="crm-muted">No operational notes yet for this household.</p>
      ) : null}
      {!loading && notes.length > 0 ? (
        <ul className="crm-operational-notes-list">
          {notes.map((note) => {
            const item = normalizeNoteToTimelineItem(note)
            return (
              <li key={note.id} className="crm-operational-notes-item">
                <p className="crm-task-title">{note.author_display_name?.trim() || 'Advisor'}</p>
                <p className="crm-task-meta">{formatWorkspaceDateTime(note.created_at)}</p>
                <p className="crm-household-activity-body">{note.body}</p>
                <div className="crm-member-row-actions">
                  <button type="button" className="crm-text-btn" onClick={() => setEditing(item)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="crm-text-btn crm-text-btn-danger"
                    onClick={() => setDeleting(item)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
