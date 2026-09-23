import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const CLIENT_ROOTS = ['src', 'pages', 'components', 'crm', 'api']

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

describe('AgentCRM client exposure', () => {
  it('is not imported by browser, CRM UI, or Vercel function source', () => {
    const offenders: string[] = []
    for (const root of CLIENT_ROOTS) {
      for (const file of walk(join(ROOT, root))) {
        const source = readFileSync(file, 'utf8')
        if (source.includes('server/agentcrm') || source.includes('AGENTCRM_PRIVATE_INTEGRATION_TOKEN')) {
          offenders.push(file)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps secret-bearing env files gitignored in the example contract', () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8')
    expect(gitignore).toMatch(/^\.env$/m)
    expect(gitignore).toMatch(/^\.env\.\*$/m)
    expect(gitignore).toMatch(/^!\.env\.example$/m)

    const example = readFileSync(join(ROOT, '.env.example'), 'utf8')
    expect(example).toContain('AGENTCRM_PRIVATE_INTEGRATION_TOKEN=')
    expect(example).not.toMatch(/AGENTCRM_PRIVATE_INTEGRATION_TOKEN=\S+/)
  })
})
