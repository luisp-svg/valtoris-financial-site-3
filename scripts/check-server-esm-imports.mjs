/**
 * Guard: production api/** serverless import graph must use Node-compatible
 * relative specifiers (explicit .js / directory/index.js).
 *
 *   node scripts/check-server-esm-imports.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()

function listApiHandlers(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) listApiHandlers(p, acc)
    else if (/\.tsx?$/.test(ent.name) && !ent.name.includes('.test.') && !ent.name.endsWith('.d.ts')) {
      acc.push(p)
    }
  }
  return acc
}

function resolveBare(fromFile, bare) {
  const base = resolve(dirname(fromFile), bare)
  for (const candidate of [base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.js')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export function findExtensionlessServerImports(root = ROOT) {
  const apiDir = join(root, 'api')
  const queue = listApiHandlers(apiDir)
  const visited = new Set()
  const violations = []

  while (queue.length) {
    const file = queue.pop()
    const rel = relative(root, file).split('\\').join('/')
    if (visited.has(rel) || !existsSync(file)) continue
    visited.add(rel)

    const text = readFileSync(file, 'utf8').replace(
      /import\s+type\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*\s+as\s+\w+|\w+)\s+from\s+['"][^'"]+['"];?/g,
      '',
    )
    const re = /(?:from\s+|import\s*\(\s*)(['"])(\.[^'"]+)\1/g
    let m
    while ((m = re.exec(text))) {
      const spec = m[2]
      if (/\.(css|scss|sass|svg|png|jpg|jpeg|gif|webp|json)$/.test(spec)) continue

      const nodeCompatible = /\.(js|mjs|cjs)$/.test(spec)
      if (!nodeCompatible) {
        violations.push({ file: rel, spec })
      }

      let bare = spec
      if (bare.endsWith('/index.js')) bare = bare.slice(0, -'/index.js'.length)
      else if (bare.endsWith('.js') || bare.endsWith('.mjs') || bare.endsWith('.cjs')) {
        bare = bare.replace(/\.(js|mjs|cjs)$/, '')
      }
      const target = resolveBare(file, bare)
      if (target && (target.endsWith('.ts') || target.endsWith('.tsx'))) {
        queue.push(target)
      }
    }
  }

  return { visited: [...visited].sort(), violations }
}

function main() {
  const { visited, violations } = findExtensionlessServerImports()
  console.log(`Server ESM import contract (api/** transitive graph)`)
  console.log(`Files scanned: ${visited.length}`)
  if (violations.length) {
    console.error(`FAIL: ${violations.length} extensionless relative runtime import(s):`)
    for (const v of violations.slice(0, 50)) {
      console.error(`  - ${v.file}: '${v.spec}'`)
    }
    if (violations.length > 50) console.error(`  … and ${violations.length - 50} more`)
    process.exit(1)
  }
  console.log('PASS: all relative runtime imports use Node-compatible .js / index.js specifiers')
}

const thisFile = fileURLToPath(import.meta.url)
const invokedAs = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedAs && thisFile === invokedAs) {
  main()
}
