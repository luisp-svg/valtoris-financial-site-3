import { readAgentCrmConfig } from '../config.js'
import { LeadConnectorClient } from '../client.js'
import { LEADCONNECTOR_API_BASE_URL, LEADCONNECTOR_API_VERSION } from '../constants.js'
import { quoteSyncEnabled } from './config.js'
/** Quote-specific writer. The general AgentCRM client remains read-only. */
export function quoteTransport(env: NodeJS.ProcessEnv = process.env) {
  const config = readAgentCrmConfig(env)
  if (!quoteSyncEnabled(env) || !config.configured) throw new Error('sync_disabled')
  const reader = new LeadConnectorClient({ token: config.token })
  return {
    get: (path: string, query: Record<string, string | number> = {}) => reader.get(path, query),
    async write(method: 'POST' | 'PUT', path: string, body: Record<string, unknown>): Promise<unknown> {
      const valid = method === 'POST' ? ['/contacts/upsert', '/opportunities/'].includes(path) : /^\/contacts\/[a-zA-Z0-9]+$/.test(path)
      if (!valid) throw new Error('invalid_write')
      const response = await fetch(LEADCONNECTOR_API_BASE_URL + path, {
        method, headers: { Authorization: `Bearer ${config.token}`, Version: LEADCONNECTOR_API_VERSION, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) { await response.arrayBuffer(); throw new Error(`agentcrm_http_${response.status}`) }
      return response.json()
    },
  }
}
