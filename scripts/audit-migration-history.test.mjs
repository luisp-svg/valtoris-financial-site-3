import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { compareMigrationHistory, sqlTokens, validateLedger } from './audit-migration-history.mjs'

const migration = (version, sql, name = 'example') => ({ version, name, statements: sql == null ? sql : [sql] })
const compare = (a, b) => compareMigrationHistory([migration('001', a)], [migration('001', b)])

test('ignores only outer comments, whitespace and empty statement separators', () => {
  assert.equal(compare('/* outer /* nested */ comment */ SELECT 1 ;', '-- hi\n SELECT  1;;').rows[0].comparison, 'text-match')
  const report = compareMigrationHistory([{ version: '001', name: 'example', statements: ['SELECT 1;', 'SELECT 2;'] }],
    [migration('001', 'SELECT 1; SELECT 2;')])
  assert.equal(report.rows[0].comparison, 'text-match')
})

test('preserves string, identifier and dollar-body data', () => {
  for (const [a, b] of [["SELECT 'a  b'", "SELECT 'a b'"], ['SELECT "Case"', 'SELECT "case"'],
    ["DO $$ BEGIN RAISE NOTICE '-- comment'; END $$", "DO $$ BEGIN RAISE NOTICE ''; END $$"],
    ["SELECT E'a\\\'b'", "SELECT 'ab'"], ["SELECT '--x'", "SELECT '--y'"]]) {
    assert.equal(compare(a, b).rows[0].comparison, 'text-differs')
  }
  assert.equal(sqlTokens("SELECT 'it''s';").length, 2)
  assert.equal(sqlTokens('SELECT $tag$body; /* literal */$tag$;').length, 2)
})

test('does not merge tokens across comments or spaces', () => {
  assert.equal(compare('SELECT a/**/b', 'SELECT ab').rows[0].comparison, 'text-differs')
  assert.equal(compare('SELECT 1 2', 'SELECT 12').rows[0].comparison, 'text-differs')
  assert.equal(compare('SELECT 1 <= 2', 'SELECT 1 < = 2').rows[0].comparison, 'text-differs')
  assert.equal(compare('SELECT 1::text', 'SELECT 1: :text').rows[0].comparison, 'text-differs')
  assert.equal(compare('SELECT .5', 'SELECT . 5').rows[0].comparison, 'text-differs')
  assert.equal(compare('SELECT café', 'SELECT caf é').rows[0].comparison, 'text-differs')
  assert.equal(compare('SELECT a +/* comment */ b', 'SELECT a + b').rows[0].comparison, 'text-match')
})

test('missing SQL never produces an equivalence claim', () => {
  for (const statements of [undefined, null, [], ['-- comment only']]) {
    const row = { version: '001', name: 'example', statements }
    const result = compareMigrationHistory([row], [row])
    assert.equal(result.rows[0].comparison, 'sql-unavailable')
    assert.equal(result.rows[0].hash, null)
    assert.equal(result.summary.reviewRows, 2)
  }
  assert.equal(compare(null, 'SELECT 1').rows[1].comparison, 'counterpart-sql-unavailable')
})

test('reports alternate versions, source matches and name differences', () => {
  const report = compareMigrationHistory([migration('001', 'SELECT 1', 'old')],
    [migration('001', 'SELECT 2', 'new'), migration('002', 'SELECT 1')],
    [{ name: '003_example.sql', sql: 'SELECT 1;' }])
  assert.deepEqual(report.rows[0].matchingOtherVersions, ['002'])
  assert.deepEqual(report.rows[0].matchingSourceFiles, ['003_example.sql'])
  assert.ok(report.rows[0].reviewReasons.includes('name-differs'))
  assert.equal(report.rows[2].comparison, 'environment-only-version')
  assert.ok(!JSON.stringify(report).includes('SELECT'))
})

test('rejects ambiguous or malformed input without echoing SQL', () => {
  for (const rows of [[migration('001', 'SELECT 1'), migration('001', 'SELECT 2')],
    [{ version: 1, name: 'bad' }], [{ version: '001', name: 'bad', statements: 'secret' }]]) {
    assert.throws(() => validateLedger(rows, 'development'))
  }
  for (const sql of ["SELECT 'secret", '/* secret', 'DO $x$ secret']) {
    assert.throws(() => sqlTokens(sql))
    assert.throws(() => validateLedger([migration('001', sql)], 'development'), /invalid SQL text in migration 001/)
  }
  assert.equal(validateLedger({ migrations: [] }, 'development').length, 0)
  assert.throws(() => compareMigrationHistory([], []), /must both contain migrations/)
})

test('CLI writes a deterministic report, supports a review gate and redacts invalid input', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'migration-audit-'))
  const script = fileURLToPath(new URL('./audit-migration-history.mjs', import.meta.url))
  try {
    mkdirSync(path.join(root, 'migrations'))
    writeFileSync(path.join(root, 'migrations', '001_example.sql'), 'SELECT 1;')
    writeFileSync(path.join(root, 'dev.json'), JSON.stringify([migration('001', 'SELECT 1')]))
    writeFileSync(path.join(root, 'prod.json'), JSON.stringify([migration('002', 'SELECT 1')]))
    const args = [script, '--development', path.join(root, 'dev.json'), '--production', path.join(root, 'prod.json'), '--migrations', path.join(root, 'migrations')]
    const run = extra => spawnSync(process.execPath, [...args, ...extra], { encoding: 'utf8' })
    const first = run([])
    assert.equal(first.status, 0)
    assert.equal(first.stdout, run([]).stdout)
    assert.equal(JSON.parse(first.stdout).rows.length, 2)
    assert.equal(run(['--fail-on-review']).status, 2)
    assert.equal(run(['--unexpected']).status, 1)
    writeFileSync(path.join(root, 'prod.json'), '{private-secret')
    const invalid = run([])
    assert.equal(invalid.status, 1)
    assert.equal(invalid.stdout, '')
    assert.ok(!invalid.stderr.includes('private-secret'))
  } finally { rmSync(root, { recursive: true, force: true }) }
})
