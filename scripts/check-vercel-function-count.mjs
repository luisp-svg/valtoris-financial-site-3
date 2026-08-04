/**
 * Guard: Vercel Hobby allows at most 12 Serverless Functions per deployment.
 * Every file matching api/ ** / *.{ts,js} counts unless a path segment starts with `_`.
 * Colocated Vitest files under api/ therefore consume Hobby slots.
 *
 *   node scripts/check-vercel-function-count.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const HOBBY_LIMIT = 12
/** After relocating api tests: 10 production handlers expected. */
export const EXPECTED_MAX_SERVERLESS_FUNCTIONS = 10
export const HOBBY_SERVERLESS_FUNCTION_LIMIT = HOBBY_LIMIT

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function isUnderscoreExcluded(relPosix) {
  return relPosix.split('/').some((seg) => seg.startsWith('_'))
}

function declaresEdgeRuntime(source) {
  return /export\s+const\s+config\s*=\s*\{[\s\S]*?runtime\s*:\s*['"]edge['"]/.test(source)
}

export function countedServerlessFunctions(root = ROOT) {
  const apiDir = join(root, 'api')
  let files = []
  try {
    files = walk(apiDir)
  } catch {
    return []
  }

  return files
    .map((abs) => relative(root, abs).split('\\').join('/'))
    .filter((p) => p.endsWith('.ts') || p.endsWith('.js'))
    .filter((p) => !p.endsWith('.d.ts'))
    .filter((p) => !isUnderscoreExcluded(p))
    .filter((p) => {
      const source = readFileSync(join(root, p), 'utf8')
      return !declaresEdgeRuntime(source)
    })
    .sort()
}

export function assertVercelFunctionBudget(root = ROOT) {
  const counted = countedServerlessFunctions(root)
  const tests = counted.filter((p) => /\.test\.(ts|js)$/.test(p))
  const errors = []

  if (counted.length > HOBBY_LIMIT) {
    errors.push(`${counted.length} counted files exceed Hobby limit ${HOBBY_LIMIT}`)
  }
  if (counted.length > EXPECTED_MAX_SERVERLESS_FUNCTIONS) {
    errors.push(
      `${counted.length} counted files exceed expected max ${EXPECTED_MAX_SERVERLESS_FUNCTIONS}`,
    )
  }
  if (tests.length > 0) {
    errors.push(`test files under api/ still count as functions: ${tests.join(', ')}`)
  }

  return { counted, tests, errors, ok: errors.length === 0 }
}

function main() {
  const result = assertVercelFunctionBudget()
  console.log(`Vercel Serverless Function budget (Hobby limit ${HOBBY_LIMIT})`)
  console.log(`Counted files under api/: ${result.counted.length}`)
  console.log(`Tests under api/ (must be 0): ${result.tests.length}`)
  for (const p of result.counted) {
    console.log(`  - ${p}`)
  }
  if (!result.ok) {
    for (const err of result.errors) console.error(`FAIL: ${err}`)
    process.exit(1)
  }
  console.log(
    `PASS: ${result.counted.length} <= ${EXPECTED_MAX_SERVERLESS_FUNCTIONS} (Hobby ${HOBBY_LIMIT}), no api test bundles`,
  )
}

const thisFile = fileURLToPath(import.meta.url)
const invokedAs = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedAs && thisFile === invokedAs) {
  main()
}
