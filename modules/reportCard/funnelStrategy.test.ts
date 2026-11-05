import {describe,it,expect} from 'vitest';
import {adaptiveReportCard} from './combined/results';
import {specializedFunnels,discoveryQuestions,discoveryPlan,validateDiscovery,discoverySummary} from './funnelStrategy';
import {combinedQuestions,validateCombined,COMBINED_FORMAT,type CombinedAnswers} from './combined/engine';
function fixture(selected:CombinedAnswers['selected'],overrides={}){
 const diagnostic:CombinedAnswers['diagnostic']={...overrides};
 for(let pass=0;pass<4;pass++)for(const q of combinedQuestions(selected,diagnostic,1,1))if(diagnostic[q.id]===undefined)diagnostic[q.id]=q.question.kind==='state'?'AR':q.question.kind==='multi'?['unknown']:'unknown';
 return {format:COMBINED_FORMAT,strategyVersion:1 as const,insuranceRoutingVersion:1 as const,selected,diagnostic,locale:'en' as const,contact:{fullName:'Synthetic Visitor',email:'visitor@example.invalid',phone:'+12025550100'}};
}
export {fixture};
describe('specialized-first funnel strategy',()=>{
 it('assigns a preliminary grade from a single known readiness check',()=>{
  const a=fixture(['student_loan'],{'student_loan.status':'current'});
  expect(adaptiveReportCard(a)!.categories[0].grade).toBe('A');
 });
 it('does not re-ask loan questions or suggest loan opportunities after no current loans',()=>{
  const a=fixture(['student_loan'],{'student_loan.loan_type':'none'}),plan=discoveryPlan('family',a);
  expect(plan.questions.some(q=>q.id.startsWith('student_loan.'))).toBe(false);
  expect(discoverySummary('family',plan.seed).opportunities.some(o=>o.service==='student_loan')).toBe(false);
 });
 it.each(specializedFunnels)('$id has 5–10 valid, unique questions',f=>{
  const a=fixture(f.selected),questions=combinedQuestions(f.selected,a.diagnostic,1,1);
  expect(questions.length).toBeGreaterThanOrEqual(5);expect(questions.length).toBeLessThanOrEqual(10);
  expect(new Set(questions.map(q=>q.id)).size).toBe(questions.length);expect(validateCombined(a)).not.toBeNull();
 });
 it('handles no-loan and lost-health branches within budget',()=>{
  for(const [selected,overrides] of [[['student_loan'],{'student_loan.loan_type':'none'}],[['health','protection'],{'health.status':'missing'}]] as const){
   const a=fixture([...selected],overrides);const qs=combinedQuestions(a.selected,a.diagnostic,1,1);
   const active=Object.fromEntries(qs.map(q=>[q.id,a.diagnostic[q.id]]));
   expect(qs.length).toBeGreaterThanOrEqual(5);expect(qs.length).toBeLessThanOrEqual(10);expect(validateCombined({...a,diagnostic:active})).not.toBeNull();
  }
 });
 it.each(['family','business'] as const)('%s discovery meets its budget and never asks a prior question',scope=>{
  const qs=discoveryQuestions(scope);expect(qs.length).toBeGreaterThanOrEqual(15);expect(qs.length).toBeLessThanOrEqual(20);
  for(const f of specializedFunnels){
   const a=fixture(f.selected),plan=discoveryPlan(scope,a);
   expect(plan.questions.every(q=>!(q.id in a.diagnostic))).toBe(true);
   const input=Object.fromEntries(plan.questions.map(q=>[q.id,q.question.kind==='state'?'AR':'unknown']));
   const valid=validateDiscovery(scope,a,input)!;expect(valid).not.toBeNull();
   expect(discoverySummary(scope,valid).answerRows).toHaveLength(qs.length);
   expect(validateDiscovery(scope,a,{...input,'shared.state':'TX'})).toBeNull();
   expect(discoveryPlan(scope,a,valid).questions).toHaveLength(0);
  }
 });
 it('preserves known answers and unknown answers when changing discovery scopes',()=>{
  const a=fixture(['student_loan']);const business=discoveryPlan('business',a);
  const d=validateDiscovery('business',a,Object.fromEntries(business.questions.map(q=>[q.id,q.question.kind==='state'?'AR':'unknown'])))!;
  expect(discoveryPlan('family',a,d).questions.every(q=>!(q.id in d))).toBe(true);
  expect(discoveryPlan('business',a,{...d,'shared.state':'TX'}).seed['shared.state']).toBe('AR');
 });
});
