#!/usr/bin/env node
/**
 * PHASE C — Create genuine Auth users via Supabase Admin API (dev only).
 *
 * Prerequisites: Phase B COMMITTED (checkpoint phase = B_neutralized, new_id NULL).
 *
 * - Reads/writes durable checkpoint via linked SQL (crm_repair is not PostgREST-exposed).
 * - Creates users only through auth.admin.createUser (never SQL into auth.*).
 * - Reconciliation-first: never createUser when a valid Auth user already owns the email.
 * - Does NOT mutate public.profiles (role promotion is Phase D).
 * - Atomic checkpoint advance to C_created only after all three replacements validate.
 *
 * Usage:
 *   npm run repair:dev-auth:phase-c
 *
 * Never prints passwords or the service-role key.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const REQUIRED_CONFIRM = 'cxgiaevervjttbuiramd'
const REQUIRED_PROJECT_REF = 'cxgiaevervjttbuiramd'
const MAP_FILE = resolve(process.cwd(), '.dev-auth-remap.json')
const SUPABASE_BIN = resolve(process.cwd(), 'node_modules/.bin/supabase')

const PLACEHOLDERS = [
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
]
const PLACEHOLDER_SET = new Set(PLACEHOLDERS)

const USERS = [
  {
    email: 'owner.dev@valtoris.test',
    role: 'owner',
    fullName: 'Dev Owner',
    slug: 'dev-owner',
    oldId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    advisorProfileId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    archivedEmail: 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
    passwordEnv: 'DEV_OWNER_PASSWORD',
  },
  {
    email: 'advisor.a@valtoris.test',
    role: 'advisor',
    fullName: 'Advisor A',
    slug: 'advisor-a',
    oldId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    advisorProfileId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    archivedEmail: 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
    passwordEnv: 'DEV_ADVISOR_A_PASSWORD',
  },
  {
    email: 'advisor.b@valtoris.test',
    role: 'advisor',
    fullName: 'Advisor B',
    slug: 'advisor-b',
    oldId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    advisorProfileId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    archivedEmail: 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test',
    passwordEnv: 'DEV_ADVISOR_B_PASSWORD',
  },
]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message) {
  console.error(`\nERROR: ${message}\n`)
  process.exit(1)
}

function assertUuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    fail(`Invalid UUID for ${label}: ${value ?? '(null)'}`)
  }
  return value.toLowerCase()
}

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function loadDotEnvFallback() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) fail('Missing .env')
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let key = line.slice(0, eq).trim()
    if (key.startsWith('export ')) key = key.slice(7).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function assertGuards() {
  const linkedRefPath = resolve(process.cwd(), 'supabase/.temp/project-ref')
  if (!existsSync(linkedRefPath)) {
    fail('Missing supabase/.temp/project-ref — link project cxgiaevervjttbuiramd first')
  }
  const linkedRef = readFileSync(linkedRefPath, 'utf8').trim()
  if (linkedRef !== REQUIRED_PROJECT_REF) {
    fail(`Linked project must be ${REQUIRED_PROJECT_REF}, got ${linkedRef}`)
  }

  const url = process.env.SUPABASE_URL?.trim()
  if (!url) fail('Missing SUPABASE_URL')
  let hostname
  try {
    hostname = new URL(url).hostname
  } catch {
    fail('SUPABASE_URL invalid')
  }
  if (hostname !== REQUIRED_HOST) {
    fail(`Hostname must be ${REQUIRED_HOST}, got ${hostname}`)
  }
  if (process.env.CONFIRM_DEV_AUTH_BOOTSTRAP?.trim() !== REQUIRED_CONFIRM) {
    fail(`CONFIRM_DEV_AUTH_BOOTSTRAP must be ${REQUIRED_CONFIRM}`)
  }
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRole) fail('Missing SUPABASE_SERVICE_ROLE_KEY')
  if (serviceRole.startsWith('sb_publishable_') || serviceRole.startsWith('sb_anon_')) {
    fail('Service role key looks like anon/publishable')
  }
  if (!existsSync(SUPABASE_BIN)) {
    fail(`Missing local supabase CLI at ${SUPABASE_BIN}`)
  }
  return { url: url.replace(/\/$/, ''), serviceRole, hostname, linkedRef }
}

function resolvePassword(passwordEnv) {
  const password = (process.env[passwordEnv] || process.env.DEV_AUTH_PASSWORD || '').trim()
  if (!password || password.length < 8) {
    fail(`Missing/short password for ${passwordEnv} (or DEV_AUTH_PASSWORD)`)
  }
  return password
}

function formatAdminError(error) {
  if (!error) return 'name=(none); message=(null); status=(none); code=(none)'
  return `name=${error.name ?? '(none)'}; message=${error.message?.trim() || '(empty)'}; status=${error.status ?? error.statusCode ?? '(none)'}; code=${error.code ?? '(none)'}`
}

function sanitizeCliOutput(text) {
  let out = String(text ?? '')
  out = out.replace(
    /(service[_-]?role(?:_key)?|password|secret|api[_-]?key|authorization|bearer)\s*[:=]\s*\S+/gi,
    '$1=<redacted>',
  )
  out = out.replace(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    '<jwt-redacted>',
  )
  // Cap failure-message size; keep head+tail for long blobs.
  if (out.length > 4000) {
    out = `${out.slice(0, 2000)}\n…[truncated]…\n${out.slice(-1000)}`
  }
  return out
}

/**
 * Scan one complete top-level JSON object/array starting at offset.
 * Tracks nested {} and [] with string/escape awareness.
 */
