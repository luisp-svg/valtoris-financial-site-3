import { describe, expect, it } from 'vitest'
import { businessAreas, familyAreas } from './cardProfiles'
import { sampleReportAnswers } from './samples'
import { combinedResults, adaptiveReportCard } from './results'
import { combinedQuestions, validateCombined, updateCombined } from './engine'

const score = (diagnostic: Record<string, string>, area: 'health' | 'credit') => {
 const answers = sampleReportAnswers(familyAreas, 'en', 1)
 return adaptiveReportCard({...answers, diagnostic:{...answers.diagnostic,...diagnostic}})!.categories.find(c => c.type === area)!
}
describe('versioned Family and Business planning grades', () => {
 it.each(['en','es'] as const)('produces valid new reports with distinct category anchors in %s', locale => {
  for (const areas of [familyAreas,businessAreas]) {
   const answers = sampleReportAnswers(areas,locale,1)
   expect(validateCombined(answers)).not.toBeNull()
   const card = adaptiveReportCard(answers)!
   expect(new Set(card.categories.map(category => category.id)).size).toBe(card.categories.length)
   expect(new Set(combinedQuestions(areas,answers.diagnostic,1,1,1,undefined,1).map(q=>q.id)).size).toBe(Object.keys(answers.diagnostic).length)
  }
 })
 it('grades health coverage, costs and disability readiness and changes the overall score', () => {
  const good = {'family_health.coverage':'all','family_health.cost_difficulty':'no','family_health.plan.review':'current','family_disability.status':'current','family_disability.review':'current'}
  const bad = {'family_health.coverage':'none','family_health.cost_difficulty':'yes','family_health.plan.review':'missing','family_disability.status':'missing','family_disability.review':'missing'}
  expect(score(good,'health')).toMatchObject({title:'Health & Disability',score:100,known:5,total:5})
  expect(score(bad,'health').score).toBe(0)
  const answers = sampleReportAnswers(familyAreas,'en',1)
  expect(adaptiveReportCard({...answers,diagnostic:{...answers.diagnostic,...bad}})!.overall.score).toBeLessThan(adaptiveReportCard({...answers,diagnostic:{...answers.diagnostic,...good}})!.overall.score!)
 })
 it('puts student loans in Credit and excludes repayment checks when there are no loans', () => {
  const base = {'credit.status':'current','credit.review':'current','family_loans.has_loans':'yes'}
  expect(score({...base,'family_loans.repayment':'current','family_loans.plan.review':'current'},'credit')).toMatchObject({title:'Credit & Student Loans',score:100,known:4,total:4})
  expect(score({...base,'family_loans.repayment':'late','family_loans.plan.review':'missing'},'credit').score).toBe(50)
  expect(score({...base,'family_loans.has_loans':'no'},'credit')).toMatchObject({score:100,known:2,total:2})
  const answers = sampleReportAnswers(familyAreas,'en',1)
  const pruned = updateCombined(familyAreas,{...answers.diagnostic,'family_loans.has_loans':'yes','family_loans.plan.review':'current'},'family_loans.has_loans','no',1,1,1,undefined,1)
  expect(pruned).not.toHaveProperty('family_loans.plan.review')
 })
 it('keeps unknown answers pending rather than scoring them zero', () => {
  expect(score({'family_health.coverage':'unknown','family_health.cost_difficulty':'unknown','family_health.plan.review':'unknown','family_disability.status':'unknown','family_disability.review':'unknown'},'health')).toMatchObject({score:null,known:0,total:5})
 })
 it('adds Retirement and Estate Planning & Exit Strategy with real scoring', () => {
  const answers = sampleReportAnswers(businessAreas,'en',1)
  const good = {...answers.diagnostic,'owner_retirement.status':'current','owner_retirement.review':'current','owner_estate.will.review':'current','owner_estate.trust.review':'current','owner_estate.exit.review':'current'}
  const bad = {...good,'owner_retirement.status':'missing','owner_retirement.review':'missing','owner_estate.will.review':'missing','owner_estate.trust.review':'missing','owner_estate.exit.review':'missing'}
  const card = adaptiveReportCard({...answers,diagnostic:good})!
  expect(card.categories.find(c=>c.type==='retirement')!.score).toBe(100)
  expect(combinedResults({...answers,diagnostic:good}).some(review=>review.title==='Estate Planning & Exit Strategy')).toBe(true)
  expect(card.categories.find(c=>c.id==='estate_exit')).toMatchObject({title:'Estate Planning & Exit Strategy',score:100,known:3,total:3})
  expect(adaptiveReportCard({...answers,diagnostic:bad})!.categories.find(c=>c.id==='estate_exit')!.score).toBe(0)
  expect(adaptiveReportCard({...answers,diagnostic:bad})!.overall.score).toBeLessThan(card.overall.score!)
 })
 it('preserves older reports and rejects unsupported version flags', () => {
  for (const areas of [familyAreas,businessAreas]) {
   const old = sampleReportAnswers(areas,'en')
   expect(validateCombined(old)).not.toBeNull()
   expect(adaptiveReportCard(old)!.categories.some(c=>c.id==='health'||c.id==='estate_exit')).toBe(false)
   expect(combinedQuestions(areas,old.diagnostic,1,1,1).some(q=>q.id.startsWith('owner_retirement.'))).toBe(false)
   expect(validateCombined({...old,planningVersion:2})).toBeNull()
  }
  expect(validateCombined({...sampleReportAnswers(['credit'],'en'),planningVersion:1})).toBeNull()
 })
})
