import type { SupabaseClient } from '@supabase/supabase-js'
import { QUOTE_LEAD_TYPES } from '../../modules/insuranceQuote/catalog'
import { insuranceQuoteSnapshot } from '../intake/insuranceQuoteSnapshot'

export const QUOTE_HISTORY_PAGE_SIZE = 20

export async function loadHouseholdInsuranceQuotes(client: SupabaseClient, householdId: string, page = 0) {
  if (!householdId) throw new Error('Household required')
  const start = page * QUOTE_HISTORY_PAGE_SIZE
  // Browser session + existing leads RLS; never fetch another household's answers.
  const { data, error } = await client.from('leads')
    .select('id, lead_type, submitted_at, raw_payload')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .in('lead_type', [...QUOTE_LEAD_TYPES])
    .order('submitted_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + QUOTE_HISTORY_PAGE_SIZE)
  if (error) throw error
  const rows = data ?? []
  return {
    hasMore: rows.length > QUOTE_HISTORY_PAGE_SIZE,
    items: rows.slice(0, QUOTE_HISTORY_PAGE_SIZE).map(row => ({
      id: String(row.id),
      leadType: String(row.lead_type),
      submittedAt: String(row.submitted_at),
      quote: insuranceQuoteSnapshot(row.lead_type, row.raw_payload),
    })),
  }
}
