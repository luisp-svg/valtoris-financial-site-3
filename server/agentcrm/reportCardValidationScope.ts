import { assertAgentCrmServerOnly } from './config.js'

const IDS = 'AGENTCRM_REPORT_CARD_VALIDATION_LEAD_IDS'
const UNTIL = 'AGENTCRM_REPORT_CARD_VALIDATION_UNTIL'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** null = ordinary operation; [] = restricted but invalid/expired, so no delivery. */
export function reportCardValidationScope(env: NodeJS.ProcessEnv, now = Date.now()): string[] | null {
  assertAgentCrmServerOnly()
  if (env[`VITE_${IDS}`] !== undefined || env[`VITE_${UNTIL}`] !== undefined) return []
  if (env[IDS] === undefined && env[UNTIL] === undefined) return null
  const ids = (env[IDS] ?? '').split(',').map(id => id.trim().toLowerCase())
  const until = env[UNTIL] ?? ''
  const expiry = Date.parse(until)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(until)
    || !Number.isFinite(expiry) || expiry <= now || expiry - now > 24 * 60 * 60 * 1000
    || ids.length > 10 || ids.some(id => !UUID.test(id)) || new Set(ids).size !== ids.length) return []
  return ids
}
