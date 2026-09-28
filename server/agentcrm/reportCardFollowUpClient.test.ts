import { describe, expect, it, vi } from 'vitest'
import { ReportCardFollowUpClient } from './reportCardFollowUpClient'

describe('scoped Report Card provider transport', () => {
  it('updates only the owner field, leaving tags, source and consent untouched',async()=>{
    const fetcher=vi.fn<typeof fetch>(async()=>new Response('{"succeeded":true}',{status:200}))
    await new ReportCardFollowUpClient('test-token',fetcher).assignContactOwner('contact123','liz123')
    const [url,options]=fetcher.mock.calls[0]
    expect(String(url)).toBe('https://services.leadconnectorhq.com/contacts/contact123')
    expect(options?.method).toBe('PUT')
    expect(JSON.parse(String(options?.body))).toEqual({assignedTo:'liz123'})
  })
  it('rejects invalid ownership identifiers before any request',()=>{
    const fetcher=vi.fn();const client=new ReportCardFollowUpClient('test-token',fetcher)
    expect(()=>client.assignContactOwner('../contacts/other','liz')).toThrow('invalid_response')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('uses a fixed origin and v3 without changing the legacy contact client', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{"tasks":[]}', {status:200}))
    const client = new ReportCardFollowUpClient('test-token', fetcher)
    await client.get('/contacts/contact123/tasks')
    expect(String(fetcher.mock.calls[0][0])).toBe('https://services.leadconnectorhq.com/contacts/contact123/tasks')
    expect(fetcher.mock.calls[0][1]).toMatchObject({method:'GET',redirect:'error',headers:{Version:'v3',Authorization:'Bearer test-token'}})
  })
  it.each(['/conversations/messages','//evil.invalid','/contacts/c/tasks/../messages','/opportunities/search?x=1'])('refuses unrelated or malformed paths: %s', async path => {
    const fetcher = vi.fn()
    const client = new ReportCardFollowUpClient('test-token', fetcher)
    await expect(client.post(path, {})).rejects.toThrow('invalid_response')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not retry an uncertain POST or expose its error body', async () => {
    const fetcher = vi.fn(async () => new Response('private-response', {status:503}))
    await expect(new ReportCardFollowUpClient('test-token', fetcher).post('/contacts/c/tasks', {})).rejects.toThrow('upstream 503')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
