import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROLES = new Set(['anon', 'authenticated'])
const BOOLEAN_FIELDS = ['rls', 'select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']
const DANGEROUS = ['truncate', 'references', 'trigger']

export function auditDatabasePrivileges(snapshot) {
  const invalid = () => { throw new Error('Invalid privilege snapshot; use the matching catalog query') }
  if (!snapshot || snapshot.formatVersion !== 1 || snapshot.schema !== 'public') invalid()
  for (const key of ['relations', 'definerFunctions', 'defaultGrants']) {
    if (!Array.isArray(snapshot[key])) invalid()
  }
  const findings = []
  const seen = new Set()
  const add = (code, level, object, role, detail) => findings.push({ code, level, object, role, detail })
  for (const row of snapshot.relations) {
    if (!row || typeof row.name !== 'string' || !ROLES.has(row.role) || !['r','p','v','m','f'].includes(row.kind)
      || BOOLEAN_FIELDS.some(key => typeof row[key] !== 'boolean')) invalid()
    const key = `relation:${row.name}:${row.role}`
    if (seen.has(key)) invalid()
    seen.add(key)
    const object = `public.${row.name}`
    const privileges = DANGEROUS.filter(key => row[key])
    if (privileges.length) {
      const table = ['r','p','f'].includes(row.kind)
      add(table ? 'dangerous-table-grant' : 'non-table-grant-review', table ? 'high' : 'info', object, row.role,
        `${privileges.join(', ')}; relation kind ${row.kind}. Review privileges separately from API reachability.`)
    }
    if (['r','p'].includes(row.kind) && !row.rls && ['select','insert','update','delete'].some(key => row[key])) {
      add('rls-disabled-with-access', 'high', object, row.role, 'Browser role has table access with RLS disabled.')
    }
    if (['v','m','f'].includes(row.kind) && ['select','insert','update','delete'].some(key => row[key])) {
      add('non-table-access-review', 'info', object, row.role, 'Review view/foreign-table authorization separately; table RLS flags do not establish safety.')
    }
  }
  for (const row of snapshot.definerFunctions) {
    if (!row || typeof row.name !== 'string' || typeof row.arguments !== 'string' || !ROLES.has(row.role)
      || typeof row.execute !== 'boolean' || typeof row.searchPathConfigured !== 'boolean') invalid()
    const object = `public.${row.name}(${row.arguments})`
    const key = `function:${object}:${row.role}`
    if (seen.has(key)) invalid()
    seen.add(key)
    if (row.execute) {
      add('definer-execute-review', 'review', object, row.role, 'Check intended callers and authorization inside the function; execution privilege alone is not proof of an exploit.')
      if (!row.searchPathConfigured) add('definer-search-path-missing', 'high', object, row.role, 'Callable definer function has no function-level search_path setting.')
    }
  }
  for (const row of snapshot.defaultGrants) {
    if (!row || ['owner','scope','objectType','grantee','privilege'].some(key => typeof row[key] !== 'string')
      || !['public','all-schemas'].includes(row.scope) || !['PUBLIC','anon','authenticated'].includes(row.grantee)) invalid()
    const key = `default:${JSON.stringify([row.owner,row.scope,row.objectType,row.grantee,row.privilege])}`
    if (seen.has(key)) invalid()
    seen.add(key)
    const object = `${row.owner}/${row.scope}/${row.objectType}`
    if (row.objectType === 'r' && ['TRUNCATE','REFERENCES','TRIGGER'].includes(row.privilege)) {
      add('dangerous-default-relation-grant', 'high', object, row.grantee, `${row.privilege} default can apply to newly created relations. Existing-object cleanup does not change this ACL.`)
    } else {
      add('default-grant-review', 'review', object, row.grantee, `${row.privilege} explicit default: verify intended future-object access for this owner.`)
    }
  }
  findings.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'))
  return {
    formatVersion: 1,
    scope: 'public schema catalog metadata; not an authorization test or proof of API exposure',
    limitations: [
      'No policy bodies, user sessions, column grants, sequence privileges, or exposed-schema settings are evaluated.',
      'Default ACL rows show explicit grants, not every effective future privilege. Built-in PUBLIC function EXECUTE, inherited memberships and global/schema ACL composition require separate review.',
      'A configured search_path is not proof that its schemas are trusted.',
      'No findings does not establish safety; empty or partial snapshots must be reconciled with a full administrative inventory.',
    ],
    summary: { relationRoleRows: snapshot.relations.length, functionRoleRows: snapshot.definerFunctions.length,
      defaultGrantRows: snapshot.defaultGrants.length, high: findings.filter(x => x.level === 'high').length,
      review: findings.filter(x => x.level === 'review').length, info: findings.filter(x => x.level === 'info').length },
    findings,
  }
}

const HELP = `Usage: node scripts/audit-database-privileges.mjs <snapshot.json> [--fail-on-high]
Reads a local snapshot from scripts/sql/academy/privilege-snapshot.sql.
No database connections or changes. JSON report goes to stdout.
Exit codes: 0 report produced, 1 invalid input, 2 high findings with --fail-on-high.
`

export function main(args) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(HELP); return 0 }
  if (![1,2].includes(args.length) || args[0].startsWith('--') || (args[1] && args[1] !== '--fail-on-high')) {
    throw new Error('Expected a snapshot path and optional --fail-on-high; use --help')
  }
  let snapshot
  try { snapshot = JSON.parse(readFileSync(args[0], 'utf8')) }
  catch { throw new Error('Cannot read a valid privilege snapshot JSON file') }
  const report = auditDatabasePrivileges(snapshot)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  return args[1] && report.summary.high ? 2 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)) }
  catch (error) { process.stderr.write(`Privilege audit: ${error.message}\n`); process.exitCode = 1 }
}
