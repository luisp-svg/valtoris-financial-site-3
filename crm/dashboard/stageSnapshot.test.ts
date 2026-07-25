import { describe, expect, it } from 'vitest'
import { buildStageSnapshot, countOpportunityStatuses } from './stageSnapshot'
import type { DashboardOpportunityItem } from './types'

function opp(
  overrides: Partial<DashboardOpportunityItem> = {},
): DashboardOpportunityItem {
  return {
    id: 'opp-1',
    title: 'Opp',
    status: 'open',
    household_id: 'hh-1',
    household_name: 'HH',
    stage_id: 's1',
    stage_name: 'Fact Finder',
    pipeline_name: 'Life',
    next_action: null,
    next_action_due_at: null,
    stage_entered_at: null,
    updated_at: '2026-07-25T00:00:00.000Z',
    created_at: '2026-07-25T00:00:00.000Z',
    ...overrides,
  }
}

describe('countOpportunityStatuses', () => {
  it('counts open-like, won, and lost', () => {
    expect(
      countOpportunityStatuses([
        { status: 'open' },
        { status: 'on_hold' },
        { status: 'won' },
        { status: 'lost' },
        { status: 'lost' },
      ]),
    ).toEqual({ open: 2, won: 1, lost: 2 })
  })
})

describe('buildStageSnapshot', () => {
  it('groups only open-like opportunities by stage and sorts by count', () => {
    const rows = buildStageSnapshot([
      opp({ id: '1', stage_id: 'a', stage_name: 'Fact Finder' }),
      opp({ id: '2', stage_id: 'a', stage_name: 'Fact Finder' }),
      opp({ id: '3', stage_id: 'b', stage_name: 'Quoted' }),
      opp({ id: '4', status: 'won', stage_id: 'c', stage_name: 'Placed' }),
    ])
    expect(rows).toEqual([
      {
        stageId: 'a',
        stageName: 'Fact Finder',
        pipelineName: 'Life',
        count: 2,
      },
      {
        stageId: 'b',
        stageName: 'Quoted',
        pipelineName: 'Life',
        count: 1,
      },
    ])
  })

  it('returns empty for no open opportunities', () => {
    expect(buildStageSnapshot([opp({ status: 'won' })])).toEqual([])
  })
})
