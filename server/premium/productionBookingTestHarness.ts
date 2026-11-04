/** Synthetic controller harness. Never imported by application code. */
import {randomUUID,createHmac} from 'node:crypto'
import {vi} from 'vitest'
import type {VercelRequest,VercelResponse} from '@vercel/node'
import type {LocalTacSandbox} from './localSandbox.js'
import type {SupabaseTacBookingStore} from './tacBookingStore.js'
import {TacBookingService,type TacBookingProvider} from './tacBookingService.js'
import {refreshProductionBookingParents} from './productionBookingFixture.js'
import {combinedFixture} from './testFixtures.js'
import {COMBINED_VERSION,primaryAssessment,type Priority} from '../../modules/reportCard/combined/engine.js'
import {validIngestRequestBodyFixture,fullConsentSnapshotFixture} from '../ingest/familyReportCard/testFixtures.js'
import {premiumAssessmentHttp} from './http.js'
import {assessmentCookieName,issueAssessmentSession} from './session.js'
import {_resetRateLimitStateForTests} from '../ingest/familyReportCard/abuse.js'
const secret='production-local-test-signing-secret-at-least-32-characters'
export function productionBookingHarness(sandbox:LocalTacSandbox,store:SupabaseTacBookingStore){
 let phoneNumber=100
 async function setup(selection:Priority|Priority[]='family',existing=false,consultationOnly=false){
  _resetRateLimitStateForTests()
  const selected=Array.isArray(selection)?selection:[selection],answers=combinedFixture(selected)
  if(consultationOnly){answers.consultationOnly=true;answers.diagnostic={}}
  answers.contact={fullName:'Valtoris QA Visitor',email:randomUUID()+'@example.invalid',phone:'+1202555'+String(phoneNumber++).padStart(4,'0')}
  const issued=issueAssessmentSession(secret),contacts=new Map<string,string>(),events=new Map<string,string>()
  const start=new Date(Date.now()+3*86400000);start.setUTCMinutes(0,0,0)
  if(existing)contacts.set(answers.contact.email,'existing'+randomUUID().replace(/-/g,''))
  let cancelled=false
  const provider:TacBookingProvider={locationId:'qaLocation',calendar:()=> 'qaCalendar',assertAllowed:()=>{},assertSilent:vi.fn(async()=>{}),slots:vi.fn(async()=>[start.toISOString()]),
   findContacts:vi.fn(async b=>contacts.has(b.email)?[contacts.get(b.email)!]:[]),verifyContact:vi.fn(async()=>{}),
   createContact:vi.fn(async b=>{if(!(await store.load(b.submission_id))?.appointment_id)throw new Error('TAC not saved first');const value='contact'+randomUUID().replace(/-/g,'');contacts.set(b.email,value);return value}),
   findEvents:vi.fn(async b=>events.has(b.id)?[events.get(b.id)!]:[]),verifyEvent:vi.fn(async()=>cancelled?'cancelled':'confirmed'),
   createEvent:vi.fn(async b=>{const row=(await sandbox.db.query<{agentcrm_sync_status:string}>('SELECT agentcrm_sync_status FROM appointments WHERE id=$1',[b.appointment_id])).rows[0];if(row.agentcrm_sync_status!=='pending')throw new Error('Pending TAC appointment missing');const value='event'+randomUUID().replace(/-/g,'');events.set(b.id,value);return value})}
  const service=new TacBookingService(store,provider),deps=sandbox.deps(secret),ingest=deps.ingest!
  deps.env={...deps.env,VALTORIS_TAC_BOOKING_ENABLED:'true'};deps.booking=service
  deps.ingest=async(...args)=>{const result=await ingest(...args);await refreshProductionBookingParents(sandbox);return result}
  async function request(action:string,body?:unknown,overrides:Record<string,unknown>={}){
   const result={status:0,body:{} as Record<string,unknown>},res={setHeader:()=>{},status:(code:number)=>{result.status=code;return res},json:(body:Record<string,unknown>)=>{result.body=body;return res}}
   const payload=Buffer.from(JSON.stringify({id:issued.session.id,expires:Date.now()+86400000})).toString('base64url'),mac=createHmac('sha256',secret).update(`valtoris-assessment-v1:${payload}`).digest('base64url')
   await premiumAssessmentHttp({method:['book','save'].includes(action)?'POST':'GET',query:{action,assessment:issued.session.id,day:start.toISOString().slice(0,10),timezone:'UTC'},headers:{host:'localhost:5173',origin:'http://localhost:5173',cookie:`${assessmentCookieName(issued.session.id)}=${payload}.${mac}`,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},body,...overrides} as unknown as VercelRequest,res as unknown as VercelResponse,deps)
   return result
  }
  const body=validIngestRequestBodyFixture({submissionId:issued.session.id,assessmentType:primaryAssessment(selected),assessmentVersion:COMBINED_VERSION,answers,submittedAt:new Date().toISOString(),consent:fullConsentSnapshotFixture({contactPermission:false,consentedAt:new Date().toISOString()})})
  const savedResult=await request('save',body);if(savedResult.status!==200)throw new Error('Synthetic assessment save failed')
  const saved=(await sandbox.load(issued.session.id))!
  return {journey:{id:issued.session.id},saved,provider,service,start:start.toISOString(),contacts,events,request,body,cancel:()=>{cancelled=true}}
 }
 return {setup}
}
export const call=(fixture:Awaited<ReturnType<ReturnType<typeof productionBookingHarness>['setup']>>,action:string,body?:unknown,overrides:Record<string,unknown>={})=>fixture.request(action,body,overrides)
