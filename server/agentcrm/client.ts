import {
  LEADCONNECTOR_API_BASE_URL,
  LEADCONNECTOR_API_VERSION,
  LEADCONNECTOR_TIMEOUT_MS,
} from './constants.js'
import { assertAgentCrmServerOnly } from './config.js'
import { categoryForStatus, LeadConnectorError } from './errors.js'

export type LeadConnectorQuery = Record<string, string | number | undefined>

export type LeadConnectorClientOptions = {
  token: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
}

/**
 * Read-only LeadConnector API v2 client.
 * Exposes GET only. Callers cannot send a request body.
 */
export class LeadConnectorClient {
  private readonly token: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly baseUrl: string

  constructor(options: LeadConnectorClientOptions) {
    assertAgentCrmServerOnly()
    const token = options.token.trim()
    if (!token) {
      throw new LeadConnectorError('unauthorized', null)
    }
    this.token = token
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? LEADCONNECTOR_TIMEOUT_MS
    this.baseUrl = (options.baseUrl ?? LEADCONNECTOR_API_BASE_URL).replace(/\/$/, '')
  }

  async get(path: string, query: LeadConnectorQuery = {}): Promise<unknown> {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new LeadConnectorError('invalid_response', null)
    }

    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === '') continue
      url.searchParams.set(key, String(value))
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
          Version: LEADCONNECTOR_API_VERSION,
        },
        signal: controller.signal,
      })
    } catch (error) {
      if (isAbortError(error)) {
        throw new LeadConnectorError('timeout', null)
      }
      throw new LeadConnectorError('network', null)
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      await discardBody(response)
      throw new LeadConnectorError(categoryForStatus(response.status), response.status)
    }

    try {
      return await response.json()
    } catch {
      throw new LeadConnectorError('invalid_response', response.status)
    }
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
  )
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.arrayBuffer()
  } catch {
    // Ignore unreadable error bodies. Never surface them.
  }
}
