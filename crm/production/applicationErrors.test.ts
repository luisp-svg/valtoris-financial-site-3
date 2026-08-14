import { describe, expect, it } from 'vitest'
import { extractCrmPpCode } from './catalogErrors'
import { APPLICATION_GENERIC_ERROR, APPLICATION_PARTIAL_FAILURE, formatApplicationUserError } from './applicationErrors'

describe('application error normalization', () => {
  it('maps CRM_PP codes to safe copy and never leaks raw postgres', () => {
    expect(extractCrmPpCode({ message: 'CRM_PP:not_authorized' })).toBe('not_authorized')
    expect(formatApplicationUserError({ message: 'CRM_PP:duplicate_application_number' })).toMatch(
      /already used/i,
    )
    expect(formatApplicationUserError({ message: 'CRM_PP:invalid_transition' })).toMatch(/Catch-up/)
    const leaked = formatApplicationUserError({
      message: 'permission denied for table policy_applications',
      code: '42501',
      details: 'SQLSTATE 42501',
    })
    expect(leaked).toBe(APPLICATION_GENERIC_ERROR)
    expect(leaked).not.toMatch(/42501|SQLSTATE|permission denied/i)
    expect(APPLICATION_PARTIAL_FAILURE).toMatch(/draft was saved/i)
  })
})
