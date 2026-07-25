import { describe, expect, it } from 'vitest'
import { isStaleOpportunity, STALE_THRESHOLD_DAYS } from './staleOpportunity'
import type { DashboardOpportunityItem } from './types'

function opp(
  overrides: Partial<DashboardOpportunityItem> = {},
): DashboardOpportunityItem {
  return {
    id: 'opp-1',
    title: 'Life gap',
    status: 'open',
    household_id: 'hh-1',
    household_name: 'Dry HH',
    stage_id: 'stage-1',
    stage_name: 'Fact Finder',
    pipeline_name: 'Life',
    next_action: null,
    next_action_due_at: null,
    stage_entered_at: '2026-07-01T12:00:00.000Z',
    updated_at: '2026-07-20T12:00:00.000Z',
    created_at: '2026-07-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('isStaleOpportunity', () => {
  const today = '2026-07-25'

  it('uses the configured threshold days', () => {
    expect(STALE_THRESHOLD_DAYS).toBe(14)
  })

  it('marks open opportunities past threshold with no next action as stale', () => {
    expect(isStaleOpportunity(opp(), { today })).toBe(true)
  })

  it('excludes won and lost', () => {
    expect(isStaleOpportunity(opp({ status: 'won' }), { today })).toBe(false)
    expect(isStaleOpportunity(opp({ status: 'lost' }), { today })).toBe(false)
  })

  it('includes on_hold', () => {
    expect(isStaleOpportunity(opp({ status: 'on_hold' }), { today })).toBe(true)
  })

  it('is not stale when still inside the threshold', () => {
    expect(
      isStaleOpportunity(opp({ stage_entered_at: '2026-07-20T12:00:00.000Z' }), { today }),
    ).toBe(false)
  })

  it('is not stale when next action is due today or later', () => {
    expect(
      isStaleOpportunity(opp({ next_action_due_at: '2026-07-25' }), { today }),
    ).toBe(false)
    expect(
      isStaleOpportunity(opp({ next_action_due_at: '2026-07-30' }), { today }),
    ).toBe(false)
  })

  it('is stale when next action is overdue past threshold', () => {
    expect(
      isStaleOpportunity(opp({ next_action_due_at: '2026-07-10' }), { today }),
    ).toBe(true)
  })

  it('falls back to updated_at when stage_entered_at is null', () => {
    expect(
      isStaleOpportunity(
        opp({ stage_entered_at: null, updated_at: '2026-07-01T12:00:00.000Z' }),
        { today },
      ),
    ).toBe(true)
  })

  it('treats 13 days as not stale and 14+ days as stale', () => {
    // today 2026-07-25 → 13 days earlier is 2026-07-12; 14 is 2026-07-11; 15 is 2026-07-10
    expect(
      isStaleOpportunity(opp({ stage_entered_at: '2026-07-12T12:00:00.000Z' }), { today }),
    ).toBe(false)
    expect(
      isStaleOpportunity(opp({ stage_entered_at: '2026-07-11T12:00:00.000Z' }), { today }),
    ).toBe(true)
    expect(
      isStaleOpportunity(opp({ stage_entered_at: '2026-07-10T12:00:00.000Z' }), { today }),
    ).toBe(true)
  })

  it('does not treat future next actions as stale even when stage is old', () => {
    expect(
      isStaleOpportunity(
        opp({
          stage_entered_at: '2026-06-01T12:00:00.000Z',
          next_action_due_at: '2026-08-01',
        }),
        { today },
      ),
    ).toBe(false)
  })

  it('recent unrelated updated_at fallback can clear stale when stage_entered_at is null', () => {
    expect(
      isStaleOpportunity(
        opp({
          stage_entered_at: null,
          updated_at: '2026-07-24T18:00:00.000Z',
        }),
        { today },
      ),
    ).toBe(false)
  })

  it('handles malformed timestamps as not stale', () => {
    expect(
      isStaleOpportunity(
        opp({ stage_entered_at: 'not-a-date', updated_at: 'also-bad' }),
        { today },
      ),
    ).toBe(false)
  })
})
