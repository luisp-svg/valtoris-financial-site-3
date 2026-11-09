import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchExecutiveRows } from './ExecutiveReportingStage1'
import { classifyTaskQueue } from '../tasks/taskQueues'

type Row = { id: string; workflow_type?:string; metadata?:Record<string,unknown> }
const id=(n:number)=>String(n).padStart(5,'0')
function mockClient(rows: Row[], options:{ failPage?:number; afterFirstPage?:(rows:Row[])=>Row[] }={}) {
  const cursors: Array<string|null> = []
  let request=0
  const db={from:()=>({select:()=>{
    let cursor:string|null=null, count=1000, start=0
    const query={
      order:()=>query,is:()=>query,in:()=>query,eq:()=>query,
      limit:(n:number)=>{count=n;return query},
      gt:(_column:string,value:string)=>{cursor=value;return query},
      range:(a:number,b:number)=>{start=a;count=b-a+1;return query},
      then:(resolve:(result:{data:Row[]|null;error:{message:string}|null})=>unknown)=>{
        const current=request>0 && options.afterFirstPage?options.afterFirstPage(rows):rows
        const data=current.filter(row=>!cursor||row.id>cursor).slice(start,start+count)
        cursors.push(cursor)
        return Promise.resolve(request++===options.failPage?{data:null,error:{message:'Page unavailable'}}:{data,error:null}).then(resolve)
      },
    }
    return query
  }})} as unknown as SupabaseClient
  return{db,cursors}
}

describe('executive reporting cursor pagination',()=>{
 it('returns an empty dataset without inventing totals',async()=>{
  const {db,cursors}=mockClient([])
  await expect(fetchExecutiveRows<Row>(db,'tasks','id','active')).resolves.toEqual([])
  expect(cursors).toEqual([null])
 })
 it('retrieves all records beyond a single response page',async()=>{
  const rows=Array.from({length:451},(_,i)=>({id:id(i)}))
  const {db,cursors}=mockClient(rows)
  await expect(fetchExecutiveRows<Row>(db,'tasks','id','active')).resolves.toEqual(rows)
  expect(cursors).toEqual([null,id(199),id(399)])
 })
 it('rejects incomplete data instead of showing misleading counts',async()=>{
  const {db}=mockClient(Array.from({length:250},(_,i)=>({id:id(i)})),{failPage:1})
  await expect(fetchExecutiveRows<Row>(db,'opportunities','id','not_deleted')).rejects.toMatchObject({message:'Page unavailable'})
 })
 it.each(['tasks','opportunities'] as const)('does not skip unchanged %s when an earlier row leaves the result set',async table=>{
  const rows=Array.from({length:401},(_,i)=>({id:id(i),workflow_type:i===200?'review_initial_diagnostic':'resolve_possible_duplicate',metadata:{contact_permission:true}}))
  const {db}=mockClient(rows,{afterFirstPage:current=>current.slice(1)})
  const result=await fetchExecutiveRows<Row>(db,table,'id,workflow_type,metadata',table==='tasks'?'active':'not_deleted')
  expect(result.filter(row=>classifyTaskQueue(row)==='sales').map(row=>row.id)).toEqual([id(200)])
  expect(new Set(result.map(row=>row.id)).size).toBe(result.length)
 })
 it('does not duplicate rows when a new UUID appears before the cursor',async()=>{
  const rows=Array.from({length:401},(_,i)=>({id:id(i+1)}))
  const {db}=mockClient(rows,{afterFirstPage:current=>[{id:id(0)},...current]})
  expect(await fetchExecutiveRows<Row>(db,'policy_applications','id','not_deleted')).toEqual(rows)
 })
})
