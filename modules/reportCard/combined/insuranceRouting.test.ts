import {describe,it,expect} from 'vitest'
import {PRIORITIES,combinedQuestions,validateCombined,readStoredCombined,combinedAnswerRows,primaryAssessment,pruneCombined,type Priority} from './engine'
import {combinedFixture} from '../../../server/premium/testFixtures'
import {adaptiveReportCard} from './results'
import {AgentCrmBookingProvider} from '../../../server/premium/agentCrmBookingProvider'
describe('insurance routing and existing assessment compatibility',()=>{
 it.each(['lifestyle','commercial','trucking']as const)('%s carries routing into stored CRM answers without scoring it',type=>{
  const a=combinedFixture([type]);expect(a.insuranceRoutingVersion).toBe(1)
  expect(validateCombined(a,primaryAssessment([type]))).not.toBeNull()
  const stored={...a} as Record<string,unknown>;delete stored.contact
  expect(readStoredCombined(stored)).toMatchObject({insuranceRoutingVersion:1})
  expect(combinedAnswerRows(stored).some(r=>r.id==='insurance.goal')).toBe(true)
  a.diagnostic[type+'.status']='current';a.diagnostic[type+'.review']='current'
  expect(adaptiveReportCard(a)?.categories[0]).toMatchObject({grade:'A',status:'preliminary',known:2,total:2})
  a.diagnostic['insurance.goal']='new';a.diagnostic['insurance.renewal']='30_days'
  expect(adaptiveReportCard(a)?.categories[0].grade).toBe('A')
 })
 it('keeps pre-extension v2 records valid without adding questions or changing their grade',()=>{
  const a=combinedFixture(['trucking']);delete a.insuranceRoutingVersion
  a.diagnostic=pruneCombined(a.selected,a.diagnostic)
  expect(validateCombined(a)).not.toBeNull();expect(combinedAnswerRows(a).some(r=>r.id==='insurance.goal')).toBe(false)
 })
 it('rejects unmarked routing data, invalid extension versions and exclusive multi values',()=>{
  const a=combinedFixture(['lifestyle']);expect(validateCombined({...a,insuranceRoutingVersion:2})).toBeNull()
  expect(validateCombined({...a,insuranceRoutingVersion:undefined})).toBeNull()
  expect(validateCombined({...a,diagnostic:{...a.diagnostic,'lifestyle.assets':['unknown','auto']}})).toBeNull()
 })
 it('keeps all 16383 priority combinations within the 25-field cap with the extension enabled',()=>{
  for(let mask=1;mask<1<<PRIORITIES.length;mask++){
   const selected=PRIORITIES.filter((_,i)=>mask&(1<<i)).map(p=>p.id)
   const q=combinedQuestions(selected,{},1);expect(q.length+3).toBeLessThanOrEqual(25)
   expect(new Set(q.map(q=>q.id)).size).toBe(q.length)
  }
 })
 it('deduplicates renewal and goal across all three insurance services',()=>{
  const q=combinedQuestions(['lifestyle','commercial','trucking'],{},1)
  for(const id of ['insurance.goal','insurance.renewal'])expect(q.filter(q=>q.id===id)).toHaveLength(1)
 })
 it('routes the three insurance consultations to the existing general calendar',()=>{
  const provider=new AgentCrmBookingProvider({AGENTCRM_PRIVATE_INTEGRATION_TOKEN:'test-only',AGENTCRM_LOCATION_ID:'test-location',AGENTCRM_BOOKING_TEST_ONLY:'false'})
  for(const type of ['lifestyle','commercial','trucking']as Priority[])expect(provider.calendar(combinedFixture([type]))).toBe('aM4Wwt4WNABaaoGNT5qQ')
 })
})
