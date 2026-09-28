import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runReportCardAgentCrmSync, type ReportCardDeliveryContext, type ReportCardSyncDeps, type ReportCardSyncInput } from './reportCardSync'
import { canonicalReportIdentity, syncReportCardDelivery, verifyReportContact } from './reportCardDelivery'
import { DeliveryHold } from './insurance/deliver'
const input: ReportCardSyncInput = { assessmentType:'family',contactPermission:true,matchStatus:'new_prospect',memberId:'member',submissionId:'lead',firstName:'Test',lastName:'Person',email:'test@example.invalid',phone:'+15555551234' }
function fixture(patch: Partial<ReportCardDeliveryContext> = {}) {
 const events: string[] = []
 const delivery: ReportCardDeliveryContext = { contactId:null,createStarted:false,tagStarted:false,tagApplied:false,
  checkpoint: vi.fn(async values => { events.push(JSON.stringify(values)) }),
  verifyContact: vi.fn(async () => ({hasTag:false})), ...patch }
 const links = {findByMember:vi.fn(async()=>({status:'not_found' as const})),saveVerifiedLink:vi.fn(async()=>({status:'created' as const}))}
 const deps: ReportCardSyncDeps = {syncEnabled:true,linkingEnabled:true,creationEnabled:true,taggingEnabled:true,triggersVerified:true,locationId:'location',log:vi.fn(),delivery,links,
 lookupIdentity:vi.fn(async()=>({status:'NO_CONTACT_FOUND' as const})),createContact:vi.fn(async()=>{events.push('create');return {id:'contact123',sourceMatched:true}}),applyTag:vi.fn(async()=>{events.push('tag')})}
 return {deps,delivery,events,links}
}
describe('durable Report Card delivery',()=>{
 it.each([undefined,false,'true',1])('requires explicit boolean contact permission (%s)',async permission=>{
  const {deps,links}=fixture()
  expect(await runReportCardAgentCrmSync({...input,contactPermission:permission as boolean},deps)).toEqual({status:'SKIP_CONSENT'})
  expect(links.findByMember).not.toHaveBeenCalled();expect(deps.lookupIdentity).not.toHaveBeenCalled();expect(deps.createContact).not.toHaveBeenCalled();expect(deps.applyTag).not.toHaveBeenCalled()
 })
 it('rejects an unclaimed legacy call before external lookup',async()=>{
  const {deps}=fixture();delete deps.delivery
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'SKIP_DELIVERY_REQUIRED'})
  expect(deps.lookupIdentity).not.toHaveBeenCalled()
 })
 it('records intent before each external write and saves returned identity before linking',async()=>{
  const {deps,events}=fixture()
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'CREATED_AND_LINKED_CONTACT'})
  expect(events.indexOf('{"contact_create_started":true}')).toBeLessThan(events.indexOf('create'))
  expect(events.indexOf('{"contact_id":"contact123"}')).toBeGreaterThan(events.indexOf('create'))
  expect(events.indexOf('{"tag_write_started":true}')).toBeLessThan(events.indexOf('tag'))
  expect(events[events.length - 1]).toBe('{"tag_applied":true}')
 })
 it('does not create when remote triggers have not been reviewed',async()=>{
  const {deps}=fixture();deps.triggersVerified=false
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'NO_CONTACT_FOUND' as const})
  expect(deps.createContact).not.toHaveBeenCalled();expect(deps.applyTag).not.toHaveBeenCalled()
 })
 it('holds an uncertain create outcome instead of retrying creation',async()=>{
  const {deps}=fixture({createStarted:true})
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'HELD',reason:'contact_outcome_unknown'})
  expect(deps.createContact).not.toHaveBeenCalled()
 })
 it('reconciles an uncertain create with an exact verified identity',async()=>{
  const {deps,delivery}=fixture({createStarted:true});deps.lookupIdentity=vi.fn(async()=>({status:'EXACT_EXISTING_CONTACT' as const,externalContactId:'contact123'}))
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'LINKED_EXISTING_CONTACT'})
  expect(deps.createContact).not.toHaveBeenCalled();expect(delivery.verifyContact).toHaveBeenCalled()
 })
 it('reuses a checkpointed contact even when the link save previously failed',async()=>{
  const {deps}=fixture({contactId:'contact123',createStarted:true})
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'ALREADY_LINKED'})
  expect(deps.lookupIdentity).not.toHaveBeenCalled();expect(deps.createContact).not.toHaveBeenCalled()
 })
 it('holds a checkpoint/link conflict without calling the provider',async()=>{
  const {deps,delivery}=fixture({contactId:'contact123'});deps.links={findByMember:async()=>({status:'found',link:{householdMemberId:'member',externalContactId:'different'}}),saveVerifiedLink:vi.fn()}
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'HELD',reason:'link_conflict'})
  expect(delivery.verifyContact).not.toHaveBeenCalled()
 })
 it('does not link an ID that fails read-back verification',async()=>{
  const {deps,links}=fixture({contactId:'contact123',verifyContact:async()=>{throw new DeliveryHold('contact_verification_failed')}})
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'HELD',reason:'contact_verification_failed'})
  expect(links.saveVerifiedLink).not.toHaveBeenCalled();expect(deps.applyTag).not.toHaveBeenCalled()
 })
 it('holds uncertain tag outcomes if read-back cannot confirm the tag',async()=>{
  const {deps}=fixture({contactId:'contact123',tagStarted:true})
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'HELD',reason:'tag_outcome_unknown'})
  expect(deps.applyTag).not.toHaveBeenCalled()
 })
 it('reconciles an already applied tag without another write',async()=>{
  const {deps,delivery}=fixture({contactId:'contact123',tagStarted:true,verifyContact:async()=>({hasTag:true})})
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'ALREADY_LINKED'})
  expect(deps.applyTag).not.toHaveBeenCalled();expect(delivery.checkpoint).toHaveBeenCalledWith({tag_applied:true})
 })
 it('stops before provider work when its lease is lost',async()=>{
  const {deps}=fixture({checkpoint:async()=>{throw new Error('lease_lost')}})
  expect(await runReportCardAgentCrmSync(input,deps)).toEqual({status:'INTEGRATION_ERROR',category:'network'})
  expect(deps.lookupIdentity).not.toHaveBeenCalled();expect(deps.createContact).not.toHaveBeenCalled()
 })
 it('does not create if the durable intent write fails',async()=>{
  const {deps}=fixture({checkpoint:async patch=>{if(patch.contact_create_started)throw new Error('failed')}})
  await runReportCardAgentCrmSync(input,deps);expect(deps.createContact).not.toHaveBeenCalled()
 })
})
const lead = {id:'lead',assessment_type:'family',lead_type:'Family Report Card',raw_payload:{firstName:'Test',lastName:'Person'},normalized_email:input.email,normalized_phone:input.phone,consent_snapshot:{contactPermission:true},status:'unassigned',duplicate_review_status:null}
const members = [{id:'member',first_name:'Test',last_name:'Person'}]
describe('canonical identity and provider read-back',()=>{
 it('uses the saved lead and selected existing member',()=>expect(canonicalReportIdentity(lead,members)).toMatchObject({...input,matchStatus:"verified_canonical"}))
 it.each(['family','business','retirement','protection','student_loan','credit','home_buyer'])('supports canonical %s records',async type=>{
  const {getReportCardAgentCrmConfig}=await import('./reportCardSyncConfig')
  expect(canonicalReportIdentity({...lead,assessment_type:type,lead_type:getReportCardAgentCrmConfig(type)!.source},members).assessmentType).toBe(type)
 })
 it('does not infer consent from contact information',()=>expect(()=>canonicalReportIdentity({...lead,consent_snapshot:{}},members)).toThrow('consent_missing'))
 it('holds pending duplicate review and mismatched card types',()=>{
  expect(()=>canonicalReportIdentity({...lead,duplicate_review_status:'pending'},members)).toThrow('identity_review_required')
  expect(()=>canonicalReportIdentity({...lead,lead_type:'Something Else'},members)).toThrow('type_mismatch')
 })
 it('holds ambiguous or unavailable household members',()=>{
  expect(()=>canonicalReportIdentity(lead,[])).toThrow('member_ambiguous')
  expect(()=>canonicalReportIdentity(lead,[...members,...members])).toThrow('member_ambiguous')
 })
 it('checks location and exact normalized identity before using a remote ID',()=>{
  const contact={locationId:'location',firstName:'Test',lastName:'Person',email:input.email,phone:input.phone,tags:['service-family-planning']}
  expect(verifyReportContact({contact},'location',input,'service-family-planning')).toEqual({hasTag:true})
  expect(()=>verifyReportContact({contact:{...contact,locationId:'other'}},'location',input,'tag')).toThrow('contact_verification_failed')
  expect(()=>verifyReportContact({contact:{...contact,email:'other@example.invalid'}},'location',input,'tag')).toThrow('contact_verification_failed')
  expect(()=>verifyReportContact({contact:{...contact,id:'wrong'}},'location',input,'tag','expected')).toThrow('contact_verification_failed')
 })
 it('does not claim a queue job or contact a provider when sync is disabled',async()=>{
  const rpc=vi.fn();expect(await syncReportCardDelivery('lead',{env:{},admin:{rpc} as unknown as SupabaseClient})).toBe('disabled');expect(rpc).not.toHaveBeenCalled()
 })
})

