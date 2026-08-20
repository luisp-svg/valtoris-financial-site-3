import { describe, expect, it } from 'vitest'
import { extractCrmPpCode } from './catalogErrors'
import { REQUIREMENT_GENERIC_ERROR, formatRequirementUserError } from './requirementErrors'

describe('requirement error normalization', () => {
  it('maps CRM_PP codes to safe copy and never leaks raw postgres', () => {
    expect(extractCrmPpCode({ message: 'CRM_PP:invalid_requirement_code' })).toBe(
      'invalid_requirement_code',
    )
    expect(formatRequirementUserError({ message: 'CRM_PP:invalid_requirement_code' })).toMatch(
      /product line/i,
    )
    expect(formatRequirementUserError({ message: 'CRM_PP:invalid_requirement_transition' })).toMatch(
      /not allowed/i,
    )
    expect(formatRequirementUserError({ message: 'CRM_PP:not_found' })).toBe(
      'That requirement was not found.',
    )
    const leaked = formatRequirementUserError({
      message: 'permission denied for table policy_application_requirements',
      code: '42501',
    })
    expect(leaked).toBe(REQUIREMENT_GENERIC_ERROR)
    expect(leaked).not.toMatch(/42501|permission denied|policy_application_requirements/i)
  })
})