function rawDecodeJsonValue(text, offset) {
  const open = text[offset]
  if (open !== '{' && open !== '[') return null

  /** @type {string[]} */
  const stack = []
  let inString = false
  let escape = false

  for (let i = offset; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch)
      continue
    }
    if (ch === '}' || ch === ']') {
      const expected = ch === '}' ? '{' : '['
      if (!stack.length || stack[stack.length - 1] !== expected) {
        throw new Error(
          `Mismatched ${ch} while scanning JSON at index ${i}\n${sanitizeCliOutput(text.slice(offset, i + 1))}`,
        )
      }
      stack.pop()
      if (stack.length === 0) {
        const slice = text.slice(offset, i + 1)
        try {
          return { value: JSON.parse(slice), end: i + 1 }
        } catch (e) {
          throw new Error(
            `JSON.parse failed for scanned value: ${e instanceof Error ? e.message : String(e)}\n${sanitizeCliOutput(slice)}`,
          )
        }
      }
    }
  }
  return null
}

/**
 * Scan stdout for complete top-level JSON values (objects/arrays).
 * Skips non-JSON prose prefixes such as "Initialising login role...".
 */
function extractJsonValues(stdout) {
  const text = String(stdout ?? '')
  const values = []
  let idx = 0

  while (idx < text.length) {
    while (idx < text.length && /\s/.test(text[idx])) idx += 1
    if (idx >= text.length) break

    if (text[idx] !== '{' && text[idx] !== '[') {
      const nextObj = text.indexOf('{', idx)
      const nextArr = text.indexOf('[', idx)
      const candidates = [nextObj, nextArr].filter((n) => n >= 0)
      if (!candidates.length) break
      idx = Math.min(...candidates)
      continue
    }

    const decoded = rawDecodeJsonValue(text, idx)
    if (!decoded) {
      throw new Error(
        `Unable to decode JSON value starting at index ${idx}\n${sanitizeCliOutput(text)}`,
      )
    }
    values.push(decoded.value)
    idx = decoded.end
  }

  return values
}

function isRowBearingValue(value) {
  if (Array.isArray(value)) {
    // Top-level row array: only objects (or empty array). Reject arrays of primitives/mixed.
    return value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
  }
  if (value && typeof value === 'object') {
    return Object.prototype.hasOwnProperty.call(value, 'rows') && Array.isArray(value.rows)
  }
  return false
}

function normalizeRowBearingValue(value) {
  if (Array.isArray(value)) {
    return { rows: value }
  }
  if (value && typeof value === 'object' && Array.isArray(value.rows)) {
    return { rows: value.rows }
  }
  throw new Error('normalizeRowBearingValue called with non-row-bearing value')
}

/**
 * Parse supabase db query -o json stdout into { rows: [...] }.
 * Supports a single envelope, NDJSON / multiple consecutive JSON values, or a top-level row array.
 * Never silently returns [] for an unrecognized structure.
 */
