import { describe, expect, it, vi } from 'vitest'
import { checkAgentCrmConnection } from './connectionCheck'
import { REPORT_CARD_FOLLOW_UP_TARGET as target } from './reportCardFollowUpConfig'

const env = { AGENTCRM_PRIVATE_INTEGRATION_TOKEN: 'private-test-token', AGENTCRM_LOCATION_ID: target.locationId }
const bodies: Record<string, unknown> = {
  [`/locations/${target.locationId}`]: { location: { id: target.locationId, name: 'Private name' } },
  '/contacts/': { contacts: [{ id: 'contact123', locationId: target.locationId, email: 'private@example.com' }] },
  '/opportunities/pipelines': { pipelines: [{ id: target.pipelineId, stages: [{ id: target.initialStageId }] }] },
  '/opportunities/search': { meta: { total: 1 }, opportunities: [{ id: 'opp123', contactId: 'contact123', pipelineId: target.pipelineId, locationId: target.locationId, name: 'Private opportunity' }] },
  '/contacts/contact123/tasks': { tasks: [{ body: 'Private task' }] },
}
function transport(overrides: Record<string, unknown> = {}, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = new URL(String(input)).pathname
    return new Response(JSON.stringify(path in overrides ? overrides[path] : bodies[path]), { status })
  })
}
describe('owner connection diagnostic', () => {
  it('makes only bounded, versioned GET reads and returns no provider data or secrets', async () => {
    const fetcher = transport()
    const report = await checkAgentCrmConnection(env, fetcher)
    expect(report.ok).toBe(true)
    expect(report.writeAccess).toBe('not_tested')
    expect(report.checks.contactOpportunities.summary).toEqual({ returned: 1, total: 1, uniqueIds: 1, matchingContact: 1, matchingPipeline: 1, nextPagePresent: false, nextPageUrlPresent: false })
    expect(fetcher).toHaveBeenCalledTimes(6)
    for (const [input, init] of fetcher.mock.calls) {
      const url = new URL(String(input))
      expect(url.origin).toBe('https://services.leadconnectorhq.com')
      expect(init?.method).toBe('GET')
      expect(init?.body).toBeUndefined()
      expect(init?.redirect).toBe('error')
      expect(new Headers(init?.headers).get('Version')).toBe(url.pathname.endsWith('/tasks') || url.pathname.endsWith('/search') ? 'v3' : '2021-07-28')
      if (url.pathname === '/contacts/') expect(url.searchParams.get('limit')).toBe('1')
      if (url.pathname === '/opportunities/search') expect(url.searchParams.get('limit')).toBe(url.searchParams.has('contactId') ? '100' : '1')
    }
    expect(JSON.stringify(report)).not.toMatch(/private|contact123|Private|I2Y36/i)
  })
  it.each([
    [{}, 'missing_configuration'],
    [{ ...env, AGENTCRM_LOCATION_ID: 'other' }, 'location_mismatch'],
    [{ ...env, VITE_AGENTCRM_PRIVATE_INTEGRATION_TOKEN: 'secret' }, 'invalid_configuration'],
  ])('fails closed before fetching for invalid configuration', async (settings, reason) => {
    const fetcher = transport()
    expect((await checkAgentCrmConnection(settings, fetcher)).checks.location.reason).toBe(reason)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([[401, 'unauthorized'], [403, 'forbidden'], [429, 'rate_limited'], [500, 'upstream']])('sanitizes HTTP %s and stops after location failure', async (status, reason) => {
    const fetcher = transport({}, status as number)
    const report = await checkAgentCrmConnection(env, fetcher)
    expect(report.checks.location.reason).toBe(reason)
    expect(report.checks.contacts.status).toBe('NOT_RUN')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([
    { id: 'contact123', locationId: 'foreign' },
    { id: '../unsafe', locationId: target.locationId },
  ])('does not read tasks for an unverified contact', async contact => {
    const fetcher = transport({ '/contacts/': { contacts: [contact] } })
    const report = await checkAgentCrmConnection(env, fetcher)
    expect(report.checks.contacts.status).toBe('FAIL')
    expect(report.checks.tasks.status).toBe('NOT_RUN')
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
  it('does not create a contact to test an empty account', async () => {
    const fetcher = transport({ '/contacts/': { contacts: [] } })
    const report = await checkAgentCrmConnection(env, fetcher)
    expect(report.checks.tasks.reason).toBe('no_existing_contact')
    expect(report.ok).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
  it.each([
    ['/opportunities/pipelines', { pipelines: [{ id: target.pipelineId, stages: [] }] }, 'pipeline'],
    ['/opportunities/search', { opportunities: [{ pipelineId: 'foreign' }] }, 'opportunities'],
    ['/contacts/contact123/tasks', { unexpected: 'private error' }, 'tasks'],
  ] as const)('rejects malformed or mismatched %s', async (path, body, check) => {
    const report = await checkAgentCrmConnection(env, transport({ [path]: body }))
    expect(report.checks[check]).toEqual({ status: 'FAIL', reason: 'invalid_response' })
    expect(report.ok).toBe(false)
  })

  it('reports mismatched provider totals without exposing IDs or guessing a correction', async () => {
    const fetcher = transport()
    const read: typeof fetch = async (input, init) => {
      const url = new URL(String(input))
      if (url.searchParams.has('contactId')) return new Response(JSON.stringify({ opportunities: [
        { id: 'privateOpp1', contactId: 'contact123', pipelineId: target.pipelineId },
        { id: 'privateOpp1', contactId: 'contact123', pipelineId: target.pipelineId },
        { id: 'privateOpp2', contactId: 'foreignContact', pipelineId: 'foreignPipeline' },
      ], meta: { total: 9, nextPage: 2, nextPageUrl: "https://private-provider-url.invalid/page2" } }))
      return fetcher(input, init)
    }
    const report = await checkAgentCrmConnection(env, read)
    expect(report.checks.contactOpportunities.summary).toEqual({ returned: 3, total: 9, uniqueIds: 2, matchingContact: 2, matchingPipeline: 2, nextPagePresent: true, nextPageUrlPresent: true })
    expect(JSON.stringify(report)).not.toMatch(/privateOpp|foreignContact|foreignPipeline|private-provider-url/)
  })
  it('sanitizes transport exceptions', async () => {
    const fetcher = vi.fn(async () => { throw new Error('private token and client information') })
    const report = await checkAgentCrmConnection(env, fetcher)
    expect(report.checks.location.reason).toBe('network')
    expect(JSON.stringify(report)).not.toContain('private')
  })
})
