/**
 * Guard: after `npx vercel build --prod`, native-import every built Node
 * Serverless Function entrypoint under Node ESM semantics.
 *
 * Fails on ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT / syntax errors.
 * Does not invoke handlers or print environment values.
 *
 *   npx vercel build --prod && node scripts/check-vercel-runtime.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { EXPECTED_MAX_SERVERLESS_FUNCTIONS } from './check-vercel-function-count.mjs'

const ROOT = process.cwd()
const OUTPUT = join(ROOT, '.vercel', 'output', 'functions')

function findFuncDirs(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (!ent.isDirectory()) continue
    if (ent.name.endsWith('.func')) acc.push(p)
    else findFuncDirs(p, acc)
  }
  return acc
}

function readVcConfig(funcDir) {
  const p = join(funcDir, '.vc-config.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function isNodeServerless(vc) {
  if (!vc) return false
  const runtime = String(vc.runtime || '')
  if (runtime.startsWith('nodejs') || runtime.startsWith('node')) return true
  // Some builds omit runtime but set launcherType Nodejs + handler.
  return vc.launcherType === 'Nodejs' && typeof vc.handler === 'string'
}

function resolveHandler(funcDir, vc) {
  if (vc?.handler) {
    const abs = join(funcDir, vc.handler)
    if (existsSync(abs) && statSync(abs).isFile()) return abs
  }
  // Fallback: deepest api/**/*.js entry
  const apiDir = join(funcDir, 'api')
  if (!existsSync(apiDir)) return null
  const stack = [apiDir]
  const js = []
  while (stack.length) {
    const d = stack.pop()
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name)
      if (ent.isDirectory()) stack.push(p)
      else if (ent.name.endsWith('.js') && !ent.name.endsWith('.map.js')) js.push(p)
    }
  }
  js.sort((a, b) => b.length - a.length)
  return js[0] || null
}

export async function assertVercelRuntimePackaging(root = ROOT) {
  const output = join(root, '.vercel', 'output', 'functions')
  const errors = []
  const results = []

  if (!existsSync(output)) {
    return {
      ok: false,
      errors: [
        'Missing .vercel/output/functions — run `npx vercel build --prod` first (do not commit .vercel/).',
      ],
      results: [],
      nodeFunctions: [],
    }
  }

  const funcDirs = findFuncDirs(output).sort()
  const nodeFunctions = []

  for (const funcDir of funcDirs) {
    const rel = relative(join(root, '.vercel', 'output', 'functions'), funcDir)
      .split('\\')
      .join('/')
    const vc = readVcConfig(funcDir)
    if (!isNodeServerless(vc)) {
      results.push({ func: rel, skipped: true, reason: 'non-node' })
      continue
    }
    if (/\.test\./i.test(rel)) {
      errors.push(`Test function bundle present: ${rel}`)
    }
    const handler = resolveHandler(funcDir, vc)
    nodeFunctions.push({ rel, handler, runtime: vc?.runtime || null })
  }

  if (nodeFunctions.length !== EXPECTED_MAX_SERVERLESS_FUNCTIONS) {
    errors.push(
      `Expected ${EXPECTED_MAX_SERVERLESS_FUNCTIONS} Node serverless functions, found ${nodeFunctions.length}`,
    )
  }

  for (const fn of nodeFunctions) {
    if (!fn.handler) {
      errors.push(`${fn.rel}: missing handler entry`)
      results.push({ func: fn.rel, ok: false, error: 'missing handler' })
      continue
    }
    try {
      await import(pathToFileURL(fn.handler).href)
      results.push({
        func: fn.rel,
        ok: true,
        runtime: fn.runtime,
        entry: relative(join(root, '.vercel', 'output', 'functions', fn.rel), fn.handler)
          .split('\\')
          .join('/'),
      })
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : null
      const message = String(err && err.message ? err.message : err)
      // Never print env values; keep path/code only.
      const safe = message
        .replace(/sb_secret_[A-Za-z0-9]+/g, '[redacted]')
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]')
      errors.push(`${fn.rel}: ${code || 'IMPORT_FAILED'} ${safe.slice(0, 240)}`)
      results.push({ func: fn.rel, ok: false, code, error: safe.slice(0, 240) })
    }
  }

  return {
    ok: errors.length === 0 && results.filter((r) => r.ok).length === EXPECTED_MAX_SERVERLESS_FUNCTIONS,
    errors,
    results,
    nodeFunctions: nodeFunctions.map((f) => f.rel),
  }
}

async function main() {
  console.log('Vercel Node ESM runtime packaging check')
  console.log(`Looking under: ${relative(ROOT, OUTPUT) || '.vercel/output/functions'}`)
  const result = await assertVercelRuntimePackaging()
  for (const r of result.results) {
    if (r.skipped) {
      console.log(`SKIP  ${r.func} (${r.reason})`)
      continue
    }
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.func}${r.entry ? ` → ${r.entry}` : ''}${r.code ? ` [${r.code}]` : ''}`)
  }
  if (!result.ok) {
    for (const err of result.errors) console.error(`FAIL: ${err}`)
    process.exit(1)
  }
  console.log(
    `PASS: ${result.nodeFunctions.length} Node functions native-imported with no module-resolution errors`,
  )
}

const thisFile = fileURLToPath(import.meta.url)
const invokedAs = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedAs && thisFile === invokedAs) {
  await main()
}
