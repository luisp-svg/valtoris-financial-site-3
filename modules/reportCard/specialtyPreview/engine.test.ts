import { describe,expect,it } from 'vitest'
import { Answers,SPECIALTY_CARDS,Specialty } from './catalog'
import { error,pathways,report,toggle,update,valid,visibleQuestions } from './engine'
function complete(type:Specialty){let a:Answers={};for(let i=0;i<3;i++)for(const q of visibleQuestions(type,a))if(!a[q.id])a[q.id]=q.kind==='number'?'10':q.kind==='multi'?[q.options![0][0]]:q.options![0][0];return a}
describe('four specialty Report Card drafts',()=>{
 it.each(Object.keys(SPECIALTY_CARDS) as Specialty[])('%s completes a short independent journey',type=>{const a=complete(type);expect(visibleQuestions(type,a).length).toBeLessThanOrEqual(16);expect(visibleQuestions(type,a).every(q=>valid(q,a[q.id]))).toBe(true);expect(report(type,a).unknown).toEqual([])})
 it('skips workforce questions for zero W-2 employees and prunes previous answers',()=>{const a=update('benefits',complete('benefits'),'employees','0');expect(visibleQuestions('benefits',a).map(q=>q.id)).toEqual(['purpose','employees']);expect(a.fulltime).toBeUndefined();expect(report('benefits',a).noEmployees).toBe(true)})
 it('does not confuse unknown employee counts with no employees',()=>{const r=report('benefits',{purpose:'add',employees:'unknown'});expect(r.noEmployees).toBe(false);expect(r.unknown.map(q=>q.id)).toEqual(['employees'])})
 it('rejects invalid and inconsistent employee counts',()=>{const q=SPECIALTY_CARDS.benefits.questions[0];expect(valid(q,'-1')).toBe(false);expect(valid(q,'1.5')).toBe(false);expect(valid(q,'')).toBe(false);expect(error('benefits',{employees:'5',fulltime:'6'})).toBe('counts')})
 it('keeps business taxes separate and removes them when the situation changes',()=>{let a=complete('tax');a=update('tax',a,'situation','owner');a=update('tax',a,'business','5000');a=update('tax',a,'personal','2000');expect(a.business).toBe('5000');expect(a.personal).toBe('2000');a=update('tax',a,'situation','employee');expect(a.business).toBeUndefined();expect(a.personal).toBe('2000')})
 it('unknown answers become confirmations rather than negative flags',()=>{const a=complete('health');a.afford='unknown';const r=report('health',a);expect(r.unknown.some(q=>q.id==='afford')).toBe(true);expect(r.review.some(q=>q.id==='afford')).toBe(false)})
 it('coverage change removes stale covered-plan details',()=>{const a=update('health',complete('health'),'coverage','none');expect(a.access).toBeUndefined();expect(a.prescriptions).toBeUndefined();expect(report('health',a).review.some(q=>q.id==='coverage')).toBe(true)})
 it('no TSP account removes account-specific questions',()=>{const a=update('tsp',complete('tsp'),'account','no');expect(a.balance).toBeUndefined();expect(a.options).toBeUndefined();expect(report('tsp',a).noTsp).toBe(true)})
 it('optional review interest does not produce a benefits review flag',()=>{const a=complete('benefits');expect(report('benefits',{...a,followup:'yes'}).review).toEqual(report('benefits',{...a,followup:'no'}).review)})
 it('every question includes English, Spanish, and a next action',()=>{for(const card of Object.values(SPECIALTY_CARDS))for(const q of card.questions){expect(q.label.en).toBeTruthy();expect(q.label.es).toBeTruthy();expect(q.next.en).toBeTruthy();expect(q.next.es).toBeTruthy()}})
 it('does not infer partner fit from unknown or small counts',()=>{
  expect(pathways('benefits',{employees:'10',fulltime:'unknown',covered:'unknown'}).map(p=>p.id)).not.toContain('dcbg')
  expect(pathways('benefits',{employees:'4',fulltime:'4',covered:'4'}).map(p=>p.id)).toEqual(['benefits_general'])
  expect(pathways('benefits',{purpose:'add',employees:'10',fulltime:'6',covered:'5'}).map(p=>p.id)).toContain('dcbg')
 })
 it('checks covered counts against the full-time count',()=>{expect(error('tax',{employees:'10',fulltime:'5',covered:'6'})).toBe('coverage_counts')})
 it('selects multiple independent tax paths without treating them as qualifications',()=>{
  const a:Answers={situation:'both',revenue:'600plus',w2_income:'600plus',employees:'10',fulltime:'8',covered:'8',changes:['sale_planned','retirement'],pretax:'500plus'}
  expect(report('tax',a).pathways.map(p=>p.id)).toEqual(['dcbg','xtra','crown','high_w2','sale','roth'])
  expect(report('tax',{...a,personal:'1000000',business:'0'}).pathways).toEqual(report('tax',{...a,personal:'0',business:'1000000'}).pathways)
 })
 it('does not route a restricted or unknown asset balance to the Roth pathway',()=>{
  for(const pretax of ['restricted','unknown','under500'])expect(pathways('tax',{changes:['retirement'],pretax}).some(p=>p.id==='roth')).toBe(false)
 })
 it('clears retirement assets when that event is deselected',()=>{const a=update('tax',{changes:['retirement'],pretax:'500plus'},'changes',['sale_planned']);expect(a.pretax).toBeUndefined()})
 it('makes none exclusive in a multi-select',()=>{expect(toggle(['medical'],'none')).toEqual(['none']);expect(toggle(['none'],'virtual')).toEqual(['virtual']);expect(toggle(['virtual'],'virtual')).toEqual([])})
 it('prunes all employer branch facts when tax income situation changes',()=>{
  const a=update('tax',{situation:'owner',revenue:'600plus',employees:'10',fulltime:'8',covered:'6',entity:'scorp'},'situation','employee')
  for(const key of ['revenue','employees','fulltime','covered','entity'])expect(a[key]).toBeUndefined()
 })
 it('keeps live question and submission contracts separate from research copies',()=>{
  expect(SPECIALTY_CARDS.family.path).toBe('/preview/report-cards/family')
  expect(SPECIALTY_CARDS.home_buyer.path).toBe('/preview/report-cards/home_buyer')
 })

})