function parseDbQueryJson(stdout) {
  let values
  try {
    values = extractJsonValues(stdout)
  } catch (e) {
    fail(
      `Failed to parse supabase db query JSON: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  if (!values.length) {
    fail(
      `supabase db query returned no JSON values\n${sanitizeCliOutput(stdout)}`,
    )
  }

  const rowBearing = values.filter(isRowBearingValue)

  if (rowBearing.length === 0) {
    fail(
      `supabase db query JSON contained no recognizable row-bearing result\n${sanitizeCliOutput(stdout)}`,
    )
  }
  if (rowBearing.length > 1) {
    fail(
      `supabase db query JSON contained ${rowBearing.length} ambiguous row-bearing results\n${sanitizeCliOutput(stdout)}`,
    )
  }

  try {
    return normalizeRowBearingValue(rowBearing[0])
  } catch (e) {
    fail(
      `Unexpected supabase db query JSON structure: ${e instanceof Error ? e.message : String(e)}\n${sanitizeCliOutput(stdout)}`,
    )
  }
}

/**
 * Non-exiting parse used by fixtures (mirrors parseDbQueryJson rules).
 * @returns {{ rows: object[] }}
 */
function parseDbQueryJsonForFixtures(stdout) {
  const values = extractJsonValues(stdout)
  if (!values.length) throw new Error('no JSON values')
  const rowBearing = values.filter(isRowBearingValue)
  if (!rowBearing.length) throw new Error('no row-bearing result')
  if (rowBearing.length > 1) {
    throw new Error(`${rowBearing.length} ambiguous row-bearing results`)
  }
  return normalizeRowBearingValue(rowBearing[0])
}

/** Offline parser fixtures — no DB, no Auth, no checkpoint writes. */
function runParserFixtures() {
  /** @type {{ name: string, stdout: string, expect: 'ok' | 'fail', rows?: object[] }}[] */
  const fixtures = [
    {
      name: 'one { rows: [...] } envelope',
      stdout: `Initialising login role...\n${JSON.stringify({
        boundary: 'abc',
        rows: [{ status: 'PHASE_C_JSON_TEST' }],
        warning: 'untrusted',
      })}\n`,
      expect: 'ok',
      rows: [{ status: 'PHASE_C_JSON_TEST' }],
    },
    {
      name: 'top-level row array',
      stdout: `${JSON.stringify([{ id: 1 }, { id: 2 }])}\n`,
      expect: 'ok',
      rows: [{ id: 1 }, { id: 2 }],
    },
    {
      name: 'metadata object followed by row-bearing object',
      stdout: `${JSON.stringify({ ok: true })}\n${JSON.stringify({
        rows: [{ email: 'a@test' }],
      })}\n`,
      expect: 'ok',
      rows: [{ email: 'a@test' }],
    },
    {
      name: 'malformed JSON',
      stdout: 'Initialising...\n{ "rows": [',
      expect: 'fail',
    },
    {
      name: 'ambiguous multiple row-bearing objects',
      stdout: `${JSON.stringify({ rows: [{ a: 1 }] })}\n${JSON.stringify({
        rows: [{ b: 2 }],
      })}\n`,
      expect: 'fail',
    },
    {
      name: 'valid JSON with no recognizable rows',
      stdout: `${JSON.stringify({ boundary: 'x', warning: 'y' })}\n`,
      expect: 'fail',
    },
  ]

  let passed = 0
  console.log('Phase C parser fixtures (offline, non-executing against Auth/DB):')
  for (const fixture of fixtures) {
    let error = null
    let result = null
    try {
      result = parseDbQueryJsonForFixtures(fixture.stdout)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }

    if (fixture.expect === 'ok') {
      if (error) {
        console.error(`  FAIL: ${fixture.name}: unexpected error: ${error}`)
        continue
      }
      if (JSON.stringify(result?.rows) !== JSON.stringify(fixture.rows)) {
        console.error(
          `  FAIL: ${fixture.name}: rows mismatch expected=${JSON.stringify(fixture.rows)} actual=${JSON.stringify(result?.rows)}`,
        )
        continue
      }
      console.log(`  PASS: ${fixture.name}`)
      passed += 1
    } else if (!error) {
      console.error(
        `  FAIL: ${fixture.name}: expected failure, got rows=${JSON.stringify(result?.rows)}`,
      )
    } else {
      console.log(`  PASS: ${fixture.name} (failed as expected: ${error.split('\n')[0]})`)
      passed += 1
    }
  }

  console.log(`Parser fixtures: ${passed}/${fixtures.length} passed`)
  if (passed !== fixtures.length) {
    process.exitCode = 1
    return false
  }
  return true
}

function dbQuery(sql, { expectRows = true } = {}) {
  const tmpPath = join(
    tmpdir(),
    `phase-c-${process.pid}-${randomBytes(8).toString('hex')}.sql`,
  )
  writeFileSync(tmpPath, sql, 'utf8')
  try {
    const result = spawnSync(
      SUPABASE_BIN,
      ['db', 'query', '--linked', '--file', tmpPath, '-o', 'json'],
      {
        encoding: 'utf8',
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 20 * 1024 * 1024,
      },
    )
    const stdout = result.stdout || ''
    const stderr = result.stderr || ''
    if (result.status !== 0) {
      fail(
        `supabase db query failed (exit ${result.status})\n${sanitizeCliOutput(stderr || stdout || '(no output)')}`,
      )
    }
    if (!expectRows) {
      // Still require a parseable row-bearing result so callers cannot miss CLI shape changes.
      const parsed = parseDbQueryJson(stdout)
      return { rows: parsed.rows, raw: stdout, stderr }
    }
    const parsed = parseDbQueryJson(stdout)
    if (!Array.isArray(parsed.rows)) {
      fail(
        `supabase db query parsed result.rows is not an array\n${sanitizeCliOutput(stdout)}`,
      )
    }
    return { rows: parsed.rows, raw: stdout, stderr }
  } finally {
    try {
      unlinkSync(tmpPath)
    } catch {
      // ignore cleanup errors
    }
  }
}

function loadCheckpointRows() {
  const { rows } = dbQuery(`
select
  email,
  old_id::text as old_id,
  new_id::text as new_id,
  role::text as role,
  slug,
  advisor_profile_id::text as advisor_profile_id,
  phase
from crm_repair._dev_auth_repair_map
order by email;
`)
  return rows
}

function expectExactCheckpointMappings(rows) {
  if (rows.length !== 3) {
    fail(`Checkpoint must contain exactly 3 rows, found ${rows.length}`)
  }

  const byEmail = new Map(rows.map((r) => [r.email, r]))
  for (const spec of USERS) {
    const row = byEmail.get(spec.email)
    if (!row) fail(`Checkpoint missing email ${spec.email}`)
    if (assertUuid(row.old_id, `${spec.email}.old_id`) !== spec.oldId) {
      fail(`Checkpoint old_id mismatch for ${spec.email}`)
    }
    if (row.role !== spec.role) fail(`Checkpoint role mismatch for ${spec.email}`)
    if (row.slug !== spec.slug) fail(`Checkpoint slug mismatch for ${spec.email}`)
    if (
      assertUuid(row.advisor_profile_id, `${spec.email}.advisor_profile_id`) !==
      spec.advisorProfileId
    ) {
      fail(`Checkpoint advisor_profile_id mismatch for ${spec.email}`)
    }
  }

  const unexpected = rows.filter((r) => !USERS.some((u) => u.email === r.email))
  if (unexpected.length) {
    fail(`Checkpoint has unexpected emails: ${unexpected.map((r) => r.email).join(', ')}`)
  }
}

function classifyCheckpoint(rows) {
  expectExactCheckpointMappings(rows)

  const allB =
    rows.every((r) => r.phase === 'B_neutralized') && rows.every((r) => r.new_id == null)
  if (allB) return { mode: 'run' }

  const allC =
    rows.every((r) => r.phase === 'C_created') &&
    rows.every((r) => r.new_id != null && !PLACEHOLDER_SET.has(String(r.new_id).toLowerCase()))
  if (allC) return { mode: 'already_complete' }

  fail(
    'Checkpoint is in an inconsistent Phase C state (expected all B_neutralized/new_id NULL, or all C_created with new_id set). Aborting to avoid duplicate Auth users.',
  )
}

function assertPhaseBDurableState() {
  // Fresh Phase B: originals are globally free.
  // Crash recovery: originals may already be owned by non-placeholder replacement
  // users/profiles/identities from a prior interrupted Phase C — that is OK.
  // Never allow originals (or identities) to remain attached to placeholder UUIDs.
  const { rows } = dbQuery(`
with expected(old_id, archived_email) as (
  values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid, 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid, 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test')
),
placeholder_ids as (
  select unnest(array[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
  ]) as id
),
archived_auth as (
  select count(*)::int as n
  from expected e
  join auth.users u on u.id = e.old_id and u.email = e.archived_email
),
archived_profiles as (
  select count(*)::int as n
  from expected e
  join public.profiles p on p.id = e.old_id and p.email = e.archived_email
),
original_on_placeholders_users as (
  select count(*)::int as n
  from auth.users u
  join placeholder_ids p on p.id = u.id
  where u.email in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  )
),
original_on_placeholders_profiles as (
  select count(*)::int as n
  from public.profiles pr
  join placeholder_ids p on p.id = pr.id
  where pr.email in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  )
),
original_identities_on_placeholders as (
  select count(*)::int as n
  from auth.identities i
  join placeholder_ids p on p.id = i.user_id
  where i.identity_data ->> 'email' in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
     or i.email in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
),
duplicate_original_users as (
  select count(*)::int as n
  from (
    select u.email
    from auth.users u
    where u.email in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
    group by u.email
    having count(*) > 1
  ) d
),
placeholder_identities as (
  select count(*)::int as n
  from auth.identities i
  join placeholder_ids p on p.id = i.user_id
),
stray_original_users as (
  -- Original emails on auth.users must be absent OR owned only by non-placeholders.
  select count(*)::int as n
  from auth.users u
  where u.email in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  )
    and u.id in (select id from placeholder_ids)
),
fresh_free_users as (
  select count(*)::int as n
  from auth.users
  where email in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  )
),
fresh_free_profiles as (
  select count(*)::int as n
  from public.profiles
  where email in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  )
),
fresh_free_identities as (
  select count(*)::int as n
  from auth.identities
  where identity_data ->> 'email' in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
     or email in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
)
select
  (select n from archived_auth) as archived_auth_matches,
  (select n from archived_profiles) as archived_profile_matches,
  (select n from original_on_placeholders_users) as original_on_placeholders_users,
  (select n from original_on_placeholders_profiles) as original_on_placeholders_profiles,
  (select n from original_identities_on_placeholders) as original_identities_on_placeholders,
  (select n from duplicate_original_users) as duplicate_original_users,
  (select n from placeholder_identities) as placeholder_identities,
  (select n from stray_original_users) as stray_original_users,
  (select n from fresh_free_users) as original_auth_users,
  (select n from fresh_free_profiles) as original_profiles,
  (select n from fresh_free_identities) as original_identities;
