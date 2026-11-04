import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Conservative SQL text comparison, not a parser or a semantic equivalence check. */
export function sqlTokens(sql) {
  const tokens = []
  let i = 0
  while (i < sql.length) {
    if (/\s/.test(sql[i])) { i++; continue }
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i + 2)
      i = end === -1 ? sql.length : end + 1
      continue
    }
    if (sql.startsWith('/*', i)) {
      let depth = 1
      i += 2
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) { depth++; i += 2 }
        else if (sql.startsWith('*/', i)) { depth--; i += 2 }
        else i++
      }
      if (depth) throw new Error('Unterminated SQL comment')
      continue
    }
    const start = i
    const escapeString = (sql[i] === 'E' || sql[i] === 'e') && sql[i + 1] === "'"
    if (sql[i] === "'" || sql[i] === '"' || escapeString) {
      if (escapeString) i++
      const quote = sql[i++]
      let closed = false
      while (i < sql.length) {
        if (escapeString && sql[i] === '\\') { i += 2; continue }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { i += 2; continue }
          i++; closed = true; break
        }
        i++
      }
      if (!closed) throw new Error('Unterminated SQL quoted value')
      tokens.push(sql.slice(start, i))
      continue
    }
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0]
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length)
      if (end === -1) throw new Error('Unterminated SQL dollar-quoted body')
      i = end + dollar.length
      // Bodies stay opaque: comments/whitespace inside a function may be data.
      tokens.push(sql.slice(start, i))
      continue
    }
    const compound = ['::', ':='].find(token => sql.startsWith(token, i))
    if (compound) { tokens.push(compound); i += compound.length; continue }
    if (/[+\-*/<>=~!@#%^&|`?]/.test(sql[i])) {
      i++
      while (i < sql.length && /[+\-*/<>=~!@#%^&|`?]/.test(sql[i]) && !sql.startsWith('--', i) && !sql.startsWith('/*', i)) i++
      tokens.push(sql.slice(start, i))
      continue
    }
    const word = sql.slice(i).match(/^[\p{L}_][\p{L}\p{N}_$]*/u)?.[0]
    const number = sql.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)?.[0]
    const token = word || number || sql[i]
    tokens.push(token)
    i += token.length
  }
  // Empty top-level statements and a final terminator do not alter SQL text content.
  return tokens.filter((token, index) => token !== ';' || (index < tokens.length - 1 && tokens[index + 1] !== ';'))
}

function fingerprint(sql) {
  const tokens = sqlTokens(sql)
  return tokens.length ? createHash('sha256').update(JSON.stringify(tokens)).digest('hex') : null
}

export function validateLedger(input, label) {
  const rows = Array.isArray(input) ? input : input?.migrations
  if (!Array.isArray(rows)) throw new Error(`${label}: expected an array or { migrations: [...] }`)
  const seen = new Set()
  return rows.map((row, index) => {
    if (!row || typeof row.version !== 'string' || !/^\d+$/.test(row.version)) {
      throw new Error(`${label}: row ${index + 1} needs a numeric version string`)
    }
    if (seen.has(row.version)) throw new Error(`${label}: duplicate migration version ${row.version}`)
    seen.add(row.version)
    if (typeof row.name !== 'string') throw new Error(`${label}: row ${index + 1} needs a name`)
    if (row.statements != null && (!Array.isArray(row.statements) || row.statements.some(s => typeof s !== 'string'))) {
      throw new Error(`${label}: ${row.version} statements must be a string array or null`)
    }
    const sql = row.statements?.join('\n;\n') ?? ''
    let hash
    try { hash = fingerprint(sql) }
    catch { throw new Error(`${label}: invalid SQL text in migration ${row.version}`) }
    return { version: row.version, name: row.name, hash, statementCount: row.statements?.length ?? null }
  }).sort((a, b) => a.version.localeCompare(b.version, 'en'))
}

