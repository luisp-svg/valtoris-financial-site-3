import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AGENTCRM_REPORT_CARD_SYNC_ENV,
  CRM_DEV_SUPABASE_HOST,
  CRM_PROD_SUPABASE_HOST,
  isAgentCrmReportCardSyncEnabled,
  isApprovedAgentCrmSupabaseHost,
} from './reportCardSyncGate'

const CRM_DEV = `https://${CRM_DEV_SUPABASE_HOST}`
const CRM_PROD = `https://${CRM_PROD_SUPABASE_HOST}`

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(full, acc)
    } else if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      acc.push(full)
    }
  }
  return acc
}

describe('isAgentCrmReportCardSyncEnabled', () => {
  it('is off when the switch is missing, false, or any other value', () => {
    expect(isAgentCrmReportCardSyncEnabled({})).toBe(false)
    expect(isAgentCrmReportCardSyncEnabled({ SUPABASE_URL: CRM_PROD })).toBe(false)
    for (const value of ['false', 'TRUE', '1', 'yes']) {
      expect(
        isAgentCrmReportCardSyncEnabled({
          [AGENTCRM_REPORT_CARD_SYNC_ENV]: value,
          SUPABASE_URL: CRM_PROD,
        }),
      ).toBe(false)
    }
  })

  it('recognizes only the CRM-dev and CRM-prod hosts', () => {
    expect(isApprovedAgentCrmSupabaseHost({ SUPABASE_URL: CRM_DEV })).toBe(true)
    expect(isApprovedAgentCrmSupabaseHost({ SUPABASE_URL: CRM_PROD })).toBe(true)
    expect(isAgentCrmReportCardSyncEnabled({ [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true', SUPABASE_URL: CRM_DEV })).toBe(true)
    expect(isAgentCrmReportCardSyncEnabled({ [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true', SUPABASE_URL: CRM_PROD })).toBe(true)
  })

  it('rejects unknown hosts and lookalike suffixes', () => {
    for (const host of [
      'https://other.supabase.co',
      'https://evil.supabase.co',
      `https://${CRM_DEV_SUPABASE_HOST}.evil.test`,
      `https://${CRM_PROD_SUPABASE_HOST}.evil.test`,
      `https://not-${CRM_PROD_SUPABASE_HOST}`,
      'https://example.com',
    ]) {
      expect(
        isAgentCrmReportCardSyncEnabled({
          [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
          SUPABASE_URL: host,
        }),
      ).toBe(false)
    }
  })

  it('rejects a browser-prefixed switch', () => {
    expect(() =>
      isAgentCrmReportCardSyncEnabled({
        VITE_AGENTCRM_REPORT_CARD_SYNC_ENABLED: 'true',
        [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
        SUPABASE_URL: CRM_PROD,
      }),
    ).toThrow(/VITE_ prefix/)
  })

  it('does not use a wildcard host match', () => {
    const source = readFileSync(new URL('./reportCardSyncGate.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/\*\.supabase\.co|endsWith\(\s*['"]\.supabase\.co['"]\)|includes\(\s*['"]supabase\.co['"]\)/)
    expect(source).toContain(CRM_DEV_SUPABASE_HOST)
    expect(source).toContain(CRM_PROD_SUPABASE_HOST)
  })

  it('is not referenced by browser, CRM UI, or Vercel function source', () => {
    const offenders: string[] = []
    for (const root of ['src', 'pages', 'components', 'crm', 'api']) {
      for (const file of walk(join(process.cwd(), root))) {
        if (readFileSync(file, 'utf8').includes(AGENTCRM_REPORT_CARD_SYNC_ENV)) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
