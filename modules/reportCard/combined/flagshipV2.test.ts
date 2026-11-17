import {expect,it} from 'vitest';
import {sampleReportAnswers} from './samples';
import {familyAreas,businessAreas} from './cardProfiles';
import {combinedQuestions,updateCombined,validateCombined,restoreStoredCombined} from './engine';
import {flagshipQuestions} from './flagship';
import {adaptiveReportCard} from './results';

for(const [profile,areas] of [['family',familyAreas],['business',businessAreas]] as const){
 it(`${profile}: validates V2 in both languages and preserves optional-phone saved answers`,()=>{
  for(const locale of ['en','es'] as const){
   const a=sampleReportAnswers(areas,locale,1,2);a.contact.phone='';
   expect(validateCombined(a)).not.toBeNull();
   expect(restoreStoredCombined(a)?.flagshipVersion).toBe(2);
   expect(adaptiveReportCard(a)?.flagship?.profile).toBe(profile);
   expect(validateCombined({...a,contact:{...a.contact,phone:'invalid'}})).toBeNull();
  }
 });
 it(`${profile}: suppresses a high grade on sparse evidence without treating private answers as failures`,()=>{
  const a=sampleReportAnswers(areas,'en',1,2),qs=flagshipQuestions(profile,a.diagnostic,2).filter(q=>q.action);
  qs.forEach(q=>a.diagnostic[q.id]='discuss');a.diagnostic[qs[0].id]='current';
  const r=adaptiveReportCard(a)!;
  expect(r.overall).toMatchObject({score:null,grade:null});
  expect(r.rating).toMatchObject({code:'PENDING',known:1});
  expect(r.flagship?.findings.filter(f=>f.state==='attention')).toHaveLength(0);
  qs.forEach(q=>a.diagnostic[q.id]='current');
  expect(adaptiveReportCard(a)?.overall).toMatchObject({score:100,grade:'A'});
 });
 it(`${profile}: uses the 80% boundary and a minimum of five substantive answers`,()=>{
  const a=sampleReportAnswers(areas,'en',1,2),qs=flagshipQuestions(profile,a.diagnostic,2).filter(q=>q.action);
  const required=Math.max(5,Math.ceil(qs.length*.8));
  qs.forEach((q,i)=>a.diagnostic[q.id]=i<required-1?'current':'unknown');
  expect(adaptiveReportCard(a)?.overall.grade).toBeNull();
  a.diagnostic[qs[required-1].id]='current';
  expect(adaptiveReportCard(a)?.overall.grade).toBe('A');
  qs.forEach((q,i)=>a.diagnostic[q.id]=i<4?'current':'not_applicable');
  expect(adaptiveReportCard(a)?.overall.grade).toBeNull();
 });
}
it('adds equity follow-ups only when relevant and prunes them after the compensation changes',()=>{
 const a=sampleReportAnswers(familyAreas,'en',1,2);
 a.diagnostic['family.compensation']=['salary','equity'];
 expect(combinedQuestions(familyAreas,a.diagnostic,1,1,1,undefined,1,2).some(q=>q.id==='family.equity.review')).toBe(true);
 a.diagnostic['family.equity.review']='unknown';
 const d=updateCombined(familyAreas,a.diagnostic,'family.compensation',['salary'],1,1,1,undefined,1,2);
 expect(d['family.equity.review']).toBeUndefined();
});
it('keeps version-one question wording and phone validation intact',()=>{
 const old=sampleReportAnswers(familyAreas,'en',1,1);
 expect(flagshipQuestions('family',old.diagnostic,1).some(q=>q.id==='family.compensation')).toBe(false);
 expect(validateCombined({...old,contact:{...old.contact,phone:''}})).toBeNull();
 expect(validateCombined(old)).not.toBeNull();
});
it('makes owner absence and household dependency visible without pretending the grade measures financial adequacy',()=>{
 const a=sampleReportAnswers(businessAreas,'en',1,2);
 a.diagnostic['business.dependency']='high';a.diagnostic['business.household_dependency']='under3';a.diagnostic['flagship.review_recency']='changed';
 const r=adaptiveReportCard(a)!;
 expect(r.flagship?.observations.join(' ')).toContain('payroll');
 expect(r.flagship?.observations.join(' ')).toContain('household');
 expect(r.flagship?.observations.join(' ')).toContain('change');
 expect(flagshipQuestions('business',a.diagnostic,2).find(q=>q.id==='business.continuity.review')?.question.label.en).toContain('30-day');
});
