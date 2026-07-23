import type { WorkspaceLoadResult } from './types'

export type WorkspaceTabId = 'overview' | 'members' | 'activity'

export type WorkspaceTabDefinition = {
  id: WorkspaceTabId | 'tasks' | 'documents'
  label: string
  enabled: boolean
}

/** Single Activity entry point; Notes/Timeline placeholders removed. */
export const WORKSPACE_TABS: WorkspaceTabDefinition[] = [
  { id: 'overview', label: 'Overview', enabled: true },
  { id: 'members', label: 'Members', enabled: true },
  { id: 'activity', label: 'Activity', enabled: true },
  { id: 'tasks', label: 'Tasks', enabled: false },
  { id: 'documents', label: 'Documents', enabled: false },
]

export type ActivityTabViewState =
  | {
      kind: 'load_error'
      notesFailed: boolean
      activitiesFailed: boolean
      message: string
    }
  | { kind: 'empty' }
  | { kind: 'timeline' }

export function canComposeNotes(notesResult: WorkspaceLoadResult<unknown>): boolean {
  return notesResult.ok
}

export function getActivityTabViewState(
  notesResult: WorkspaceLoadResult<unknown>,
  activitiesResult: WorkspaceLoadResult<unknown>,
  timelineComplete: boolean,
  timelineLength: number,
): ActivityTabViewState {
  const notesFailed = !notesResult.ok
  const activitiesFailed = !activitiesResult.ok

  if (notesFailed || activitiesFailed) {
    const parts: string[] = []
    if (notesFailed) parts.push('notes')
    if (activitiesFailed) parts.push('activity records')
    return {
      kind: 'load_error',
      notesFailed,
      activitiesFailed,
      message: `Unable to load ${parts.join(' and ')}.`,
    }
  }

  if (timelineComplete && timelineLength === 0) {
    return { kind: 'empty' }
  }

  return { kind: 'timeline' }
}

export function formatTimelineDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
