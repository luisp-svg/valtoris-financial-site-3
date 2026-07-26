import { canComposeNotes } from '../../activityTabConfig'
import EmptyState from '../../../components/ui/EmptyState'
import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import HouseholdNoteComposer from '../../HouseholdNoteComposer'
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
  const composerEnabled = canComposeNotes(notesResult)

  return (
    <div
      id="crm-client-workspace-tab-notes-panel"
      role="tabpanel"
      aria-labelledby="crm-client-workspace-tab-notes"
      className="crm-household-workspace-tab-panel"
    >
      {actionSuccess ? <p className="crm-banner crm-banner-success">{actionSuccess}</p> : null}

      <HouseholdNoteComposer
        householdId={householdId}
        authorUserId={authorUserId}
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

      <Panel labelledBy="crm-notes-heading">
        <SectionHeader
          title="Notes"
          titleId="crm-notes-heading"
          meta={notesResult.ok ? <span className="crm-count-pill">{notes.length}</span> : null}
        />

        {!notesResult.ok ? (
          <EmptyState
            title="Unable to load notes"
            description={notesResult.error}
          />
        ) : notes.length === 0 ? (
          <EmptyState
            title="No notes yet"
            description="Internal notes for this household will appear here."
          />
        ) : (
          <ul className="crm-household-overview-list">
            {notes.map((note) => (
              <li key={note.id}>
                <p className="crm-task-title">
                  {note.author_display_name?.trim() || 'Advisor'}
                </p>
                <p className="crm-task-meta">{formatWorkspaceDateTime(note.created_at)}</p>
                <p className="crm-household-activity-body">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
