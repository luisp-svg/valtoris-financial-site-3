import { useState } from 'react'
import { canComposeNotes } from '../../activityTabConfig'
import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import HouseholdNoteComposer from '../../HouseholdNoteComposer'
import HouseholdNoteDeletePanel from '../../HouseholdNoteDeletePanel'
import HouseholdNoteEditPanel from '../../HouseholdNoteEditPanel'
import { crmNoteAuthorUserId } from '../../noteAuthor'
import { normalizeNoteToTimelineItem } from '../../timeline'
import type { HouseholdTimelineItem } from '../../types'
import type { ClientWorkspaceActivityHandlers, ClientWorkspaceTabProps } from '../types'
import { formatWorkspaceDateTime } from '../format'

type NotesTabProps = ClientWorkspaceTabProps &
  Pick<
    ClientWorkspaceActivityHandlers,
    'authorUserId' | 'actionSuccess' | 'onRefreshAfterMutation' | 'onRefreshAfterFailure'
  > & {
    focusComposerRequestId?: number
  }

export default function NotesTab({
  workspace,
  householdId,
  authorUserId,
  actionSuccess,
  onRefreshAfterMutation,
  onRefreshAfterFailure,
  focusComposerRequestId = 0,
}: NotesTabProps) {
  const notesResult = workspace.notes
  const notes = notesResult.ok ? notesResult.value : []
  const composerAuthorId = crmNoteAuthorUserId({ id: authorUserId })
  const composerEnabled = Boolean(composerAuthorId) && canComposeNotes(notesResult)
  const [editing, setEditing] = useState<HouseholdTimelineItem | null>(null)
  const [deleting, setDeleting] = useState<HouseholdTimelineItem | null>(null)

  return (
    <div
      id="crm-client-workspace-tab-notes-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-notes"
      className="crm-household-workspace-tab-panel"
    >
      {actionSuccess ? <p className="crm-banner crm-banner-success">{actionSuccess}</p> : null}

      <p className="crm-muted">Private household notes — not policy-specific.</p>

      {composerAuthorId ? (
        <HouseholdNoteComposer
          householdId={householdId}
          authorUserId={composerAuthorId}
          disabled={!composerEnabled}
          disabledReason={
            composerEnabled
              ? null
              : 'Notes could not be loaded. Retry from Timeline before adding a note.'
          }
          focusRequestId={focusComposerRequestId}
          onSaved={() => onRefreshAfterMutation('Note added.')}
          onSaveFailed={onRefreshAfterFailure}
        />
      ) : (
        <p className="crm-banner crm-banner-warning">
          Sign in to add an operational note. Author is your CRM profile.
        </p>
      )}

      {editing ? (
        <HouseholdNoteEditPanel
          item={editing}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await onRefreshAfterMutation('Note updated.')
          }}
          onSaveFailed={onRefreshAfterFailure}
        />
      ) : null}
      {deleting ? (
        <HouseholdNoteDeletePanel
          item={deleting}
          onCancel={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null)
            await onRefreshAfterMutation('Note deleted.')
          }}
          onDeleteFailed={onRefreshAfterFailure}
        />
      ) : null}

      <Panel labelledBy="crm-notes-heading">
        <SectionHeader
          title="Operational Notes"
          titleId="crm-notes-heading"
          meta={notesResult.ok ? <span className="crm-count-pill">{notes.length}</span> : null}
        />

        {!notesResult.ok ? (
          <EmptyState
            title="Unable to load operational notes"
            description={notesResult.error}
          />
        ) : notes.length === 0 ? (
          <EmptyState
            title="No operational notes yet"
            description="Private household notes appear here, newest first. Older notes are kept."
          />
        ) : (
          <ul className="crm-household-overview-list">
            {notes.map((note) => {
              const item = normalizeNoteToTimelineItem(note)
              return (
                <li key={note.id}>
                  <p className="crm-task-title">
                    {note.author_display_name?.trim() || 'Advisor'}
                  </p>
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
        )}
      </Panel>
    </div>
  )
}
