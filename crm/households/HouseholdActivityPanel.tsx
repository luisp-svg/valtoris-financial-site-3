import { useState } from 'react'
import {
  canComposeNotes,
  getActivityTabViewState,
} from './activityTabConfig'
import HouseholdActivityTimeline from './HouseholdActivityTimeline'
import HouseholdNoteComposer from './HouseholdNoteComposer'
import HouseholdNoteDeletePanel from './HouseholdNoteDeletePanel'
import HouseholdNoteEditPanel from './HouseholdNoteEditPanel'
import type {
  CrmHouseholdWorkspace,
  HouseholdTimelineItem,
} from './types'

type NoteUiState =
  | { mode: 'idle' }
  | { mode: 'edit'; item: HouseholdTimelineItem }
  | { mode: 'delete'; item: HouseholdTimelineItem }

type HouseholdActivityPanelProps = {
  householdId: string
  authorUserId: string
  workspace: CrmHouseholdWorkspace
  actionSuccess: string | null
  onRefreshAfterMutation: (successMessage: string) => Promise<void>
  onRefreshAfterFailure: () => Promise<void>
  onRetryLoad: () => Promise<void>
}

function ActivityEmptyIcon() {
  return (
    <svg
      className="crm-household-activity-empty-icon"
      viewBox="0 0 48 48"
      width="40"
      height="40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.08" />
      <path
        d="M24 12v12l7 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 34h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function HouseholdActivityPanel({
  householdId,
  authorUserId,
  workspace,
  actionSuccess,
  onRefreshAfterMutation,
  onRefreshAfterFailure,
  onRetryLoad,
}: HouseholdActivityPanelProps) {
  const [noteUi, setNoteUi] = useState<NoteUiState>({ mode: 'idle' })
  const [retrying, setRetrying] = useState(false)

  const viewState = getActivityTabViewState(
    workspace.notes,
    workspace.activities,
    workspace.timelineComplete,
    workspace.timeline.length,
  )
  const composerEnabled = canComposeNotes(workspace.notes)
  const actionsDisabled = noteUi.mode !== 'idle'

  async function handleRetry() {
    setRetrying(true)
    try {
      await onRetryLoad()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      id="crm-household-tab-activity-panel"
      role="tabpanel"
      aria-labelledby="crm-household-tab-activity"
      className="crm-household-workspace-tab-panel crm-activity-tab-panel"
    >
      {actionSuccess ? <p className="crm-banner crm-banner-success">{actionSuccess}</p> : null}

      <HouseholdNoteComposer
        householdId={householdId}
        authorUserId={authorUserId}
        disabled={!composerEnabled}
        disabledReason={
          composerEnabled
            ? null
            : 'Notes could not be loaded. Retry loading activity before adding a note.'
        }
        onSaved={() => onRefreshAfterMutation('Note added.')}
        onSaveFailed={onRefreshAfterFailure}
      />

      {noteUi.mode === 'edit' ? (
        <HouseholdNoteEditPanel
          key={noteUi.item.id}
          item={noteUi.item}
          onCancel={() => setNoteUi({ mode: 'idle' })}
          onSaved={async () => {
            setNoteUi({ mode: 'idle' })
            await onRefreshAfterMutation('Note updated.')
          }}
          onSaveFailed={onRefreshAfterFailure}
        />
      ) : null}

      {noteUi.mode === 'delete' ? (
        <HouseholdNoteDeletePanel
          key={`delete-${noteUi.item.id}`}
          item={noteUi.item}
          onCancel={() => setNoteUi({ mode: 'idle' })}
          onDeleted={async () => {
            setNoteUi({ mode: 'idle' })
            await onRefreshAfterMutation('Note deleted.')
          }}
          onDeleteFailed={onRefreshAfterFailure}
        />
      ) : null}

      <section className="crm-panel" aria-labelledby="crm-activity-timeline-heading">
        <div className="crm-panel-head">
          <h2 id="crm-activity-timeline-heading">Activity</h2>
          {viewState.kind === 'timeline' ? (
            <span className="crm-count-pill">{workspace.timeline.length}</span>
          ) : null}
        </div>

        {viewState.kind === 'load_error' ? (
          <div className="crm-empty-state crm-activity-load-error">
            <p className="crm-empty-state-title">Unable to load activity</p>
            <p>{viewState.message}</p>
            {!workspace.notes.ok ? (
              <p className="crm-muted" style={{ whiteSpace: 'pre-wrap' }}>
                {workspace.notes.error}
              </p>
            ) : null}
            {!workspace.activities.ok ? (
              <p className="crm-muted" style={{ whiteSpace: 'pre-wrap' }}>
                {workspace.activities.error}
              </p>
            ) : null}
            <p className="crm-muted">
              The merged timeline is hidden until both notes and activity records load successfully.
            </p>
            <button
              type="button"
              className="crm-secondary-btn"
              onClick={() => void handleRetry()}
              disabled={retrying}
            >
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        ) : null}

        {viewState.kind === 'empty' ? (
          <div className="crm-empty-state crm-household-activity-empty">
            <ActivityEmptyIcon />
            <p className="crm-empty-state-title">No activity yet.</p>
            <p>Notes and household events will appear here as advisors work with this household.</p>
          </div>
        ) : null}

        {viewState.kind === 'timeline' ? (
          <HouseholdActivityTimeline
            items={workspace.timeline}
            onEditNote={(item) => setNoteUi({ mode: 'edit', item })}
            onDeleteNote={(item) => setNoteUi({ mode: 'delete', item })}
            actionsDisabled={actionsDisabled}
          />
        ) : null}
      </section>
    </div>
  )
}
