import type { SupabaseClient } from '@supabase/supabase-js'
import type { MatchCandidate } from './types'

export type FindMatchCandidatesInput = {
  normalizedEmail: string | null
  normalizedPhone: string | null
}

type HouseholdRow = {
  id: string
  display_name: string | null
  normalized_email: string | null
  normalized_phone: string | null
}

type MemberRow = {
  id: string
  household_id: string
  first_name: string | null
  last_name: string | null
  normalized_email: string | null
  normalized_phone: string | null
  is_primary_contact: boolean | null
}

function buildOrFilter(input: FindMatchCandidatesInput): string {
  const parts: string[] = []
  if (input.normalizedEmail) parts.push(`normalized_email.eq.${input.normalizedEmail}`)
  if (input.normalizedPhone) parts.push(`normalized_phone.eq.${input.normalizedPhone}`)
  return parts.join(',')
}

function toDisplayName(firstName: string | null, lastName: string | null): string | null {
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim()
  return joined || null
}

/**
 * Looks up potential existing CRM contacts by normalized email/phone across
 * `households` and `household_members`. Only active (non soft-deleted,
 * non-merged) rows are considered. Results are deduplicated by household id;
 * when a household is only found via its own `households` row, a follow-up
 * lookup fills in the primary contact's name for name-conflict checks.
 */
export async function findMatchCandidates(
  admin: SupabaseClient,
  input: FindMatchCandidatesInput,
): Promise<MatchCandidate[]> {
  if (!input.normalizedEmail && !input.normalizedPhone) return []

  const orFilter = buildOrFilter(input)
  const byHousehold = new Map<string, MatchCandidate>()

  const [householdsResult, membersResult] = await Promise.all([
    admin
      .from('households')
      .select('id, display_name, normalized_email, normalized_phone')
      .is('deleted_at', null)
      .is('merged_into_household_id', null)
      .or(orFilter),
    admin
      .from('household_members')
      .select('id, household_id, first_name, last_name, normalized_email, normalized_phone, is_primary_contact')
      .is('deleted_at', null)
      .or(orFilter),
  ])

  if (householdsResult.error) throw householdsResult.error
  if (membersResult.error) throw membersResult.error

  const householdRows = (householdsResult.data ?? []) as HouseholdRow[]
  const memberRows = (membersResult.data ?? []) as MemberRow[]

  for (const row of householdRows) {
    byHousehold.set(row.id, {
      householdId: row.id,
      displayName: row.display_name ?? null,
      normalizedEmail: row.normalized_email ?? null,
      normalizedPhone: row.normalized_phone ?? null,
      firstName: null,
      lastName: null,
      source: 'household',
    })
  }

  for (const row of memberRows) {
    const existing = byHousehold.get(row.household_id)
    if (!existing) {
      byHousehold.set(row.household_id, {
        householdId: row.household_id,
        displayName: toDisplayName(row.first_name, row.last_name),
        normalizedEmail: row.normalized_email ?? null,
        normalizedPhone: row.normalized_phone ?? null,
        firstName: row.first_name ?? null,
        lastName: row.last_name ?? null,
        source: 'member',
        memberId: row.id,
      })
      continue
    }

    // Household already matched directly — enrich with a name, preferring the primary contact.
    if (!existing.firstName || row.is_primary_contact) {
      existing.firstName = row.first_name ?? existing.firstName
      existing.lastName = row.last_name ?? existing.lastName
      existing.memberId = row.id
    }
  }

  const householdOnlyIds = householdRows
    .map((row) => row.id)
    .filter((id) => {
      const candidate = byHousehold.get(id)
      return candidate?.source === 'household' && !candidate.firstName
    })

  if (householdOnlyIds.length > 0) {
    const { data: primaryContacts, error } = await admin
      .from('household_members')
      .select('id, household_id, first_name, last_name')
      .is('deleted_at', null)
      .eq('is_primary_contact', true)
      .in('household_id', householdOnlyIds)

    if (error) throw error

    for (const row of (primaryContacts ?? []) as Pick<MemberRow, 'id' | 'household_id' | 'first_name' | 'last_name'>[]) {
      const existing = byHousehold.get(row.household_id)
      if (existing) {
        existing.firstName = row.first_name ?? null
        existing.lastName = row.last_name ?? null
      }
    }
  }

  return Array.from(byHousehold.values())
}
