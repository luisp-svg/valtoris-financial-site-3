import { describe,expect,it } from 'vitest'
import { gradeReport,letterGrade } from './grading'
import { SPECIALTY_CARDS,Specialty,Answers } from './catalog'
import { visibleQuestions } from './engine'
function complete(type:Specialty){const a:Answers={};for(let i=0;i<4;i++)for(const q of visibleQuestions(type,a))if(!a[q.id])a[q.id]=q.kind==='number'?'10':q.kind==='multi'?[q.options![0][0]]:q.options![0][0];return a}
describe('transparent Report Card draft grades',()=>{
 it.each(Object.keys(SPECIALTY_CARDS) as Specialty[])('%s has a grade after a complete review',type=>{const r=gradeReport(type,complete(type));expect(r.letter).toMatch(/^[ABCDF]$/);expect(r.provisional).toBe(false);expect(r.measures.length).toBeGreaterThan(0)})
 it('does not turn all unknowns into an F',()=>{const a=Object.fromEntries(SPECIALTY_CARDS.health.questions.map(q=>[q.id,'unknown']));const r=gradeReport('health',a);expect(r.score).toBeNull();expect(r.letter).toBeNull();expect(r.provisional).toBe(true)})
 it('shows partial evidence as preliminary without zero-filling',()=>{const r=gradeReport('tax',{support:'planning',payments_review:'unknown',records_ready:'yes'});expect(r.score).toBe(100);expect(r.provisional).toBe(true)})
 it('does not grade income, tax amounts, or partner routing',()=>{const a=complete('tax');expect(gradeReport('tax',{...a,personal:'0',business:'1000000',w2_income:'600plus',revenue:'600plus'}).score).toBe(gradeReport('tax',{...a,personal:'1000000',business:'0',w2_income:'under150',revenue:'under150'}).score)})
 it('does not punish hidden health questions',()=>{const r=gradeReport('health',{purpose:'individual',coverage:'none'});expect(r.measures.map(m=>m.id)).toEqual(['coverage']);expect(r.score).toBe(0);expect(r.provisional).toBe(false)})
 it('marks employer benefits as inapplicable for zero employees',()=>{const r=gradeReport('benefits',{employees:'0'});expect(r.notApplicable).toBe(true);expect(r.letter).toBeNull()})
 it('uses declared grade boundaries consistently',()=>{expect([100,90,89,80,79,70,69,60,59,0].map(letterGrade)).toEqual(['A','A','B','B','C','C','D','D','F','F'])})
})

describe('health routes and fair exclusions',()=>{
 it('does not penalize no regular prescriptions or no provider preference',()=>{
 const r=gradeReport('health',{purpose:'individual',coverage:'all',afford:'comfortable',cost_understanding:'yes',access:'na',prescriptions:'na'})
 expect(r.score).toBe(100);expect(r.provisional).toBe(false);expect(r.measures.map(m=>m.id)).not.toContain('prescriptions')
 })
 it('grades supplemental preparation separately from major-medical coverage',()=>{
 const r=gradeReport('health',{purpose:'supplemental',coverage:'none',supplement_review:'yes',supplement_terms:'yes',supplement_budget:'yes'})
 expect(r.score).toBe(100);expect(r.measures.map(m=>m.id)).not.toContain('coverage')
 })
})
