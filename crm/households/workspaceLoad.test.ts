import { describe, expect, it } from 'vitest'
import { buildWorkspaceTimeline, settleWorkspaceLoad } from './householdsApi'
import type { HouseholdActivityRecord, HouseholdNote } from './types'

function makeNote(id: string, createdAt: string): HouseholdNote {
  return {
    id,
    household_id: 'hh-1',
    opportunity_id: null,
    author_user_id: 'user-1',
    author_display_name: 'Ada',
    body: `Note ${id}`,
    visibility: 'internal',
    created_at: createdAt,
    updated_at: createdAt,
  }
}

function makeActivity(id: string, occurredAt: string): HouseholdActivityRecord {
  return {
    id,
    household_id: 'hh-1',
    actor_user_id: 'user-1',
    actor_display_name: 'Ada',
    activity_type: 'stage_changed',
    title: `Activity ${id}`,
    body: null,
    metadata: {},
    occurred_at: occurredAt,
    created_at: occurredAt,
  }
}

describe('settleWorkspaceLoad', () => {
  it('marks successful loads as ok with the resolved value', async () => {
    const result = await settleWorkspaceLoad(Promise.resolve(['a', 'b']), [], 'notes')
    expect(result).toEqual({ ok: true, value: ['a', 'b'] })
  })

  it('marks empty successful loads as ok with an empty value', async () => {
    const result = await settleWorkspaceLoad(Promise.resolve([] as string[]), ['fallback'], 'notes')
    expect(result).toEqual({ ok: true, value: [] })
    expect(result.ok).toBe(true)
  })

  it('captures formatted errors and preserves the fallback value', async () => {
    const result = await settleWorkspaceLoad(
      Promise.reject({ message: 'boom', code: 'PGRST301' }),
      [] as string[],
      'notes',
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.value).toEqual([])
    expect(result.error).toContain('notes failed')
    expect(result.error).toContain('message=boom')
    expect(result.error).toContain('code=PGRST301')
  })
})

describe('buildWorkspaceTimeline', () => {
  const notes = [makeNote('n1', '2026-07-01T10:00:00.000Z')]
  const activities = [makeActivity('a1', '2026-07-02T10:00:00.000Z')]

  it('builds timeline when both sources succeed (including empty)', () => {
    const built = buildWorkspaceTimeline(
      { ok: true, value: notes },
      { ok: true, value: activities },
    )
    expect(built.timelineComplete).toBe(true)
    expect(built.timeline.map((item) => item.sourceEntityId)).toEqual(['a1', 'n1'])
  })

  it('builds an empty timeline for successful empty sources', () => {
    const built = buildWorkspaceTimeline({ ok: true, value: [] }, { ok: true, value: [] })
    expect(built.timelineComplete).toBe(true)
    expect(built.timeline).toEqual([])
  })

  it('suppresses timeline when notes fail, preserving that failure is visible via ok flags', () => {
    const notesResult = {
      ok: false as const,
      value: [] as HouseholdNote[],
      error: 'notes failed | message=boom',
    }
    const activitiesResult = { ok: true as const, value: activities }
    const built = buildWorkspaceTimeline(notesResult, activitiesResult)
    expect(built.timelineComplete).toBe(false)
    expect(built.timeline).toEqual([])
    expect(activitiesResult.value).toHaveLength(1)
    expect(notesResult.ok).toBe(false)
  })

  it('suppresses timeline when activities fail', () => {
    const built = buildWorkspaceTimeline(
      { ok: true, value: notes },
      {
        ok: false,
        value: [],
        error: 'activity_records failed | message=boom',
      },
    )
    expect(built.timelineComplete).toBe(false)
    expect(built.timeline).toEqual([])
  })

  it('suppresses timeline on partial load (one success, one failure)', () => {
    const built = buildWorkspaceTimeline(
      { ok: true, value: notes },
      { ok: false, value: [], error: 'activity_records failed' },
    )
    expect(built.timelineComplete).toBe(false)
    expect(built.timeline).toEqual([])
  })
})
