import { describe, expect, it, vi } from 'vitest'
import { fetchPolicyDirectory, filterPolicyDirectory, type DirectoryPolicy } from './policyDirectoryApi'

function row(index: number): DirectoryPolicy {
  return { id: `policy-${index}`, household_id: `household-${index}`, source_application_id: null,
    policy_number: `PN-${index}`, carrier: 'Carrier One', policy_type: 'Term', status: 'in_force',
    effective_date: null, updated_at: '2026-10-29', household: { display_name: `Client ${index}` } }
}
function fixture(rows: unknown[], failStart = -1) {
  const q = { select: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn() }
  q.select.mockReturnValue(q); q.is.mockReturnValue(q); q.order.mockReturnValue(q)
  q.range.mockImplementation((start: number, end: number) => Promise.resolve(start === failStart
    ? { data: null, error: new Error('late page failed') } : { data: rows.slice(start, end + 1), error: null }))
  const from = vi.fn<(table: string) => typeof q>(() => q)
  return { q, from, client: { from } as never }
}
describe('authorized policy directory', () => {
  it('finds a policy beyond 1,000 with bounded reads and stable ordering', async () => {
    const f = fixture(Array.from({ length: 1201 }, (_, index) => row(index)))
    const rows = await fetchPolicyDirectory(f.client)
    expect(rows).toHaveLength(1201)
    expect(filterPolicyDirectory(rows, 'Client 1200', '', '').map(row => row.id)).toEqual(['policy-1200'])
    expect(f.q.range).toHaveBeenLastCalledWith(1200, 1299)
    expect(f.q.is).toHaveBeenCalledWith('deleted_at', null)
    expect(f.q.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(f.q.order).toHaveBeenCalledWith('id', { ascending: true })
    expect(f.from.mock.calls.every(call => call[0] === 'policies')).toBe(true)
  })
  it('fails the whole result when a later page fails or repeats an ID', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => row(index))
    await expect(fetchPolicyDirectory(fixture(rows, 100).client)).rejects.toThrow('late page failed')
    rows[100] = row(0)
    await expect(fetchPolicyDirectory(fixture(rows).client)).rejects.toThrow('Records changed')
  })
  it('combines literal search terms with status and carrier filters', () => {
    const rows = [row(1), { ...row(2), carrier: 'Other', status: 'canceled' }]
    expect(filterPolicyDirectory(rows, 'CLIENT pn-1', 'in_force', 'Carrier One')).toEqual([rows[0]])
    expect(filterPolicyDirectory(rows, 'Client', 'canceled', 'Other')).toEqual([rows[1]])
    expect(filterPolicyDirectory(rows, '%', '', '')).toEqual([])
    expect(filterPolicyDirectory(rows, '', '', '')).toEqual(rows)
  })
  it('retains historical and unlinked policies and handles hidden client embeds', async () => {
    const f = fixture([{ ...row(1), status: 'surrendered', household: [{ display_name: 'Array client' }] },
      { ...row(2), household: null }])
    const rows = await fetchPolicyDirectory(f.client)
    expect(rows[0].household?.display_name).toBe('Array client')
    expect(rows[0].status).toBe('surrendered')
    expect(rows[0].source_application_id).toBeNull()
    expect(rows[1].household).toBeNull()
    expect(filterPolicyDirectory(rows, 'PN-2', '', '')).toEqual([rows[1]])
  })
})
