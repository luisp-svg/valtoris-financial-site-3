import { describe,expect,it,vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SPECIALTY_CARDS,type Answers,type Specialty } from './catalog'
import { visibleQuestions } from './engine'
import { GUIDED_REPORT_FORMAT,validateGuidedReport,guidedResult } from './submission'
import { validIngestRequestBodyFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { ingestPublicReportCard } from '../../../server/ingest/familyReportCard/ingestFamilyReportCard'
import { mapPublicFamilyDiagnosticDetail } from '../../../crm/households/assessments/diagnosticFormatters'
export function sampleGuided(type:Specialty){const diagnostic:Answers={};for(let pass=0;pass<4;pass++)for(const q of visibleQuestions(type,diagnostic))if(!diagnostic[q.id])diagnostic[q.id]=q.kind==='number'?'10':q.kind==='multi'?[q.options![0][0]]:q.options![0][0];return {format:GUIDED_REPORT_FORMAT,assessmentType:type,diagnostic,locale:'en' as const,contact:{fullName:'QA Sample',email:'qa@example.invalid',phone:''}}}
describe('v4 Report Card server handoff',()=>{
 it.each(Object.keys(SPECIALTY_CARDS) as Specialty[])('%s validates and persists canonical results without contact duplication in answer history',async type=>{
  const a=sampleGuided(type);expect(validateGuidedReport(type,a)).toEqual(a)
  let payload:Record<string,unknown>={}
  const admin={rpc:vi.fn(async(fn:string,args:Record<string,unknown>)=>{if(fn==='ingest_public_report_card'){payload=args.p_payload as Record<string,unknown>;return {data:{created:true,lead_id:'lead',household_id:'household',member_id:'member',assessment_id:'assessment',match_status:'new_prospect',sheets_sync_status:'pending'},error:null}}return {data:null,error:null}})} as unknown as SupabaseClient
  const external=vi.fn().mockResolvedValue(null)
  const body=validIngestRequestBodyFixture({assessmentType:type,assessmentVersion:4,answers:a,clientReportedScore:guidedResult(type,a.diagnostic).overallScore===100?0:100,clientReportedGrade:guidedResult(type,a.diagnostic).overallGrade==='A'?'F':'A'})
  const result=await ingestPublicReportCard(body,{admin,findCandidates:async()=>[],sheetsWriter:vi.fn().mockResolvedValue({status:'skipped'}),runStudentLoanDryRun:external,orchestrateFollowUpTask:vi.fn().mockResolvedValue({status:'task_not_required'})})
  expect(result.ok).toBe(true);expect(payload.assessment_type).toBe(type);expect(payload.scoring_version).toBe(4)
  const expected=guidedResult(type,a.diagnostic);expect(payload.overall_score).toBe(expected.overallScore);expect(payload.overall_grade).toBe(expected.overallGrade);expect(payload.overall_score).not.toBe(body.clientReportedScore);expect(payload.overall_grade).not.toBe(body.clientReportedGrade)
  expect(payload.answers).not.toHaveProperty('contact');expect((payload.derived_metrics as Record<string,unknown>).guidedReportResult).toMatchObject({version:4,grade:expected.grade})
  expect(external).toHaveBeenCalledOnce()
 })
 it('rejects hidden answers, unknown fields, and mismatched types',()=>{
  const a=sampleGuided('health')
  expect(validateGuidedReport('tax',a)).toBeNull();expect(validateGuidedReport('health',{...a,diagnostic:{...a.diagnostic,bank_account:'not allowed'}})).toBeNull()
  expect(validateGuidedReport('health',{...a,diagnostic:{...a.diagnostic,supplement_terms:'yes'}})).toBeNull()
 })
 it('rejects invalid contacts before saving',()=>{expect(validateGuidedReport('tax',{...sampleGuided('tax'),contact:{fullName:'Single',email:'invalid',phone:''}})).toBeNull()})
 it('keeps provisional grades distinct from definitive stored grades',()=>{const a=sampleGuided('tax');a.diagnostic.records_ready='unknown';const r=guidedResult('tax',a.diagnostic);expect(r.grade.provisional).toBe(true);expect(r.overallGrade).toBeNull()})
})

describe('guided boundary failures do not save or contact anyone',()=>{
 it('rejects missing consent before any RPC or external call',async()=>{
  const admin={rpc:vi.fn()} as unknown as SupabaseClient,external=vi.fn()
  const result=await ingestPublicReportCard(validIngestRequestBodyFixture({assessmentType:'tax',assessmentVersion:4,answers:sampleGuided('tax'),consent:{assessmentStorageAcknowledged:false,privacyAcknowledged:false}}),{admin,runStudentLoanDryRun:external})
  expect(result.ok).toBe(false);expect(admin.rpc).not.toHaveBeenCalled();expect(external).not.toHaveBeenCalled()
 })
})
