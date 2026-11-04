import assert from 'node:assert/strict'
import type { VercelRequest,VercelResponse } from '@vercel/node'
import { premiumAssessmentHttp } from './http.js'
import { combinedFixture } from './testFixtures.js'
import { COMBINED_VERSION,PRIORITIES,primaryAssessment,combinedQuestions,pruneCombined, type Priority } from '../../modules/reportCard/combined/engine.js'
import { validIngestRequestBodyFixture,fullConsentSnapshotFixture } from '../ingest/familyReportCard/testFixtures.js'
import { _resetRateLimitStateForTests } from '../ingest/familyReportCard/abuse.js'
import { mapPublicFamilyDiagnosticDetail } from '../../crm/households/assessments/diagnosticFormatters.js'
import { LocalTacSandbox } from './localSandbox.js'
export async function runLocalJourney(sandbox:LocalTacSandbox,selected:Priority[],label:string,existing=false,locale:'en'|'es'='en',testPhone?:string){
 _resetRateLimitStateForTests()
 const answers=combinedFixture(selected);answers.locale=locale;answers.contact={fullName:'QA '+label.replace(/[^a-z0-9]/gi,' '),email:label.toLowerCase().replace(/[^a-z0-9]/g,'-')+'@example.invalid',phone:testPhone??'+1202555'+String(100+PRIORITIES.findIndex(p=>p.id===selected[0])*3+(label.includes('existing')?1:label.includes('combined')?2:0)).padStart(4,'0')}
 if(selected.includes('benefits')){
  answers.diagnostic['benefits.purpose']='costs';answers.diagnostic['benefits.employees']='10';answers.diagnostic['benefits.fulltime']='8';answers.diagnostic['benefits.covered']='6'
  for(let pass=0;pass<5;pass++)for(const q of combinedQuestions(selected,answers.diagnostic,answers.insuranceRoutingVersion))if(answers.diagnostic[q.id]===undefined)answers.diagnostic[q.id]='unknown'
  answers.diagnostic=pruneCombined(selected,answers.diagnostic,answers.insuranceRoutingVersion)
 }
 if(existing)await sandbox.seedContact(answers)
 const before=await sandbox.audit(),deps=sandbox.deps('local-qa-only-signing-key-at-least-thirty-two-characters')
 let id='',cookie=''
 async function call(action:string,body?:unknown){
  const result={status:200,body:{} as Record<string,unknown>,headers:{} as Record<string,string>}
  const response={setHeader:(k:string,v:string)=>{result.headers[k]=v},status:(code:number)=>{result.status=code;return response},json:(value:Record<string,unknown>)=>{result.body=value;return response}}
  await premiumAssessmentHttp({method:action==='report'?'GET':'POST',query:{flow:'premium',action,assessment:id,lang:locale},headers:{host:'localhost:5173',origin:'http://localhost:5173',cookie,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},body} as unknown as VercelRequest,response as unknown as VercelResponse,deps)
  return result
 }
 const start=await call('start');assert.equal(start.status,200);id=String(start.body.submissionId);cookie=start.headers['Set-Cookie'].split(';')[0]
 const body=validIngestRequestBodyFixture({submissionId:id,assessmentType:primaryAssessment(selected),assessmentVersion:COMBINED_VERSION,answers,submittedAt:new Date().toISOString(),consent:fullConsentSnapshotFixture({contactPermission:false,consentedAt:new Date().toISOString()})})
 const saved=await call('save',body);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal((await call('save',body)).status,200)
 assert.equal((await call('report')).status,423)
 await sandbox.followUp(id);await sandbox.followUp(id)
 await sandbox.setBooking(id);await sandbox.setBooking(id);const tacBooking=await sandbox.db.query<{status:string;external_event_id:string}>("SELECT status,external_event_id FROM local_tac_booking_requests WHERE assessment_id=$1",[id]);assert.equal(tacBooking.rows.length,1);assert.equal(tacBooking.rows[0].status,'confirmed');assert.ok(tacBooking.rows[0].external_event_id);const unlocked=await call('report');assert.equal(unlocked.status,200,JSON.stringify(unlocked.body));assert.equal((unlocked.body.results as unknown[]).length,selected.length)
 const stored=(await sandbox.load(id))!
 const detail=mapPublicFamilyDiagnosticDetail({id:stored.id,assessment_type:primaryAssessment(selected),capture_channel:'public_self_report',status:'completed',completed_at:stored.submittedAt,answers:stored.answers,derived_metrics:stored.derived,scoring_version:COMBINED_VERSION,overall_score:null,overall_grade:null},'local-household',null)
 assert.equal(detail?.combinedReports?.length,selected.length);assert.ok(detail?.bookingVerifiedAt)
 const after=await sandbox.audit();assert.equal(after.counts.local_tac_booking_requests-before.counts.local_tac_booking_requests,1);assert.equal(after.counts.local_bookings-before.counts.local_bookings,1);assert.equal(after.counts.local_submissions-before.counts.local_submissions,1);assert.equal(after.counts.local_opportunities-before.counts.local_opportunities,1);assert.equal(after.counts.local_tasks-before.counts.local_tasks,1);assert.equal(after.counts.local_contacts-before.counts.local_contacts,existing?0:1)
 await sandbox.setBooking(id,'cancelled');assert.equal((await call('report')).status,423);await sandbox.setBooking(id,'confirmed');assert.equal((await call('report')).status,200)
 return {id,selected,locale,existingContact:existing,passed:true,contactCount:1,opportunityCount:1,internalTaskCount:1,emails:0,texts:0,campaignEnrollments:0,bookingGate:true,cancellationRelocks:true,tacVerified:true}
}
