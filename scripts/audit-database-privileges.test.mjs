import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { auditDatabasePrivileges } from './audit-database-privileges.mjs'

const empty = () => ({ formatVersion: 2, schema: 'public', relations: [], columnReferences: [], definerFunctions: [], defaultGrants: [] })
const relation = (overrides = {}) => ({ name: 'example', kind: 'r', role: 'authenticated', rls: true,
  select: true, insert: false, update: false, delete: false, truncate: false, references: false, trigger: false, maintain: false, ...overrides })

test('flags dangerous base-table grants even when RLS is enabled', () => {
  const s = empty(); s.relations = [relation({ truncate: true })]
  const r = auditDatabasePrivileges(s)
  assert.equal(r.summary.high, 1)
  assert.equal(r.findings[0].code, 'dangerous-table-grant')
})

test('does not misrepresent view grants as truncatable base tables', () => {
  const s = empty(); s.relations = [relation({ kind: 'v', rls: false, truncate: true })]
  const r = auditDatabasePrivileges(s)
  assert.equal(r.summary.high, 0)
  assert.ok(r.findings.some(x => x.code === 'non-table-grant-review'))
  assert.ok(r.findings.some(x => x.code === 'non-table-access-review'))
})

test('flags MAINTAIN on existing and future relations', () => {
  const s = empty(); s.relations = [relation({ maintain: true })]
  s.defaultGrants = [{ owner: 'postgres', scope: 'public', objectType: 'r', grantee: 'authenticated', privilege: 'MAINTAIN' }]
  const r = auditDatabasePrivileges(s)
  assert.equal(r.summary.high, 2)
  assert.ok(r.findings.some(x => x.detail.includes('maintain')))
})

test('reports column-only REFERENCES and rejects contradictory or incomplete snapshots', () => {
  const s = empty(); s.relations = [relation()]
  s.columnReferences = [{ table: 'example', column: 'id', role: 'authenticated' }]
  const r = auditDatabasePrivileges(s)
  assert.equal(r.summary.columnReferenceRows, 1)
  assert.equal(r.findings[0].code, 'column-reference-grant')
  s.relations[0].references = true
  assert.throws(() => auditDatabasePrivileges(s), /Invalid privilege snapshot/)
  assert.throws(() => auditDatabasePrivileges({ ...empty(), formatVersion: 1 }), /Invalid privilege snapshot/)
  const old = empty(); delete old.columnReferences
  assert.throws(() => auditDatabasePrivileges(old), /Invalid privilege snapshot/)
})

test('distinguishes disabled RLS with effective access from inaccessible tables', () => {
  const s = empty(); s.relations = [relation({ rls: false })]
  assert.equal(auditDatabasePrivileges(s).summary.high, 1)
  s.relations = [relation({ rls: false, select: false })]
  assert.equal(auditDatabasePrivileges(s).summary.high, 0)
})

test('definer execution requires review, not an automatic exploit claim', () => {
  const s = empty(); s.definerFunctions = [{ name: 'helper', arguments: 'id uuid', role: 'anon', execute: true, searchPathConfigured: true }]
  assert.equal(auditDatabasePrivileges(s).summary.high, 0)
  assert.equal(auditDatabasePrivileges(s).summary.review, 1)
  s.definerFunctions[0].searchPathConfigured = false
  assert.equal(auditDatabasePrivileges(s).summary.high, 1)
  s.definerFunctions[0].execute = false
  assert.equal(auditDatabasePrivileges(s).findings.length, 0)
})

test('reports future-object defaults independently from current grants', () => {
  const s = empty(); s.defaultGrants = [{ owner: 'postgres', scope: 'public', objectType: 'r', grantee: 'authenticated', privilege: 'TRUNCATE' },
    { owner: 'postgres', scope: 'all-schemas', objectType: 'f', grantee: 'PUBLIC', privilege: 'EXECUTE' }]
  const r = auditDatabasePrivileges(s)
  assert.equal(r.summary.high, 1)
  assert.equal(r.summary.review, 1)
  assert.equal(r.summary.relationRoleRows, 0)
  assert.ok(r.limitations.some(x => x.includes('Built-in PUBLIC')))
})

test('rejects malformed, duplicate and unsupported snapshots', () => {
  const s = empty(); s.relations = [relation(), relation()]
  assert.throws(() => auditDatabasePrivileges(s), /Invalid privilege snapshot/)
  for (const bad of [null, {}, { ...empty(), schema: 'auth' }, { ...empty(), relations: [relation({ rls: 'true' })] }]) {
    assert.throws(() => auditDatabasePrivileges(bad), /Invalid privilege snapshot/)
  }
})

test('CLI gates high findings and does not echo invalid input', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'privilege-audit-'))
  const file = path.join(dir, 'snapshot.json')
  const script = fileURLToPath(new URL('./audit-database-privileges.mjs', import.meta.url))
  const run = flags => spawnSync(process.execPath, [script, file, ...flags], { encoding: 'utf8' })
  try {
    const s = empty(); s.relations = [relation({ truncate: true })]
    writeFileSync(file, JSON.stringify(s))
    assert.equal(run([]).status, 0)
    assert.equal(run(['--fail-on-high']).status, 2)
    assert.equal(run([]).stdout, run([]).stdout)
    writeFileSync(file, 'private-secret')
    const bad = run([])
    assert.equal(bad.status, 1)
    assert.equal(bad.stdout, '')
    assert.ok(!bad.stderr.includes('private-secret'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
