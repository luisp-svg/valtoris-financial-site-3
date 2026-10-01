import { describe, expect, it, vi } from 'vitest'
import { deliverReportCardFollowUp, type FollowUpDelivery } from './reportCardFollowUp'
const leadId = '00000000-0000-4000-8000-000000000001'
const nextLeadId = '00000000-0000-4000-8000-000000000002'
function fixture(patch: Partial<FollowUpDelivery> = {}) {
 const delivery: FollowUpDelivery = { lead_id: leadId, contact_id:'contact1', opportunity_id:null, opportunity_create_started:false, task_id:null, task_create_started:false, ...patch }
 const target = {locationId:'location1',pipelineId:'pipeline1',initialStageId:'stage-1',assignedUserId:'luis1'}
 const state = { opportunities: [{id:'opp1',contactId:'contact1',pipelineId:'pipeline1',locationId:'location1',status:'won',pipelineStageId:'existingStage'}] as Record<string,unknown>[], tasks: [] as Record<string,unknown>[], events:[] as string[] }
 const transport = {
  get:vi.fn(async(path:string) => {
   if(path==='/opportunities/search')return {opportunities:state.opportunities,meta:{total:state.opportunities.length,startAfterId:state.opportunities[0]?.id}}
   if(path==='/contacts/contact1/tasks')return {tasks:state.tasks}
   return {task:state.tasks.find(t=>path.endsWith('/'+t.id))}
  }),
  post:vi.fn(async(path:string,body:Record<string,unknown>) => {
   state.events.push('post:'+path)
   if(path==='/opportunities/') {const opportunity={...body,id:'newOpp'};state.opportunities.push(opportunity);return {opportunity}}
   const task={...body,id:'task'+(state.tasks.length+1),contactId:'contact1'};state.tasks.push(task);return {task}
  }),
 }
 const checkpoint=vi.fn(async(patch:Record<string,unknown>)=>{state.events.push(JSON.stringify(patch));Object.assign(delivery,patch)})
 const verifyContact=vi.fn(async()=>{})
 const input={delivery,target,assessmentType:'family',contactName:'María de la Cruz',dueDate:'2026-09-29T14:00:00.000Z',transport,checkpoint,verifyContact}
 return {input,state,transport,checkpoint,verifyContact}
}
describe('per-submission Report Card follow-up',()=>{
 it('refuses an old claim missing task checkpoint fields',async()=>{
  const f=fixture();delete (f.input.delivery as Partial<FollowUpDelivery>).task_create_started
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('task_schema_unavailable');expect(f.transport.get).not.toHaveBeenCalled();expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('does not create after a task-intent checkpoint failure',async()=>{
  const f=fixture();const original=f.checkpoint.getMockImplementation()!
  f.checkpoint.mockImplementation(async patch=>{if(patch.task_create_started)throw new Error('consent_revoked');await original(patch)})
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('consent_revoked');expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('holds two tasks bearing the same submission reference',async()=>{
  const f=fixture();await deliverReportCardFollowUp(f.input);f.input.delivery.task_id=null
  f.state.tasks.push({...f.state.tasks[0],id:'duplicate'})
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('multiple_submission_tasks');expect(f.transport.post).toHaveBeenCalledTimes(1)
 })
 it('reuses a completed opportunity without changing its stage and creates one task',async()=>{
  const f=fixture();expect(await deliverReportCardFollowUp(f.input)).toEqual({opportunityId:'opp1',taskId:'task1'})
  expect(f.transport.post).toHaveBeenCalledTimes(1)
  expect(f.state.opportunities[0]).toMatchObject({status:'won',pipelineStageId:'existingStage'})
  expect(f.state.events.indexOf('{"task_create_started":true}')).toBeLessThan(f.state.events.indexOf('post:/contacts/contact1/tasks'))
  expect(f.checkpoint).toHaveBeenLastCalledWith({status:'synced',last_code:'verified'})
 })
 it('retries a checkpointed task without another create',async()=>{
  const f=fixture();await deliverReportCardFollowUp(f.input);await deliverReportCardFollowUp(f.input)
  expect(f.transport.post).toHaveBeenCalledTimes(1)
 })
 it('creates a separate task for a repeat submission using the same opportunity',async()=>{
  const f=fixture();await deliverReportCardFollowUp(f.input)
  f.input.delivery={...f.input.delivery,lead_id:nextLeadId,task_id:null,task_create_started:false}
  await deliverReportCardFollowUp(f.input)
  expect(f.state.tasks).toHaveLength(2);expect(f.state.tasks[0].title).not.toBe(f.state.tasks[1].title)
  expect(f.transport.post.mock.calls.every(([p])=>p==='/contacts/contact1/tasks')).toBe(true)
 })
 it('reconciles a lost task response from its unique submission reference',async()=>{
  const f=fixture();await deliverReportCardFollowUp(f.input);f.input.delivery.task_id=null
  f.state.tasks[0].completed=true
  await deliverReportCardFollowUp(f.input)
  expect(f.transport.post).toHaveBeenCalledTimes(1);expect(f.state.tasks[0].completed).toBe(true)
 })
 it('holds an unknown task outcome when the search is empty',async()=>{
  const f=fixture({task_create_started:true});await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('task_outcome_unknown')
  expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('holds duplicate opportunities instead of picking one',async()=>{
  const f=fixture();f.state.opportunities.push({...f.state.opportunities[0],id:'opp2'})
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('multiple_opportunities');expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('holds an opportunity belonging to another contact',async()=>{
  const f=fixture();f.state.opportunities[0].contactId='other'
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('opportunity_scope_conflict');expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('does not recreate an opportunity whose returned ID is absent from search',async()=>{
  const f=fixture({opportunity_id:'knownOpp'});f.state.opportunities=[]
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('opportunity_search_pending');expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('does not retry unknown opportunity creation',async()=>{
  const f=fixture({opportunity_create_started:true});f.state.opportunities=[]
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('opportunity_outcome_unknown');expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('creates an opportunity only after durable intent',async()=>{
  const f=fixture();f.state.opportunities=[];await deliverReportCardFollowUp(f.input)
  expect(f.state.events.indexOf('{"opportunity_create_started":true}')).toBeLessThan(f.state.events.indexOf('post:/opportunities/'))
  expect(f.state.opportunities[0]).toMatchObject({name:'María de la Cruz',contactId:'contact1',pipelineStageId:'stage-1',status:'open'})
 })
 it('does not create a generically named opportunity when the client name is blank',async()=>{
  const f=fixture();f.state.opportunities=[];f.input.contactName='   '
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('invalid_contact_name')
  expect(f.transport.post).not.toHaveBeenCalled();expect(f.input.delivery.opportunity_create_started).toBe(false)
 })
 it('does not contact the provider after lease or consent checkpoint failure',async()=>{
  const f=fixture();f.checkpoint.mockRejectedValue(new Error('lease_lost'))
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('lease_lost');expect(f.transport.get).not.toHaveBeenCalled();expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('holds mismatched task read-back without recreating',async()=>{
  const f=fixture();await deliverReportCardFollowUp(f.input);f.state.tasks[0].assignedTo='other'
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('task_verification_failed');expect(f.transport.post).toHaveBeenCalledTimes(1)
 })
 it('does not interpret a malformed opportunity search as no matches',async()=>{
  const f=fixture();f.transport.get.mockResolvedValueOnce({opportunities:[],meta:{}} as never)
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('incomplete_opportunity_response');expect(f.transport.post).not.toHaveBeenCalled()
 })
 it('does not write when canonical contact verification fails',async()=>{
  const f=fixture();f.verifyContact.mockRejectedValue(new Error('identity_changed'))
  await expect(deliverReportCardFollowUp(f.input)).rejects.toThrow('identity_changed');expect(f.transport.post).not.toHaveBeenCalled()
 })
})
