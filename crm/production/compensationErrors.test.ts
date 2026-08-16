import { describe, expect, it } from 'vitest'
import {
  ACTUAL_LOAD_ERROR,
  COMPENSATION_GENERIC_ERROR,
  EXPECTED_LIST_LOAD_ERROR,
  formatCompensationUserError,
} from './compensationErrors'
import { formatCompensationDevError } from './compensationApi'

describe('compensation error normalization', () => {
  it('maps CRM_PP codes to safe copy and never leaks SQL or internals', () => {
    expect(formatCompensationUserError({ message: 'CRM_PP:not_authorized' })).toMatch(/permission/i)
    expect(formatCompensationUserError({ message: 'CRM_PP:not_authenticated' })).toMatch(/sign in/i)
    expect(formatCompensationUserError({ message: 'CRM_PP:not_found' })).toMatch(/not found/i)
    const leaked = formatCompensationUserError({
      message: 'permission denied for table policy_application_expected_compensations',
      code: '42501',
      details: 'SQLSTATE 42501 SELECT * FROM policy_writing_commission_events',
      hint: 'PGRST301',
    })
    expect(leaked).toBe(COMPENSATION_GENERIC_ERROR)
    expect(leaked).not.toMatch(/CRM_PP|42501|SQLSTATE|permission denied|PGRST|SELECT \*/i)
    expect(EXPECTED_LIST_LOAD_ERROR).toMatch(/still shown/i)
    expect(ACTUAL_LOAD_ERROR).toMatch(/try again/i)
  })

  it('keeps development logs detailed without using them as UI copy', () => {
    const dev = formatCompensationDevError('production-actual-detail', {
      message: 'CRM_PP:not_authorized',
      code: 'PGRST116',
    })
    expect(dev).toContain('[production-actual-detail]')
    expect(dev).toContain('CRM_PP:not_authorized')
    expect(formatCompensationUserError({ message: 'CRM_PP:not_authorized' })).not.toContain('CRM_PP')
  })
})
