import {describe,it,expect} from 'vitest'
import {combinedQuestions,projectDiagnostic,pruneCombined,updateCombined,validateCombined} from './legacyEngine'
import {combinedFixture} from '../../../server/premium/legacyTestFixtures'
import {lifestyleResults} from './lifestyleResults'

describe('P&C conditional review',()=>{
 it('separates commercial operating state from property state and prunes branches when assets change',()=>{
  let d=updateCombined(['lifestyle'],{},'lifestyle.assets',['home','vehicles','business'])
  const ids=combinedQuestions(['lifestyle'],d).map(q=>q.id)
  expect(ids).toEqual(expect.arrayContaining(['lifestyle.property_use','lifestyle.property_value','lifestyle.renovation','lifestyle.drivers','lifestyle.commercial','lifestyle.business_state','lifestyle.state']))
  d={...d,'lifestyle.property_value':'over_3000','lifestyle.commercial':['cyber'],'lifestyle.business_state':'TX'}
  d=updateCombined(['lifestyle'],d,'lifestyle.assets',['valuables'])
  expect(d).not.toHaveProperty('lifestyle.property_value');expect(d).not.toHaveProperty('lifestyle.commercial');expect(d).not.toHaveProperty('lifestyle.business_state')
  expect(combinedQuestions(['lifestyle'],d).map(q=>q.id)).toContain('lifestyle.special_assets')
  expect(projectDiagnostic('lifestyle',d)).not.toHaveProperty('commercial')
 })
 it('rejects hidden answers and contradictory exclusive selections on the server',()=>{
  const a=combinedFixture(['lifestyle'])
  expect(validateCombined(a)).not.toBeNull()
  expect(validateCombined({...a,diagnostic:{...a.diagnostic,'lifestyle.commercial':['cyber']}})).toBeNull()
  expect(validateCombined({...a,diagnostic:{...a.diagnostic,'lifestyle.changes':['none','property']}})).toBeNull()
  expect(pruneCombined([],a.diagnostic)).toEqual({})
 })
 it('builds a useful bilingual review without claiming coverage adequacy or an aggregate grade',()=>{
  const d={assets:['home','business'],property_value:'over_3000',umbrella:'unknown',renewal:'30',deadline:'notice',commercial:['cyber']}
  const en=lifestyleResults(d,'en'),es=lifestyleResults(d,'es')
  expect(en.overallGrade).toBeNull();expect(en.overallScore).toBeNull()
  expect(en.reported.find(q=>q.id==='property_value')?.value).toBe('Over $3 million')
  expect(en.confirm.map(q=>q.id)).toContain('umbrella')
  expect(en.topics.map(q=>q.id)).toEqual(['policy','property','umbrella','commercial','timing'])
  expect(es.summary).toContain('riesgos declarados');expect(es.reported.find(q=>q.id==='property_value')?.value).toContain('millones')
 })
})
