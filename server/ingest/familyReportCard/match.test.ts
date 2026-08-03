import { describe, expect, it } from 'vitest'
import { classifyMatch } from './match'
import { matchCandidateFixture } from './testFixtures'

const baseInput = {
  normalizedEmail: 'jamie.rivera@example.com',
  normalizedPhone: '+15552014488',
  firstName: 'Jamie',
  lastName: 'Rivera',
}

describe('classifyMatch', () => {
  it('returns new_prospect when there are no candidates', () => {
    const result = classifyMatch({ ...baseInput, candidates: [] })
    expect(result.status).toBe('new_prospect')
    expect(result.candidatesConsidered).toBe(0)
  })

  it('returns new_prospect when all candidates are soft-deleted', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [matchCandidateFixture({ isDeleted: true })],
    })
    expect(result.status).toBe('new_prospect')
  })

  it('returns exact_trusted_match when a single candidate matches email + phone with no name conflict', () => {
    const result = classifyMatch({ ...baseInput, candidates: [matchCandidateFixture()] })
    expect(result.status).toBe('exact_trusted_match')
    expect(result.matchedHouseholdId).toBe('hh-existing-1')
    expect(result.matchConfidence).toBe('high')
  })

  it('treats a candidate with no name on file as no conflict (still exact_trusted_match)', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [matchCandidateFixture({ firstName: null, lastName: null, displayName: null })],
    })
    expect(result.status).toBe('exact_trusted_match')
  })

  it('downgrades to possible_match when email + phone match but the name materially conflicts', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [matchCandidateFixture({ firstName: 'Morgan', lastName: 'Lee' })],
    })
    expect(result.status).toBe('possible_match')
    expect(result.matchReason).toBe('exact_contact_name_conflict')
    expect(result.candidateHouseholdId).toBe('hh-existing-1')
  })

  it('does not conflict when only the first name matches (last name blank cannot conflict)', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [matchCandidateFixture({ firstName: 'Jamie', lastName: '' })],
    })
    expect(result.status).toBe('exact_trusted_match')
  })

  it('returns possible_match when multiple households exact-match', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [
        matchCandidateFixture({ householdId: 'hh-1' }),
        matchCandidateFixture({ householdId: 'hh-2' }),
      ],
    })
    expect(result.status).toBe('possible_match')
    expect(result.matchReason).toBe('multiple_exact_contact_matches')
  })

  it('returns possible_match for an email-only match', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [matchCandidateFixture({ normalizedPhone: '+15559998888' })],
    })
    expect(result.status).toBe('possible_match')
    expect(result.matchReason).toBe('email_only_match')
    expect(result.matchConfidence).toBe('low')
  })

  it('returns possible_match for a phone-only match', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [matchCandidateFixture({ normalizedEmail: 'someone.else@example.com' })],
    })
    expect(result.status).toBe('possible_match')
    expect(result.matchReason).toBe('phone_only_match')
  })

  it('returns possible_match when email and phone partially match different households', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [
        matchCandidateFixture({ householdId: 'hh-email', normalizedPhone: '+15559998888' }),
        matchCandidateFixture({
          householdId: 'hh-phone',
          normalizedEmail: 'someone.else@example.com',
        }),
      ],
    })
    expect(result.status).toBe('possible_match')
    expect(result.matchReason).toBe('multiple_partial_contact_matches')
  })

  it('returns possible_match (shared contact overlap) when a candidate has neither field matching directly', () => {
    const result = classifyMatch({
      ...baseInput,
      candidates: [
        matchCandidateFixture({
          normalizedEmail: 'unrelated@example.com',
          normalizedPhone: '+15550001111',
        }),
      ],
    })
    expect(result.status).toBe('possible_match')
    expect(result.matchReason).toBe('unclassified_candidate_overlap')
  })

  it('ignores a null submitted email/phone when matching (cannot exact-match without both)', () => {
    const result = classifyMatch({
      normalizedEmail: null,
      normalizedPhone: '+15552014488',
      firstName: 'Jamie',
      lastName: 'Rivera',
      candidates: [matchCandidateFixture()],
    })
    expect(result.status).toBe('possible_match')
    expect(result.matchReason).toBe('phone_only_match')
  })
})
