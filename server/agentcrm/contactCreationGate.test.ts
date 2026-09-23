import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGENTCRM_CONTACT_CREATION_ENV, isAgentCrmContactCreationEnabled } from './contactCreationGate'
import { AGENTCRM_CONTACT_LINKING_ENV } from './contactLinkGate'
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

describe('isAgentCrmContactCreationEnabled', () => {
  it('is off by default', () => {
    expect(isAgentCrmContactCreationEnabled({})).toBe(false)
  })

  it('stays off for CRM-dev when the flag is false', () => {
    expect(
      isAgentCrmContactCreationEnabled({
        [AGENTCRM_CONTACT_CREATION_ENV]: 'false',
        SUPABASE_URL: CRM_DEV,
      }),
    ).toBe(false)
  })

  it('is on for an approved host only when master, linking, and creation are exactly true', () => {
    for (const host of [CRM_DEV, CRM_PROD]) {
      expect(
        isAgentCrmContactCreationEnabled({
          [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
          [AGENTCRM_CONTACT_LINKING_ENV]: 'true',
          [AGENTCRM_CONTACT_CREATION_ENV]: 'true',
          SUPABASE_URL: host,
        }),
      ).toBe(true)
    }
  })

  it('stays off when linking is off, including on production', () => {
    expect(
      isAgentCrmContactCreationEnabled({
        [AGENTCRM_REPORT_CARD_SYNC_ENV]: 'true',
        [AGENTCRM_CONTACT_CREATION_ENV]: 'true',
        SUPABASE_URL: CRM_PROD,
      }),
    ).toBe(false)
  })

  it('rejects a browser-prefixed flag', () => {
    expect(() =>
      isAgentCrmContactCreationEnabled({
        VITE_AGENTCRM_CONTACT_CREATION_ENABLED: 'true',
        [AGENTCRM_CONTACT_CREATION_ENV]: 'true',
        SUPABASE_URL: CRM_DEV,
      }),
    ).toThrow(/VITE_ prefix/)
  })

  it('is not referenced by browser, CRM UI, or Vercel function source', () => {
    const offenders: string[] = []
    for (const root of ['src', 'pages', 'components', 'crm', 'api']) {
      for (const file of walk(join(process.cwd(), root))) {
        if (readFileSync(file, 'utf8').includes(AGENTCRM_CONTACT_CREATION_ENV)) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
