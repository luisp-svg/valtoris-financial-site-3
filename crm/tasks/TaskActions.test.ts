import { describe,it,expect } from 'vitest'
import { supportsTaskActions } from './TaskActions'
describe('task action eligibility',()=>{
 it('allows manual tasks and recognized review work',()=>{
  expect(supportsTaskActions({source_type:'manual',workflow_type:null})).toBe(true)
  expect(supportsTaskActions({source_type:'digital_identity_ingest',workflow_type:'review_digital_identity_lead'})).toBe(true)
  expect(supportsTaskActions({source_type:'public_family_ingest',workflow_type:'review_initial_diagnostic'})).toBe(true)
 })
 it('keeps duplicate and unknown work in its workflow',()=>{
  for(const workflow_type of ['resolve_possible_duplicate','resolve_digital_identity_duplicate','future_workflow']) expect(supportsTaskActions({source_type:'system',workflow_type})).toBe(false)
  expect(supportsTaskActions({source_type:'system',workflow_type:null})).toBe(false)
  expect(supportsTaskActions({source_type:'unknown',workflow_type:'review_initial_diagnostic'})).toBe(false)
 })
})