`)

  const row = rows[0]
  if (!row) fail('Phase B durable validation returned no rows')

  if (Number(row.archived_auth_matches) !== 3) {
    fail(
      `Phase B durable check failed: archived auth email/UUID pairings expected 3, found ${row.archived_auth_matches}`,
    )
  }
  if (Number(row.archived_profile_matches) !== 3) {
    fail(
      `Phase B durable check failed: archived profile email/UUID pairings expected 3, found ${row.archived_profile_matches}`,
    )
  }
  if (Number(row.placeholder_identities) !== 0) {
    fail(
      `Phase B durable check failed: placeholder auth.identities expected 0, found ${row.placeholder_identities}`,
    )
  }
  if (Number(row.original_on_placeholders_users) !== 0) {
    fail('Phase B durable check failed: original emails still attached to placeholder auth.users')
  }
  if (Number(row.original_on_placeholders_profiles) !== 0) {
    fail('Phase B durable check failed: original emails still attached to placeholder profiles')
  }
  if (Number(row.original_identities_on_placeholders) !== 0) {
    fail('Phase B durable check failed: original emails still attached to placeholder identities')
  }
  if (Number(row.duplicate_original_users) !== 0) {
    fail('Phase B durable check failed: duplicate auth.users rows for an original email')
  }
  if (Number(row.stray_original_users) !== 0) {
    fail('Phase B durable check failed: stray original emails on placeholder auth.users')
  }

  const occupiedUsers = Number(row.original_auth_users)
  const occupiedProfiles = Number(row.original_profiles)
  const occupiedIdentities = Number(row.original_identities)

  // Fresh start: originals must be globally free.
  // Partial Phase C recovery: 1–3 non-placeholder occupants are allowed and reconciled next.
  if (occupiedUsers === 0 && occupiedProfiles === 0 && occupiedIdentities === 0) {
    console.log('Phase B durable state: originals globally free (fresh Phase C)')
    return
  }

  if (occupiedUsers < 0 || occupiedUsers > 3) {
    fail(`Phase B durable check failed: unexpected original auth.users occupancy (${occupiedUsers})`)
  }

  // Any occupant must be a valid non-placeholder Auth user (validated during reconcile).
  console.log(
    `Phase B durable state: partial/complete Auth occupancy detected (users=${occupiedUsers}, profiles=${occupiedProfiles}, identities=${occupiedIdentities}) — will reconcile before createUser`,
  )
}

function findAuthUserByEmail(email) {
  const { rows } = dbQuery(`
