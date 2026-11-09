import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchVisibleTasks } from './tasksApi'
import { classifyTaskQueue } from './taskQueues'

type Row = Record<string, unknown> & {id:string}
const id = (n:number) => String(n).padStart(4,'0')
function clientFor(rows: Row[], options: { failPage?:number; afterFirstPage?:(rows:Row[])=>Row[] } = {}) {
  const calls = { range:vi.fn(), order:vi.fn(), eq:vi.fn(), lt:vi.fn(), in:vi.fn(), limit:vi.fn(), gt:vi.fn() }
  let request = 0
  const client = { from: () => {
    let start=0,end=999,cursor:string|null=null
    const order:Array<[string,{ascending:boolean;nullsFirst?:boolean}]>=[]
    const query = {
      select:()=>query,is:()=>query,
      in:(...args:unknown[])=>{calls.in(...args);return query},
      eq:(...args:unknown[])=>{calls.eq(...args);return query},
      lt:(...args:unknown[])=>{calls.lt(...args);return query},
      gt:(column:string,value:string)=>{cursor=value;calls.gt(column,value);return query},
      order:(column:string,opts:{ascending:boolean;nullsFirst?:boolean})=>{order.push([column,opts]);calls.order(column,opts);return query},
      range:(a:number,b:number)=>{start=a;end=b;calls.range(a,b);return query},
      limit:(n:number)=>{end=start+n-1;calls.limit(n);return query},
      then:(resolve:(value:unknown)=>unknown)=>{
        const current = request>0 && options.afterFirstPage ? options.afterFirstPage(rows) : rows
        const ordered=[...current].sort((a,b)=>{
          for(const [key,opts] of order){
            if(a[key]==null && b[key]!=null)return opts.nullsFirst===false?1:-1
            if(b[key]==null && a[key]!=null)return opts.nullsFirst===false?-1:1
            const comparison=String(a[key]??'').localeCompare(String(b[key]??''))
            if(comparison)return opts.ascending?comparison:-comparison
          }
          return 0
        }).filter(row=>!cursor || row.id>cursor)
        const failed=request++===options.failPage
        return Promise.resolve(failed?{data:null,error:{message:'Later page unavailable'}}:{data:ordered.slice(start,Math.min(end+1,start+1000)),error:null}).then(resolve)
      },
    }
    return query
  }} as unknown as SupabaseClient
  return {client,calls}
}

describe('visible task cursor pagination',()=>{
 it('reaches queue members beyond the API cap and reapplies scope filters on each page',async()=>{
  const rows=[...Array.from({length:1000},(_,i)=>({id:id(i),workflow_type:'resolve_possible_duplicate'})),
    {id:id(1000),workflow_type:'review_initial_diagnostic',metadata:{contact_permission:true}},
    {id:id(1001),source_type:'manual'}]
  const {client,calls}=clientFor(rows)
  const result=await fetchVisibleTasks(client,{householdId:'h',opportunityId:'o',assignedUserId:'a',dueBefore:'2026-11-08'})
  expect(result).toHaveLength(1002)
  expect(result.filter(t=>classifyTaskQueue(t)==='sales').map(t=>t.id)).toEqual([id(1000)])
  expect(result.filter(t=>classifyTaskQueue(t)==='operations').map(t=>t.id)).toEqual([id(1001)])
  expect(calls.range).not.toHaveBeenCalled()
  expect(calls.gt.mock.calls).toEqual([199,399,599,799,999].map(n=>['id',id(n)]))
  expect(calls.eq.mock.calls.filter(([column])=>column==='household_id')).toHaveLength(6)
  expect(calls.eq.mock.calls.filter(([column])=>column==='opportunity_id')).toHaveLength(6)
  expect(calls.eq.mock.calls.filter(([column])=>column==='assigned_user_id')).toHaveLength(6)
  expect(calls.lt).toHaveBeenCalledTimes(6)
  expect(calls.in).toHaveBeenCalledWith('status',['open','in_progress'])
 })
 it.each(['completed','rescheduled'])('does not skip an unchanged sales task when an earlier task is %s',async action=>{
  const rows=Array.from({length:401},(_,i)=>({id:id(i),due_date:'2026-11-08',workflow_type:i===200?'review_initial_diagnostic':'resolve_possible_duplicate',metadata:{contact_permission:true}}))
  const {client}=clientFor(rows,{afterFirstPage:current=>action==='completed'?current.slice(1):current.map((row,i)=>i===0?{...row,due_date:'2026-12-01'}:row)})
  const result=await fetchVisibleTasks(client)
  expect(result.filter(t=>classifyTaskQueue(t)==='sales').map(t=>t.id)).toEqual([id(200)])
  expect(new Set(result.map(t=>t.id)).size).toBe(result.length)
 })
 it('restores due-date, creation-time, and ID display order after cursor loading',async()=>{
  const {client}=clientFor([
    {id:'a',due_date:null,created_at:'2026-11-01'},
    {id:'b',due_date:'2026-11-09',created_at:'2026-11-01'},
    {id:'c',due_date:'2026-11-08',created_at:'2026-11-01'},
    {id:'d',due_date:'2026-11-08',created_at:'2026-11-02'},
    {id:'e',due_date:'2026-11-08',created_at:'2026-11-02'},
  ])
  expect((await fetchVisibleTasks(client)).map(t=>t.id)).toEqual(['d','e','c','b','a'])
 })
 it('rejects a later-page failure instead of returning partial totals',async()=>{
  const {client}=clientFor(Array.from({length:250},(_,i)=>({id:id(i)})),{failPage:1})
  await expect(fetchVisibleTasks(client)).rejects.toMatchObject({message:'Later page unavailable'})
 })
 it('preserves bounded dashboard requests and database display ordering',async()=>{
  const {client,calls}=clientFor(Array.from({length:25},(_,i)=>({id:id(i)})))
  expect(await fetchVisibleTasks(client,{limit:10})).toHaveLength(10)
  expect(calls.gt).not.toHaveBeenCalled()
  expect(calls.range).not.toHaveBeenCalled()
  expect(calls.limit).toHaveBeenCalledWith(10)
  expect(calls.order).toHaveBeenCalledWith('due_date',{ascending:true,nullsFirst:false})
 })
})
