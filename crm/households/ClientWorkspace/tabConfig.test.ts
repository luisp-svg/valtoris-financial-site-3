import { describe, expect, it } from 'vitest'
import {
  CLIENT_WORKSPACE_QUICK_ACTIONS,
  CLIENT_WORKSPACE_TAB_PARAM,
  CLIENT_WORKSPACE_TABS,
  DEFAULT_CLIENT_WORKSPACE_TAB,
  isClientWorkspaceTabSlug,
  tabIdFromSearchParams,
  tabSlugForId,
  withWorkspaceTabParam,
} from './tabConfig'

describe('CLIENT_WORKSPACE_TABS', () => {
  it('exposes the full Client Workspace tab set in order', () => {
    expect(CLIENT_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'overview',
      'financial_progress',
      'cases',
      'policies',
      'timeline',
      'tasks',
      'notes',
      'documents',
      'reviews',
      'household',
    ])
    expect(CLIENT_WORKSPACE_TABS.every((tab) => tab.enabled)).toBe(true)
  })
})

describe('CLIENT_WORKSPACE_QUICK_ACTIONS', () => {
  it('lists wired vs future-disabled quick actions', () => {
    expect(CLIENT_WORKSPACE_QUICK_ACTIONS.map((action) => action.id)).toEqual([
      'add_task',
      'add_note',
      'create_opportunity',
      'create_case',
      'upload_document',
      'schedule_review',
    ])
    expect(
      CLIENT_WORKSPACE_QUICK_ACTIONS.filter((action) => action.availability === 'enabled').map(
        (action) => action.id,
      ),
    ).toEqual(['add_task', 'add_note', 'create_opportunity', 'upload_document'])
    expect(
      CLIENT_WORKSPACE_QUICK_ACTIONS.filter(
        (action) => action.availability === 'disabled_future',
      ).map((action) => action.id),
    ).toEqual(['create_case', 'schedule_review'])
  })
})

describe('tabIdFromSearchParams', () => {
  it('defaults to overview when tab is missing', () => {
    expect(tabIdFromSearchParams(new URLSearchParams())).toBe(DEFAULT_CLIENT_WORKSPACE_TAB)
    expect(tabIdFromSearchParams(new URLSearchParams('foo=bar'))).toBe('overview')
  })

  it('resolves valid tab slugs including financial-progress', () => {
    expect(tabIdFromSearchParams(new URLSearchParams('tab=overview'))).toBe('overview')
    expect(tabIdFromSearchParams(new URLSearchParams('tab=financial-progress'))).toBe(
      'financial_progress',
    )
    expect(tabIdFromSearchParams(new URLSearchParams('tab=household'))).toBe('household')
    expect(tabIdFromSearchParams(new URLSearchParams('tab=notes'))).toBe('notes')
  })

  it('defaults safely to overview for invalid tab values', () => {
    expect(tabIdFromSearchParams(new URLSearchParams('tab=members'))).toBe('overview')
    expect(tabIdFromSearchParams(new URLSearchParams('tab=financial_progress'))).toBe('overview')
    expect(tabIdFromSearchParams(new URLSearchParams('tab='))).toBe('overview')
    expect(tabIdFromSearchParams(new URLSearchParams('tab=nope'))).toBe('overview')
  })
})

describe('withWorkspaceTabParam', () => {
  it('sets the tab slug and preserves unrelated query parameters', () => {
    const current = new URLSearchParams('foo=1&tab=tasks')
    const next = withWorkspaceTabParam(current, 'financial_progress')
    expect(next.get(CLIENT_WORKSPACE_TAB_PARAM)).toBe('financial-progress')
    expect(next.get('foo')).toBe('1')
    expect(tabSlugForId('financial_progress')).toBe('financial-progress')
    expect(isClientWorkspaceTabSlug('financial-progress')).toBe(true)
    expect(isClientWorkspaceTabSlug('financial_progress')).toBe(false)
  })

  it('supports tab selection write for every enabled tab', () => {
    for (const tab of CLIENT_WORKSPACE_TABS) {
      const params = withWorkspaceTabParam(new URLSearchParams('keep=yes'), tab.id)
      expect(params.get('keep')).toBe('yes')
      expect(tabIdFromSearchParams(params)).toBe(tab.id)
    }
  })
})
