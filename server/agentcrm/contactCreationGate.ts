import { assertAgentCrmServerOnly } from './config.js'
import { isAgentCrmContactLinkingEnabled } from './contactLinkGate.js'
import { isApprovedAgentCrmSupabaseHost } from './reportCardSyncGate.js'

export const AGENTCRM_CONTACT_CREATION_ENV = 'AGENTCRM_CONTACT_CREATION_ENABLED'

const FORBIDDEN_VITE_NAME = 'VITE_AGENTCRM_CONTACT_CREATION_ENABLED'

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Contact creation requires the master sync switch, durable linking, this
 * flag exactly true, and an approved host. Linking off cannot create an
 * unlinked AgentCRM contact.
 */
export function isAgentCrmContactCreationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  assertAgentCrmServerOnly()
  if (readTrimmed(env, FORBIDDEN_VITE_NAME) !== '') {
    throw new Error('AgentCRM settings must not use a VITE_ prefix.')
  }
  if (readTrimmed(env, AGENTCRM_CONTACT_CREATION_ENV) !== 'true') return false
  if (!isApprovedAgentCrmSupabaseHost(env)) return false
  return isAgentCrmContactLinkingEnabled(env)
}
