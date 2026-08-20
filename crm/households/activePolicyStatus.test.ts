import { describe, expect, it } from 'vitest'
import { isActiveHouseholdPolicy } from './activePolicyStatus'

describe('household active policy status', () => {
  it('counts linked policies as active only when status is in_force', () => {
    expect(
      isActiveHouseholdPolicy({ status: 'in_force', source_application_id: 'app-1' }),
    ).toBe(true)
    expect(
      isActiveHouseholdPolicy({ status: 'issued', source_application_id: 'app-1' }),
    ).toBe(false)
    expect(
      isActiveHouseholdPolicy({ status: 'canceled', source_application_id: 'app-1' }),
    ).toBe(false)
    expect(
      isActiveHouseholdPolicy({ status: 'surrendered', source_application_id: 'app-1' }),
    ).toBe(false)
  })

  it('excludes canceled and surrendered from unlinked/legacy rows', () => {
    expect(isActiveHouseholdPolicy({ status: 'canceled' })).toBe(false)
    expect(isActiveHouseholdPolicy({ status: 'cancelled' })).toBe(false)
    expect(isActiveHouseholdPolicy({ status: 'surrendered' })).toBe(false)
    expect(isActiveHouseholdPolicy({ status: 'lapsed' })).toBe(false)
  })

  it('keeps legacy issued/pending/active vocabulary as active when unlinked', () => {
    expect(isActiveHouseholdPolicy({ status: 'issued' })).toBe(true)
    expect(isActiveHouseholdPolicy({ status: 'pending' })).toBe(true)
    expect(isActiveHouseholdPolicy({ status: 'active' })).toBe(true)
    expect(isActiveHouseholdPolicy({ status: 'in_force' })).toBe(true)
  })
})
