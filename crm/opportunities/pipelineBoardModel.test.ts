import {describe,it,expect} from 'vitest'
import {normalizeOpportunityListItem} from './opportunitiesApi'
import {activeHouseholdOpportunityCounts,pipelineBoardGroups} from './pipelineBoardModel'
import type {OpportunityStageOption} from './types'
const item=(id:string,pipeline:string,stage:string,status='open')=>normalizeOpportunityListItem({id,title:id,household_id:'same-client',pipeline_id:pipeline,stage_id:stage,service_vertical_id:pipeline,status,pipeline:{id:pipeline,name:pipeline}})
const stage=(id:string,pipeline_id:string,sort_order:number):OpportunityStageOption=>({id,pipeline_id,name:'Same name',code:id,sort_order,is_won:false,is_lost:false,is_terminal:false})
describe('parallel sales cycles',()=>{
 it('preserves separate opportunities for one household across pipelines',()=>{const items=[item('life','life','s1'),item('loans','loans','s2'),item('health','health','s3','won')];const groups=pipelineBoardGroups(items,[stage('s1','life',2),stage('s2','loans',1),stage('s3','health',1)]);expect(groups).toHaveLength(3);expect(groups.flatMap(g=>g.columns.flatMap(c=>c.items.map(i=>i.id))).sort()).toEqual(['health','life','loans']);expect(activeHouseholdOpportunityCounts(items).get('same-client')).toBe(2)})
 it('keeps empty stages in sales order and never merges stages by label',()=>{const groups=pipelineBoardGroups([item('a','p','later')],[stage('later','p',20),stage('first','p',10)]);expect(groups[0].columns.map(c=>c.id)).toEqual(['first','later']);expect(groups[0].columns[0].items).toEqual([])})
 it('groups existing Student Loans consultation records under the five workflow columns',()=>{
  const pipeline = 'loans'
  const stages = [
   {...stage('identified',pipeline,1),name:'Identified'},
   {...stage('consultation',pipeline,2),name:'Consultation'},
   {...stage('presented',pipeline,3),name:'Onboarding'},
   {...stage('student_loan_fulfillment',pipeline,4),name:'Fulfillment'},
   {...stage('student_loan_processing',pipeline,5),name:'Processing'},
   {...stage('sold',pipeline,6),name:'Complete',is_won:true},
   {...stage('closed_lost',pipeline,7),name:'Closed / Lost',is_lost:true,is_terminal:true},
  ]
  const identified = item('new',pipeline,'identified')
  const consultation = item('existing',pipeline,'consultation')
  const group = pipelineBoardGroups([identified,consultation],stages)[0]
  expect(group.columns.map(column=>column.name)).toEqual(['Consultation','Onboarding','Fulfillment','Processing','Complete'])
  expect(group.columns[0].items).toEqual([identified,consultation])
  const lost = pipelineBoardGroups([item('lost',pipeline,'closed_lost','lost')],stages)[0]
  expect(lost.columns).toHaveLength(5)
  expect(lost.closedItems[0].id).toBe('lost')
 })

})
