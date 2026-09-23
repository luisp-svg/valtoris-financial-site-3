import { assertAgentCrmServerOnly } from './config.js'

export const AGENTCRM_CONTACT_LINKING_ENV = 'AGENTCRM_CONTACT_LINKING_ENABLED'

/** CRM-dev only. Production does not have migration 055, so any other host stays off. */
export const CRM_DEV_SUPABASE_HOST = 'cxgiaevervjttbuiramd.supabase.co'

const FORBIDDEN_VITE_NAME = 'VITE_AGENTCRM_CONTACT_LINKING_ENABLED'

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Durable link writes are off unless a server explicitly opts in AND the
 * Supabase URL is CRM-dev. Production, and every other host, cannot reach
 * integration_contact_links through this path.
 */
export function isAgentCrmContactLinkingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  assertAgentCrmServerOnly()
  if (readTrimmed(env, FORBIDDEN_VITE_NAME) !== '') {
    throw new Error('AgentCRM settings must not use a VITE_ prefix.')
  }
  if (readTrimmed(env, AGENTCRM_CONTACT_LINKING_ENV) !== 'true') return false

  const rawUrl = readTrimmed(env, 'SUPABASE_URL')
  if (!rawUrl) return false
  try {
    return new URL(rawUrl).hostname === CRM_DEV_SUPABASE_HOST
  } catch {
    return false
  }
}
