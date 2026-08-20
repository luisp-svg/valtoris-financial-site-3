/**
 * Household "active policy" rule after Migration 045.
 *
 * Linked production policies are active only while `policies.status === in_force`.
 * Unlinked/legacy rows keep the historical inactive-set vocabulary so issued/pending/
 * active free-text states still count until they are remapped.
 */
const ALWAYS_INACTIVE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'surrendered',
  'lapsed',
  'expired',
  'replaced',
])

export function isActiveHouseholdPolicy(policy: {
  status: string
  source_application_id?: string | null
}): boolean {
  const status = policy.status.trim().toLowerCase()
  if (!status) return false
  if (ALWAYS_INACTIVE_STATUSES.has(status)) return false
  if (policy.source_application_id) return status === 'in_force'
  return true
}
