import {describe,it,expect} from 'vitest';
import {PRIORITIES,COMBINED_FORMAT,combinedQuestions,validateCombined,pruneCombined,primaryAssessment} from './engine';
import {adaptiveReportCard} from './results';
import {combinedFixture} from '../../../server/premium/testFixtures';
describe('adaptive assessment budget and evidence',()=>{
 it('caps all 16,383 nonempty service combinations, with no duplicate IDs',()=>{
  for(let mask=1;mask<1<<PRIORITIES.length;mask++){
   const selected=PRIORITIES.filter((_,i)=>mask&(1<<i)).map(p=>p.id);
   for(const d of [{},{'health.status':'missing','student_loan.loan_type':'none'}] as import('../shortForm/contract').ShortDiagnostic[]){
    const qs=combinedQuestions(selected,d);expect(qs.length).toBeLessThanOrEqual(22);expect(new Set(qs.map(q=>q.id)).size).toBe(qs.length);
   }
  }
 });
 it('asks exactly 22 diagnostic questions (25 including contact) when all services selected and keeps every category represented',()=>{
  const selected=PRIORITIES.map(p=>p.id),qs=combinedQuestions(selected,{});expect(qs).toHaveLength(22);
  for(const type of selected)expect(qs.some(q=>q.id===type+'.status')).toBe(true);
  expect(qs.some(q=>q.id==='student_loan.loan_type')).toBe(true);expect(qs.some(q=>q.id==='health.goal')).toBe(true);
 });
 it.each(PRIORITIES)('validates $id through the same server contract',({id})=>{const a=combinedFixture([id]);expect(validateCombined(a,primaryAssessment([id]))).not.toBeNull();});
 it('rejects injected answers, malformed contact and duplicate services',()=>{const a=combinedFixture(['health']);expect(validateCombined({...a,diagnostic:{...a.diagnostic,extra:'yes'}})).toBeNull();expect(validateCombined({...a,contact:{...a.contact,fullName:12}})).toBeNull();expect(validateCombined({...a,selected:['health','health']})).toBeNull();});
 it('prunes conditional data and does not grade no-loan cases',()=>{const a=combinedFixture(['student_loan']);a.diagnostic=pruneCombined(a.selected,{...a.diagnostic,'student_loan.loan_type':'none'});expect(a.diagnostic['student_loan.status']).toBeUndefined();expect(validateCombined(a)).not.toBeNull();expect(adaptiveReportCard(a)?.categories[0].grade).toBeNull();});
 it('does not invent a grade from unknown answers',()=>{const a=combinedFixture(PRIORITIES.map(p=>p.id));const r=adaptiveReportCard(a)!;expect(r.overall.grade).toBeNull();expect(r.categories.every(c=>c.grade===null&&c.status==='needs-review')).toBe(true);});
 it('scores concrete checks and labels every grade preliminary',()=>{const a=combinedFixture(['health','student_loan']);for(const q of combinedQuestions(a.selected,a.diagnostic))if(/\.(status|review)$/.test(q.id))a.diagnostic[q.id]='current';let r=adaptiveReportCard(a)!;expect(r.overall.grade).toBe('A');expect(r.categories.every(c=>c.status==='preliminary')).toBe(true);a.diagnostic['health.status']='missing';a.diagnostic['health.review']='missing';r=adaptiveReportCard(a)!;expect(r.categories.find(c=>c.type==='health')?.grade).toBe('F');expect(r.overall.score).toBe(50);});
 it('does not grant an overall A from one known category among many',()=>{const a=combinedFixture(PRIORITIES.map(p=>p.id));a.diagnostic['health.status']='current';expect(adaptiveReportCard(a)?.overall.grade).toBeNull();});
 it('uses the new version only for new assessments',()=>expect(combinedFixture().format).toBe(COMBINED_FORMAT));
});
