import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { LeadConnectorClient } from './client'
import { findDuplicateContactByEmail, parseDuplicateSearch } from './duplicateContact'
import { lookupAgentCrmIdentity, type AgentCrmIdentityCandidate } from './identityLookup'

const LOCATION_ID = 'loc-test'
const EMAIL = 'valtoris-agentcrm-test-001@example.invalid'
const PHONE = '+12025550101'
const CONTACT_ID = 'synthetic-contact-1'

const CANDIDATE: AgentCrmIdentityCandidate = {
  firstName: 'Valtoris',
  lastName: 'API Test',
  email: EMAIL,
  phone: '202-555-0101',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function contactRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CONTACT_ID,
    locationId: 'withheld-location',
    firstName: 'Valtoris',
    lastName: 'API Test',
    email: EMAIL,
    phone: '+1 (202) 555-0101',
    tags: ['do-not-leak-tag'],
    customFields: [{ id: 'field-1', value: 'do-not-leak-field' }],
    additionalEmails: [],
    additionalPhones: [],
    dateAdded: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function withoutPhone(record: Record<string, unknown>): Record<string, unknown> {
  const next = { ...record }
  delete next.phone
  return next
}

function searchBody(contact: unknown, matchingField?: string) {
  return {
    contact,
    ...(matchingField ? { matchingField } : {}),
    traceId: 'trace-withheld',
  }
}

function mockSearches(emailBody: unknown, phoneBody: unknown, emailStatus = 200, phoneStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof URL ? input : new URL(String(input))
    expect(url.pathname).toBe('/contacts/search/duplicate')
    expect(url.searchParams.get('locationId')).toBe(LOCATION_ID)
    const hasEmail = url.searchParams.has('email')
    const hasNumber = url.searchParams.has('number')
    expect(hasEmail && hasNumber).toBe(false)
    if (hasEmail) return jsonResponse(emailBody, emailStatus)
    if (hasNumber) return jsonResponse(phoneBody, phoneStatus)
    return jsonResponse({ contact: null }, 500)
  })
}

function clientWith(fetchImpl: typeof fetch): LeadConnectorClient {
  return new LeadConnectorClient({ token: 'pit-test-placeholder', fetchImpl })
}

describe('duplicate search contract', () => {
  it('parses a zero-match body as no contact', () => {
    expect(parseDuplicateSearch({ contact: null, traceId: 'trace-withheld' })).toBeNull()
  })

  it('parses a positive contact and drops tags, custom fields, and other metadata', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(searchBody(contactRecord(), 'email')),
    )
    const found = await findDuplicateContactByEmail(clientWith(fetchImpl), LOCATION_ID, EMAIL)
    expect(found).toEqual({
      id: CONTACT_ID,
      firstName: 'Valtoris',
      lastName: 'API Test',
      email: EMAIL,
      phone: '+1 (202) 555-0101',
    })
    expect(JSON.stringify(found)).not.toContain('do-not-leak')
    expect(JSON.stringify(found)).not.toContain('withheld-location')
    const url = fetchImpl.mock.calls[0]?.[0]
    const init = fetchImpl.mock.calls[0]?.[1]
    if (!(url instanceof URL) || !init) throw new Error('expected a URL request')
    expect(init.method).toBe('GET')
    expect(url.searchParams.get('email')).toBe(EMAIL)
    expect(url.searchParams.has('number')).toBe(false)
  })

  it('treats a missing phone key as an absent phone', () => {
    const parsed = parseDuplicateSearch(searchBody(withoutPhone(contactRecord())))
    expect(parsed?.phone).toBeNull()
  })
})

