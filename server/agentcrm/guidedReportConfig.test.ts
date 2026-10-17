import { describe,it,expect } from 'vitest'
import { getReportCardAgentCrmConfig,isEnabledReportCardContactSource,isEnabledReportCardServiceTag } from './reportCardSyncConfig'
describe('approved guided report routing labels',()=>{
 it.each([['health','Health Insurance'],['tsp','TSP'],['benefits','Employee Benefits'],['tax','Tax Review']])('maps %s to the user-approved tag', (type,tag)=>{
  const c=getReportCardAgentCrmConfig(type)!
  expect(c.serviceTag).toBe(tag);expect(c.enabled).toBe(true);expect(isEnabledReportCardServiceTag(tag)).toBe(true);expect(isEnabledReportCardContactSource(c.source)).toBe(true)
 })
 it('does not accept arbitrary types or tags',()=>{expect(getReportCardAgentCrmConfig('invented')).toBeNull();expect(isEnabledReportCardServiceTag('unexpected')).toBe(false)})
})
