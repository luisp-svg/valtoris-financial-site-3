import { describe, expect, it } from 'vitest'
import { buildNeedsAttentionItems } from './needsAttention'
import type { DashboardOpportunityItem, DashboardTaskItem } from './types'

function task(overrides: Partial<DashboardTaskItem> = {}): DashboardTaskItem {
  return {
    id: 'task-1',
    title: 'Call client',
    due_date: '2026-07-19',
    priority: 'high',
    status: 'open',
    household_id: 'hh-1',
    household_name: 'Dry HH A',
    opportunity_id: null,
    ...overrides,
  }
}

function opportunity(
  overrides: Partial<DashboardOpportunityItem> = {},
): DashboardOpportunityItem {
  return {
    id: 'opp-1',
    title: 'Life gap',
    status: 'open',
    household_id: 'hh-1',
    household_name: 'Dry HH A',
    stage_id: 'stage-1',
    stage_name: 'Fact Finder',
    pipeline_name: 'Life',
    next_action: 'Send illustration',
    next_action_due_at: '2026-07-20',
    stage_entered_at: '2026-07-01T12:00:00.000Z',
    updated_at: '2026-07-20T12:00:00.000Z',
    created_at: '2026-07-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('buildNeedsAttentionItems', () => {
  const today = '2026-07-25'

  it('orders buckets: overdue task, overdue next action, due today, stale', () => {
    const items = buildNeedsAttentionItems({
      today,
      overdueTasks: [task({ id: 't-overdue', due_date: '2026-07-19' })],
      tasksDueToday: [task({ id: 't-today', due_date: '2026-07-25', title: 'Today task' })],
      openOpportunities: [
        opportunity({
          id: 'opp-overdue',
          next_action_due_at: '2026-07-20',
        }),
        opportunity({
          id: 'opp-today',
          next_action_due_at: '2026-07-25',
          next_action: 'Follow up',
          stage_entered_at: '2026-07-20T12:00:00.000Z',
        }),
        opportunity({
          id: 'opp-stale',
          next_action: null,
          next_action_due_at: null,
          stage_entered_at: '2026-07-01T12:00:00.000Z',
        }),
      ],
    })

    expect(items.map((item) => item.kind)).toEqual([
      'overdue_task',
      'overdue_next_action',
      'task_due_today',
      'next_action_due_today',
      'stale_opportunity',
    ])
  })

  it('dedupes the same entity within a bucket', () => {
    const items = buildNeedsAttentionItems({
      today,
      overdueTasks: [task({ id: 't1' }), task({ id: 't1' })],
      tasksDueToday: [],
      openOpportunities: [],
    })
    expect(items).toHaveLength(1)
  })

  it('allows the same household across different entities', () => {
    const items = buildNeedsAttentionItems({
      today,
      overdueTasks: [task({ id: 't1', household_id: 'hh-1' })],
      tasksDueToday: [],
      openOpportunities: [
        opportunity({
          id: 'opp-1',
          household_id: 'hh-1',
          next_action_due_at: '2026-07-10',
        }),
      ],
    })
    expect(items).toHaveLength(2)
    expect(new Set(items.map((item) => item.entityId)).size).toBe(2)
  })

  it('links opportunities to opportunity workspace paths', () => {
    const items = buildNeedsAttentionItems({
      today,
      overdueTasks: [],
      tasksDueToday: [],
      openOpportunities: [
        opportunity({ id: 'opp-99', next_action_due_at: '2026-07-10' }),
      ],
    })
    expect(items[0]?.href).toBe('/crm/opportunities/opp-99')
  })

  it('returns empty when nothing needs attention', () => {
    const items = buildNeedsAttentionItems({
      today,
      overdueTasks: [],
      tasksDueToday: [],
      openOpportunities: [
        opportunity({
          stage_entered_at: '2026-07-24T12:00:00.000Z',
          next_action_due_at: '2026-07-30',
        }),
      ],
    })
    expect(items).toEqual([])
  })
})