select
  id::text as id,
  email,
  (email_confirmed_at is not null) as email_confirmed,
  deleted_at is not null as is_deleted,
  (nullif(encrypted_password, '') is not null) as has_password
from auth.users
where email = ${sqlText(email)}
order by created_at asc
limit 2;
`)
  if (rows.length > 1) {
    fail(`Multiple auth.users rows found for ${email}`)
  }
  return rows[0] ?? null
}

function loadIdentitiesForUser(userId) {
  const id = assertUuid(userId, 'identity lookup user_id')
  const { rows } = dbQuery(`
select
  id::text as identity_id,
  user_id::text as user_id,
  provider,
  provider_id,
  identity_data ->> 'email' as identity_email
from auth.identities
where user_id = '${id}'::uuid
order by provider, provider_id;
`)
  return rows
}

function assertArchivedAndPlaceholderInvariants() {
  const { rows } = dbQuery(`
select
  (
    select count(*)::int
    from auth.users u
    where (u.id, u.email) in (
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test')
    )
  ) as archived_auth_ok,
  (
    select count(*)::int
    from public.profiles p
    where (p.id, p.email) in (
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test')
    )
  ) as archived_profiles_ok,
  (
    select count(*)::int
    from auth.identities
    where user_id in (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    )
  ) as placeholder_identities;
