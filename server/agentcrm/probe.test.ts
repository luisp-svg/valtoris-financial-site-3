import { describe, expect, it, vi } from 'vitest'
import { LeadConnectorClient } from './client'
import { probeAgentCrm, runConfiguredAgentCrmProbe } from './probe'

const FAKE_TOKEN = 'pit-test-placeholder'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function routeFetch(routes: Record<string, Response | (() => Response)>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!(input instanceof URL)) throw new Error('expected a URL request')
    if (init?.method !== 'GET') throw new Error('expected GET')
    const key = `${input.pathname}${input.search}`
    const match = routes[key] ?? routes[input.pathname]
    if (!match) return jsonResponse({ message: 'missing' }, 404)
    return typeof match === 'function' ? match() : match
  })
}

describe('probeAgentCrm', () => {
  it('authenticates, reads one contact, and keeps metadata names without contact fields', async () => {
    const fetchImpl = routeFetch({
      '/locations/loc-1': jsonResponse({ location: { id: 'loc-1', name: 'Valtoris AgentCRM' } }),
      '/contacts/?locationId=loc-1&limit=1': jsonResponse({
        contacts: [{ id: 'c-1', email: 'hidden@example.com', phone: '+15555550100', firstName: 'Hidden' }],
      }),
      '/locations/loc-1/customFields': jsonResponse({
        customFields: [{ id: 'cf-1', name: 'Report Card Grade', fieldKey: 'contact.report_card_grade', dataType: 'TEXT', model: 'contact' }],
      }),
      '/locations/loc-1/tags': jsonResponse({ tags: [{ id: 'tag-1', name: 'Report Card' }] }),
      '/opportunities/pipelines?locationId=loc-1': jsonResponse({
        pipelines: [{ id: 'pipe-1', name: 'Life', stages: [{ id: 'st-1', name: 'New' }] }],
      }),
      '/calendars/?locationId=loc-1': jsonResponse({ calendars: [{ id: 'cal-1', name: 'Intro' }] }),
      '/workflows/?locationId=loc-1': jsonResponse({ workflows: [{ id: 'wf-1', name: 'Welcome' }] }),
    })
    const client = new LeadConnectorClient({ token: FAKE_TOKEN, fetchImpl })
    const report = await probeAgentCrm(client, 'loc-1')

    expect(report.authentication).toBe('PASS')
    expect(report.locationLookup).toBe('PASS')
    expect(report.contactRead).toBe('PASS')
    expect(report.metadataDiscovery).toBe('PASS')
    expect(report.contactsReturned).toBe(1)
    expect(report.location).toEqual({ id: 'loc-1', name: 'Valtoris AgentCRM' })
    expect(report.customFields[0]).toMatchObject({ id: 'cf-1', name: 'Report Card Grade' })
    expect(report.tags).toEqual([{ id: 'tag-1', name: 'Report Card' }])
    expect(report.pipelines[0]?.stages).toEqual([{ id: 'st-1', name: 'New' }])
    expect(JSON.stringify(report)).not.toMatch(/hidden@example.com|Hidden|5555550100/)
    expect(fetchImpl.mock.calls.every((call) => call[1]?.method === 'GET')).toBe(true)
  })

  it('stops after an unauthorized location lookup', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ message: 'nope' }, 401),
    )
    const client = new LeadConnectorClient({ token: FAKE_TOKEN, fetchImpl })
    const report = await probeAgentCrm(client, 'loc-1')
    expect(report.authentication).toBe('FAIL')
    expect(report.locationLookup).toBe('FAIL')
    expect(report.contactRead).toBe('NOT_RUN')
    expect(report.metadataDiscovery).toBe('NOT_RUN')
    expect(report.failures).toEqual([{ step: 'location', category: 'unauthorized', status: 401 }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('treats a missing workflow route as unavailable while other metadata can pass', async () => {
    const fetchImpl = routeFetch({
      '/locations/loc-1': jsonResponse({ location: { id: 'loc-1', name: 'AgentCRM' } }),
      '/contacts/?locationId=loc-1&limit=1': jsonResponse({ contacts: [] }),
      '/locations/loc-1/customFields': jsonResponse({ customFields: [] }),
      '/locations/loc-1/tags': jsonResponse({ tags: [] }),
      '/opportunities/pipelines?locationId=loc-1': jsonResponse({ pipelines: [] }),
      '/calendars/?locationId=loc-1': jsonResponse({ calendars: [] }),
      '/workflows/?locationId=loc-1': jsonResponse({}, 404),
    })
    const client = new LeadConnectorClient({ token: FAKE_TOKEN, fetchImpl })
    const report = await probeAgentCrm(client, 'loc-1')
    expect(report.contactRead).toBe('PASS')
    expect(report.contactsReturned).toBe(0)
    expect(report.metadataDiscovery).toBe('PASS')
    expect(report.unavailable).toContain('workflows')
  })
})

describe('runConfiguredAgentCrmProbe', () => {
  it('does not call the network when the token is absent', async () => {
    const fetchImpl = vi.fn()
    const result = await runConfiguredAgentCrmProbe({ AGENTCRM_LOCATION_ID: 'loc-1' }, fetchImpl)
    expect(result).toEqual({ configured: false, missing: ['token'] })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
