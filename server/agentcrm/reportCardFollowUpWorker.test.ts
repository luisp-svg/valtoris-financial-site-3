import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncReportCardDelivery } from './reportCardDelivery'
import { REPORT_CARD_FOLLOW_UP_TARGET as target, STUDENT_LOAN_CONTACT_OWNER_ID as liz } from './reportCardFollowUpConfig'
const remote = vi.hoisted(() => ({ tasks: [] as Record<string, unknown>[], posts: [] as string[], contactSync: vi.fn(), owner: 'otherOwner', assignments: [] as string[] }))
vi.mock('./reportCardSync.js', () => ({runReportCardAgentCrmSync: remote.contactSync}))
vi.mock('./client.js', () => ({LeadConnectorClient: class {
  async get() { return {contact:{id:'contact123',locationId:'I2Y36c45rBLFZhCQwkDC',firstName:'Test',lastName:'Person',email:'qa@example.invalid',phone:null,assignedTo:remote.owner}} }
}}))
vi.mock('./reportCardFollowUpClient.js', () => ({ReportCardFollowUpClient: class {
  async get(path: string) {
    if (path === '/opportunities/search') return {opportunities:[{id:'opp123',contactId:'contact123',pipelineId:'PsDkzCwY1xpySYvqd4j0',status:'won'}],meta:{total:1}}
    if (path.endsWith('/tasks')) return {tasks:remote.tasks}
    return {task:remote.tasks.find(t=>path.endsWith('/'+t.id))}
  }
  async assignContactOwner(_contact: string, owner: string) {remote.assignments.push(owner);remote.owner=owner}
  async post(path: string, body: Record<string,unknown>) {
    remote.posts.push(path)
    const task={...body,id:`task${remote.tasks.length+1}`,contactId:'contact123'};remote.tasks.push(task);return {task}
  }
}}))
const env={SUPABASE_URL:'https://phanoknohbidqtgrpwvk.supabase.co',AGENTCRM_REPORT_CARD_SYNC_ENABLED:'true',AGENTCRM_CONTACT_LINKING_ENABLED:'true',AGENTCRM_PRIVATE_INTEGRATION_TOKEN:'test-token',AGENTCRM_LOCATION_ID:target.locationId,AGENTCRM_REPORT_CARD_TRIGGERS_VERIFIED:'true',AGENTCRM_REPORT_CARD_DIRECT_FOLLOW_UP_VERIFIED:'true'}
function fixture(studentLoan = false) {
  const delivery={lead_id:'00000000-0000-4000-8000-000000000001',claim_token:'claim',delivery_kind:'report_card',target_location_id:target.locationId,contact_id:null as string|null,contact_create_started:false,tag_write_started:false,tag_applied:false,opportunity_id:null,opportunity_create_started:false,task_id:null,task_create_started:false}
  const patches:Record<string,unknown>[]=[]
  const rpc=vi.fn(async(name:string,args?:Record<string,unknown>)=>{
    if(name==='claim_report_card_delivery')return {data:{...delivery},error:null}
    const patch=args!.p_patch as Record<string,unknown>;patches.push({...patch});Object.assign(delivery,patch);return {data:true,error:null}
  })
  const from=(table:string)=>{
    const result={data:table==='leads'?{id:delivery.lead_id,created_at:'2026-09-28T18:00:00Z',household_id:'household',assessment_type:studentLoan?'student_loan':'family',lead_type:studentLoan?'Student Loan Report Card':'Family Report Card',raw_payload:{firstName:'Test',lastName:'Person'},normalized_email:'qa@example.invalid',normalized_phone:null,consent_snapshot:{contactPermission:true}}:table==='households'?{id:'household'}:[{id:'member',first_name:'Test',last_name:'Person'}],error:null}
    const query={select:()=>query,eq:()=>query,is:()=>query,single:async()=>result,maybeSingle:async()=>result,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(result).then(resolve)}
    return query
  }
  return {delivery,patches,rpc,admin:{rpc,from} as unknown as SupabaseClient}
}
beforeEach(()=>{
  remote.tasks=[];remote.posts=[];remote.owner='otherOwner';remote.assignments=[];remote.contactSync.mockReset()
  remote.contactSync.mockImplementation(async(_input,deps)=>{await deps.delivery.checkpoint({contact_id:'contact123'});return {status:'ALREADY_LINKED'}})
})
describe('Report Card worker follow-up integration',()=>{
  it('routes student-loan ownership to Lizbeth while keeping review tasks with Luis',async()=>{
    const f=fixture(true)
    expect(await syncReportCardDelivery(undefined,{admin:f.admin,env})).toBe('synced')
    expect(remote.assignments).toEqual([liz]);expect(remote.owner).toBe(liz)
    expect(remote.tasks[0].assignedTo).toBe(target.assignedUserId)
  })
  it('forces service tagging off even when the general environment flag is on',async()=>{
    const f=fixture()
    await syncReportCardDelivery(undefined,{admin:f.admin,env:{...env,AGENTCRM_CONTACT_TAGGING_ENABLED:'true'}})
    expect(remote.contactSync.mock.calls[0][1].taggingEnabled).toBe(false)
    expect(remote.assignments).toEqual([])
  })
  it.each(['tag_write_started','tag_applied'] as const)('holds legacy tag-routed jobs for review (%s)',async key=>{
    const f=fixture();f.delivery[key]=true
    expect(await syncReportCardDelivery(undefined,{admin:f.admin,env})).toBe('held')
    expect(remote.contactSync).not.toHaveBeenCalled();expect(remote.posts).toEqual([])
    expect(f.patches[f.patches.length-1]).toEqual({status:'held',last_code:'legacy_tag_routing_review'})
  })

  it('carries the newly checkpointed contact through to a verified task before marking synced',async()=>{
    const f=fixture()
    expect(await syncReportCardDelivery(undefined,{admin:f.admin,env})).toBe('synced')
    expect(f.delivery).toMatchObject({contact_id:'contact123',opportunity_id:'opp123',task_id:'task1',task_create_started:true})
    expect(f.patches[f.patches.length - 1]).toEqual({status:'synced',last_code:'verified'})
    expect(remote.posts).toEqual(['/contacts/contact123/tasks'])
    expect(remote.tasks[0]).toMatchObject({assignedTo:target.assignedUserId,dueDate:'2026-09-29T14:00:00.000Z'})
    expect(await syncReportCardDelivery(undefined,{admin:f.admin,env})).toBe('synced')
    expect(remote.posts).toHaveLength(1)
  })
  it('does not even claim work without direct-routing verification',async()=>{
    const f=fixture()
    expect(await syncReportCardDelivery(undefined,{admin:f.admin,env:{...env,AGENTCRM_REPORT_CARD_DIRECT_FOLLOW_UP_VERIFIED:'false'}})).toBe('disabled')
    expect(f.rpc).not.toHaveBeenCalled();expect(remote.contactSync).not.toHaveBeenCalled()
  })
  it('holds a pre-081 claim before contact or tag work',async()=>{
    const f=fixture();delete (f.delivery as Partial<typeof f.delivery>).task_id
    expect(await syncReportCardDelivery(undefined,{admin:f.admin,env})).toBe('held')
    expect(remote.contactSync).not.toHaveBeenCalled();expect(remote.posts).toHaveLength(0)
  })
  it('never creates a task when contact delivery was held',async()=>{
    const f=fixture();remote.contactSync.mockResolvedValue({status:'HELD',reason:'contact_verification_failed'})
    expect(await syncReportCardDelivery(undefined,{admin:f.admin,env})).toBe('held')
    expect(remote.posts).toHaveLength(0)
  })
})
