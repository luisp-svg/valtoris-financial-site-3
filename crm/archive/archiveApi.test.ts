import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { changeArchive, loadArchived } from './archiveApi'
const client = (data: unknown, message?: string) => ({ rpc: vi.fn().mockResolvedValue({ data, error: message ? { message } : null }) }) as unknown as SupabaseClient

describe('archive acknowledgements and errors', () => {
  it('accepts only exact successful acknowledgements', async () => {
    await expect(changeArchive(client({ok:true,id:'a',kind:'lead',archived:true}), 'lead', 'a', true)).resolves.toBeUndefined()
    for (const data of [null, {ok:true,id:'b',kind:'lead',archived:true}, {ok:true,id:'a',kind:'household',archived:true}, {ok:true,id:'a',kind:'lead',archived:false}]) {
      await expect(changeArchive(client(data), 'lead', 'a', true)).rejects.toThrow('could not be confirmed')
    }
  })
  it('uses the dedicated restore function', async () => {
    const c = client({ok:true,id:'a',kind:'household',archived:false})
    await changeArchive(c, 'household','a',false)
    expect(c.rpc).toHaveBeenCalledWith('restore_crm_record',{p_kind:'household',p_id:'a'})
  })
  it('explains dependency and duplicate restrictions', async () => {
    await expect(changeArchive(client(null,'CRM_ARCHIVE:restore_household_first'),'lead','a',false)).rejects.toThrow('Restore the household first')
    await expect(changeArchive(client(null,'CRM_ARCHIVE:resolve_duplicate_first'),'lead','a',true)).rejects.toThrow('pending duplicate review')
  })
  it('does not expose raw database errors', async () => {
    await expect(changeArchive(client(null,'private data'),'lead','a',true)).rejects.toThrow('Refresh and try again')
  })
  it('pages archived records on the server', async () => {
    const c = client([])
    expect(await loadArchived(c,'lead',2)).toEqual([])
    expect(c.rpc).toHaveBeenCalledWith('list_archived_crm_records',{p_kind:'lead',p_offset:100,p_limit:50})
  })
  it('fails closed on an unavailable archive list', async () => {
    await expect(loadArchived(client(null),'lead',0)).rejects.toThrow('Unable to load')
  })
})
