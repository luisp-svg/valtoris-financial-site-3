import { describe, expect, it } from 'vitest'
import { STAGE_TRANSITION_GENERIC_ERROR, formatStageTransitionUserError } from './stageTransitionErrors'

describe('stage transition error normalization', () => {
  it('maps known CRM_PP codes to useful copy and never leaks internals', () => {
    expect(formatStageTransitionUserError({ message: 'CRM_PP:invalid_transition' })).toBe(
      'That stage change is not allowed from the current stage.',
    )
    expect(formatStageTransitionUserError({ message: 'CRM_PP:not_authorized' })).toMatch(/permission/i)
    expect(formatStageTransitionUserError({ message: 'CRM_PP:missing_required_fields' })).toMatch(
      /policy number|reason/i,
    )
    expect(formatStageTransitionUserError({ message: 'CRM_PP:invalid_participants' })).toMatch(/participants/i)
    expect(formatStageTransitionUserError({ message: 'CRM_PP:invalid_allocations' })).toMatch(/10,000/i)
    expect(formatStageTransitionUserError({ message: 'CRM_PP:invalid_delivery_status' })).toMatch(/delivery/i)
    expect(formatStageTransitionUserError({ message: 'CRM_PP:issue_failed' })).toMatch(/could not be issued/i)
    const leaked = formatStageTransitionUserError({
      message: 'permission denied for table policy_applications',
      code: '42501',
      details: 'SQLSTATE 42501 SELECT * FROM policy_applications',
    })
    expect(leaked).toBe(STAGE_TRANSITION_GENERIC_ERROR)
    expect(leaked).not.toMatch(/CRM_PP|42501|SQLSTATE|permission denied|SELECT/i)
  })
})
