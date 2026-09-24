import { assertAgentCrmServerOnly, readAgentCrmConfig } from '../config.js'
import { isApprovedAgentCrmSupabaseHost } from '../reportCardSyncGate.js'
export const QUOTE_LOCATION = 'I2Y36c45rBLFZhCQwkDC'
export const QUOTE_PIPELINE = 'xtN2q302YhbWvQZUEC3n'
export const QUOTE_STAGE = '280b65b1-2f4d-42e6-99c4-48865e1266d5'
export function quoteSyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  assertAgentCrmServerOnly()
  if (env.VITE_AGENTCRM_INSURANCE_SYNC_ENABLED) throw new Error('Server-only setting')
  const config = readAgentCrmConfig(env)
  return env.AGENTCRM_INSURANCE_SYNC_ENABLED === 'true' && env.AGENTCRM_INSURANCE_TRIGGERS_VERIFIED === 'true'
    && isApprovedAgentCrmSupabaseHost(env) && config.configured && config.locationId === QUOTE_LOCATION
}