`)
  const row = rows[0]
  if (Number(row.archived_auth_ok) !== 3) {
    fail('Archived auth emails changed unexpectedly')
  }
  if (Number(row.archived_profiles_ok) !== 3) {
    fail('Archived profile emails changed unexpectedly')
  }
  if (Number(row.placeholder_identities) !== 0) {
    fail(`Placeholder identities must remain 0, found ${row.placeholder_identities}`)
  }
}

function validateReplacementUser(userId, email, { requirePassword = true } = {}) {
  const id = assertUuid(userId, `${email} replacement id`)
  if (PLACEHOLDER_SET.has(id)) {
    fail(`Replacement UUID for ${email} must not be a placeholder (${id})`)
  }

  const user = findAuthUserByEmail(email)
  if (!user) fail(`Replacement auth.users row missing for ${email}`)
  if (assertUuid(user.id, `${email} auth id`) !== id) {
    fail(`Auth user id for ${email} is ${user.id}, expected bound id ${id}`)
  }
  if (user.email !== email) fail(`Auth email mismatch for ${email}`)
  if (user.is_deleted === true || user.is_deleted === 't') {
    fail(`Replacement Auth user for ${email} is deleted`)
  }
  if (!(user.email_confirmed === true || user.email_confirmed === 't')) {
    fail(`Replacement Auth user for ${email} is not email-confirmed`)
  }
  if (requirePassword && !(user.has_password === true || user.has_password === 't')) {
    fail(`Replacement Auth user for ${email} has no password credential`)
  }

  const identities = loadIdentitiesForUser(id)
  if (identities.length !== 1) {
    fail(`Expected exactly 1 identity for ${email} (${id}), found ${identities.length}`)
  }
  const identity = identities[0]
  if (identity.provider !== 'email') {
    fail(`Expected email provider identity for ${email}, found provider=${identity.provider}`)
  }
  if (assertUuid(identity.user_id, `${email} identity.user_id`) !== id) {
    fail(`Identity user_id mismatch for ${email}`)
  }
  if (assertUuid(identity.provider_id, `${email} identity.provider_id`) !== id) {
    fail(`Identity provider_id must equal Auth user UUID for ${email}`)
  }
  if (identity.identity_email !== email) {
    fail(`Identity identity_data.email mismatch for ${email}`)
  }

  // Email occupancy: provider_id is the Auth user UUID for email identities, not the email.
  // Match on identity_data.email and generated auth.identities.email only.
  const { rows: occ } = dbQuery(`
select count(*)::int as n
from auth.identities
where (
    identity_data ->> 'email' = ${sqlText(email)}
    or email = ${sqlText(email)}
  )
  and user_id is distinct from '${id}'::uuid;
`)
  if (Number(occ[0]?.n) !== 0) {
    fail(`Email ${email} is occupied by another identity user_id`)
  }

  assertArchivedAndPlaceholderInvariants()
  return { id, email }
}

function assertDistinctNewIds(bindings) {
  const ids = bindings.map((b) => assertUuid(b.newId, b.email))
  if (new Set(ids).size !== ids.length) {
    fail('Replacement UUIDs are not distinct from one another')
  }
  for (const id of ids) {
    if (PLACEHOLDER_SET.has(id)) {
      fail(`Replacement UUID ${id} collides with a placeholder`)
    }
  }
}

function writeCheckpointAtomic(bindings) {
  assertDistinctNewIds(bindings)
  const byEmail = new Map(bindings.map((b) => [b.email, b]))

  for (const spec of USERS) {
    if (!byEmail.has(spec.email)) fail(`Missing binding for ${spec.email} before checkpoint write`)
  }

  const owner = byEmail.get('owner.dev@valtoris.test')
  const advA = byEmail.get('advisor.a@valtoris.test')
  const advB = byEmail.get('advisor.b@valtoris.test')

  const sql = `
begin;

do $phase_c$
declare
  n int;
