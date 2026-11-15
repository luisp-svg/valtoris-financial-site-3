import {describe,it,expect} from 'vitest';
import {familyAreas,businessAreas} from './cardProfiles';
import {combinedQuestions,updateCombined,validateCombined,combinedAnswerRows} from './engine';
import {adaptiveReportCard,combinedResults} from './results';
import {sampleReportAnswers} from './samples';
import {flagshipQuestions,flagshipSummary} from './flagship';

describe('flagship questionnaires and reports',()=>{
 for(const [profile,areas] of [['family',familyAreas],['business',businessAreas]] as const) {
  it(`${profile}: completes and restores the versioned questions in both languages`,()=>{
   for(const locale of ['en','es'] as const){
    const a=sampleReportAnswers([...areas],locale,1,1);
    expect(validateCombined(a)).not.toBeNull();
    expect(combinedAnswerRows(a,locale)).toHaveLength(Object.keys(a.diagnostic).length);
    const qs=combinedQuestions(areas,a.diagnostic,1,1,1,undefined,1,1);
    expect(new Set(qs.map(q=>q.id)).size).toBe(qs.length);
    expect(qs.every(q=>q.section?.[locale]&&q.question.label[locale])).toBe(true);
    const r=adaptiveReportCard(a)!;
    expect(r.flagship?.profile).toBe(profile);
    expect(r.flagship?.priorities).toHaveLength(3);
    expect(r.flagship?.priorities.every(f=>f.action&&f.professional&&f.reason&&f.answer)).toBe(true);
   }
  });
 }
 it('keeps optional calculations out of the default family journey and prunes them after opting out',()=>{
  let d={'family.calculate':'yes','family.dependents':'children','family.housing':'own'};
  expect(flagshipQuestions('family',d).some(q=>q.id==='family.annual_support')).toBe(true);
  const next=updateCombined(familyAreas,{...d,'family.annual_support':'60000'},'family.calculate','no',1,1,1,1,1,1);
  expect(next['family.annual_support']).toBeUndefined();
  expect(flagshipQuestions('family',{'family.dependents':'self','family.calculate':'yes'}).some(q=>q.id==='family.annual_support')).toBe(false);
  const a=sampleReportAnswers(familyAreas,'en',1,1);
  a.diagnostic=updateCombined(familyAreas,a.diagnostic,'family.calculate','no',1,1,1,1,1,1);
  expect(combinedResults(a).some(r=>r.kind==='protection-estimate')).toBe(false);
 });
 it('skips employee, funding and multi-owner questions when inapplicable',()=>{
  const ids=flagshipQuestions('business',{'benefits.workforce':'none','business.owners':'sole','business.funding.purpose':'none'}).map(q=>q.id);
  expect(ids).not.toContain('benefits.review');expect(ids).not.toContain('business.buy_sell.review');expect(ids).not.toContain('business.funding.documents.review');
  const all=flagshipQuestions('business',{'benefits.workforce':'medium','business.owners':'multiple','business.funding.purpose':'growth'}).map(q=>q.id);
  expect(all).toContain('benefits.review');expect(all).toContain('business.buy_sell_funding.review');expect(all).toContain('business.funding.documents.review');
 });
 it('keeps private and unknown answers distinct without treating them as failed practices',()=>{
  const a=sampleReportAnswers(familyAreas,'en',1,1);
  for(const q of flagshipQuestions('family',a.diagnostic)) if(q.action)a.diagnostic[q.id]='discuss';
  a.diagnostic['family.cashflow.status']='current';a.diagnostic['family.reserves.review']='unknown';
  const r=adaptiveReportCard(a)!;
  expect(r.overall.score).toBe(100);
  expect(r.flagship?.known).toBe(1);
  expect(r.flagship?.findings.some(f=>f.state==='private')).toBe(true);
  expect(r.flagship?.findings.some(f=>f.state==='unknown')).toBe(true);
 });
 it('ties an actionable priority to the reported issue and keeps its evidence visible',()=>{
  const d=sampleReportAnswers(businessAreas,'en',1,1).diagnostic;
  for(const q of flagshipQuestions('business',d))if(q.action)d[q.id]='current';
  d['business.continuity.review']='missing';d['flagship.priority']='continuity';
  const report=flagshipSummary('business',d,'en');
  expect(report.priorities[0]).toMatchObject({id:'business.continuity.review',state:'attention'});
  expect(report.priorities[0].action).toContain('authorize payments');
 });
 it('leaves saved pre-flagship questionnaires and grades unchanged',()=>{
  const a=sampleReportAnswers(familyAreas,'en',1);
  expect(validateCombined(a)).not.toBeNull();expect(adaptiveReportCard(a)?.flagship).toBeNull();
  expect(combinedQuestions(a.selected,a.diagnostic,1,1,1,undefined,1).some(q=>q.id==='flagship.priority')).toBe(false);
  expect(validateCombined({...a,flagshipVersion:2})).toBeNull();
  expect(validateCombined({...sampleReportAnswers(['credit'],'en'),flagshipVersion:1})).toBeNull();
 });
});
