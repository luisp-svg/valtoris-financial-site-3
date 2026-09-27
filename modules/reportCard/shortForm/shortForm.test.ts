import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SHORT_CARDS, SHORT_FORM_FORMAT } from './catalog'
import { validateShortAnswers, updateShortAnswer, visibleQuestions, type ShortAnswers } from './contract'
import { buildShortResult, readShortResult } from './results'
import type { PublicReportCardAssessmentType } from '../publicIngestCatalog'
import { validIngestRequestBodyFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'
import { ingestFamilyReportCard } from '../../../server/ingest/familyReportCard/ingestFamilyReportCard'
import { mapPublicFamilyDiagnosticDetail } from '../../../crm/households/assessments/diagnosticFormatters'

const types=Object.keys(SHORT_CARDS) as PublicReportCardAssessmentType[]
function answers(type:PublicReportCardAssessmentType):ShortAnswers {
  return {format:SHORT_FORM_FORMAT,assessmentType:type,contact:{fullName:'QA Rivera',email:'qa@example.invalid',phone:''},diagnostic:Object.fromEntries(SHORT_CARDS[type].questions.map(q=>[q.id,q.kind==='multi'?['unknown']:q.options && !q.options.some(o=>o.value==='unknown') ? q.options[q.options.length-1].value : 'unknown']))}
}
describe('versioned short reviews',()=>{
  it.each(types)('%s stays within fifteen fields and preserves explicit unknowns',type=>{
    const a=answers(type)
    expect(SHORT_CARDS[type].questions.length+3).toBeLessThanOrEqual(15)
    expect(validateShortAnswers(type,a)).toEqual(a)
    expect(buildShortResult(type,a.diagnostic)).toMatchObject({version:3,overallScore:null,overallGrade:null,metrics:[]})
    for(const q of SHORT_CARDS[type].questions){ expect(q.label.en).toBeTruthy();expect(q.label.es).toBeTruthy() }
    const body=validIngestRequestBodyFixture({assessmentType:type,assessmentVersion:3,answers:a})
    expect(validateFamilyReportCardIngestRequest(body).ok).toBe(true)
    expect(validateFamilyReportCardIngestRequest({...body,assessmentVersion:1}).ok).toBe(false)
    expect(validateFamilyReportCardIngestRequest({...body,assessmentVersion:4}).ok).toBe(false)
    expect(validateShortAnswers(type,{...a,diagnostic:{...a.diagnostic,privateNotes:'unexpected'}})).toBeNull()
  })
  it('removes hidden answers and does not count housing twice',()=>{
    let a=answers('protection')
    a={...a,diagnostic:{...a.diagnostic,income:'100000',years:'10',debt:'5000',education:'999999',final_expenses:'15000',coverage:'200000',housing:'3000'}}
    a.diagnostic=updateShortAnswer('protection',a.diagnostic,'children','0')
    expect(a.diagnostic).not.toHaveProperty('education')
    expect(visibleQuestions('protection',a.diagnostic).length+3).toBe(13)
    expect(validateShortAnswers('protection',a)).not.toBeNull()
    expect(buildShortResult('protection',a.diagnostic).metrics.find(m=>m.id==='simple_protection_gap')?.value).toBe(820000)
    expect(buildShortResult('protection',{...a.diagnostic,income:'unknown'}).metrics).toEqual([])
  })
  it('distinguishes known zero from unknown retirement income',()=>{
    const d=answers('retirement').diagnostic
    expect(buildShortResult('retirement',{...d,spending:'4000',income:'0'}).metrics[0].value).toBe(4000)
    expect(buildShortResult('retirement',{...d,spending:'4000',income:'unknown'}).metrics).toEqual([])
    expect(validateShortAnswers('retirement',{...answers('retirement'),diagnostic:{...d,retired:'no',age:'60',target_age:'59'}})).toBeNull()
    expect(updateShortAnswer('retirement',d,'retired','yes')).not.toHaveProperty('target_age')
  })
  it('rejects contradictory selections, invalid states, and fractional people',()=>{
    const a=answers('family')
    expect(validateShortAnswers('family',{...a,diagnostic:{...a.diagnostic,dependents:'1.5'}})).toBeNull()
    expect(validateShortAnswers('family',{...a,diagnostic:{...a.diagnostic,documents:['none','unknown']}})).toBeNull()
    const p=answers('protection')
    expect(validateShortAnswers('protection',{...p,diagnostic:{...p.diagnostic,state:'not-a-state'}})).toBeNull()
  })
  it('does not change the historical family contract',()=>{
    expect(validateFamilyReportCardIngestRequest(validIngestRequestBodyFixture()).ok).toBe(true)
    expect(validateFamilyReportCardIngestRequest(validIngestRequestBodyFixture({assessmentVersion:3})).ok).toBe(false)
  })
  it.each(types)('%s persists ungraded server results and privacy-safe answers using the existing pipeline',async type=>{
    let payload:Record<string,unknown>={}
    const rpc=vi.fn(async (fn:string,args:Record<string,unknown>)=>{
      if(fn==='ingest_public_report_card') { payload=args.p_payload as Record<string,unknown>;return {data:{created:true,lead_id:'lead-1',household_id:'hh-1',member_id:'member-1',assessment_id:'assessment-1',match_status:'new_prospect',sheets_sync_status:'pending',duplicate_review_id:null},error:null} }
      return {data:null,error:null}
    })
    const writer=vi.fn().mockResolvedValue({status:'succeeded'})
    const body=validIngestRequestBodyFixture({assessmentType:type,assessmentVersion:3,answers:answers(type),clientReportedScore:100,clientReportedGrade:'A+'})
    body.consent={...(body.consent as Record<string,unknown>),contactPermission:false,emailMarketingConsent:false,smsMarketingConsent:false}
    const result=await ingestFamilyReportCard(body,{admin:{rpc} as unknown as SupabaseClient,findCandidates:async()=>[],sheetsWriter:writer,orchestrateFollowUpTask:vi.fn().mockResolvedValue({status:'not_required'})})
    expect(result.ok).toBe(true)
    expect(payload).toMatchObject({assessment_type:type,overall_score:null,overall_grade:null,scoring_version:3,idempotency_key:body.submissionId,consent_snapshot:{contactPermission:false,emailMarketingConsent:false,smsMarketingConsent:false}})
    expect(payload.answers).not.toHaveProperty('contact')
    expect(JSON.stringify(payload.answers)).not.toContain('qa@example.invalid')
    expect(writer).toHaveBeenCalledTimes(1)
    const detail=mapPublicFamilyDiagnosticDetail({...payload,id:'assessment-1',completed_at:'2026-09-26T12:00:00Z',capture_channel:'public_self_report',status:'completed'},'hh-1',null)
    expect(detail?.shortFormResult?.version).toBe(3)
    expect(detail?.submittedAnswers.length).toBe(SHORT_CARDS[type].questions.length)
    expect(JSON.stringify(detail?.submittedAnswers)).not.toContain('qa@example.invalid')
    expect(readShortResult({...detail?.shortFormResult,metrics:[{value:Infinity}]})).toBeUndefined()
  })
})
