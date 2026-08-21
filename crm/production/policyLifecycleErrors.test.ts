import { describe, expect, it } from 'vitest'
import {
  POLICY_LIFECYCLE_DATE_OUTCOME_ERROR,
  POLICY_LIFECYCLE_GENERIC_ERROR,
  formatPolicyLifecycleUserError,
} from './policyLifecycleErrors'

describe('post-placement lifecycle error copy', () => {
  it('maps owner and required-field failures', () => {
    expect(formatPolicyLifecycleUserError({ message: 'CRM_PP:not_authorized' })).toBe(
      'Only the owner can record a canceled or surrendered policy outcome.',
    )
    expect(formatPolicyLifecycleUserError({ message: 'CRM_PP:missing_required_fields' })).toBe(
      'Enter a termination reason.',
    )
    expect(formatPolicyLifecycleUserError({ message: 'CRM_PP:invalid_transition' })).toMatch(
      /not currently in force/i,
    )
  })

  it('surfaces date/outcome conflicts from invalid_payload', () => {
    expect(formatPolicyLifecycleUserError({ message: 'CRM_PP:invalid_payload' })).toBe(
      POLICY_LIFECYCLE_DATE_OUTCOME_ERROR,
    )
    expect(POLICY_LIFECYCLE_DATE_OUTCOME_ERROR).toMatch(/12-month/)
    expect(POLICY_LIFECYCLE_DATE_OUTCOME_ERROR).toMatch(/Leave the date blank/)
  })

  it('does not leak raw postgres on unknown failures', () => {
    const leaked = formatPolicyLifecycleUserError({
      message: 'permission denied for table policies',
      code: '42501',
    })
    expect(leaked).toBe(POLICY_LIFECYCLE_GENERIC_ERROR)
    expect(leaked).not.toMatch(/42501|permission denied|policies/i)
  })
})
