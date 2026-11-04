import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchIntakeQueue, fetchIntakeQueueSafe } from './intakeApi'
import { buildIntakeCounts, matchesIntakeFilter } from './intakeFormatters'

function fixture(count: number, failAt?: number, repeatPage = false) {
  const leads = Array.from({ length: count }, (_, index) => ({
    id: `lead-${String(index).padStart(5, '0')}`,
    household_id: `household-${index}`,
    lead_type: 'Family Report Card',
    submitted_at: '2026-10-01T12:00:00Z',
    status: 'unassigned',
    ingest_match_status: index === count - 1 ? 'possible_match' : 'new_prospect',
    duplicate_review_status: index === count - 1 ? 'pending' : 'none',
    sheets_sync_status: 'skipped',
    raw_payload: {},
    deleted_at: null,
  }))
  const ranges: number[][] = []
  const orders: unknown[][] = []
  const from = vi.fn((table: string) => {
    let start = 0
    let end = 99
    const query: Record<string, unknown> = {}
    const chain = new Proxy(query, {
      get(_target, key) {
        if (key === 'then') return (resolve: (value: unknown) => unknown) => Promise.resolve(
          table === 'leads'
            ? start === failAt ? { data: null, error: { message: 'Synthetic later-page failure' } }
              : { data: leads.slice(repeatPage ? 0 : start, repeatPage ? end - start + 1 : end + 1), error: null }
            : { data: [], error: null },
        ).then(resolve)
        if (key === 'range') return (first: number, last: number) => {
          start = first; end = last
          if (table === 'leads') ranges.push([first, last])
          return chain
        }
        if (key === 'order') return (...args: unknown[]) => { if (table === 'leads') orders.push(args); return chain }
        return () => chain
      },
    })
    return chain
  })
  return { client: { from } as unknown as SupabaseClient, ranges, orders, from }
}

describe('complete incoming lead queue', () => {
  it('includes work beyond 150 and 1,000 before calculating review counts and filters', async () => {
    const f = fixture(1201)
    const items = await fetchIntakeQueue(f.client)
    expect(items).toHaveLength(1201)
    expect(new Set(items.map(item => item.leadId)).size).toBe(1201)
    expect(f.ranges).toHaveLength(13)
    expect(f.ranges[f.ranges.length - 1]).toEqual([1200, 1299])
    expect(f.orders).toContainEqual(['id', { ascending: true }])
    expect(buildIntakeCounts(items, null).possible_duplicates).toBe(1)
    expect(items.filter(item => matchesIntakeFilter(item, 'possible_duplicates', null)).map(item => item.leadId)).toEqual(['lead-01200'])
  })
  it('respects an explicit caller limit without reinstating a default queue cap', async () => {
    const f = fixture(1201)
    expect(await fetchIntakeQueue(f.client, { limit: 151 })).toHaveLength(151)
    expect(f.ranges).toEqual([[0, 99], [100, 150]])
  })
  it('does not return a successful partial queue when a later page fails', async () => {
    const f = fixture(1201, 1200)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { expect(await fetchIntakeQueueSafe(f.client)).toEqual({ ok: false, error: 'Unable to load incoming leads. Please try again.' }) }
    finally { spy.mockRestore() }
  })
  it('rejects repeated page boundaries instead of looping or double-counting', async () => {
    const f = fixture(100, undefined, true)
    await expect(fetchIntakeQueue(f.client)).rejects.toThrow('changed while loading')
    expect(f.ranges).toHaveLength(2)
  })
  it('handles empty queues and invalid limits before querying', async () => {
    const f = fixture(0)
    expect(await fetchIntakeQueue(f.client)).toEqual([])
    const empty = fixture(1)
    expect(await fetchIntakeQueue(empty.client, { limit: 0 })).toEqual([])
    for (const limit of [-1, 1.5, Infinity, NaN]) await expect(fetchIntakeQueue(empty.client, { limit })).rejects.toThrow('Invalid intake queue limit')
    expect(empty.from).not.toHaveBeenCalled()
  })
})
