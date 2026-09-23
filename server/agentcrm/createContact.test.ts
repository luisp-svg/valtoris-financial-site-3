import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { AGENTCRM_CONTACT_CREATION_ENV } from './contactCreationGate'
import { createAgentCrmContact, STUDENT_LOAN_CONTACT_SOURCE } from './createContact'
import { LeadConnectorError } from './errors'

const CRM_DEV = 'https://cxgiaevervjttbuiramd.supabase.co'
const CRM_PROD = 'https://phanoknohbidqtgrpwvk.supabase.co'
const TOKEN = 'pit-test-placeholder'
const LOCATION = 'loc-test'
const EMAIL = 'valtoris-agentcrm-create-test-001@example.invalid'
const PHONE = '+12025550199'

const INPUT = {
  firstName: 'Valtoris',
  lastName: 'API Create Test',
  email: EMAIL,
  phone: '202-555-0199',
}

function enabledEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    [AGENTCRM_CONTACT_CREATION_ENV]: 'true',
    SUPABASE_URL: CRM_DEV,
    AGENTCRM_PRIVATE_INTEGRATION_TOKEN: TOKEN,
    AGENTCRM_LOCATION_ID: LOCATION,
    ...overrides,
  }
}

function contactBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    contact: {
      id: 'synthetic-created-contact',
      locationId: LOCATION,
      firstName: 'Valtoris',
      lastName: 'API Create Test',
      email: EMAIL,
      phone: '+1 (202) 555-0199',
      source: STUDENT_LOAN_CONTACT_SOURCE,
      tags: ['do-not-keep'],
      ...overrides,
    },
  }
}

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createAgentCrmContact', () => {
  it('does not POST when the creation gate is off', async () => {
    const fetchImpl = vi.fn()
    await expect(
      createAgentCrmContact(INPUT, {
        env: { SUPABASE_URL: CRM_DEV, AGENTCRM_PRIVATE_INTEGRATION_TOKEN: TOKEN, AGENTCRM_LOCATION_ID: LOCATION },
        fetchImpl,
      }),
    ).rejects.toMatchObject({ category: 'forbidden' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not POST for the production host even when the flag is true', async () => {
    const fetchImpl = vi.fn()
    await expect(
      createAgentCrmContact(INPUT, { env: enabledEnv({ SUPABASE_URL: CRM_PROD }), fetchImpl }),
    ).rejects.toMatchObject({ category: 'forbidden' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not POST for CRM-dev when the flag is false', async () => {
    const fetchImpl = vi.fn()
    await expect(
      createAgentCrmContact(INPUT, {
        env: enabledEnv({ [AGENTCRM_CONTACT_CREATION_ENV]: 'false' }),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ category: 'forbidden' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts only the minimum payload when CRM-dev creation is enabled', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(contactBody()))
    const created = await createAgentCrmContact(INPUT, { env: enabledEnv(), fetchImpl })
    expect(created.id).toBe('synthetic-created-contact')
    expect(created.sourceMatched).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const url = fetchImpl.mock.calls[0]?.[0]
    const init = fetchImpl.mock.calls[0]?.[1]
    if (!(url instanceof URL) || !init) throw new Error('expected a URL request')
    expect(url.pathname).toBe('/contacts/')
    expect(init.method).toBe('POST')
    expect(url.toString()).not.toContain(TOKEN)
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`)
    expect(headers.get('Version')).toBe('2021-07-28')

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['email', 'firstName', 'lastName', 'locationId', 'phone', 'source'])
    expect(body).toEqual({
      locationId: LOCATION,
      firstName: 'Valtoris',
      lastName: 'API Create Test',
      email: EMAIL,
      phone: PHONE,
      source: STUDENT_LOAN_CONTACT_SOURCE,
    })
    expect(body).not.toHaveProperty('tags')
    expect(body).not.toHaveProperty('customFields')
    expect(body).not.toHaveProperty('dnd')
    expect(JSON.stringify(body)).not.toMatch(/score|grade|consent|memberId/i)
  })

  it('rejects a success body without a contact id', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(contactBody({ id: '' })))
    await expect(createAgentCrmContact(INPUT, { env: enabledEnv(), fetchImpl })).rejects.toMatchObject({
      category: 'invalid_response',
    })
  })

  it('rejects a returned identity that does not match the request', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(contactBody({ email: 'other@example.invalid' })))
    try {
      await createAgentCrmContact(INPUT, { env: enabledEnv(), fetchImpl })
      throw new Error('expected identity rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(LeadConnectorError)
      expect((error as LeadConnectorError).category).toBe('invalid_response')
      expect((error as Error).message).not.toContain(EMAIL)
      expect((error as Error).message).not.toContain('other@example.invalid')
    }
  })

  it.each([
    [400, 'http'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [429, 'rate_limited'],
    [500, 'upstream'],
    [422, 'http'],
  ] as const)('sanitizes HTTP %s as %s and drops the body', async (status, category) => {
    const leaked = `body-secret-${status}`
    const fetchImpl = vi.fn(async () => jsonResponse({ message: leaked, email: EMAIL }, status))
    try {
      await createAgentCrmContact(INPUT, { env: enabledEnv(), fetchImpl })
      throw new Error('expected a sanitized failure')
    } catch (error) {
      expect(error).toBeInstanceOf(LeadConnectorError)
      expect((error as LeadConnectorError).category).toBe(category)
      expect((error as LeadConnectorError).status).toBe(status)
      expect((error as Error).message).not.toContain(leaked)
      expect((error as Error).message).not.toContain(EMAIL)
      expect((error as Error).message).not.toContain(TOKEN)
    }
  })

  it('maps an aborted request to a timeout without the underlying message', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error(`timeout for ${EMAIL}`)
          error.name = 'AbortError'
          reject(error)
        })
      })
    })
    try {
      await createAgentCrmContact(INPUT, { env: enabledEnv(), fetchImpl, timeoutMs: 5 })
      throw new Error('expected a timeout')
    } catch (error) {
      expect(error).toBeInstanceOf(LeadConnectorError)
      expect((error as LeadConnectorError).category).toBe('timeout')
      expect((error as Error).message).not.toContain(EMAIL)
    }
  })

  it('does not log the request or response', async () => {
    const sinks = ['log', 'info', 'warn', 'error', 'debug'] as const
    const spies = sinks.map((method) => vi.spyOn(console, method).mockImplementation(() => {}))
    const fetchImpl = vi.fn(async () => jsonResponse(contactBody()))
    await createAgentCrmContact(INPUT, { env: enabledEnv(), fetchImpl })
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })

  it('does not create a contact for a source outside the enabled configuration', async () => {
    const fetchImpl = vi.fn()
    await expect(
      createAgentCrmContact({ ...INPUT, source: 'Credit Report Card' }, { env: enabledEnv(), fetchImpl }),
    ).rejects.toMatchObject({ category: 'forbidden' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('leaves the generic client on GET', () => {
    const clientSource = readFileSync(new URL('./client.ts', import.meta.url), 'utf8')
    const createSource = readFileSync(new URL('./createContact.ts', import.meta.url), 'utf8')
    expect(clientSource).toContain("method: 'GET'")
    expect(clientSource).not.toMatch(/method:\s*['"]POST['"]|method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/)
    expect(createSource).toMatch(/method:\s*'POST'/)
    expect(createSource).not.toMatch(/method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/)
    expect(createSource).not.toMatch(/\/contacts\/upsert|tags:|customFields:/)
  })
})
