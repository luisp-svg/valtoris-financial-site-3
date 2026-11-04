import {it,expect} from 'vitest'
import {coverageReview,annualCostScenario,publicCoverageReview} from './coverageReview'
import {gradeReport} from './grading'
import {SPECIALTY_CARDS} from './catalog'
import {valid,update,visibleQuestions} from './engine'
it('separates affordability from grade and preserves urgent premium pressure',()=>{
 const a={purpose:'individual',coverage:'all',cost_understanding:'yes',exposure_review:'yes',access:'yes',prescriptions:'yes'}
 expect(gradeReport('health',{...a,afford:'comfortable'}).score).toBe(gradeReport('health',{...a,afford:'unmanageable'}).score)
 expect(coverageReview('health',{...a,afford:'unmanageable'})?.urgent.some(r=>r.id==='afford')).toBe(true)
})
it('validates actual calendar dates and rejects rollover dates',()=>{
 const q=SPECIALTY_CARDS.benefits.questions.find(q=>q.id==='renewal_date')!
 expect(valid(q,'2027-02-28')).toBe(true);expect(valid(q,'2027-02-30')).toBe(false);expect(valid(q,'unknown')).toBe(true)
})
it('prunes employer follow-ups when ownership changes',()=>{
 const a=update('health',{owner_status:'employer',employees:'12',business_review:'yes'},'owner_status','no')
 expect(a.employees).toBeUndefined();expect(a.business_review).toBeUndefined()
})
it('keeps purchasing intent separate from self-reported review and outputs three actions',()=>{
 const r=coverageReview('health',{owner_status:'employer',business_review:'yes',coverage:'none'})!
 expect(r.internal.employerReviewRequested).toBe(true);expect(r.verification).toBe('self_reported');expect(r.actions).toHaveLength(3)
 expect(r.internal.priority).toBe('prompt_review')
 expect(coverageReview('benefits',{employees:'0'})?.coverageStatus).toContain('No workforce')
 expect(visibleQuestions('benefits',{employees:'0'}).map(q=>q.id)).not.toContain('renewal_date')
})
it('does not double count the deductible or imply a total spending cap',()=>{
 expect(annualCostScenario(1000,2000,8000)).toMatchObject({annualPremium:12000,expectedYear:14000,difficultYearCovered:20000})
 expect(()=>annualCostScenario(1000,9000,8000)).toThrow();expect(()=>annualCostScenario(-1,0,0)).toThrow()
})

it('keeps operational priority out of public results',()=>{expect(publicCoverageReview('health',{coverage:'none'})).not.toHaveProperty('internal')})
