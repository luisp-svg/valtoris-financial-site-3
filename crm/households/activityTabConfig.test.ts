import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_TABS,
  canComposeNotes,
  getActivityTabViewState,
} from './activityTabConfig'
import type { WorkspaceLoadResult } from './types'

function ok<T>(value: T): WorkspaceLoadResult<T> {
  return { ok: true, value }
}

function fail<T>(value: T, error = 'failed'): WorkspaceLoadResult<T> {
  return { ok: false, value, error }
}

describe('WORKSPACE_TABS', () => {
  it('enables Activity and does not expose Notes or Timeline tabs', () => {
    const enabled = WORKSPACE_TABS.filter((tab) => tab.enabled).map((tab) => tab.id)
    const labels = WORKSPACE_TABS.map((tab) => tab.label)
    expect(enabled).toEqual(['overview', 'members', 'activity'])
    expect(labels).not.toContain('Notes')
    expect(labels).not.toContain('Timeline')
  })
})

describe('canComposeNotes', () => {
  it('allows composing only when notes loaded successfully', () => {
    expect(canComposeNotes(ok([]))).toBe(true)
    expect(canComposeNotes(fail([]))).toBe(false)
  })
})

describe('getActivityTabViewState', () => {
  it('returns true empty state when both sources succeed and timeline is empty', () => {
    expect(getActivityTabViewState(ok([]), ok([]), true, 0)).toEqual({ kind: 'empty' })
  })

  it('returns timeline state when complete with items', () => {
    expect(getActivityTabViewState(ok([]), ok([]), true, 2)).toEqual({ kind: 'timeline' })
  })

  it('returns load_error for notes failure and does not use empty state', () => {
    const state = getActivityTabViewState(fail([]), ok([]), false, 0)
    expect(state.kind).toBe('load_error')
    if (state.kind !== 'load_error') throw new Error('expected load_error')
    expect(state.notesFailed).toBe(true)
    expect(state.activitiesFailed).toBe(false)
    expect(state.message).toContain('notes')
  })

  it('returns load_error for activities failure', () => {
    const state = getActivityTabViewState(ok([]), fail([]), false, 0)
    expect(state.kind).toBe('load_error')
    if (state.kind !== 'load_error') throw new Error('expected load_error')
    expect(state.activitiesFailed).toBe(true)
    expect(state.message).toContain('activity records')
  })

  it('returns load_error for partial failure even if one collection has values', () => {
    const state = getActivityTabViewState(
      ok([{ id: 'n1' }]),
      fail([]),
      false,
      0,
    )
    expect(state.kind).toBe('load_error')
  })
})
