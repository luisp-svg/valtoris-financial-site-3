import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createTask } from './tasksApi'
vi.mock('../../platform/activities',()=>({recordActivityBestEffort:vi.fn()}))
it('recovers an uncertain successful save without creating a second task',async()=>{
 let stored: Record<string,unknown> | null=null, inserts=0
 const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:stored,error:null}),insert:(row:Record<string,unknown>)=>{inserts++;stored=row;return query},single:async()=>({data:null,error:{message:'Network response lost'}})}
 const client={from:()=>query} as unknown as SupabaseClient
 const input={title:'Follow up',description:'',due_date:'2026-09-28',priority:'medium' as const,assigned_user_id:'writer',household_id:'household',opportunity_id:'opportunity'}
 await expect(createTask(client,input,'writer','stable-request')).rejects.toMatchObject({message:'Network response lost'})
 const task=await createTask(client,input,'writer','stable-request')
 expect(task.id).toBe('stable-request');expect(inserts).toBe(1)
 await expect(createTask(client,{...input,title:'Different work'},'writer','stable-request')).rejects.toThrow('different details')
 expect(inserts).toBe(1)
})
