import { assertAgentCrmServerOnly } from './config.js'
import { isAgentCrmReportCardSyncEnabled, isApprovedAgentCrmSupabaseHost } from './reportCardSyncGate.js'

export { CRM_DEV_SUPABASE_HOST, CRM_PROD_SUPABASE_HOST } from './reportCardSyncGate.js'

export const AGENTCRM_CONTACT_LINKING_ENV = 'AGENTCRM_CONTACT_LINKING_ENABLED'

const FORBIDDEN_VITE_NAME = 'VITE_AGENTCRM_CONTACT_LINKING_ENABLED'

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Durable link writes require the master sync switch, this flag exactly true,
 * and an approved CRM-dev or CRM-prod host. Any other host stays off.
 */
export function isAgentCrmContactLinkingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  assertAgentCrmServerOnly()
  if (readTrimmed(env, FORBIDDEN_VITE_NAME) !== '') {
    throw new Error('AgentCRM settings must not use a VITE_ prefix.')
  }
  if (readTrimmed(env, AGENTCRM_CONTACT_LINKING_ENV) !== 'true') return false
  if (!isApprovedAgentCrmSupabaseHost(env)) return false
  return isAgentCrmReportCardSyncEnabled(env)
}
