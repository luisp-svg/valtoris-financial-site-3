import { describe, expect, it, vi } from 'vitest'
import { fetchCrmDashboard, fetchOpportunityStatusCounts } from './dashboardApi'

type QueryResult = { data?: unknown; count?: number | null; error?: { message: string } | null }

function createQuery(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  for (const method of [
    'select',
    'is',
    'in',
    'eq',
    'lt',
    'not',
    'or',
    'order',
    'limit',
  ]) {
    builder[method] = vi.fn(chain)
  }
  builder.then = undefined
  // Make awaitable
  Object.assign(builder, {
    then(resolve: (value: QueryResult) => unknown) {
      return Promise.resolve(result).then(resolve)
    },
  })
  return builder
}

describe('fetchOpportunityStatusCounts', () => {
  it('requests exact head counts for open/on_hold, won, and lost', async () => {
    const calls: Array<{ table: string; builder: ReturnType<typeof createQuery> }> = []
    const supabase = {
      from(table: string) {
        const builder = createQuery({ count: table === 'opportunities' ? 2 : 0, error: null })
        calls.push({ table, builder })
        return builder
      },
    }

    const counts = await fetchOpportunityStatusCounts(supabase as never)
    expect(counts).toEqual({ open: 2, won: 2, lost: 2 })
    expect(calls).toHaveLength(3)
    expect(calls.every((call) => call.table === 'opportunities')).toBe(true)
    for (const call of calls) {
      expect(call.builder.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
      expect(call.builder.is).toHaveBeenCalledWith('deleted_at', null)
    }
  })
})

describe('fetchCrmDashboard', () => {
  it('returns independent section failures without aborting the whole dashboard', async () => {
    let opportunitySelects = 0
    const supabase = {
      from(table: string) {
        if (table === 'opportunities') {
          opportunitySelects += 1
          // status count calls use head; open list uses data
          if (opportunitySelects <= 3) {
            return createQuery({ count: 1, error: null })
          }
          return createQuery({
            data: null,
            error: { message: 'opp list failed' },
          })
        }
        if (table === 'tasks') {
          return createQuery({ data: [], error: null })
        }
        if (table === 'activities') {
          return createQuery({
            data: null,
            error: { message: 'activities failed' },
          })
        }
        if (table === 'households') {
          return createQuery({
            data: [
              {
                id: 'hh-1',
                display_name: 'Dry HH A',
                created_at: '2026-07-17T16:13:11.880299+00:00',
                status: 'prospect',
              },
            ],
            error: null,
          })
        }
        return createQuery({ data: [], error: null })
      },
    }

    const dashboard = await fetchCrmDashboard(supabase as never, { today: '2026-07-25' })

    expect(dashboard.statusCounts.ok).toBe(true)
    expect(dashboard.statusCounts.value).toEqual({ open: 1, won: 1, lost: 1 })
    expect(dashboard.openOpportunities.ok).toBe(false)
    expect(dashboard.stageSnapshot.ok).toBe(false)
    expect(dashboard.tasksDueToday.ok).toBe(true)
    expect(dashboard.overdueTasks.ok).toBe(true)
    expect(dashboard.recentActivities.ok).toBe(false)
    expect(dashboard.recentHouseholds.ok).toBe(true)
    expect(dashboard.recentHouseholds.value[0]?.display_name).toBe('Dry HH A')
  })

  it('soft-fails status counts without blocking recent households', async () => {
    const supabase = {
      from(table: string) {
        if (table === 'opportunities') {
          return createQuery({ count: null, error: { message: 'count denied' } })
        }
        if (table === 'tasks') return createQuery({ data: [], error: null })
        if (table === 'activities') return createQuery({ data: [], error: null })
        if (table === 'households') {
          return createQuery({
            data: [{ id: 'hh-2', display_name: 'HH B', created_at: '2026-07-17T00:00:00Z', status: 'client' }],
            error: null,
          })
        }
        return createQuery({ data: [], error: null })
      },
    }

    const dashboard = await fetchCrmDashboard(supabase as never, { today: '2026-07-25' })
    expect(dashboard.statusCounts.ok).toBe(false)
    expect(dashboard.recentHouseholds.ok).toBe(true)
    expect(dashboard.recentHouseholds.value).toHaveLength(1)
  })
})
