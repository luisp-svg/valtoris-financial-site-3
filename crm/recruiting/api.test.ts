import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listRecruits, recruitingManager } from './api'
function paged(pages: { data: { id: string; updated_at: string }[] | null; error: unknown }[]) {
  const cursors: string[] = []
  let index = 0
  const query = { select() { return this }, order() { return this }, limit() { return this }, gt(_key: string, cursor: string) { cursors.push(cursor); return this }, then(resolve: (value: unknown) => unknown) { return Promise.resolve(pages[index++]).then(resolve) } }
  return { db: { from: () => query } as unknown as SupabaseClient, cursors }
}
describe('recruiting reads', () => {
  it('continues through short server pages and sorts the complete result', async () => {
    const { db, cursors } = paged([{data:[{id:'a',updated_at:'2026-01-01'}],error:null},{data:[{id:'b',updated_at:'2026-02-01'}],error:null},{data:[],error:null}])
    expect((await listRecruits(db)).map(r => r.id)).toEqual(['b','a'])
    expect(cursors).toEqual(['a','b'])
  })
  it('rejects later-page failures instead of returning an incomplete list', async () => {
    const { db } = paged([{data:[{id:'a',updated_at:'2026-01-01'}],error:null},{data:null,error:new Error('read failed')}])
    await expect(listRecruits(db)).rejects.toThrow('read failed')
  })
  it('rejects a non-advancing cursor', async () => {
    const page = {data:[{id:'a',updated_at:'2026-01-01'}],error:null}
    await expect(listRecruits(paged([page,page]).db)).rejects.toThrow('finish loading')
  })
  it('fails closed when authority cannot be confirmed', async () => {
    const db = { rpc: async () => ({ data:true,error:new Error('unavailable') }) } as unknown as SupabaseClient
    await expect(recruitingManager(db)).rejects.toThrow('unavailable')
  })
})
