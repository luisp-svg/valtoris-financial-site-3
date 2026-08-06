/**
 * PostgREST OR filter: keep households that are NOT Manual Contact networking records.
 * Excludes only rows where status='lead' AND lead_source='manual_contact'.
 */
export const MANUAL_CONTACT_HOUSEHOLD_EXCLUSION =
  'status.neq.lead,lead_source.is.null,lead_source.neq.manual_contact'

/** Pure helper for unit tests / client-side sanity checks. */
export function isManualContactHousehold(row: {
  status?: string | null
  lead_source?: string | null
}): boolean {
  return String(row.status ?? '') === 'lead' && String(row.lead_source ?? '') === 'manual_contact'
}

export function shouldIncludeInNormalHouseholdLists(row: {
  status?: string | null
  lead_source?: string | null
}): boolean {
  return !isManualContactHousehold(row)
}
