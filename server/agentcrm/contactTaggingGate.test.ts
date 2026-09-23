import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGENTCRM_CONTACT_TAGGING_ENV, isAgentCrmContactTaggingEnabled } from './contactTaggingGate'

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
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      walk(full, acc)
    } else if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      acc.push(full)
    }
  }
  return acc
}

describe('isAgentCrmContactTaggingEnabled', () => {
  it('is off by default', () => {
    expect(isAgentCrmContactTaggingEnabled({})).toBe(false)
  })

  it('is on only for CRM-dev when the flag is exactly true', () => {
    expect(
      isAgentCrmContactTaggingEnabled({
        [AGENTCRM_CONTACT_TAGGING_ENV]: 'true',
        SUPABASE_URL: CRM_DEV,
      }),
    ).toBe(true)
  })

  it('stays off for production even when the flag is true', () => {
    expect(
      isAgentCrmContactTaggingEnabled({
        [AGENTCRM_CONTACT_TAGGING_ENV]: 'true',
        SUPABASE_URL: CRM_PROD,
      }),
    ).toBe(false)
  })

  it('rejects a browser-prefixed flag', () => {
    expect(() =>
      isAgentCrmContactTaggingEnabled({
        VITE_AGENTCRM_CONTACT_TAGGING_ENABLED: 'true',
        [AGENTCRM_CONTACT_TAGGING_ENV]: 'true',
        SUPABASE_URL: CRM_DEV,
      }),
    ).toThrow(/VITE_ prefix/)
  })

  it('is not referenced by browser, CRM UI, or Vercel function source', () => {
    const offenders: string[] = []
    for (const root of ['src', 'pages', 'components', 'crm', 'api']) {
      for (const file of walk(join(process.cwd(), root))) {
        if (readFileSync(file, 'utf8').includes(AGENTCRM_CONTACT_TAGGING_ENV)) offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
