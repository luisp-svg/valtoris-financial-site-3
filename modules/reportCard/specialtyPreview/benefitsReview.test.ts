import { describe, expect, it } from 'vitest'
import { type Answers, SPECIALTY_CARDS } from './catalog'
import { error, report, update, visibleQuestions } from './engine'
import { gradeReport } from './grading'
import { GUIDED_REPORT_FORMAT, validateGuidedReport } from './submission'

function completed(): Answers {
 const answers: Answers = {purpose:'costs',employees:'20',fulltime:'15',covered:'12'}
 for(const q of visibleQuestions('benefits',answers))if(answers[q.id]===undefined)answers[q.id]=q.kind==='number'?'100':q.kind==='multi'?[q.options![0][0]]:q.options![0][0]
 return answers
}
describe('employer benefits review',()=>{
 it('collects implementation details only for employers with staff',()=>{
  const ids=visibleQuestions('benefits',{purpose:'costs',employees:'20'}).map(q=>q.id)
  expect(ids).toEqual(expect.arrayContaining(['fulltime','covered','work_state','contribution','renewal','payroll_provider','payroll_frequency','decision_role','records_ready','review_timing']))
  const cleared=update('benefits',completed(),'employees','0')
  expect(Object.keys(cleared).sort()).toEqual(['employees','purpose'])
  expect(gradeReport('benefits',cleared).notApplicable).toBe(true)
 })
 it('keeps potential partner fit separate from preparation grades',()=>{
  const answers=completed()
  expect(report('benefits',answers).pathways.map(p=>p.id)).toContain('dcbg')
  const smaller={...answers,employees:'4',fulltime:'4',covered:'4',contribution:'0'}
  expect(report('benefits',smaller).pathways.map(p=>p.id)).not.toContain('dcbg')
  expect(gradeReport('benefits',smaller).score).toBe(gradeReport('benefits',answers).score)
  expect(gradeReport('benefits',{...answers,payroll_provider:'unknown'}).provisional).toBe(true)
 })
 it('validates the complete employer review for the existing save flow',()=>{
  const diagnostic=completed()
  expect(error('benefits',diagnostic)).toBeNull()
  expect(validateGuidedReport('benefits',{format:GUIDED_REPORT_FORMAT,assessmentType:'benefits',diagnostic,contact:{fullName:'Example Reviewer',email:'review@example.com',phone:''},locale:'en'})).not.toBeNull()
  expect(error('benefits',{...diagnostic,covered:'16'})).toBe('coverage_counts')
 })
 it('has bilingual copy for new questions without collecting individual employee data',()=>{
  const questions=SPECIALTY_CARDS.benefits.questions
  expect(new Set(questions.map(q=>q.id)).size).toBe(questions.length)
  for(const q of questions){expect(q.label.en.length).toBeGreaterThan(0);expect(q.label.es.length).toBeGreaterThan(0)}
  expect(questions.map(q=>q.id)).not.toContain('employee_names')
 })
})
