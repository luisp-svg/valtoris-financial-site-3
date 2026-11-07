import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchExecutiveRows } from './ExecutiveReportingStage1'

type Row = { id: string }

function mockClient(rows: Row[], failAtOffset?: number) {
  const offsets: number[] = []
  const db = {
    from: () => ({
      select: () => {
        let start = 0
        let end = 0
        const query = {
          order: () => query,
          is: () => query,
          in: () => query,
          eq: () => query,
          range: (pageStart: number, pageEnd: number) => {
            start = pageStart
            end = pageEnd
            offsets.push(start)
            return query
          },
          then: (resolve: (result: { data: Row[] | null; error: { message: string } | null }) => unknown) =>
            Promise.resolve(start === failAtOffset
              ? { data: null, error: { message: 'Page unavailable' } }
              : { data: rows.slice(start, end + 1), error: null }).then(resolve),
        }
        return query
      },
    }),
  } as unknown as SupabaseClient
  return { db, offsets }
}

describe('executive reporting pagination', () => {
  it('returns an empty dataset without inventing totals', async () => {
    const { db, offsets } = mockClient([])
    await expect(fetchExecutiveRows<Row>(db, 'tasks', 'id', 'active')).resolves.toEqual([])
    expect(offsets).toEqual([0])
  })
  it('retrieves all records beyond a single response page', async () => {
    const rows = Array.from({ length: 451 }, (_, index) => ({ id: String(index) }))
    const { db, offsets } = mockClient(rows)
    await expect(fetchExecutiveRows<Row>(db, 'tasks', 'id', 'active')).resolves.toEqual(rows)
    expect(offsets).toEqual([0, 200, 400])
  })
  it('rejects incomplete data instead of showing misleading counts', async () => {
    const rows = Array.from({ length: 250 }, (_, index) => ({ id: String(index) }))
    const { db } = mockClient(rows, 200)
    await expect(fetchExecutiveRows<Row>(db, 'opportunities', 'id', 'not_deleted')).rejects.toMatchObject({ message: 'Page unavailable' })
  })
})