describe('lookupAgentCrmIdentity', () => {
  it('returns NO_CONTACT_FOUND when both searches are empty', async () => {
    const fetchImpl = mockSearches(searchBody(null), searchBody(null))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'NO_CONTACT_FOUND' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns EXACT_EXISTING_CONTACT when both searches are the same compatible contact', async () => {
    const fetchImpl = mockSearches(searchBody(contactRecord(), 'email'), searchBody(contactRecord(), 'phone'))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, {
      ...CANDIDATE,
      firstName: 'valtoris',
      lastName: 'api test',
    })
    expect(result).toEqual({ status: 'EXACT_EXISTING_CONTACT', externalContactId: CONTACT_ID })
    expect(JSON.stringify(result)).not.toContain(EMAIL)
    expect(JSON.stringify(result)).not.toContain('555')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const emailUrl = fetchImpl.mock.calls[0]?.[0]
    const phoneUrl = fetchImpl.mock.calls[1]?.[0]
    if (!(emailUrl instanceof URL) || !(phoneUrl instanceof URL)) throw new Error('expected URL requests')
    expect(emailUrl.searchParams.get('email')).toBe(EMAIL)
    expect(emailUrl.searchParams.has('number')).toBe(false)
    expect(phoneUrl.searchParams.get('number')).toBe(PHONE)
    expect(phoneUrl.searchParams.has('email')).toBe(false)
  })

  it('returns DIFFERENT_CONTACTS when email and phone resolve to different ids', async () => {
    const fetchImpl = mockSearches(
      searchBody(contactRecord({ id: 'contact-a' })),
      searchBody(contactRecord({ id: 'contact-b' })),
    )
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'DIFFERENT_CONTACTS' })
    expect(JSON.stringify(result)).not.toContain('contact-a')
    expect(JSON.stringify(result)).not.toContain('contact-b')
  })

  it('returns EMAIL_ONLY_MATCH when only the email search finds a contact', async () => {
    const fetchImpl = mockSearches(searchBody(contactRecord()), searchBody(null))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'EMAIL_ONLY_MATCH' })
  })

  it('returns PHONE_ONLY_MATCH when only the phone search finds a contact', async () => {
    const fetchImpl = mockSearches(searchBody(null), searchBody(contactRecord()))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'PHONE_ONLY_MATCH' })
  })

  it('returns CONTACT_FIELD_MISMATCH when the returned email does not normalize to the input', async () => {
    const mismatched = contactRecord({ email: 'other-person@example.invalid' })
    const fetchImpl = mockSearches(searchBody(mismatched), searchBody(mismatched))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'CONTACT_FIELD_MISMATCH' })
  })

  it('returns CONTACT_FIELD_MISMATCH when the returned phone does not normalize to the input', async () => {
    const mismatched = contactRecord({ phone: '+12025550199' })
    const fetchImpl = mockSearches(searchBody(mismatched), searchBody(mismatched))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'CONTACT_FIELD_MISMATCH' })
  })

  it('returns NAME_CONFLICT when both identifiers match but the name conflicts', async () => {
    const fetchImpl = mockSearches(
      searchBody(contactRecord({ firstName: 'Morgan', lastName: 'Lee' })),
      searchBody(contactRecord({ firstName: 'Morgan', lastName: 'Lee' })),
    )
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'NAME_CONFLICT' })
  })

  it('does not search when the input email is missing', async () => {
    const fetchImpl = vi.fn()
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, {
      ...CANDIDATE,
      email: '   ',
    })
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not search when the input phone is missing', async () => {
    const fetchImpl = vi.fn()
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, {
      ...CANDIDATE,
      phone: null,
    })
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'MISSING_IDENTITY_INPUT' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns CONTACT_FIELD_MISMATCH when the contact has no phone key', async () => {
    const record = withoutPhone(contactRecord())
    const fetchImpl = mockSearches(searchBody(record), searchBody(record))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'AMBIGUOUS', reason: 'CONTACT_FIELD_MISMATCH' })
  })

  it('returns INTEGRATION_ERROR for a malformed body', async () => {
    const fetchImpl = mockSearches({ unexpected: true }, searchBody(null))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'INTEGRATION_ERROR', category: 'invalid_response' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [429, 'rate_limited'],
    [503, 'upstream'],
  ] as const)('returns INTEGRATION_ERROR for HTTP %s and does not treat it as no contact', async (status, category) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: EMAIL, phone: PHONE }), { status }))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'INTEGRATION_ERROR', category })
    expect(JSON.stringify(result)).not.toContain(EMAIL)
    expect(JSON.stringify(result)).not.toContain('555')
  })

  it('returns INTEGRATION_ERROR when the phone search fails after an empty email search', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input : new URL(String(input))
      if (url.searchParams.has('email')) return jsonResponse(searchBody(null))
      return new Response('{}', { status: 429 })
    })
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    expect(result).toEqual({ status: 'INTEGRATION_ERROR', category: 'rate_limited' })
    expect(result).not.toEqual({ status: 'NO_CONTACT_FOUND' })
  })

  it('returns INTEGRATION_ERROR on timeout', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('request failed')
          error.name = 'AbortError'
          reject(error)
        })
      })
    })
    const result = await lookupAgentCrmIdentity(
      new LeadConnectorClient({ token: 'pit-test-placeholder', fetchImpl, timeoutMs: 5 }),
      LOCATION_ID,
      CANDIDATE,
    )
    expect(result).toEqual({ status: 'INTEGRATION_ERROR', category: 'timeout' })
  })

  it('normalizes email case and whitespace before the email-only query', async () => {
    const fetchImpl = mockSearches(searchBody(contactRecord({ email: '  Valtoris-AgentCRM-Test-001@Example.Invalid ' })), searchBody(contactRecord()))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, {
      ...CANDIDATE,
      email: '  Valtoris-AgentCRM-Test-001@Example.Invalid ',
    })
    expect(result.status).toBe('EXACT_EXISTING_CONTACT')
    const emailUrl = fetchImpl.mock.calls[0]?.[0]
    if (!(emailUrl instanceof URL)) throw new Error('expected a URL request')
    expect(emailUrl.searchParams.get('email')).toBe(EMAIL)
  })

  it('normalizes US phone formatting before the phone-only query', async () => {
    const fetchImpl = mockSearches(searchBody(contactRecord({ phone: '(202) 555-0101' })), searchBody(contactRecord({ phone: '2025550101' })))
    const result = await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, {
      ...CANDIDATE,
      phone: '202.555.0101',
    })
    expect(result).toEqual({ status: 'EXACT_EXISTING_CONTACT', externalContactId: CONTACT_ID })
    const phoneUrl = fetchImpl.mock.calls[1]?.[0]
    if (!(phoneUrl instanceof URL)) throw new Error('expected a URL request')
    expect(phoneUrl.searchParams.get('number')).toBe(PHONE)
  })

  it('does not log candidate identity or response bodies', async () => {
    const sinks = ['log', 'info', 'warn', 'error', 'debug'] as const
    const spies = sinks.map((method) => vi.spyOn(console, method).mockImplementation(() => {}))
    const fetchImpl = mockSearches(searchBody(contactRecord(), 'phone'), searchBody(contactRecord(), 'phone'))
    await lookupAgentCrmIdentity(clientWith(fetchImpl), LOCATION_ID, CANDIDATE)
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    }
  })

  it('keeps AgentCRM source limited to GET', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url))
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    expect(files.length).toBeGreaterThan(0)
    for (const name of files) {
      const source = readFileSync(join(dir, name), 'utf8')
      if (name === 'createContact.ts' || name === 'applyContactTag.ts') {
        expect(source).toMatch(/method:\s*'POST'/)
        expect(source).not.toMatch(/method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/)
      } else {
        expect(source).not.toMatch(/method:\s*['"]POST['"]|method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/)
      }
      if (name === 'reportCardSync.ts') {
        expect(source).not.toMatch(/console\.(log|warn|error|debug)/)
      } else {
        expect(source).not.toMatch(/console\.(log|info|warn|error|debug)/)
      }
    }
  })

})
