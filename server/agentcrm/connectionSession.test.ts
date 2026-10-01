import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), probe: vi.fn(), rate: vi.fn(), from: vi.fn() }))
vi.mock('../../lib/supabase/server.js', () => ({ createSupabaseServerClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }))
vi.mock('./connectionCheck.js', () => ({ checkAgentCrmConnection: mocks.probe }))
vi.mock('../ingest/familyReportCard/abuse.js', () => ({ checkRateLimit: mocks.rate }))
import handler from '../../api/crm/session'
async function request(query: Record<string, unknown> = { check: 'agentcrm' }, method = 'GET') {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  await handler({ method, query } as VercelRequest, res as unknown as VercelResponse)
  return res
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner123', email: 'owner@example.com' } }, error: null })
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: mocks.profile }) }) })
  mocks.profile.mockResolvedValue({ data: { role: 'owner' }, error: null })
  mocks.rate.mockReturnValue({ allowed: true })
  mocks.probe.mockResolvedValue({ ok: true, mode: 'read_only' })
})
describe('connection diagnostic authorization', () => {
  it('allows an authenticated owner and disables response caching', async () => {
    const res = await request()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(mocks.probe).toHaveBeenCalledTimes(1)
    expect(mocks.rate).toHaveBeenCalledWith('agentcrm-connection:owner123')
  })
  it('rejects anonymous callers before provider access', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await request()).status).toHaveBeenCalledWith(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it.each(['advisor', 'client', 'admin', null])('rejects role %s', async role => {
    mocks.profile.mockResolvedValue({ data: { role }, error: null })
    expect((await request()).status).toHaveBeenCalledWith(403)
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('fails closed on a profile read error', async () => {
    mocks.profile.mockResolvedValue({ data: { role: 'owner' }, error: { message: 'private' } })
    expect((await request()).status).toHaveBeenCalledWith(403)
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('throttles repeated owner requests', async () => {
    mocks.rate.mockReturnValue({ allowed: false })
    const res = await request()
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60')
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('preserves the ordinary session response without provider reads', async () => {
    const res = await request({})
    expect(res.json).toHaveBeenCalledWith({ ok: true, authenticated: true, user: { id: 'owner123', email: 'owner@example.com' } })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it.each([{ check: 'unknown' }, { check: ['agentcrm', 'agentcrm'] }])('rejects ambiguous or unknown check parameters', async query => {
    expect((await request(query)).status).toHaveBeenCalledWith(400)
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('rejects non-GET requests', async () => {
    expect((await request({}, 'POST')).status).toHaveBeenCalledWith(405)
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('sanitizes unexpected authentication errors', async () => {
    mocks.getUser.mockRejectedValue(new Error('private credential'))
    const res = await request()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Session check failed' })
    expect(mocks.probe).not.toHaveBeenCalled()
  })
})
