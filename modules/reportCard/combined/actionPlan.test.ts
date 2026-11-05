import {expect,it} from 'vitest'
import {PRIORITIES} from './engine'
import {reportActionPlan} from './actionPlan'
it.each(['en','es'] as const)('covers each selected review in all three stages (%s)',locale=>{
 for(const priority of PRIORITIES){const plan=reportActionPlan([priority.id],locale)
  for(const stage of Object.values(plan)){expect(stage).toHaveLength(1);expect(stage[0].id).toBe(priority.id);expect(stage[0].title).toBe(priority[locale]);expect(stage[0].text.length).toBeGreaterThan(50)}
 }
})
it('does not add unselected reviews or duplicate repeated selections',()=>{
 const plan=reportActionPlan(['tax','tax'], 'en')
 for(const stage of Object.values(plan))expect(stage.map(item=>item.id)).toEqual(['tax'])
 expect(reportActionPlan([], 'en')).toEqual({immediate:[],thirtyDay:[],ninetyDay:[]})
})
