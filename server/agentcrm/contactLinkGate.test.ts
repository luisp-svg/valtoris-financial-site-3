import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGENTCRM_CONTACT_LINKING_ENV, isAgentCrmContactLinkingEnabled } from './contactLinkGate'
import { AGENTCRM_REPORT_CARD_SYNC_ENV } from './reportCardSyncGate'

const CRM_DEV = 'https://cxgiaevervjttbuiramd.supabase.co'
const CRM_PROD = 'https://phanoknohbidqtgrpwvk.supabase.co'

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(full, acc)
    } else if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      acc.push(full)
    }
  }
  return acc
}

describe('isAgentCrmContactLinkingEnabled', () => {
  it('is off by default', () => {
    expect(isAgentCrmContactLinkingEnabled({})).toBe(false)
  })

  it('is on for an approved host only when the master switch and linking flag are exactly true', () => {
    for (const host of [CRM_DEV, CRM_PROD]) {
      expect(
        isAgentCrmContactLinkingEnabled({
          [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
          [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
          SUPABASE_URL: host,
        }),
      ).toBe(true)
    }
  })

  it('stays off for production when the master switch is missing', () => {
    expect(
      isAgentCrmContactLinkingEnabled({
        [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
        SUPABASE_URL: CRM_PROD,
      }),
    ).toBe(false)
  })

  it('stays off for an unknown host', () => {
    expect(
      isAgentCrmContactLinkingEnabled({
        [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
        [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
        SUPABASE_URL: 'https://other.supabase.co',
      }),
    ).toBe(false)
  })

  it('does not treat other truthy strings as enabled', () => {
    expect(
      isAgentCrmContactLinkingEnabled({
        [AGENTCRM_CONTACT_LINKING_ENV]: 'TRUE',
        SUPABASE_URL: CRM_DEV,
      }),
    ).toBe(false)
    expect(
      isAgentCrmContactLinkingEnabled({
        [AGENTCRM_CONTACT_LINKING_ENV]: '1',
        SUPABASE_URL: CRM_DEV,
      }),
    ).toBe(false)
  })

  it('rejects a browser-prefixed flag', () => {
    expect(() =>
      isAgentCrmContactLinkingEnabled({
        VITE_AGENTCRM_CONTACT_LINKING_ENABLED: 'true',
        [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
        SUPABASE_URL: CRM_DEV,
      }),
    ).toThrow(/VITE_ prefix/)
  })

  it('is not referenced by browser, CRM UI, or Vercel function source', () => {
    const offenders: string[] = []
    for (const root of ['src', 'pages', 'components', 'crm', 'api']) {
      for (const file of walk(join(process.cwd(), root))) {
        if (readFileSync(file, 'utf8').includes(AGENTCRM_CONTACT_LINKING_ENV)) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
