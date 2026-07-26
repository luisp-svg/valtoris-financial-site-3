import { describe, expect, it } from 'vitest'
import {
  buildOwnerAlerts,
  buildStageHealth,
  buildWorkloadRows,
  countOpenLike,
  countStaleOpportunities,
  countTasksWithoutAssignee,
  countWithoutNextAction,
} from './aggregateOwnerOps'
import type { AgencySnapshot, LightAdvisor, LightHousehold, LightOpportunity, LightTask } from './types'

const today = '2026-07-25'

function opp(partial: Partial<LightOpportunity> & Pick<LightOpportunity, 'id' | 'stage_id'>): LightOpportunity {
  return {
    title: 'Opp',
    status: 'open',
    household_id: 'hh-1',
    assigned_advisor_id: 'adv-1',
    next_action: 'Call',
    next_action_due_at: '2026-07-28',
    stage_entered_at: '2026-07-20T12:00:00.000Z',
    updated_at: '2026-07-20T12:00:00.000Z',
    stage_name: 'Discovery',
    pipeline_name: 'Default',
    ...partial,
  }
}

describe('aggregateOwnerOps', () => {
  it('counts open-like and no-next-action opportunities', () => {
    const rows = [
      opp({ id: '1', stage_id: 's1' }),
      opp({
        id: '2',
        stage_id: 's1',
        next_action: null,
        next_action_due_at: null,
      }),
      opp({ id: '3', stage_id: 's2', status: 'won' }),
    ]
    expect(countOpenLike(rows)).toBe(2)
    expect(countWithoutNextAction(rows)).toBe(1)
  })

  it('counts stale opportunities using the 9A rule over the full set', () => {
    const rows = [
      opp({
        id: 'stale',
        stage_id: 's1',
        stage_entered_at: '2026-07-01T12:00:00.000Z',
        next_action_due_at: '2026-07-10',
      }),
      opp({
        id: 'fresh',
        stage_id: 's1',
        stage_entered_at: '2026-07-20T12:00:00.000Z',
        next_action_due_at: '2026-07-28',
      }),
    ]
    expect(countStaleOpportunities(rows, today)).toBe(1)
  })

  it('builds stage health sorted by count without sampling', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      opp({ id: `a${i}`, stage_id: 's-a', stage_name: 'A' }),
    ).concat(
      Array.from({ length: 2 }, (_, i) =>
        opp({ id: `b${i}`, stage_id: 's-b', stage_name: 'B' }),
      ),
    )
    const health = buildStageHealth(rows)
    expect(health[0]).toMatchObject({ stageId: 's-a', count: 5 })
    expect(health[1]).toMatchObject({ stageId: 's-b', count: 2 })
  })

  it('builds workload sorted by needs attention and appends Unassigned', () => {
    const advisors: LightAdvisor[] = [
      { id: 'adv-1', display_name: 'Ada', is_active: true },
      { id: 'adv-2', display_name: 'Bea', is_active: true },
    ]
    const households: LightHousehold[] = [
      { id: 'hh-1', assigned_advisor_id: 'adv-1', display_name: 'One' },
      { id: 'hh-2', assigned_advisor_id: null, display_name: 'Unassigned HH' },
      { id: 'hh-3', assigned_advisor_id: 'adv-2', display_name: 'Two' },
    ]
    const opportunities: LightOpportunity[] = [
      opp({
        id: 'o1',
        stage_id: 's1',
        assigned_advisor_id: 'adv-1',
        stage_entered_at: '2026-07-01T12:00:00.000Z',
        next_action_due_at: '2026-07-10',
      }),
      opp({
        id: 'o2',
        stage_id: 's1',
        assigned_advisor_id: null,
        household_id: 'hh-2',
      }),
    ]
    const tasks: LightTask[] = [
      {
        id: 't1',
        title: 'Due',
        due_date: today,
        status: 'open',
        household_id: 'hh-3',
        assigned_user_id: 'user-2',
        opportunity_id: null,
      },
      {
        id: 't2',
        title: 'Overdue unassigned task',
        due_date: '2026-07-20',
        status: 'open',
        household_id: 'hh-2',
        assigned_user_id: null,
        opportunity_id: null,
      },
    ]

    const rows = buildWorkloadRows({ advisors, households, opportunities, tasks, today })
    const unassigned = rows[rows.length - 1]
    expect(unassigned.displayName).toBe('Unassigned')
    expect(unassigned.households).toBe(1)
    expect(unassigned.openOpportunities).toBe(1)
    expect(rows[0].needsAttention).toBeGreaterThanOrEqual(rows[1].needsAttention)
    expect(rows.some((row) => row.advisorId === 'adv-1')).toBe(true)
    expect(countTasksWithoutAssignee(tasks)).toBe(1)
  })

  it('builds operational alerts ordered by severity', () => {
    const snapshot: Pick<
      AgencySnapshot,
      | 'staleOpportunities'
      | 'opportunitiesWithoutNextAction'
      | 'overdueTasks'
      | 'unassignedHouseholds'
      | 'unassignedOpportunities'
    > = {
      staleOpportunities: 2,
      opportunitiesWithoutNextAction: 1,
      overdueTasks: 3,
      unassignedHouseholds: 1,
      unassignedOpportunities: 4,
    }
    const alerts = buildOwnerAlerts({ snapshot, tasksWithoutAssignee: 2 })
    expect(alerts[0].kind).toBe('overdue_task')
    expect(alerts.map((a) => a.kind)).toContain('stale_opportunity')
    expect(alerts.map((a) => a.kind)).toContain('task_without_assignee')
    expect(alerts.every((a) => a.href.length > 0)).toBe(true)
  })
})
