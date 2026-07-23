import { describe, expect, it } from 'vitest'
import {
  activityTimelineId,
  buildHouseholdTimeline,
  isNoteEdited,
  normalizeActivityToTimelineItem,
  normalizeNoteToTimelineItem,
  noteTimelineId,
} from './timeline'
import type { HouseholdActivityRecord, HouseholdNote } from './types'

function makeNote(overrides: Partial<HouseholdNote> = {}): HouseholdNote {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    household_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    opportunity_id: null,
    author_user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    author_display_name: 'Ada Advisor',
    body: 'Hello household',
    visibility: 'internal',
    created_at: '2026-07-01T10:00:00.000Z',
    updated_at: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeActivity(overrides: Partial<HouseholdActivityRecord> = {}): HouseholdActivityRecord {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    household_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    actor_user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    actor_display_name: 'Ada Advisor',
    activity_type: 'assignment_changed',
    title: 'Household assigned',
    body: 'Assigned to advisor',
    metadata: { reason: 'manual' },
    occurred_at: '2026-07-02T12:00:00.000Z',
    created_at: '2026-07-02T12:00:00.000Z',
    ...overrides,
  }
}

describe('noteTimelineId / activityTimelineId', () => {
  it('builds stable source ids', () => {
    expect(noteTimelineId('abc')).toBe('note:abc')
    expect(activityTimelineId('xyz')).toBe('activity:xyz')
  })
})

describe('isNoteEdited', () => {
  it('is false when timestamps match', () => {
    expect(isNoteEdited('2026-07-01T10:00:00.000Z', '2026-07-01T10:00:00.000Z')).toBe(false)
  })

  it('is true when updated_at is later', () => {
    expect(isNoteEdited('2026-07-01T10:00:00.000Z', '2026-07-01T11:00:00.000Z')).toBe(true)
  })
})

describe('normalizeNoteToTimelineItem', () => {
  it('maps note fields and marks editable/deletable', () => {
    const item = normalizeNoteToTimelineItem(makeNote())
    expect(item.id).toBe('note:11111111-1111-1111-1111-111111111111')
    expect(item.householdId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(item.activityType).toBe('note')
    expect(item.displayVariant).toBe('note')
    expect(item.title).toBe('Note')
    expect(item.body).toBe('Hello household')
    expect(item.occurredAt).toBe('2026-07-01T10:00:00.000Z')
    expect(item.updatedAt).toBe('2026-07-01T10:00:00.000Z')
    expect(item.sourceEntityType).toBe('note')
    expect(item.sourceEntityId).toBe('11111111-1111-1111-1111-111111111111')
    expect(item.isEditable).toBe(true)
    expect(item.isDeletable).toBe(true)
    expect(item.isEdited).toBe(false)
  })

  it('sets isEdited when updated_at is later than created_at', () => {
    const item = normalizeNoteToTimelineItem(
      makeNote({ updated_at: '2026-07-01T12:30:00.000Z' }),
    )
    expect(item.isEdited).toBe(true)
  })

  it('maps note.created_at to occurredAt', () => {
    const item = normalizeNoteToTimelineItem(
      makeNote({ created_at: '2026-06-15T08:00:00.000Z' }),
    )
    expect(item.occurredAt).toBe('2026-06-15T08:00:00.000Z')
  })
})

describe('normalizeActivityToTimelineItem', () => {
  it('maps activity fields and marks not editable/deletable', () => {
    const item = normalizeActivityToTimelineItem(makeActivity())
    expect(item.id).toBe('activity:22222222-2222-2222-2222-222222222222')
    expect(item.activityType).toBe('assignment_changed')
    expect(item.displayVariant).toBe('assignment')
    expect(item.occurredAt).toBe('2026-07-02T12:00:00.000Z')
    expect(item.updatedAt).toBeNull()
    expect(item.sourceEntityType).toBe('activity')
    expect(item.isEditable).toBe(false)
    expect(item.isDeletable).toBe(false)
    expect(item.isEdited).toBe(false)
    expect(item.metadata).toEqual({ reason: 'manual' })
  })

  it('maps activity.occurred_at to occurredAt', () => {
    const item = normalizeActivityToTimelineItem(
      makeActivity({ occurred_at: '2026-05-01T00:00:00.000Z' }),
    )
    expect(item.occurredAt).toBe('2026-05-01T00:00:00.000Z')
  })

  it('falls unknown activity types back to other/system', () => {
    const item = normalizeActivityToTimelineItem(
      makeActivity({ activity_type: 'email_sent', title: 'Email' }),
    )
    expect(item.activityType).toBe('other')
    expect(item.displayVariant).toBe('system')
  })

  it('maps stage and recommendation variants', () => {
    expect(
      normalizeActivityToTimelineItem(makeActivity({ activity_type: 'stage_changed' }))
        .displayVariant,
    ).toBe('stage')
    expect(
      normalizeActivityToTimelineItem(
        makeActivity({ activity_type: 'recommendation_converted' }),
      ).displayVariant,
    ).toBe('recommendation')
    expect(
      normalizeActivityToTimelineItem(makeActivity({ activity_type: 'task_created' }))
        .displayVariant,
    ).toBe('task')
  })
})

describe('buildHouseholdTimeline', () => {
  it('merges notes and activities sorted by occurredAt descending', () => {
    const olderNote = makeNote({
      id: 'note-old',
      created_at: '2026-07-01T10:00:00.000Z',
      updated_at: '2026-07-01T10:00:00.000Z',
    })
    const newerActivity = makeActivity({
      id: 'act-new',
      occurred_at: '2026-07-03T10:00:00.000Z',
    })
    const midNote = makeNote({
      id: 'note-mid',
      created_at: '2026-07-02T10:00:00.000Z',
      updated_at: '2026-07-02T10:00:00.000Z',
    })

    const timeline = buildHouseholdTimeline([olderNote, midNote], [newerActivity])
    expect(timeline.map((item) => item.sourceEntityId)).toEqual([
      'act-new',
      'note-mid',
      'note-old',
    ])
  })
})
