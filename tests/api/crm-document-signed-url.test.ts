import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleCrmDocumentSignedUrlRequest } from '../../api/crm/documents/signed-url'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), maybeSingle: vi.fn(),
  admin: vi.fn(), storageFrom: vi.fn(), createSignedUrl: vi.fn(),
}))
vi.mock('../../lib/supabase/server.js', () => ({
  createSupabaseServerClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}))
vi.mock('../../lib/supabase/admin.js', () => ({ createSupabaseAdminClient: mocks.admin }))

const documentId = '00000000-0000-4000-8000-000000000001'
function response() {
  return {
    headers: {} as Record<string, string>, statusCode: 0, body: undefined as unknown,
    setHeader(name: string, value: string) { this.headers[name] = value },
    status(code: number) { this.statusCode = code; return this },
    json(body: unknown) { this.body = body; return this },
  }
}
async function run(method = 'GET', id = documentId) {
  const res = response()
  await handleCrmDocumentSignedUrlRequest({ method, query: { documentId: id } } as never, res as never)
  expect(res.headers['Cache-Control']).toBe('private, no-store')
  expect(res.headers['CDN-Cache-Control']).toBe('no-store')
  expect(res.headers['Vercel-CDN-Cache-Control']).toBe('no-store')
  return res
}
beforeEach(() => {
  vi.resetAllMocks()
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: mocks.maybeSingle }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query)
  mocks.from.mockReturnValue(query)
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null })
  mocks.maybeSingle.mockResolvedValue({ data: {
    id: documentId, storage_bucket: 'crm-documents', storage_path: 'authorized/document.pdf',
    mime_type: 'application/pdf', doc_type: 'pc_quote_auto', file_name: 'quote.pdf',
  }, error: null })
  mocks.admin.mockReturnValue({ storage: { from: mocks.storageFrom } })
  mocks.storageFrom.mockReturnValue({ createSignedUrl: mocks.createSignedUrl })
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.test/temporary-link' }, error: null })
})
describe('private document download links', () => {
  it('prevents caching and signs only the RLS-authorized document for 120 seconds', async () => {
    const res = await run()
    expect(res.statusCode).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('documents')
    expect(mocks.storageFrom).toHaveBeenCalledWith('crm-documents')
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('authorized/document.pdf', 120)
    expect(mocks.getUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.from.mock.invocationCallOrder[0])
    expect(mocks.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(mocks.admin.mock.invocationCallOrder[0])
  })
  it('protects method and validation errors without accessing auth or storage', async () => {
    expect((await run('POST')).statusCode).toBe(405)
    expect((await run('GET', 'invalid')).statusCode).toBe(400)
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('denies missing or rejected authentication before document lookup', async () => {
    for (const error of [null, { message: 'invalid session' }]) {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error })
      expect((await run()).statusCode).toBe(401)
    }
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('does not mint links for absent or inaccessible document rows', async () => {
    for (const error of [null, { message: 'denied' }]) {
      mocks.maybeSingle.mockResolvedValue({ data: null, error })
      expect((await run()).statusCode).toBe(404)
    }
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('protects configuration failures without exposing their details', async () => {
    mocks.admin.mockImplementation(() => { throw new Error('private configuration') })
    const res = await run()
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('private configuration')
  })
  it('protects storage failures and missing links without exposing storage errors', async () => {
    for (const error of [null, { message: 'private storage failure' }]) {
      mocks.createSignedUrl.mockResolvedValue({ data: null, error })
      const res = await run()
      expect(res.statusCode).toBe(500)
      expect(JSON.stringify(res.body)).not.toContain('private storage failure')
    }
  })
})
