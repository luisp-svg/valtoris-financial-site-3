import {it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {fetchHouseholdOptions} from './tasksApi'
it('loads households beyond the first page and keeps a deterministic order',async()=>{
 const first=Array.from({length:200},(_,i)=>({id:String(i),display_name:`Client ${i}`}))
 const range=vi.fn().mockResolvedValueOnce({data:first,error:null}).mockResolvedValueOnce({data:[{id:'qa',display_name:'QA'}],error:null})
 const query={select:vi.fn(),is:vi.fn(),order:vi.fn(),range}
 query.select.mockReturnValue(query);query.is.mockReturnValue(query);query.order.mockReturnValue(query)
 const result=await fetchHouseholdOptions({from:()=>query} as unknown as SupabaseClient)
 expect(result).toHaveLength(201);expect(result[200].id).toBe('qa')
 expect(range.mock.calls).toEqual([[0,199],[200,399]])
 expect(query.order).toHaveBeenCalledWith('id',{ascending:true})
})
