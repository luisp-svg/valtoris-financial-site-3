import {beforeEach,describe,it,expect,vi} from 'vitest';
import type {VercelRequest,VercelResponse} from '@vercel/node';
import {premiumAssessmentHttp,type SavedAssessment} from './http';
import {issueAssessmentSession,assessmentCookieName} from './session';
import {combinedQuestions,COMBINED_FORMAT} from '../../modules/reportCard/combined/engine';
import {combinedResults} from '../../modules/reportCard/combined/results';
import {discoveryPlan} from '../../modules/reportCard/funnelStrategy';
import {_resetRateLimitStateForTests} from '../ingest/familyReportCard/abuse';
const secret='synthetic-local-only-secret-longer-than-32-characters',now=Date.parse('2026-10-29T12:00:00Z');
function setup(){
 const issued=issueAssessmentSession(secret,now),diagnostic:Record<string,string>={};
 for(const q of combinedQuestions(['student_loan'],{},1,1))diagnostic[q.id]=q.question.kind==='state'?'AR':'unknown';
 const answers={format:COMBINED_FORMAT,strategyVersion:1 as const,insuranceRoutingVersion:1 as const,selected:['student_loan' as const],diagnostic,locale:'en' as const,contact:{fullName:'Synthetic Visitor',email:'visitor@example.invalid',phone:'+12025550100'}};
 const saved:SavedAssessment={id:'original-assessment',updatedAt:new Date(now).toISOString(),submittedAt:new Date(now).toISOString(),answers,derived:{combinedReportResults:combinedResults(answers),bookingVerification:{retained:true}}};
 const deps={env:{VALTORIS_PREMIUM_ENABLED:'true',VALTORIS_ASSESSMENT_SESSION_SECRET:secret},now:()=>now,load:vi.fn(async()=>saved),saveProof:vi.fn(async()=>true),saveDiscovery:vi.fn(async(_s:SavedAssessment,d:Record<string,unknown>)=>{saved.derived={...saved.derived,comprehensiveDiscovery:d};return true}),verifyBooking:vi.fn(async()=>null),ingest:vi.fn()};
 async function request(action:string,body:Record<string,unknown>={},cookie=true){
  const state={status:200,body:{} as any};const res={setHeader:vi.fn(),status(n:number){state.status=n;return res},json(b:unknown){state.body=b;return res}};
  const post=action==='save-discovery'||action==='book';
  await premiumAssessmentHttp({method:post?'POST':'GET',query:{action,assessment:issued.session.id,scope:'business'},body:{submissionId:issued.session.id,...body},headers:{host:'localhost',origin:'http://localhost','content-type':'application/json',cookie:cookie?`${assessmentCookieName(issued.session.id)}=${issued.token}`:''}} as unknown as VercelRequest,res as unknown as VercelResponse,deps);
  return state;
 }
 return {saved,deps,request};
}
beforeEach(()=>_resetRateLimitStateForTests());
describe('two-stage authenticated workflow',()=>{
 it('provides results immediately without booking or provider availability',async()=>{
  const {request,deps}=setup();const r=await request('report');expect(r.status).toBe(200);expect(r.body.results).toHaveLength(1);expect(deps.verifyBooking).not.toHaveBeenCalled();expect(deps.saveProof).not.toHaveBeenCalled();
 });
 it('recomputes final ratings for saved results from before the rating panel existed',async()=>{
  const {request,saved}=setup();saved.derived.combinedReportResults=[{type:'student_loan',title:'Old saved result',kind:'adaptive',result:{grade:null}}];
  const result=await request('report');expect(result.status).toBe(200);expect(result.body.results[0].result.rating.code).toBe('PENDING');
 });
 it('saves both stages on the original record, retains booking and does not re-ingest',async()=>{
  const {request,deps,saved}=setup();const plan=discoveryPlan('business',saved.answers);
  const diagnostic=Object.fromEntries(plan.questions.map(q=>[q.id,q.question.kind==='state'?'AR':'unknown']));
  const result=await request('save-discovery',{scope:'business',diagnostic});expect(result.status).toBe(200);
  expect(deps.saveDiscovery).toHaveBeenCalledTimes(1);expect(deps.saveDiscovery.mock.calls[0][0].id).toBe('original-assessment');
  expect(saved.derived.bookingVerification).toEqual({retained:true});expect(deps.ingest).not.toHaveBeenCalled();
  expect((await request('discovery')).body.questions).toHaveLength(0);
  expect((await request('save-discovery',{scope:'business',diagnostic:{}})).status).toBe(200);expect(deps.saveDiscovery).toHaveBeenCalledTimes(1);
 });
 it('rejects unauthorized reads and attempts to overwrite prior answers',async()=>{
  const {request,deps}=setup();expect((await request('discovery',{},false)).status).toBe(401);
  expect((await request('save-discovery',{scope:'family',diagnostic:{'shared.state':'TX'}})).status).toBe(400);expect(deps.saveDiscovery).not.toHaveBeenCalled();
 });
 it('reports a concurrent edit without claiming a save',async()=>{
  const {request,deps,saved}=setup();deps.saveDiscovery.mockResolvedValue(false);
  const diagnostic=Object.fromEntries(discoveryPlan('business',saved.answers).questions.map(q=>[q.id,q.question.kind==='state'?'AR':'unknown']));
  expect((await request('save-discovery',{scope:'business',diagnostic})).status).toBe(409);
 });
});

describe('new strategy booking confirmation handoff',()=>{
 it.each(['confirmed','pending','conflict'] as const)('persists verified booking proof safely: %s',async state=>{
  const {request,deps,saved}=setup();Object.assign(deps.env,{VALTORIS_TAC_BOOKING_ENABLED:'true'});
  const proof={eventId:'syntheticEvent',contactId:'syntheticContact',calendarId:'syntheticCalendar',startTime:'2026-11-02T15:00:00Z',verifiedAt:'2026-10-29T12:00:00Z'};
  const booking={book:vi.fn(async()=>({state:'confirmed' as const,startTime:proof.startTime})),verify:vi.fn(async()=>state==='pending'?null:proof)};
  Object.assign(deps,{booking});deps.saveProof.mockResolvedValue(state!=='conflict');
  const response=await request('book',{startTime:proof.startTime,timezone:'UTC'});
  expect(response.status).toBe(state==='pending'?202:state==='conflict'?409:200);
  expect(booking.verify).toHaveBeenCalledTimes(1);expect(deps.ingest).not.toHaveBeenCalled();
  if(state==='pending')expect(deps.saveProof).not.toHaveBeenCalled();
  else expect(deps.saveProof).toHaveBeenCalledWith(saved,proof);
 });
});
