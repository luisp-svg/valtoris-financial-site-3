import { describe, expect, it } from 'vitest'
import { classifyMatch } from '../familyReportCard/match.js'
import type { MatchCandidate } from '../familyReportCard/types.js'

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    householdId: 'hh-1',
    displayName: 'Jamie Rivera',
    normalizedEmail: 'jamie@example.com',
    normalizedPhone: '+15551112222',
    firstName: 'Jamie',
    lastName: 'Rivera',
    source: 'member',
    ...overrides,
  }
}

describe('bulk import identity classification parity with classifyMatch', () => {
  it('treats same name only as new_prospect and exact phone+email as trusted', () => {
    expect(
      classifyMatch({
        normalizedEmail: 'other@example.com',
        normalizedPhone: '+15550000000',
        firstName: 'Jamie',
        lastName: 'Rivera',
        candidates: [],
      }).status,
    ).toBe('new_prospect')

    expect(
      classifyMatch({
        normalizedEmail: 'jamie@example.com',
        normalizedPhone: '+15551112222',
        firstName: 'Jamie',
        lastName: 'Rivera',
        candidates: [candidate()],
      }).status,
    ).toBe('exact_trusted_match')

    expect(
      classifyMatch({
        normalizedEmail: 'jamie@example.com',
        normalizedPhone: '+15550000001',
        firstName: 'Other',
        lastName: 'Person',
        candidates: [candidate()],
      }).status,
    ).toBe('possible_match')
  })
})
