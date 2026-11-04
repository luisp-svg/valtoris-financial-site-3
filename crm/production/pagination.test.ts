import {describe,it,expect,vi} from 'vitest'
import {fetchProductionApplications} from './productionApi'
import {fetchPaidCommissionEvents} from './compensationApi'
import {fetchOverdueRequirementCountsByApplicationIds} from './requirementApi'
import {readAllPages} from '../../lib/readAllPages'
function fixture(tables:Record<string,Record<string,unknown>[]>,failAt=-1){
 const ranges:number[][]=[],batches:string[][]=[]
 const from=vi.fn((table:string)=>{
  let ids:string[]|undefined,start=0,end=99
  const q={select:()=>q,is:()=>q,eq:()=>q,not:()=>q,lte:()=>q,order:()=>q,
   in:(_key:string,values:string[])=>{ids=values;batches.push(values);return q},
   range:(a:number,b:number)=>{start=a;end=b;ranges.push([a,b]);return q},
   then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:(tables[table]??[]).filter(row=>!ids||ids.includes(String(row.application_id))).slice(start,end+1),error:start===failAt?new Error('later page failed'):null}).then(resolve)}
  return q
 })
 return {client:{from} as never,ranges,batches}
}
describe('complete Production inputs',()=>{
 it('loads 1,201 applications beyond both old limits',async()=>{
  const rows=Array.from({length:1201},(_,i)=>({id:'a'+i,production_stage:'submitted',product_line:'life_term'}))
  const f=fixture({policy_applications:rows});const all=await fetchProductionApplications(f.client)
  expect(all).toHaveLength(1201);expect(all[1200].id).toBe('a1200');expect(f.ranges).toHaveLength(13)
  expect(await fetchProductionApplications(f.client,{limit:201})).toHaveLength(201)
 })
 it('paginates more than 1,000 related events for a single application',async()=>{
  const events=Array.from({length:1201},(_,i)=>({id:'e'+i,application_id:'a',event_type:'paid',amount_cents:1}))
  const f=fixture({policy_writing_commission_events:events})
  const all=await fetchPaidCommissionEvents(f.client,['a']);expect(all).toHaveLength(1201);expect(all.reduce((sum,row)=>sum+row.amount_cents,0)).toBe(1201)
 })
 it('bounds ID lists and includes overdue requirements from late batches',async()=>{
  const ids=Array.from({length:205},(_,i)=>'a'+i)
  const f=fixture({policy_application_requirements:[{id:'r',application_id:'a204',status:'open',due_date:'2026-01-01'}]})
  expect((await fetchOverdueRequirementCountsByApplicationIds(f.client,ids,'2026-10-28')).get('a204')).toBe(1)
  expect(f.batches.map(ids=>ids.length)).toEqual([100,100,5])
 })
 it('rejects partial parent loads and repeated boundaries',async()=>{
  const f=fixture({policy_applications:Array.from({length:201},(_,i)=>({id:'a'+i,production_stage:'submitted',product_line:'life_term'}))},100)
  await expect(fetchProductionApplications(f.client)).rejects.toThrow('later page failed')
  await expect(readAllPages(async()=>({data:Array.from({length:100},(_,i)=>({id:String(i)})),error:null}))).rejects.toThrow('Records changed')
 })
})
