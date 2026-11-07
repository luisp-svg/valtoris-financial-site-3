import { describe, expect, it } from 'vitest'
import { classifyTaskQueue } from './taskQueues'
import type { CrmTask } from './types'

const task = (overrides: Partial<CrmTask>): CrmTask => ({
  id: 'task', household_id: 'household', opportunity_id: null, title: 'Review',
  description: null, due_date: null, priority: 'medium', status: 'open',
  assigned_user_id: null, created_by_user_id: null, created_at: '',
  completed_at: null, deleted_at: null, ...overrides,
})

describe('task queue classification', () => {
  it('routes consented diagnostic reviews to sales', () => {
    expect(classifyTaskQueue(task({ workflow_type: 'review_initial_diagnostic', metadata: { contact_permission: true } }))).toBe('sales')
  })
  it('never treats absent or denied consent as sales-ready', () => {
    expect(classifyTaskQueue(task({ workflow_type: 'review_initial_diagnostic', metadata: { contact_permission: false } }))).toBe('internal')
    expect(classifyTaskQueue(task({ workflow_type: 'review_initial_diagnostic' }))).toBe('internal')
  })
  it('routes duplicate review to internal regardless of consent', () => {
    expect(classifyTaskQueue(task({ workflow_type: 'resolve_possible_duplicate', metadata: { contact_permission: true } }))).toBe('internal')
  })
  it('routes manual servicing work to operations', () => {
    expect(classifyTaskQueue(task({ source_type: 'manual', title: 'Collect POI docs' }))).toBe('operations')
  })
})

// Regression: reporting must preserve the queue's safety precedence for manual work.
describe('manual task safety precedence', () => {
  it('keeps denied contact permission internal', () => {
    expect(classifyTaskQueue(task({ source_type: 'manual', metadata: { contact_permission: false } }))).toBe('internal')
  })
  it('keeps manual duplicate reviews internal', () => {
    expect(classifyTaskQueue(task({ source_type: 'manual', workflow_type: 'resolve_possible_duplicate', metadata: { contact_permission: true } }))).toBe('internal')
  })
})
