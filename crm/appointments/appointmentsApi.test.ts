import {describe,it,expect,vi} from 'vitest'
import {fetchAppointmentsPage} from './appointmentsApi'
function client(result:unknown){const q={select:vi.fn(),is:vi.fn(),gte:vi.fn(),neq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue(result)};for(const m of ['select','is','gte','neq','order'] as const)q[m].mockReturnValue(q);return {q,client:{from:()=>q} as never}}
describe('appointment pages',()=>{
 it('requests late pages with exact totals',async()=>{const f=client({data:[{id:'a1001'}],count:1201,error:null});expect((await fetchAppointmentsPage(f.client,21,false)).total).toBe(1201);expect(f.q.range).toHaveBeenCalledWith(1000,1049);expect(f.q.select.mock.calls[0][1]).toEqual({count:'exact'})})
 it('filters upcoming appointments before paging and sorts nearest first',async()=>{const f=client({data:[],count:0,error:null});await fetchAppointmentsPage(f.client,1,true,'2026-10-28T12:00:00Z');expect(f.q.gte).toHaveBeenCalledWith('starts_at','2026-10-28T12:00:00Z');expect(f.q.neq).toHaveBeenCalledWith('status','cancelled');expect(f.q.order).toHaveBeenCalledWith('starts_at',{ascending:true})})
 it('fails unavailable counts and errors instead of inventing totals',async()=>{await expect(fetchAppointmentsPage(client({data:[],count:null,error:null}).client,1,false)).rejects.toThrow('total unavailable');await expect(fetchAppointmentsPage(client({data:null,count:null,error:new Error('offline')}).client,1,false)).rejects.toThrow('offline')})
})
