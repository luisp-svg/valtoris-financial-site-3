import { assertAgentCrmServerOnly } from './config.js'
import { CRM_DEV_SUPABASE_HOST } from './contactLinkGate.js'

export const AGENTCRM_CONTACT_TAGGING_ENV = 'AGENTCRM_CONTACT_TAGGING_ENABLED'

const FORBIDDEN_VITE_NAME = 'VITE_AGENTCRM_CONTACT_TAGGING_ENABLED'

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Tagging is a separate opt-in from contact creation and Valtoris link writes.
 * It stays off unless the flag is exactly true and SUPABASE_URL is CRM-dev.
 */
export function isAgentCrmContactTaggingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  assertAgentCrmServerOnly()
  if (readTrimmed(env, FORBIDDEN_VITE_NAME) !== '') {
    throw new Error('AgentCRM settings must not use a VITE_ prefix.')
  }
  if (readTrimmed(env, AGENTCRM_CONTACT_TAGGING_ENV) !== 'true') return false

  const rawUrl = readTrimmed(env, 'SUPABASE_URL')
  if (!rawUrl) return false
  try {
    return new URL(rawUrl).hostname === CRM_DEV_SUPABASE_HOST
  } catch {
    return false
  }
}
