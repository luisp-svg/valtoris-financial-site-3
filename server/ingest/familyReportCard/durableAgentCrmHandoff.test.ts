import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ingestFamilyReportCard } from './ingestFamilyReportCard'
import { syncReportCardDelivery } from '../../agentcrm/reportCardDelivery'
import { validIngestRequestBodyFixture } from './testFixtures'
vi.mock('../../agentcrm/reportCardDelivery',()=>({syncReportCardDelivery:vi.fn()}))
describe('persisted AgentCRM handoff',()=>{
 it.each([true,false])('passes only the saved lead ID on created=%s, never replay-supplied identity',async created=>{
  vi.mocked(syncReportCardDelivery).mockReset().mockResolvedValue('disabled')
  const admin={rpc:vi.fn(async(name:string)=>name==='ingest_public_report_card'?{data:{created,lead_id:'canonical-lead',household_id:'canonical-household',member_id:'canonical-member',assessment_id:'assessment',match_status:'new_prospect',sheets_sync_status:'skipped'},error:null}:{data:true,error:null})} as unknown as SupabaseClient
  const result=await ingestFamilyReportCard(validIngestRequestBodyFixture(),{admin,findCandidates:async()=>[],sheetsWriter:vi.fn().mockResolvedValue({status:'skipped'}),orchestrateFollowUpTask:vi.fn().mockResolvedValue({status:'skipped'})})
  expect(result.ok).toBe(true)
  expect(syncReportCardDelivery).toHaveBeenCalledExactlyOnceWith('canonical-lead',{admin})
  expect(JSON.stringify(result)).not.toContain('canonical-member')
 })
 it('preserves a saved assessment when the delivery worker fails',async()=>{
  vi.mocked(syncReportCardDelivery).mockReset().mockRejectedValue(new Error('provider down'))
  const admin={rpc:vi.fn(async(name:string)=>name==='ingest_public_report_card'?{data:{created:true,lead_id:'canonical-lead',household_id:'canonical-household',member_id:'canonical-member',assessment_id:'assessment',match_status:'new_prospect'},error:null}:{data:true,error:null})} as unknown as SupabaseClient
  const result=await ingestFamilyReportCard(validIngestRequestBodyFixture(),{admin,findCandidates:async()=>[],sheetsWriter:vi.fn().mockResolvedValue({status:'skipped'}),orchestrateFollowUpTask:vi.fn().mockResolvedValue({status:'skipped'})})
  expect(result.ok).toBe(true);expect(JSON.stringify(result)).not.toContain('provider down')
 })
})
