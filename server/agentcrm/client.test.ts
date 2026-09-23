import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { LeadConnectorClient } from './client'
import { LEADCONNECTOR_API_VERSION } from './constants'
import { readAgentCrmConfig } from './config'
import { LeadConnectorError } from './errors'
import { readContactCount, readLocation } from './reads'

const FAKE_TOKEN = 'pit-test-placeholder'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('readAgentCrmConfig', () => {
  it('stays unconfigured when the server env vars are blank', () => {
    expect(readAgentCrmConfig({})).toEqual({ configured: false, missing: ['token', 'locationId'] })
  })

  it('rejects a VITE_ prefixed token without repeating the value', () => {
    const secret = 'do-not-print-this-value'
    expect(() =>
      readAgentCrmConfig({
        VITE_AGENTCRM_PRIVATE_INTEGRATION_TOKEN: secret,
      }),
    ).toThrow(/VITE_ prefix/)
    try {
      readAgentCrmConfig({ VITE_AGENTCRM_PRIVATE_INTEGRATION_TOKEN: secret })
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).not.toContain(secret)
    }
  })
})

describe('LeadConnectorClient', () => {
  it('sends a versioned bearer GET and does not put the token in the URL', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ location: { id: 'loc-1', name: 'AgentCRM' } }),
    )
    const client = new LeadConnectorClient({ token: FAKE_TOKEN, fetchImpl })
    await readLocation(client, 'loc-1')

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const url = fetchImpl.mock.calls[0]?.[0]
    const init = fetchImpl.mock.calls[0]?.[1]
    if (!(url instanceof URL) || !init) throw new Error('expected a URL request')
    expect(url.pathname).toBe('/locations/loc-1')
    expect(url.search).toBe('')
    expect(url.toString()).not.toContain(FAKE_TOKEN)
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${FAKE_TOKEN}`)
    expect(headers.get('Version')).toBe(LEADCONNECTOR_API_VERSION)
  })

  it('reduces a contact page to a count and drops contact fields', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        contacts: [
          {
            id: 'c-1',
            firstName: 'Hidden',
            lastName: 'Person',
            email: 'hidden@example.com',
            phone: '+15555550100',
            address1: '1 Secret St',
          },
        ],
      }),
    )
    const client = new LeadConnectorClient({ token: FAKE_TOKEN, fetchImpl })
    const summary = await readContactCount(client, 'loc-1')
    expect(summary).toEqual({ returned: 1 })
    expect(JSON.stringify(summary)).not.toMatch(/Hidden|hidden@example.com|5555550100|Secret/)

    const url = fetchImpl.mock.calls[0]?.[0]
    const init = fetchImpl.mock.calls[0]?.[1]
    if (!(url instanceof URL) || !init) throw new Error('expected a URL request')
    expect(url.pathname).toBe('/contacts/')
    expect(url.searchParams.get('locationId')).toBe('loc-1')
    expect(url.searchParams.get('limit')).toBe('1')
    expect(init.method).toBe('GET')
  })

  it('returns a sanitized status on failure and discards the response body', async () => {
    const leaked = 'pit-leaked-body-value'
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ message: leaked, email: 'hidden@example.com' }), { status: 401 }),
    )
    const client = new LeadConnectorClient({ token: FAKE_TOKEN, fetchImpl })
    await expect(readLocation(client, 'loc-1')).rejects.toMatchObject({
      name: 'LeadConnectorError',
      category: 'unauthorized',
      status: 401,
    })
    try {
      await readLocation(client, 'loc-1')
    } catch (error) {
      expect(error).toBeInstanceOf(LeadConnectorError)
      expect((error as Error).message).not.toContain(leaked)
      expect((error as Error).message).not.toContain('hidden@example.com')
      expect((error as Error).message).not.toContain(FAKE_TOKEN)
    }
  })

  it('maps an aborted request to a timeout without the underlying message', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('request to secret-host failed')
          error.name = 'AbortError'
          reject(error)
        })
      })
    })
    const client = new LeadConnectorClient({ token: FAKE_TOKEN, fetchImpl, timeoutMs: 5 })
    await expect(client.get('/locations/loc-1')).rejects.toMatchObject({ category: 'timeout' })
  })
})

describe('AgentCRM server boundary', () => {
  it('keeps the client on GET and out of browser entrypoints', () => {
    const clientSource = readFileSync(new URL('./client.ts', import.meta.url), 'utf8')
    expect(clientSource).toContain("method: 'GET'")
    expect(clientSource).not.toMatch(/method:\s*'POST'|method:\s*'PUT'|method:\s*'PATCH'|method:\s*'DELETE'/)

    const readsSource = readFileSync(new URL('./reads.ts', import.meta.url), 'utf8')
    expect(readsSource).not.toMatch(/\/contacts\/upsert|\/conversations\/messages/)
  })
})
