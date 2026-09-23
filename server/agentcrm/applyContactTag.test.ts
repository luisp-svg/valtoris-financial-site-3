import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { applyReportCardServiceTag, applyStudentLoanServiceTag, STUDENT_LOAN_SERVICE_TAG } from './applyContactTag'
import { AGENTCRM_CONTACT_TAGGING_ENV } from './contactTaggingGate'
import { LeadConnectorError } from './errors'

const TOKEN = 'pit-test-placeholder'
const CONTACT_ID = 'syntheticContact1'

function enabledEnv(): NodeJS.ProcessEnv {
  return {
    [AGENTCRM_CONTACT_TAGGING_ENV]: 'true',
    SUPABASE_URL: 'https://cxgiaevervjttbuiramd.supabase.co',
    AGENTCRM_PRIVATE_INTEGRATION_TOKEN: TOKEN,
    AGENTCRM_LOCATION_ID: 'loc-test',
  }
}

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('applyStudentLoanServiceTag', () => {
  it('posts only the existing student loan service tag', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ tags: [STUDENT_LOAN_SERVICE_TAG] }),
    )
    await applyStudentLoanServiceTag(CONTACT_ID, { env: enabledEnv(), fetchImpl })
    const url = fetchImpl.mock.calls[0]?.[0]
    const init = fetchImpl.mock.calls[0]?.[1]
    if (!(url instanceof URL) || !init) throw new Error('expected a URL request')
    expect(url.pathname).toBe(`/contacts/${CONTACT_ID}/tags`)
    expect(init.method).toBe('POST')
    expect(url.toString()).not.toContain(TOKEN)
    expect(JSON.parse(String(init.body))).toEqual({ tags: [STUDENT_LOAN_SERVICE_TAG] })
  })

  it('does not POST when the tagging gate is off', async () => {
    const fetchImpl = vi.fn()
    await expect(applyStudentLoanServiceTag(CONTACT_ID, { env: {}, fetchImpl })).rejects.toMatchObject({
      category: 'forbidden',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects a success body that does not include the service tag', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ tags: ['some-other-tag'] }))
    await expect(applyStudentLoanServiceTag(CONTACT_ID, { env: enabledEnv(), fetchImpl })).rejects.toMatchObject({
      category: 'invalid_response',
    })
  })

  it('sanitizes an unauthorized response without the body', async () => {
    const leaked = 'tag-body-secret'
    const fetchImpl = vi.fn(async () => jsonResponse({ message: leaked, email: 'hidden@example.invalid' }, 401))
    try {
      await applyStudentLoanServiceTag(CONTACT_ID, { env: enabledEnv(), fetchImpl })
      throw new Error('expected a sanitized failure')
    } catch (error) {
      expect(error).toBeInstanceOf(LeadConnectorError)
      expect((error as LeadConnectorError).category).toBe('unauthorized')
      expect((error as Error).message).not.toContain(leaked)
      expect((error as Error).message).not.toContain('hidden@example.invalid')
      expect((error as Error).message).not.toContain(TOKEN)
    }
  })

  it('does not apply a tag outside the enabled Report Card configuration', async () => {
    const fetchImpl = vi.fn()
    await expect(
      applyReportCardServiceTag(CONTACT_ID, 'credit-service', { env: enabledEnv(), fetchImpl }),
    ).rejects.toMatchObject({ category: 'forbidden' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not update a contact or send a message', () => {
    const source = readFileSync(new URL('./applyContactTag.ts', import.meta.url), 'utf8')
    const config = readFileSync(new URL('./reportCardSyncConfig.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/method:\s*'POST'/)
    expect(source).not.toMatch(/method:\s*['"]PUT['"]|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/)
    expect(source).not.toMatch(/\/contacts\/upsert|\/conversations\/messages|opportunity|workflow/)
    expect(config).toContain(STUDENT_LOAN_SERVICE_TAG)
    expect(source).not.toMatch(/aa-student|student loan leads|sl-reportcard-sent/)
  })
})