import { describe, expect, it } from 'vitest'
import {
  dueLabel,
  calendarToday,
  requirementOpen,
  requirementTransitions,
} from './caseModel'
import { serviceError } from './model'
describe('case deadlines and transitions', () => {
  it('uses local calendar days and distinguishes today from overdue', () => {
    expect(calendarToday(new Date(2026, 8, 27, 0, 5))).toBe('2026-09-27')
    expect(dueLabel('2026-09-26', '2026-09-27')).toBe('Overdue · 2026-09-26')
    expect(dueLabel('2026-09-27', '2026-09-27')).toBe('Due today · 2026-09-27')
    expect(dueLabel(null, '2026-09-27')).toBe('No date set')
  })
  it('closed requirements do not count as outstanding', () => {
    expect(requirementOpen({ status: 'scheduled' })).toBe(true)
    for (const status of ['complete', 'waived', 'cancelled'] as const)
      expect(requirementOpen({ status })).toBe(false)
  })
  it('offers explicit reopen and terminal cancellation', () => {
    expect(requirementTransitions('complete')).toEqual(['complete', 'open'])
    expect(requirementTransitions('waived')).toEqual(['waived', 'open'])
    expect(requirementTransitions('cancelled')).toEqual(['cancelled'])
  })
  it('explains completion blockers and stale edits without exposing internals', () => {
    expect(serviceError(new Error('CRM_SP:blocking_requirements'))).toContain(
      'Resolve',
    )
    expect(serviceError(new Error('CRM_SP:stale_record'))).toContain('Reload')
    expect(serviceError(new Error('CRM_SP:ineligible_assignee'))).toContain(
      'already has access',
    )
  })
})
