import { describe, expect, it } from 'vitest'
import { normalizeActivityToTimelineItem, normalizeNoteToTimelineItem } from './timeline'
import type { HouseholdActivityRecord, HouseholdNote } from './types'

const note: HouseholdNote = {
  id: 'note-1',
  household_id: 'hh-1',
  opportunity_id: null,
  author_user_id: 'user-1',
  author_display_name: 'Ada',
  body: 'Hello',
  visibility: 'internal',
  created_at: '2026-07-01T10:00:00.000Z',
  updated_at: '2026-07-01T11:00:00.000Z',
}

const activity: HouseholdActivityRecord = {
  id: 'act-1',
  household_id: 'hh-1',
  actor_user_id: 'user-1',
  actor_display_name: 'Ada',
  activity_type: 'assignment_changed',
  title: 'Assigned',
  body: null,
  metadata: {},
  occurred_at: '2026-07-02T10:00:00.000Z',
  created_at: '2026-07-02T10:00:00.000Z',
}

describe('timeline item note controls', () => {
  it('marks notes editable/deletable and edited when updated later', () => {
    const item = normalizeNoteToTimelineItem(note)
    expect(item.isEditable).toBe(true)
    expect(item.isDeletable).toBe(true)
    expect(item.isEdited).toBe(true)
    expect(item.displayVariant).toBe('note')
  })

  it('marks activities immutable with no note controls', () => {
    const item = normalizeActivityToTimelineItem(activity)
    expect(item.isEditable).toBe(false)
    expect(item.isDeletable).toBe(false)
    expect(item.isEdited).toBe(false)
    expect(item.displayVariant).toBe('assignment')
  })
})
