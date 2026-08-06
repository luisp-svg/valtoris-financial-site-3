import { describe, expect, it } from 'vitest'
import {
  isManualContactHousehold,
  MANUAL_CONTACT_HOUSEHOLD_EXCLUSION,
  shouldIncludeInNormalHouseholdLists,
} from './exclusions'

describe('Manual Contact household exclusions', () => {
  it('excludes only lead + manual_contact households', () => {
    expect(
      isManualContactHousehold({ status: 'lead', lead_source: 'manual_contact' }),
    ).toBe(true)
    expect(shouldIncludeInNormalHouseholdLists({ status: 'lead', lead_source: 'manual_contact' })).toBe(
      false,
    )
    expect(shouldIncludeInNormalHouseholdLists({ status: 'lead', lead_source: null })).toBe(true)
    expect(
      shouldIncludeInNormalHouseholdLists({ status: 'prospect', lead_source: 'manual_contact' }),
    ).toBe(true)
    expect(shouldIncludeInNormalHouseholdLists({ status: 'client', lead_source: null })).toBe(true)
  })

  it('exports the PostgREST OR filter used by Households and dashboard', () => {
    expect(MANUAL_CONTACT_HOUSEHOLD_EXCLUSION).toContain('status.neq.lead')
    expect(MANUAL_CONTACT_HOUSEHOLD_EXCLUSION).toContain('lead_source.neq.manual_contact')
  })
})