describe('approved coverage routing',()=>{
 it('keeps supplemental and Medicare questions separate',()=>{
 const ids=visibleQuestions('health',{purpose:'supplemental',coverage:'all',type:'employer'}).map(q=>q.id)
 expect(ids).toContain('supplement_terms');expect(ids).not.toContain('medicare_type');expect(ids).not.toContain('prescriptions')
 })
 it('prunes supplemental answers when changing purpose',()=>{
 const a=update('health',{purpose:'supplemental',supplement:['accident'],supplement_terms:'yes'},'purpose','medicare')
 expect(a.supplement).toBeUndefined();expect(visibleQuestions('health',a).map(q=>q.id)).toContain('medicare_type')
 })
 it('flags access problems independently of the grade',()=>{expect(report('health',{purpose:'review',coverage:'all',access:'problem'}).critical.map(q=>q.id)).toContain('access')})
 it('separates a group health shopper from the DCBG path',()=>{
 const a={purpose:'start_group',employees:'10',fulltime:'10',covered:'10'}
 expect(visibleQuestions('benefits',a).map(q=>q.id)).toContain('group_status')
 expect(pathways('benefits',a).map(p=>p.id)).toContain('group_health');expect(pathways('benefits',a).map(p=>p.id)).not.toContain('dcbg')
 })
})

describe('TSP and tax decision journeys',()=>{
 it('keeps beneficiary rules apart from owner retirement questions',()=>{
 const a={goal:'beneficiary',service:'beneficiary',account:'yes'}
 const ids=visibleQuestions('tsp',a).map(q=>q.id)
 expect(ids).toContain('inherited_records');expect(ids).toContain('inherited_options');expect(ids).not.toContain('timeline');expect(ids).not.toContain('loan');expect(ids).not.toContain('income_review')
 expect(pathways('tsp',a).map(p=>p.id)).toEqual(['tsp_beneficiary'])
 })
 it('only asks rollover comparison checks when comparing alternatives',()=>{
 expect(visibleQuestions('tsp',{goal:'understand',service:'civilian',account:'yes'}).map(q=>q.id)).not.toContain('options')
 expect(visibleQuestions('tsp',{goal:'compare',service:'former',account:'yes'}).map(q=>q.id)).toContain('options')
 })
 it('clears inherited answers when changing to an owner review',()=>{
 let a:Answers={goal:'beneficiary',service:'beneficiary',inherited_records:'yes',inherited_options:'yes'}
 a=update('tsp',a,'goal','income');a=update('tsp',a,'service','former')
 expect(a.inherited_records).toBeUndefined();expect(a.inherited_options).toBeUndefined()
 })
 it('distinguishes completed sales from advance planning',()=>{
 const r=pathways('tax',{changes:['sale_done']}).find(p=>p.id==='sale')!
 expect(r.detail.en).toContain('completed sale');expect(visibleQuestions('tax',{changes:['sale_done']}).map(q=>q.id)).not.toContain('event_timing')
 expect(visibleQuestions('tax',{changes:['sale_planned']}).map(q=>q.id)).toContain('event_timing')
 })
 it('keeps unknown revenue out of the Crown route',()=>{expect(pathways('tax',{situation:'owner',revenue:'unknown'}).some(p=>p.id==='crown')).toBe(false)})
})
