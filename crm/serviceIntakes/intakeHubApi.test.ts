import { describe,expect,it,vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadIntakeHubSources,loadIntakeHubStatus } from './intakeHubApi'
function fake(results: {data: unknown;error: unknown}[]) {
  const calls: {table:string;filters:unknown[][]}[]=[]
  return {calls,client:{from:(table:string) => {
    const call={table,filters:[] as unknown[][]};calls.push(call)
    const result=results.shift() ?? {data:[],error:null}
    const query: Record<string,unknown>={then:(resolve:(r:unknown)=>unknown) => Promise.resolve(result).then(resolve)}
    for(const method of ['select','eq','in','is','order','range','contains','limit']) query[method]=vi.fn((...args:unknown[]) => {call.filters.push([method,...args]);return query})
    return query
  }} as unknown as SupabaseClient}
}
describe('household intake access',()=>{
  it('loads progress with one household- and origin-scoped read',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[{type:'life_insurance_intake',status:'draft',updated_at:'2026-09-01'}],error:null})
    const rows=await loadIntakeHubStatus({rpc} as unknown as SupabaseClient,{kind:'member',id:'m',householdId:'h'})
    expect(rows).toEqual([{type:'life_insurance_intake',status:'draft',updatedAt:'2026-09-01'}])
    expect(rpc).toHaveBeenCalledWith('client_intake_progress',{p_household_id:'h',p_origin_kind:'member',p_origin_id:'m'})
  })
  it('does not show Not started when the progress read fails',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:null,error:{message:'failure'}})
    await expect(loadIntakeHubStatus({rpc} as unknown as SupabaseClient,{kind:'contact',id:'c',householdId:'h'})).rejects.toThrow('Unable to load')
  })
  it('only lists active manual contacts from the current household with server pagination',async()=>{
    const f=fake([{data:[{id:'c',normalized_email:'client@example.invalid',submitted_at:'2026-09-01'}],error:null}])
    const rows=await loadIntakeHubSources(f.client,'h','contact',2)
    expect(rows[0].origin).toEqual({kind:'contact',id:'c',householdId:'h'})
    expect(f.calls[0].filters).toContainEqual(['eq','lead_type','Manual Contact'])
    expect(f.calls[0].filters).toContainEqual(['is','deleted_at',null])
    expect(f.calls[0].filters).toContainEqual(['range',50,74])
  })
  it('limits report sources to completed public reports',async()=>{
    const f=fake([{data:[],error:null}])
    await loadIntakeHubSources(f.client,'h','report_card',0)
    expect(f.calls[0].filters).toContainEqual(['eq','status','completed'])
    expect(f.calls[0].filters).toContainEqual(['eq','capture_channel','public_self_report'])
  })
})
