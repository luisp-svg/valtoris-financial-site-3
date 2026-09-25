import {describe,expect,it} from 'vitest'
import {ADDITIONAL_SERVICE_CONTRACTS,emptyAdditionalIntake,validateAdditionalIntake,type AdditionalServiceId} from './additionalServiceSchema'
describe('additional service intakes',()=>{
 for(const id of Object.keys(ADDITIONAL_SERVICE_CONTRACTS) as AdditionalServiceId[])it(`${id} separates drafts from completion and rejects other services`,()=>{
  const a=emptyAdditionalIntake(id)
  expect(validateAdditionalIntake(id,a)).toEqual([])
  expect(validateAdditionalIntake(id,a,true).length).toBeGreaterThan(0)
  expect(validateAdditionalIntake(id,{...a,tracks:['not-a-service']})).not.toEqual([])
  expect(validateAdditionalIntake(id,{...a,sections:{...a.sections,client:[{...a.sections.client[0],ssn:'forbidden'}]}})).not.toEqual([])
 })
 it('does not accept negative monetary values',()=>{
  const a=emptyAdditionalIntake('home_buyer');a.sections.purchase[0].price='-100'
  expect(validateAdditionalIntake('home_buyer',a)).not.toEqual([])
 })
})
