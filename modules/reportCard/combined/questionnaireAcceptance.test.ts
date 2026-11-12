import { describe, expect, it } from 'vitest'
import { familyAreas, businessAreas } from './cardProfiles'
import { sampleReportAnswers } from './samples'
import { combinedQuestions, pruneCombined, validCombinedQuestion, validateCombined, type Priority } from './engine'
import type { ShortDiagnostic } from '../shortForm/contract'
function complete(areas: Priority[], overrides:ShortDiagnostic, locale:'en'|'es') {
 const sample=sampleReportAnswers(areas,locale,1)
 let diagnostic={...sample.diagnostic,...overrides}
 for(let pass=0;pass<5;pass++){
  diagnostic=pruneCombined(areas,diagnostic,1,1,1,undefined,1)
  for(const item of combinedQuestions(areas,diagnostic,1,1,1,undefined,1)){
   if(validCombinedQuestion(item,diagnostic[item.id]))continue
   diagnostic[item.id]=item.question.kind==='state'?'TX':item.question.kind==='multi'?['unknown']:item.question.kind==='number'?'unknown':item.question.options?.find(option=>option.value==='unknown')?.value??item.question.options?.[0]?.value??'unknown'
  }
 }
 return {...sample,diagnostic}
}
describe('complete questionnaire branches without a real submission',()=>{
 for(const locale of ['en','es'] as const)for(const coverage of ['all','some','none'])for(const loans of ['yes','no','unknown']){
  it(`validates Family ${coverage} coverage / ${loans} loans in ${locale}`,()=>{
   const answers=complete(familyAreas,{'family_health.coverage':coverage,'family_loans.has_loans':loans},locale)
   const questions=combinedQuestions(familyAreas,answers.diagnostic,1,1,1,undefined,1)
   const ids=questions.map(q=>q.id)
   expect(validateCombined(answers)).not.toBeNull()
   expect(new Set(ids).size).toBe(ids.length)
   expect(ids.includes('family_health.premium')).toBe(coverage!=='none')
   expect(ids.includes('family_health.needs')).toBe(coverage!=='all')
   for(const id of ['family_loans.type','family_loans.balance','family_loans.payment','family_loans.repayment','family_loans.plan.review']) expect(ids.includes(id)).toBe(loans==='yes')
   for(const q of questions){expect(q.question.label[locale].trim()).not.toBe('');expect(validCombinedQuestion(q,answers.diagnostic[q.id])).toBe(true)}
   expect(ids.indexOf('family_loans.has_loans')).toBeGreaterThan(ids.indexOf('credit.review'))
   expect(ids).toContain('family_disability.status')
   expect(ids).toContain('family_disability.review')
  })
 }
 for(const locale of ['en','es'] as const)for(const workforce of ['none','small'])it(`validates Business ${workforce} workforce in ${locale}`,()=>{
  const answers=complete(businessAreas,{'benefits.workforce':workforce},locale)
  const ids=combinedQuestions(businessAreas,answers.diagnostic,1,1,1,undefined,1).map(q=>q.id)
  expect(validateCombined(answers)).not.toBeNull()
  expect(ids.includes('benefits.status')).toBe(workforce!=='none')
  expect(ids).toEqual(expect.arrayContaining(['owner_retirement.status','owner_retirement.review','owner_estate.will.review','owner_estate.trust.review','owner_estate.exit.review']))
 })
})
