import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncReportCardDelivery } from './reportCardDelivery'
import { runReportCardAgentCrmSync } from './reportCardSync'
vi.mock('./reportCardSync',()=>({runReportCardAgentCrmSync:vi.fn()}))
const env={AGENTCRM_PRIVATE_INTEGRATION_TOKEN:'test-token',AGENTCRM_LOCATION_ID:'location',SUPABASE_URL:'https://phanoknohbidqtgrpwvk.supabase.co',AGENTCRM_REPORT_CARD_SYNC_ENABLED:'true',AGENTCRM_CONTACT_LINKING_ENABLED:'true'}
const lead={id:'savedLead',household_id:'savedHousehold',assessment_type:'family',lead_type:'Family Report Card',raw_payload:{firstName:'Saved',lastName:'Person'},normalized_email:'saved@example.invalid',normalized_phone:'+15555551234',consent_snapshot:{contactPermission:true},duplicate_review_status:'none',status:'unassigned'}
function fixture(overrides: {lead?: unknown; household?: unknown; members?: unknown; claim?: unknown; claimError?: unknown; checkpoint?: boolean; tableError?: string}={}) {
 const queries: [string,string,unknown][]=[]
 const rpc=vi.fn(async(name:string,_args:Record<string,unknown>)=>name==='claim_report_card_delivery'?{data:'claim' in overrides?overrides.claim:{lead_id:'savedLead',claim_token:'lease',delivery_kind:'report_card',target_location_id:'location',contact_id:null,contact_create_started:false,tag_write_started:false,tag_applied:false},error:overrides.claimError??null}:{data:overrides.checkpoint??true,error:null})
 const rows: Record<string,unknown>={leads:'lead' in overrides?overrides.lead:lead,households:'household' in overrides?overrides.household:{id:'savedHousehold'},household_members:'members' in overrides?overrides.members:[{id:'savedMember',first_name:'Saved',last_name:'Person'}]}
 const from=vi.fn((table:string)=>{
  const value=()=>({data:rows[table],error:overrides.tableError===table?new Error('read failed'):null})
  const q={select(){return this},eq(key:string,v:unknown){queries.push([table,key,v]);return this},is(key:string,v:unknown){queries.push([table,key,v]);return this},single:async()=>value(),maybeSingle:async()=>value(),then(resolve:(v:unknown)=>unknown){return Promise.resolve(value()).then(resolve)}};return q
 })
 return {admin:{rpc,from} as unknown as SupabaseClient,rpc,from,queries}
}
beforeEach(()=>vi.mocked(runReportCardAgentCrmSync).mockReset())
describe('Report Card worker authorization and canonical read',()=>{
 it('sends only saved identity to the engine and targets the persisted household',async()=>{
  const f=fixture();vi.mocked(runReportCardAgentCrmSync).mockResolvedValue({status:'ALREADY_LINKED'})
  expect(await syncReportCardDelivery('savedLead',{admin:f.admin,env})).toBe('synced')
  expect(f.rpc).toHaveBeenCalledWith('claim_report_card_delivery',{p_location:'location',p_lead_id:'savedLead'})
  expect(vi.mocked(runReportCardAgentCrmSync).mock.calls[0][0]).toMatchObject({firstName:'Saved',lastName:'Person',email:'saved@example.invalid',memberId:'savedMember',contactPermission:true})
  expect(f.queries).toContainEqual(['households','id','savedHousehold']);expect(f.queries).toContainEqual(['households','merged_into_household_id',null]);expect(f.queries).toContainEqual(['leads','deleted_at',null])
  expect(vi.mocked(runReportCardAgentCrmSync).mock.calls[0][1]?.triggersVerified).toBe(false)
 })
 it.each([{}, {contactPermission:false}, {contactPermission:'true'}])('does not dispatch without saved explicit consent %j',async consent=>{
  const f=fixture({lead:{...lead,consent_snapshot:consent}})
  expect(await syncReportCardDelivery('lead',{admin:f.admin,env})).toBe('held');expect(runReportCardAgentCrmSync).not.toHaveBeenCalled()
 })
 it('does not dispatch for a deleted, merged, or missing household',async()=>{
  const f=fixture({household:null});expect(await syncReportCardDelivery('lead',{admin:f.admin,env})).toBe('held');expect(runReportCardAgentCrmSync).not.toHaveBeenCalled()
 })
 it('does not dispatch after member-read errors or ambiguous membership',async()=>{
  for(const overrides of [{tableError:'household_members'},{members:[]}]){
   const f=fixture(overrides);expect(await syncReportCardDelivery('lead',{admin:f.admin,env})).not.toBe('synced')
  }
  expect(runReportCardAgentCrmSync).not.toHaveBeenCalled()
 })
 it('does not dispatch claims for another kind or provider location',async()=>{
  for(const patch of [{delivery_kind:'insurance_quote'},{target_location_id:'different'}]){
   const f=fixture({claim:{lead_id:'savedLead',claim_token:'lease',delivery_kind:'report_card',target_location_id:'location',...patch}})
   expect(await syncReportCardDelivery('lead',{admin:f.admin,env})).toBe('held');expect(f.from).not.toHaveBeenCalled()
  }
  expect(runReportCardAgentCrmSync).not.toHaveBeenCalled()
 })
 it('returns safely when migration is unavailable or another worker holds the queue',async()=>{
  for(const [overrides,expected] of [[{claimError:'unavailable'},'queue_unavailable'],[{claim:null},'idle']] as const){
   const f=fixture(overrides);expect(await syncReportCardDelivery('lead',{admin:f.admin,env})).toBe(expected);expect(f.from).not.toHaveBeenCalled()
  }
 })
 it('holds controlled identity conflicts and retries provider failures without logging identity',async()=>{
  for(const [decision,outcome] of [[{status:'HELD',reason:'contact_outcome_unknown'},'held'],[{status:'INTEGRATION_ERROR',category:'network'},'pending']] as const){
   const f=fixture();vi.mocked(runReportCardAgentCrmSync).mockResolvedValue(decision)
   expect(await syncReportCardDelivery('lead',{admin:f.admin,env})).toBe(outcome)
   const checkpoints=f.rpc.mock.calls.filter(([name])=>name==='checkpoint_insurance_quote_delivery')
   expect(JSON.stringify(checkpoints)).not.toContain('saved@example.invalid')
  }
 })
 it('does not claim work after the bounded invocation deadline',async()=>{
  const f=fixture();expect(await syncReportCardDelivery('lead',{admin:f.admin,env,deadline:Date.now()})).toBe('budget_exhausted');expect(f.rpc).not.toHaveBeenCalled()
 })
})