begin
  update crm_repair._dev_auth_repair_map m
  set
    new_id = case m.email
      when 'owner.dev@valtoris.test' then '${assertUuid(owner.newId, 'owner newId')}'::uuid
      when 'advisor.a@valtoris.test' then '${assertUuid(advA.newId, 'advisor.a newId')}'::uuid
      when 'advisor.b@valtoris.test' then '${assertUuid(advB.newId, 'advisor.b newId')}'::uuid
    end,
    phase = 'C_created',
    updated_at = now()
  where m.phase = 'B_neutralized'
    and m.new_id is null
    and (
      (m.email = 'owner.dev@valtoris.test'
        and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
        and m.role = 'owner'
        and m.slug = 'dev-owner'
        and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')
      or (m.email = 'advisor.a@valtoris.test'
        and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
        and m.role = 'advisor'
        and m.slug = 'advisor-a'
        and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2')
      or (m.email = 'advisor.b@valtoris.test'
        and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
        and m.role = 'advisor'
        and m.slug = 'advisor-b'
        and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3')
    );

  get diagnostics n = row_count;
  if n <> 3 then
    raise exception
      'Phase C abort: atomic checkpoint update affected % rows (expected exactly 3)',
      n;
  end if;

  if (
    select count(*)::int from crm_repair._dev_auth_repair_map
    where phase = 'C_created' and new_id is not null
  ) <> 3 then
    raise exception 'Phase C abort: checkpoint not fully advanced to C_created';
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map
    where new_id is null
       or phase is distinct from 'C_created'
       or new_id in (
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
       )
  ) then
    raise exception 'Phase C abort: checkpoint postcondition failed after update';
  end if;

  if not exists (
    select 1 from crm_repair._dev_auth_repair_map
    where email = 'owner.dev@valtoris.test'
      and new_id = '${assertUuid(owner.newId, 'owner newId')}'::uuid
      and phase = 'C_created'
  ) then
    raise exception 'Phase C abort: owner.dev checkpoint new_id mismatch after update';
  end if;
  if not exists (
    select 1 from crm_repair._dev_auth_repair_map
    where email = 'advisor.a@valtoris.test'
      and new_id = '${assertUuid(advA.newId, 'advisor.a newId')}'::uuid
      and phase = 'C_created'
  ) then
    raise exception 'Phase C abort: advisor.a checkpoint new_id mismatch after update';
  end if;
  if not exists (
    select 1 from crm_repair._dev_auth_repair_map
    where email = 'advisor.b@valtoris.test'
      and new_id = '${assertUuid(advB.newId, 'advisor.b newId')}'::uuid
      and phase = 'C_created'
  ) then
    raise exception 'Phase C abort: advisor.b checkpoint new_id mismatch after update';
  end if;
end
$phase_c$;

commit;

-- Durable read after COMMIT (also the result set returned by supabase db query --file).
select
  email,
  old_id::text as old_id,
  new_id::text as new_id,
  role::text as role,
  slug,
  advisor_profile_id::text as advisor_profile_id,
  phase
from crm_repair._dev_auth_repair_map
order by email;
`

  console.log('Checkpoint update: beginning atomic write (all 3 rows → C_created)')
  const { rows } = dbQuery(sql)
  if (rows.length !== 3) {
    fail(`Checkpoint update verification returned ${rows.length} rows (expected 3)`)
  }
  for (const spec of USERS) {
    const row = rows.find((r) => r.email === spec.email)
    if (!row) fail(`Checkpoint verification missing ${spec.email}`)
    if (row.phase !== 'C_created') fail(`Checkpoint phase not C_created for ${spec.email}`)
    if (assertUuid(row.new_id, `${spec.email} checkpoint new_id`) !== byEmail.get(spec.email).newId) {
      fail(`Checkpoint new_id mismatch after commit for ${spec.email}`)
    }
  }
  console.log('Checkpoint update: committed (phase=C_created for all 3 rows)')
  return rows
}

async function createAuthUser(admin, spec) {
  const password = resolvePassword(spec.passwordEnv)
  const { data: created, error: createError } = await admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName },
  })

  if (createError || !created?.user) {
    // Race/conflict: reconcile instead of failing blindly.
    const existing = findAuthUserByEmail(spec.email)
    if (existing) {
      console.log(
        `  → createUser conflict/error; reconciling existing Auth user for ${spec.email}`,
      )
      validateReplacementUser(existing.id, spec.email)
      return { newId: assertUuid(existing.id, spec.email), action: 'resume_after_conflict' }
    }
    fail(`createUser(${spec.email}) failed: ${formatAdminError(createError)}`)
  }

  const newId = assertUuid(created.user.id, `${spec.email} created id`)
  if (PLACEHOLDER_SET.has(newId)) {
    fail(`createUser returned a placeholder UUID for ${spec.email}`)
  }
  if (created.user.email !== spec.email) {
    fail(`createUser email mismatch for ${spec.email}`)
  }

  validateReplacementUser(newId, spec.email)
  return { newId, action: 'create' }
}

function writeLocalMap(bindings) {
  /** @type {Record<string, object>} */
  const payload = {}
  for (const spec of USERS) {
    const b = bindings.find((x) => x.email === spec.email)
    payload[spec.email] = {
      email: spec.email,
      oldId: spec.oldId,
      newId: b.newId,
      role: spec.role,
      slug: spec.slug,
      advisorProfileId: spec.advisorProfileId,
      action: b.action,
    }
  }
  writeFileSync(MAP_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`Wrote local map ${MAP_FILE} (UUIDs only; not a secret store)`)
}

async function validateAlreadyComplete(rows) {
  console.log('Checkpoint already C_created — validating bound Auth users (no createUser)')
  // Original emails are occupied by the new users; skip "globally free" Phase B preflight.
  assertArchivedAndPlaceholderInvariants()

  const bindings = []
  for (const spec of USERS) {
    const row = rows.find((r) => r.email === spec.email)
    const newId = assertUuid(row.new_id, `${spec.email} checkpoint new_id`)
    console.log(
      `Validating resume ${spec.email} old=${spec.oldId} new=${newId}`,
    )
    validateReplacementUser(newId, spec.email)
    bindings.push({ email: spec.email, oldId: spec.oldId, newId, action: 'already_complete' })
  }
  assertDistinctNewIds(bindings)
  writeLocalMap(bindings)
  console.log('\nPHASE_C_OK — checkpoint already C_created; Auth users validated.\n')
}

function assertDbQueryJsonParser() {
  const { rows } = dbQuery(`select 'PHASE_C_JSON_TEST' as status;`)
  if (rows.length !== 1) {
    fail(
      `CLI JSON parser self-test failed: expected exactly 1 row, got ${rows.length}`,
    )
  }
  if (rows[0]?.status !== 'PHASE_C_JSON_TEST') {
    fail(
      `CLI JSON parser self-test failed: expected status=PHASE_C_JSON_TEST, got ${rows[0]?.status ?? '(missing)'}`,
    )
  }
  console.log('CLI JSON parser self-test: OK (PHASE_C_JSON_TEST)')
}

async function runCreateOrReconcile(admin) {
  assertPhaseBDurableState()
  console.log('Phase B durable state: OK')

  // Harmless read-only parse check before any Admin createUser call.
  assertDbQueryJsonParser()

  /** @type {{ email: string, oldId: string, newId: string, action: string }[]} */
  const bindings = []

  for (const spec of USERS) {
    console.log(`Processing ${spec.email} (old=${spec.oldId})`)

    const existing = findAuthUserByEmail(spec.email)
    if (existing) {
      const newId = assertUuid(existing.id, `${spec.email} existing id`)
      if (PLACEHOLDER_SET.has(newId)) {
        fail(
          `Auth user for ${spec.email} is still a placeholder UUID (${newId}); Phase B archive state is inconsistent`,
        )
      }
      console.log(`  → resume existing Auth user new=${newId}`)
      validateReplacementUser(newId, spec.email)
      bindings.push({
        email: spec.email,
        oldId: spec.oldId,
        newId,
        action: 'resume',
      })
      continue
    }

    console.log('  → no existing Auth user; calling admin.createUser')
    const created = await createAuthUser(admin, spec)
    console.log(`  → ${created.action} new=${created.newId}`)
    bindings.push({
      email: spec.email,
      oldId: spec.oldId,
      newId: created.newId,
      action: created.action,
    })
  }

  assertDistinctNewIds(bindings)

  // Final invariant pass before durable checkpoint write.
  for (const b of bindings) {
    validateReplacementUser(b.newId, b.email)
  }
  assertArchivedAndPlaceholderInvariants()

  // Original emails must now be occupied exactly once each on auth.users (the replacements),
  // and must remain free on placeholder/archived rows (already checked). Profiles for new
  // users may exist via trigger; originals must not remain on placeholder profile emails.
  const { rows: occupancy } = dbQuery(`
select
  u.email,
  count(*)::int as n
from auth.users u
where u.email in (
  'owner.dev@valtoris.test',
  'advisor.a@valtoris.test',
  'advisor.b@valtoris.test'
)
group by u.email
order by u.email;
`)
  if (occupancy.length !== 3 || occupancy.some((r) => Number(r.n) !== 1)) {
    fail('Expected exactly one auth.users row per original email before checkpoint write')
  }

  writeCheckpointAtomic(bindings)
  writeLocalMap(bindings)

  console.log('\nPhase C bindings:')
  for (const b of bindings) {
    console.log(`  ${b.email}: old=${b.oldId} new=${b.newId} action=${b.action}`)
  }
  console.log('\nPHASE_C_OK — all three users validated; checkpoint advanced to C_created.\n')
}

async function main() {
  if (process.argv.includes('--self-test-parser')) {
    const ok = runParserFixtures()
    if (!ok) fail('Parser fixture suite failed')
    console.log('PHASE_C_PARSER_SELF_TEST_OK')
    return
  }

  loadDotEnvFallback()
  const { url, serviceRole, hostname, linkedRef } = assertGuards()

  console.log('PHASE C — create/reconcile genuine Auth users (Admin API + linked SQL)')
  console.log(`Project: ${linkedRef}`)
  console.log(`Target hostname: ${hostname}`)
  console.log('Emails:')
  for (const u of USERS) console.log(`  - ${u.email} (old=${u.oldId})`)
  console.log('')

  // First DB access: checkpoint load (Admin client is not created yet).
  const checkpointRows = loadCheckpointRows()
  const { mode } = classifyCheckpoint(checkpointRows)
  console.log(`Checkpoint gate: mode=${mode}`)

  if (mode === 'already_complete') {
    await validateAlreadyComplete(checkpointRows)
    return
  }

  // mode === 'run' → all B_neutralized / new_id NULL
  // Admin client is created only after checkpoint gate passes.
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  await runCreateOrReconcile(supabase.auth.admin)
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)))
