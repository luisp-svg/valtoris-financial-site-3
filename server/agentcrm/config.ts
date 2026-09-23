import { AGENTCRM_LOCATION_ENV, AGENTCRM_TOKEN_ENV } from './constants.js'

const FORBIDDEN_VITE_NAMES = [
  'VITE_AGENTCRM_PRIVATE_INTEGRATION_TOKEN',
  'VITE_AGENTCRM_LOCATION_ID',
] as const

export type AgentCrmMissingSetting = 'token' | 'locationId'

export type AgentCrmConfig =
  | { configured: true; token: string; locationId: string }
  | { configured: false; missing: AgentCrmMissingSetting[] }

export function assertAgentCrmServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('AgentCRM client must run only on the server.')
  }
}

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Server-only AgentCRM settings.
 * The token is never read from import.meta.env or a VITE_ variable.
 * Location id is required because LeadConnector v2 does not return the
 * sub-account id from the Private Integration token alone.
 */
export function readAgentCrmConfig(env: NodeJS.ProcessEnv = process.env): AgentCrmConfig {
  assertAgentCrmServerOnly()

  if (FORBIDDEN_VITE_NAMES.some((name) => readTrimmed(env, name) !== '')) {
    throw new Error('AgentCRM settings must not use a VITE_ prefix.')
  }

  const token = readTrimmed(env, AGENTCRM_TOKEN_ENV)
  const locationId = readTrimmed(env, AGENTCRM_LOCATION_ENV)
  const missing: AgentCrmMissingSetting[] = []
  if (!token) missing.push('token')
  if (!locationId) missing.push('locationId')
  if (missing.length > 0) return { configured: false, missing }
  return { configured: true, token, locationId }
}
