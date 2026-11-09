import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchVisibleTasks } from './tasksApi'
import { classifyTaskQueue } from './taskQueues'

function clientFor(rows: Record<string, unknown>[], failAt?: number) {
  const calls = { range: vi.fn(), order: vi.fn(), eq: vi.fn(), lt: vi.fn(), in: vi.fn(), limit: vi.fn() }
  const client = { from: () => {
    let start = 0, end = 999
    const query = {
      select: () => query, is: () => query,
      in: (...args: unknown[]) => { calls.in(...args); return query },
      eq: (...args: unknown[]) => { calls.eq(...args); return query },
      lt: (...args: unknown[]) => { calls.lt(...args); return query },
      order: (...args: unknown[]) => { calls.order(...args); return query },
      range: (a: number, b: number) => { start = a; end = b; calls.range(a,b); return query },
      limit: (n: number) => { end = n-1; calls.limit(n); return query },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(start === failAt
        ? {data:null,error:{message:'Later page unavailable'}}
        : {data:rows.slice(start, Math.min(end+1,start+1000)),error:null}).then(resolve),
    }
    return query
  }} as unknown as SupabaseClient
  return {client,calls}
}

describe('visible task pagination', () => {
  it('reaches queue members beyond the first API response cap', async () => {
    const rows = [...Array.from({length:1000},(_,i)=>({id:String(i),workflow_type:'resolve_possible_duplicate'})),
      {id:'sales-last',workflow_type:'review_initial_diagnostic',metadata:{contact_permission:true}},
      {id:'operations-last',source_type:'manual'}]
    const {client,calls}=clientFor(rows)
    const result=await fetchVisibleTasks(client,{householdId:'h',opportunityId:'o',assignedUserId:'a',dueBefore:'2026-11-08'})
    expect(result).toHaveLength(1002)
    expect(result.filter(t=>classifyTaskQueue(t)==='sales').map(t=>t.id)).toEqual(['sales-last'])
    expect(result.filter(t=>classifyTaskQueue(t)==='operations').map(t=>t.id)).toEqual(['operations-last'])
    expect(calls.range.mock.calls).toEqual([[0,199],[200,399],[400,599],[600,799],[800,999],[1000,1199]])
    expect(calls.order).toHaveBeenCalledWith('id',{ascending:true})
    expect(calls.eq.mock.calls.filter(([column])=>column==='household_id')).toHaveLength(6)
    expect(calls.lt).toHaveBeenCalledTimes(6)
    expect(calls.in).toHaveBeenCalledWith('status',['open','in_progress'])
  })
  it('rejects a later-page failure instead of returning partial queue totals', async () => {
    const {client}=clientFor(Array.from({length:250},(_,i)=>({id:String(i)})),200)
    await expect(fetchVisibleTasks(client)).rejects.toMatchObject({message:'Later page unavailable'})
  })
  it('preserves bounded dashboard requests', async () => {
    const {client,calls}=clientFor(Array.from({length:25},(_,i)=>({id:String(i)})))
    expect(await fetchVisibleTasks(client,{limit:10})).toHaveLength(10)
    expect(calls.range).not.toHaveBeenCalled()
    expect(calls.limit).toHaveBeenCalledWith(10)
  })
})
