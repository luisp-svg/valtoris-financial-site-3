import { assertAgentCrmServerOnly } from './config.js'
import { isAgentCrmReportCardSyncEnabled, isApprovedAgentCrmSupabaseHost } from './reportCardSyncGate.js'

export const AGENTCRM_CONTACT_TAGGING_ENV = 'AGENTCRM_CONTACT_TAGGING_ENABLED'

const FORBIDDEN_VITE_NAME = 'VITE_AGENTCRM_CONTACT_TAGGING_ENABLED'

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Tagging requires the master sync switch, this flag exactly true, and an
 * approved host. Creation and linking flags do not authorize tagging.
 */
export function isAgentCrmContactTaggingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  assertAgentCrmServerOnly()
  if (readTrimmed(env, FORBIDDEN_VITE_NAME) !== '') {
    throw new Error('AgentCRM settings must not use a VITE_ prefix.')
  }
  if (readTrimmed(env, AGENTCRM_CONTACT_TAGGING_ENV) !== 'true') return false
  if (!isApprovedAgentCrmSupabaseHost(env)) return false
  return isAgentCrmReportCardSyncEnabled(env)
}
