import {describe,it,expect} from 'vitest';
import {adaptiveReportCard} from './combined/results';
import {publicReportCards,reportCardForFocus,specializedFunnels,discoveryQuestions,discoveryPlan,validateDiscovery,discoverySummary,specializedNextSteps} from './funnelStrategy';
import {combinedQuestions,updateCombined,validateCombined,COMBINED_FORMAT,type CombinedAnswers} from './combined/engine';
function fixture(selected:CombinedAnswers['selected'],overrides={}){
 const diagnostic:CombinedAnswers['diagnostic']={...overrides};
 for(let pass=0;pass<4;pass++)for(const q of combinedQuestions(selected,diagnostic,1,1))if(diagnostic[q.id]===undefined)diagnostic[q.id]=q.question.kind==='state'?'AR':q.question.kind==='multi'?['unknown']:'unknown';
 return {format:COMBINED_FORMAT,strategyVersion:1 as const,insuranceRoutingVersion:1 as const,selected,diagnostic,locale:'en' as const,contact:{fullName:'Synthetic Visitor',email:'visitor@example.invalid',phone:'+12025550100'}};
}
export {fixture};
describe('dedicated Report Card strategy',()=>{
 it('routes prior entry links to the appropriate main card and keeps trucking off the directory',()=>{
  expect(publicReportCards.map(card=>card.id)).toEqual(['family','business','student_loan','health','home_buyer','retirement']);
  expect(reportCardForFocus('lifestyle')?.id).toBe('family');
  expect(reportCardForFocus('commercial')?.id).toBe('business');
  expect(reportCardForFocus('benefits')?.id).toBe('business');
  expect(reportCardForFocus('trucking')?.directOnly).toBe(true);
 });
 it.each([
  ['private',7,['retirement.private_accounts.status','retirement.private_options.review']],
  ['federal',7,['retirement.tsp.status','retirement.federal_benefits.review']],
  ['both',9,['retirement.private_accounts.status','retirement.private_options.review','retirement.tsp.status','retirement.federal_benefits.review']],
  ['unknown',5,[]],
 ] as const)('selects the %s retirement path from the answer', (path,count,branchIds)=>{
  expect(reportCardForFocus('tsp')).toEqual(reportCardForFocus('retirement'));
  const selected=reportCardForFocus('retirement')!.selected;
  const diagnostic: CombinedAnswers['diagnostic'] = {'retirement.path':path};
  const questions=combinedQuestions(selected,diagnostic,1,1,1);
  expect(questions).toHaveLength(count);
  expect(questions.map(q=>q.id).filter(id=>/retirement\.(private|tsp|federal)/.test(id))).toEqual(branchIds);
  for (const {id} of questions) diagnostic[id] ??= 'unknown';
  const saved=validateCombined({...fixture(selected),diagnostic,cardVersion:1})!;
  expect(saved).not.toBeNull();
  expect(specializedNextSteps(saved)[0].text.includes('TSP')).toBe(path==='federal'||path==='both');
  if (path==='both') {
   const switched=updateCombined(selected,diagnostic,'retirement.path','private',1,1,1);
   expect(switched['retirement.tsp.status']).toBeUndefined();
   expect(switched['retirement.private_options.review']).toBe('unknown');
  }
 });
 it.each(['family','business'])('%s has a versioned overall grade and a score for each applicable area',id=>{
  const selected=reportCardForFocus(id)!.selected;
  const diagnostic: CombinedAnswers['diagnostic'] = id==='business' ? {'benefits.workforce':'none'} : {'family.housing':'rent'};
  const questions=combinedQuestions(selected,diagnostic,1,1,1);
  expect(questions.length).toBeLessThanOrEqual(22);
  expect(new Set(questions.map(q=>q.id)).size).toBe(questions.length);
  for(const {id,question} of questions) if(diagnostic[id]===undefined) {
   diagnostic[id]=question.options?.some(option=>option.value==='current')?'current':question.kind==='multi'?['unknown']:'unknown';
  }
  const saved=validateCombined({...fixture(selected),diagnostic,cardVersion:1})!;
  expect(saved).not.toBeNull();
  const result=adaptiveReportCard(saved)!;
  expect(result.overall.grade).toBe('A');
  expect(result.categories).toHaveLength(id==='family'?5:4);
  for (const category of result.categories) expect(category.rating.code).toBe(category.type==='benefits'?'NA':'A');
  const partial = Object.fromEntries(Object.entries(diagnostic).map(([key,value])=>[key,value==='current'?'partial':value]));
  expect(adaptiveReportCard({...saved,diagnostic:partial})?.overall).toMatchObject({score:50,grade:'D'});
 });
 it('assigns a preliminary grade from a single known readiness check',()=>{
  const a=fixture(['student_loan'],{'student_loan.status':'current'});
  expect(adaptiveReportCard(a)!.categories[0].grade).toBe('A');
 });
 it('does not re-ask loan questions or suggest loan opportunities after no current loans',()=>{
  const a=fixture(['student_loan'],{'student_loan.loan_type':'none'}),plan=discoveryPlan('family',a);
  expect(plan.questions.some(q=>q.id.startsWith('student_loan.'))).toBe(false);
  expect(discoverySummary('family',plan.seed).opportunities.some(o=>o.service==='student_loan')).toBe(false);
 });
 it.each(specializedFunnels.filter(card => card.id !== 'family' && card.id !== 'business'))('$id has 5–10 valid, unique questions',f=>{
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
