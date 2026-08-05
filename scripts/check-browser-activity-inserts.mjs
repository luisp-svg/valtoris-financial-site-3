/**
 * Guard: production browser/CRM client code must not directly insert into
 * public.activities, and must not reintroduce a browser direct-INSERT helper.
 *
 * Approved browser Activity writes use record_crm_activity only:
 *   - tasks.manual.created
 *   - onboarding.completed
 *
 * Excluded (allowed to insert):
 *   - server/**, api/** (service-role / serverless)
 *   - scripts/**, supabase/** (ops + migrations)
 *   - *.test.ts / *.test.tsx fixtures
 *
 *   node scripts/check-browser-activity-inserts.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()

const SCAN_ROOTS = ['crm', 'components', 'pages', 'src', 'platform', 'utils', 'constants', 'lib']

const IGNORE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.vercel',
  'coverage',
  'tmp',
])

function listFiles(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const ent of entries) {
    if (IGNORE_DIR_NAMES.has(ent.name)) continue
    const p = join(dir, ent.name)
    if (ent.isDirectory()) {
      listFiles(p, acc)
      continue
    }
    if (!/\.(ts|tsx)$/.test(ent.name)) continue
    if (ent.name.includes('.test.') || ent.name.endsWith('.d.ts')) continue
    if (!statSync(p).isFile()) continue
    acc.push(p)
  }
  return acc
}

function isExcludedPath(rel) {
  return (
    rel.startsWith('server/') ||
    rel.startsWith('api/') ||
    rel.startsWith('scripts/') ||
    rel.startsWith('supabase/')
  )
}

/**
 * Detect `.from('activities').insert` / `.from("activities").insert` call chains,
 * including multiline forms.
 */
const INSERT_CHAIN_RE =
  /\.from\(\s*(['"])activities\1\s*\)[\s\S]{0,200}?\.insert\s*\(/g

/**
 * Detect reintroduction of a browser write helper that talks to activities.insert
 * even if the chain is split across locals.
 */
const HELPER_INSERT_RE =
  /(?:from\(\s*(['"])activities\1\s*\)[\s\S]{0,400}?insert\s*\(|insert\s*\(\s*\{[\s\S]{0,200}?activity_type\s*:)/g

export function findBrowserActivityInserts(root = ROOT) {
  const files = []
  for (const scanRoot of SCAN_ROOTS) {
    listFiles(join(root, scanRoot), files)
  }

  const violations = []

  for (const file of files) {
    const rel = relative(root, file).split('\\').join('/')
    if (isExcludedPath(rel)) continue

    const text = readFileSync(file, 'utf8')
    const patterns = [
      { name: 'activities.insert_chain', re: INSERT_CHAIN_RE },
      { name: 'activities.insert_helper_shape', re: HELPER_INSERT_RE },
    ]

    for (const { name, re } of patterns) {
      re.lastIndex = 0
      let match
      while ((match = re.exec(text))) {
        const line = text.slice(0, match.index).split('\n').length
        violations.push({
          file: rel,
          line,
          kind: name,
          snippet: match[0].replace(/\s+/g, ' ').slice(0, 90),
        })
      }
    }
  }

  // Deduplicate identical file:line pairs (helper regex can overlap chain regex).
  const seen = new Set()
  const deduped = []
  for (const v of violations) {
    const key = `${v.file}:${v.line}:${v.kind}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(v)
  }

  return { filesScanned: files.length, violations: deduped, allowlist: [] }
}

function main() {
  const { filesScanned, violations } = findBrowserActivityInserts()
  console.log('Browser Activity direct-INSERT guard')
  console.log(`Files scanned: ${filesScanned}`)
  console.log('Allowed browser insert modules: (none)')
  if (violations.length) {
    console.error(`FAIL: ${violations.length} browser/client activities.insert site(s):`)
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} [${v.kind}] ${v.snippet}`)
    }
    process.exitCode = 1
    return
  }
  console.log('PASS: zero production browser direct Activity INSERT sites')
}

const thisFile = fileURLToPath(import.meta.url)
const invokedAs = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedAs && thisFile === invokedAs) {
  main()
}