describe('optional phone durable delivery', () => {
 it('accepts a canonical lead without manufacturing a phone', () => {
  expect(canonicalReportIdentity({...lead, normalized_phone:null},members).phone).toBeNull()
 })
 it.each(['family','business','retirement','protection','student_loan','credit','home_buyer'])('creates and tags a new email-only %s contact after a no-match decision', async assessmentType => {
  const {deps}=fixture()
  expect(await runReportCardAgentCrmSync({...input,assessmentType,phone:null},deps)).toEqual({status:'CREATED_AND_LINKED_CONTACT'})
  expect(deps.createContact).toHaveBeenCalledWith(expect.objectContaining({phone:''}))
 })
 it('does not create, link, or tag an existing email-only match', async () => {
  const {deps,links}=fixture()
  deps.lookupIdentity=vi.fn(async()=>({status:'AMBIGUOUS' as const,reason:'EMAIL_ONLY_MATCH' as const}))
  expect(await runReportCardAgentCrmSync({...input,phone:null},deps)).toEqual({status:'AMBIGUOUS',reason:'EMAIL_ONLY_MATCH'})
  expect(deps.createContact).not.toHaveBeenCalled();expect(links.saveVerifiedLink).not.toHaveBeenCalled();expect(deps.applyTag).not.toHaveBeenCalled()
 })
 it('holds an uncertain email-only creation instead of creating again', async () => {
  const {deps}=fixture({createStarted:true})
  expect(await runReportCardAgentCrmSync({...input,phone:null},deps)).toEqual({status:'HELD',reason:'contact_outcome_unknown'})
  expect(deps.createContact).not.toHaveBeenCalled()
 })
 it('requires an exact read-back including an absent phone', () => {
  const identity={...input,phone:null}
  const contact={id:'contact123',locationId:'location',firstName:input.firstName,lastName:input.lastName,email:input.email}
  expect(verifyReportContact({contact},'location',identity,'tag','contact123')).toEqual({hasTag:false})
  expect(()=>verifyReportContact({contact:{...contact,phone:input.phone}},'location',identity,'tag','contact123')).toThrow('contact_verification_failed')
  expect(()=>verifyReportContact({contact:{...contact,lastName:'Other'}},'location',identity,'tag','contact123')).toThrow('contact_verification_failed')
 })
})
