import type { SupabaseClient } from '@supabase/supabase-js'
import { updateHouseholdMember } from './householdsApi'
import type { MemberRelationship } from './types'

const MEMBER_RELATIONSHIPS = new Set<MemberRelationship>([
  'primary',
  'spouse',
  'partner',
  'child',
  'dependent',
  'parent',
  'grandparent',
  'business_partner',
  'employee',
  'other',
])

export function isValidMemberDateOfBirth(value: string): boolean {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false
  const [year, month, day] = trimmed.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false
  }
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  if (date.getTime() > todayUtc) return false
  if (year < 1900) return false
  return true
}

/**
 * Applies date_of_birth on an existing household member through the canonical
 * member-update path. Does not log the date of birth.
 */
export async function saveHouseholdMemberDateOfBirth(
  supabase: SupabaseClient,
  memberId: string,
  householdId: string,
  dateOfBirth: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isValidMemberDateOfBirth(dateOfBirth)) {
    return { ok: false, message: 'Enter a valid date of birth.' }
  }

  const { data, error } = await supabase
    .from('household_members')
    .select('first_name, last_name, relationship, is_primary_contact, email, phone')
    .eq('id', memberId)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, message: 'Date of birth could not be saved. Add it on the household record.' }
  }

  const relationship = MEMBER_RELATIONSHIPS.has(data.relationship as MemberRelationship)
    ? (data.relationship as MemberRelationship)
    : 'other'

  try {
    await updateHouseholdMember(supabase, memberId, householdId, {
      first_name: String(data.first_name ?? ''),
      last_name: String(data.last_name ?? ''),
      relationship,
      is_primary_contact: Boolean(data.is_primary_contact),
      email: (data.email as string | null) ?? null,
      phone: (data.phone as string | null) ?? null,
      date_of_birth: dateOfBirth.trim(),
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Date of birth could not be saved. Add it on the household record.' }
  }
}
