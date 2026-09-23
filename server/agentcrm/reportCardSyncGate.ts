import { assertAgentCrmServerOnly } from './config.js'

export const AGENTCRM_REPORT_CARD_SYNC_ENV = 'AGENTCRM_REPORT_CARD_SYNC_ENABLED'

/** Exact CRM-dev hostname. Not a suffix and not a wildcard. */
export const CRM_DEV_SUPABASE_HOST = 'cxgiaevervjttbuiramd.supabase.co'

/** Exact CRM-prod hostname. Not a suffix and not a wildcard. */
export const CRM_PROD_SUPABASE_HOST = 'phanoknohbidqtgrpwvk.supabase.co'

const APPROVED_SUPABASE_HOSTS = new Set<string>([CRM_DEV_SUPABASE_HOST, CRM_PROD_SUPABASE_HOST])

const FORBIDDEN_VITE_NAME = 'VITE_AGENTCRM_REPORT_CARD_SYNC_ENABLED'

function readTrimmed(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * True only when SUPABASE_URL's hostname is one of the two approved projects.
 * Matching is exact. A suffix, prefix, or other supabase.co host stays off.
 */
export function isApprovedAgentCrmSupabaseHost(env: NodeJS.ProcessEnv = process.env): boolean {
  const rawUrl = readTrimmed(env, 'SUPABASE_URL')
  if (!rawUrl) return false
  try {
    return APPROVED_SUPABASE_HOSTS.has(new URL(rawUrl).hostname)
  } catch {
    return false
  }
}

/**
 * Master kill switch for Report Card AgentCRM sync.
 * Off unless the flag is exactly true and the Supabase host is approved.
 * Missing, false, and every other value stay off.
 */
export function isAgentCrmReportCardSyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  assertAgentCrmServerOnly()
  if (readTrimmed(env, FORBIDDEN_VITE_NAME) !== '') {
    throw new Error('AgentCRM settings must not use a VITE_ prefix.')
  }
  if (readTrimmed(env, AGENTCRM_REPORT_CARD_SYNC_ENV) !== 'true') return false
  return isApprovedAgentCrmSupabaseHost(env)
}
