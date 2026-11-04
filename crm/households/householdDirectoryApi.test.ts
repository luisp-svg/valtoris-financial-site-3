import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchHouseholdDirectory } from './householdsApi'

function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  return { rpc, supabase: { rpc } as unknown as SupabaseClient }
}
const page = {
  rows: [{ id: 'household-1051', display_name: 'Beyond old cap', status: 'client',
    updated_at: '2026-10-28T12:00:00Z', relationship_stage_id: 'stage-1',
    members: [{ id: 'member-1', first_name: 'New', last_name: 'Client', is_primary_contact: true }] }],
  total: 1581, page: 22, pageSize: 50,
  stages: [{ id: 'stage-1', name: 'Active' }], advisors: [],
}

describe('household directory browser API', () => {
  it('keeps authoritative totals/page and normalizes households on a late page', async () => {
    const { rpc, supabase } = client(page)
    const result = await fetchHouseholdDirectory(supabase, { page: 22, search: ' New Client ', stageId: 'stage-1', advisorId: 'all', assignment: 'unassigned' })
    expect(result.total).toBe(1581)
    expect(result.page).toBe(22)
    expect(result.rows[0].id).toBe('household-1051')
    expect(result.rows[0].members[0].household_id).toBe('household-1051')
    expect(rpc).toHaveBeenCalledWith('search_household_directory', {
      p_search: 'New Client', p_stage_id: 'stage-1', p_advisor_id: null,
      p_assignment: 'unassigned', p_page: 22, p_page_size: 50,
    })
  })
  it('preserves literal search characters as RPC parameters', async () => {
    const { rpc, supabase } = client({ ...page, rows: [], total: 0, page: 1 })
    await fetchHouseholdDirectory(supabase, { search: '%,_()' })
    expect(rpc.mock.calls[0][1].p_search).toBe('%,_()')
  })
  it('surfaces missing migrations/permission failures instead of falling back to capped results', async () => {
    const failure = { code: 'PGRST202', message: 'Function unavailable' }
    const { supabase } = client(null, failure)
    await expect(fetchHouseholdDirectory(supabase)).rejects.toEqual(failure)
  })
  it.each([null, [], {}, { ...page, total: null }, { ...page, total: 0 },
    { ...page, rows: [{}] }, { ...page, pageSize: 1000 }, { ...page, stages: [{}] }])('rejects malformed response %#', async data => {
    await expect(fetchHouseholdDirectory(client(data).supabase)).rejects.toThrow('Invalid household directory response')
  })
})