export function compareMigrationHistory(development, production, sources = []) {
  const dev = validateLedger(development, 'development')
  const prod = validateLedger(production, 'production')
  if (!dev.length || !prod.length) throw new Error('development and production ledgers must both contain migrations')
  const sourceIndex = sources.map(({ name, sql }) => ({ name, hash: fingerprint(sql) }))
  const rows = []
  for (const [environment, entries, other] of [['development', dev, prod], ['production', prod, dev]]) {
    const otherByVersion = new Map(other.map(row => [row.version, row]))
    for (const row of entries) {
      const counterpart = otherByVersion.get(row.version)
      let comparison = 'environment-only-version'
      if (!row.hash) comparison = 'sql-unavailable'
      else if (counterpart) comparison = !counterpart.hash ? 'counterpart-sql-unavailable'
        : row.hash === counterpart.hash ? 'text-match' : 'text-differs'
      const matchingOtherVersions = row.hash ? other.filter(x => x.hash === row.hash && x.version !== row.version).map(x => x.version) : []
      const matchingSourceFiles = row.hash ? sourceIndex.filter(x => x.hash === row.hash).map(x => x.name).sort() : []
      const reasons = []
      if (comparison !== 'text-match') reasons.push(comparison)
      if (counterpart && counterpart.name !== row.name) reasons.push('name-differs')
      if (matchingSourceFiles.length === 0) reasons.push('source-text-not-matched')
      if (matchingOtherVersions.length) reasons.push('matching-sql-under-other-version')
      rows.push({ environment, ...row, comparison, matchingOtherVersions, matchingSourceFiles, reviewReasons: reasons })
    }
  }
  return {
    formatVersion: 1,
    comparisonMethod: 'Conservative token-text match; quoted values and dollar bodies preserved. Not semantic equivalence or replay validation.',
    summary: { development: dev.length, production: prod.length, reviewRows: rows.filter(x => x.reviewReasons.length).length },
    rows,
  }
}

const HELP = `Usage: node scripts/audit-migration-history.mjs --development <ledger.json> --production <ledger.json> --migrations <directory> [--fail-on-review]

Reads local JSON ledgers and SQL files only. Writes a JSON report to stdout.
No database connection, environment loading, migration execution or deployment.
Input: an array or { "migrations": [...] }, with version/name/statements fields.
Missing, null, empty and comment-only SQL is reported as unavailable, never equal.
SQL text is omitted from the report. Keep source snapshots out of Git.
Exit codes: 0 report produced, 1 invalid input, 2 review needed with --fail-on-review.
`

export function main(args) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(HELP); return 0 }
  const options = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--fail-on-review') {
      if (options[arg]) throw new Error('Duplicate option --fail-on-review')
      options[arg] = true
    } else if (['--development', '--production', '--migrations'].includes(arg)) {
      if (options[arg] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing or duplicate value for ${arg}`)
      options[arg] = args[++i]
    } else throw new Error('Unknown option; use --help')
  }
  for (const key of ['--development', '--production', '--migrations']) {
    if (!options[key]) throw new Error(`Required option ${key}; use --help`)
  }
  const readLedger = key => {
    try { return JSON.parse(readFileSync(options[key], 'utf8')) }
    catch { throw new Error(`Cannot read valid JSON for ${key}`) }
  }
  const directory = options['--migrations']
  let sources
  try {
    sources = readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      .map(entry => ({ name: entry.name, sql: readFileSync(path.join(directory, entry.name), 'utf8') }))
  } catch { throw new Error('Cannot read migration directory') }
  if (!sources.length) throw new Error('Migration directory contains no numbered SQL files')
  let report
  try { report = compareMigrationHistory(readLedger('--development'), readLedger('--production'), sources) }
  catch (error) {
    // Never echo SQL or a JSON parser excerpt that could contain private data.
    if (error instanceof Error && /^(development|production|Cannot read)/.test(error.message)) throw error
    throw new Error('Cannot compare migration text')
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  return options['--fail-on-review'] && report.summary.reviewRows ? 2 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)) }
  catch (error) { process.stderr.write(`Migration audit: ${error.message}\n`); process.exitCode = 1 }
}
