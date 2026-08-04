import type { MatchCandidate, MatchClassificationResult } from './types.js'

export type ClassifyMatchInput = {
  normalizedEmail: string | null
  normalizedPhone: string | null
  firstName: string
  lastName: string
  candidates: MatchCandidate[]
}

function looseNameMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase()
  const nb = b.trim().toLowerCase()
  if (!na || !nb) return false
  return na === nb
}

/**
 * A candidate "conflicts" only when it has both a first and last name on file
 * AND neither matches the submitted name. Candidates with an empty/unknown
 * name can never conflict — we simply don't have enough information.
 */
function hasNameConflict(input: ClassifyMatchInput, candidate: MatchCandidate): boolean {
  const candidateFirst = candidate.firstName?.trim() ?? ''
  const candidateLast = candidate.lastName?.trim() ?? ''
  if (!candidateFirst || !candidateLast) return false

  const firstMatches = looseNameMatch(candidateFirst, input.firstName)
  const lastMatches = looseNameMatch(candidateLast, input.lastName)
  return !firstMatches && !lastMatches
}

function uniqueHouseholdIds(candidates: MatchCandidate[]): Set<string> {
  return new Set(candidates.map((candidate) => candidate.householdId))
}

/**
 * Pure identity classification. No I/O — `candidates` must already be the
 * result of a DB lookup (see findCandidates.ts). Soft-deleted/merged
 * candidates are filtered out defensively even though callers should already
 * exclude them from the query.
 */
export function classifyMatch(input: ClassifyMatchInput): MatchClassificationResult {
  const active = input.candidates.filter((candidate) => !candidate.isDeleted)

  if (active.length === 0) {
    return {
      status: 'new_prospect',
      matchReason: 'no_candidates_found',
      matchConfidence: 'high',
      candidatesConsidered: 0,
    }
  }

  const exactCandidates = active.filter(
    (candidate) =>
      input.normalizedEmail !== null &&
      input.normalizedPhone !== null &&
      candidate.normalizedEmail === input.normalizedEmail &&
      candidate.normalizedPhone === input.normalizedPhone,
  )

  if (exactCandidates.length > 0) {
    const exactHouseholds = uniqueHouseholdIds(exactCandidates)

    if (exactHouseholds.size > 1) {
      return {
        status: 'possible_match',
        candidateHouseholdId: exactCandidates[0].householdId,
        matchReason: 'multiple_exact_contact_matches',
        matchConfidence: 'medium',
        candidatesConsidered: active.length,
      }
    }

    const candidate = exactCandidates[0]
    if (hasNameConflict(input, candidate)) {
      return {
        status: 'possible_match',
        candidateHouseholdId: candidate.householdId,
        matchReason: 'exact_contact_name_conflict',
        matchConfidence: 'medium',
        candidatesConsidered: active.length,
      }
    }

    return {
      status: 'exact_trusted_match',
      matchedHouseholdId: candidate.householdId,
      matchReason: 'email_and_phone_match',
      matchConfidence: 'high',
      candidatesConsidered: active.length,
    }
  }

  const emailMatches = input.normalizedEmail
    ? active.filter((candidate) => candidate.normalizedEmail === input.normalizedEmail)
    : []
  const phoneMatches = input.normalizedPhone
    ? active.filter((candidate) => candidate.normalizedPhone === input.normalizedPhone)
    : []

  if (emailMatches.length > 0 || phoneMatches.length > 0) {
    const combinedHouseholds = new Set([
      ...uniqueHouseholdIds(emailMatches),
      ...uniqueHouseholdIds(phoneMatches),
    ])
    const primary = emailMatches[0] ?? phoneMatches[0]

    let matchReason = 'phone_only_match'
    if (combinedHouseholds.size > 1) {
      matchReason = 'multiple_partial_contact_matches'
    } else if (emailMatches.length > 0 && phoneMatches.length > 0) {
      matchReason = 'email_and_phone_partial_match'
    } else if (emailMatches.length > 0) {
      matchReason = 'email_only_match'
    }

    return {
      status: 'possible_match',
      candidateHouseholdId: primary.householdId,
      matchReason,
      matchConfidence: 'low',
      candidatesConsidered: active.length,
    }
  }

  // Candidates were returned by the lookup (e.g. a shared household record)
  // but neither normalized field lines up directly — treat conservatively.
  return {
    status: 'possible_match',
    candidateHouseholdId: active[0].householdId,
    matchReason: 'unclassified_candidate_overlap',
    matchConfidence: 'low',
    candidatesConsidered: active.length,
  }
}
