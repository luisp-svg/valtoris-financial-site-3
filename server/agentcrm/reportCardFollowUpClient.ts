import { assertAgentCrmServerOnly } from './config.js'
import { LEADCONNECTOR_API_BASE_URL, LEADCONNECTOR_TIMEOUT_MS } from './constants.js'
import { categoryForStatus, LeadConnectorError } from './errors.js'
import type { FollowUpTransport } from './reportCardFollowUp.js'

/** Narrow v3 transport. Existing contact/insurance clients retain their API version. */
export class ReportCardFollowUpClient implements FollowUpTransport {
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {
    assertAgentCrmServerOnly()
    if (!token.trim()) throw new LeadConnectorError('unauthorized', null)
  }
  get(path: string, query: Record<string, string | number> = {}) {
    return this.request('GET', path, query)
  }
  post(path: string, body: Record<string, unknown>) {
    return this.request('POST', path, {}, body)
  }
  assignContactOwner(contactId: string, userId: string) {
    if (![contactId, userId].every(value => /^[a-zA-Z0-9]{1,128}$/.test(value))) throw new LeadConnectorError('invalid_response', null)
    return this.request('PUT', `/contacts/${contactId}`, {}, { assignedTo: userId })
  }
  private async request(method: 'GET' | 'POST' | 'PUT', path: string, query: Record<string, string | number>, body?: Record<string, unknown>) {
    const allowed = method === 'GET'
      ? path === '/opportunities/search' || /^\/contacts\/[a-zA-Z0-9]{1,128}\/tasks(?:\/[a-zA-Z0-9]{1,128})?$/.test(path)
      : method === 'POST'
        ? path === '/opportunities/' || /^\/contacts\/[a-zA-Z0-9]{1,128}\/tasks$/.test(path)
        : /^\/contacts\/[a-zA-Z0-9]{1,128}$/.test(path)
    if (!allowed) throw new LeadConnectorError('invalid_response', null)
    const url = new URL(path, LEADCONNECTOR_API_BASE_URL)
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LEADCONNECTOR_TIMEOUT_MS)
    try {
      const response = await this.fetchImpl(url, {
        method, redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}`, Version: 'v3', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (!response.ok) throw new LeadConnectorError(categoryForStatus(response.status), response.status)
      try { return await response.json() } catch { throw new LeadConnectorError('invalid_response', response.status) }
    } catch (error) {
      if (error instanceof LeadConnectorError) throw error
      throw new LeadConnectorError(controller.signal.aborted ? 'timeout' : 'network', null)
    } finally { clearTimeout(timer) }
  }
}
