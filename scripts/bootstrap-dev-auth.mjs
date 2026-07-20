#!/usr/bin/env node
/**
 * Local/dev-only bootstrap for real Supabase Auth users on valtoris-crm-dev.
 *
 * Env loading:
 * - Preferred: `npm run bootstrap:dev-auth` → `node --env-file=.env …`
 * - Fallback: loadDotEnvFallback() fills only keys that are still undefined
 * - Precedence: existing shell environment variables override .env values
 *
 * Safety:
 * - Requires SUPABASE_URL hostname === cxgiaevervjttbuiramd.supabase.co
 * - Requires CONFIRM_DEV_AUTH_BOOTSTRAP === cxgiaevervjttbuiramd
 * - Never enumerates all Auth users via listUsers pagination
 * - Resolves a full plan before any write (no partial writes on lookup failure)
 * - Never prints passwords or the service-role key
 *
 * Modes:
 *   npm run bootstrap:dev-auth
 *   npm run bootstrap:dev-auth:diagnose   (--diagnose-placeholders)
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const REQUIRED_CONFIRM = 'cxgiaevervjttbuiramd'

const FORBIDDEN_PLACEHOLDERS = [
  'YOUR_PROJECT_REF',
  'your_project_ref',
  'your_actual_service_role_key',
  'YOUR_SERVICE_ROLE_KEY',
  'YOUR_SUPABASE_SERVICE_ROLE_KEY',
  'choose_a_secure_password',
  'choose-a-strong-dev-password',
]

/** @type {ReadonlyArray<{ email: string, role: 'owner' | 'advisor', fullName: string, slug: string, passwordEnv: string, placeholderId: string }>} */
const DEV_USERS = [
  {
    email: 'owner.dev@valtoris.test',
    role: 'owner',
    fullName: 'Dev Owner',
    slug: 'dev-owner',
    passwordEnv: 'DEV_OWNER_PASSWORD',
    placeholderId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  },
  {
    email: 'advisor.a@valtoris.test',
    role: 'advisor',
    fullName: 'Advisor A',
    slug: 'advisor-a',
    passwordEnv: 'DEV_ADVISOR_A_PASSWORD',
    placeholderId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  },
  {
    email: 'advisor.b@valtoris.test',
    role: 'advisor',
    fullName: 'Advisor B',
    slug: 'advisor-b',
    passwordEnv: 'DEV_ADVISOR_B_PASSWORD',
    placeholderId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  },
]

const PLACEHOLDER_USER_IDS = DEV_USERS.map((u) => u.placeholderId)

/** Public CRM columns that may reference profiles.id */
const PROFILE_FK_TARGETS = [
  ['profiles', 'id'],
  ['profiles', 'manager_id'],
  ['advisor_profiles', 'user_id'],
  ['app_settings', 'updated_by_user_id'],
  ['audit_logs', 'actor_user_id'],
  ['households', 'assigned_by_user_id'],
  ['households', 'created_by_user_id'],
  ['duplicate_reviews', 'resolved_by_user_id'],
  ['leads', 'assigned_by_user_id'],
  ['recommendations', 'reviewed_by_user_id'],
  ['recommendations', 'created_by_user_id'],
  ['opportunities', 'assigned_by_user_id'],
  ['advisor_assignments', 'assigned_by_user_id'],
  ['tasks', 'assigned_user_id'],
  ['tasks', 'created_by_user_id'],
  ['notes', 'author_user_id'],
  ['activities', 'actor_user_id'],
  ['documents', 'uploaded_by_user_id'],
  ['client_portal_accounts', 'user_id'],
]

const PROFILE_FK_REMAP_TARGETS = PROFILE_FK_TARGETS.filter(
  ([table, column]) => !(table === 'profiles' && column === 'id'),
)

function loadDotEnvFallback() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    fail(
      'Missing project-root .env file. Create it from .env.example, then run: npm run bootstrap:dev-auth',
    )
  }

  const text = readFileSync(envPath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let key = line.slice(0, eq).trim()
    if (key.startsWith('export ')) key = key.slice(7).trim()
    if (!key) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function fail(message) {
  console.error(`\nERROR: ${message}\n`)
  process.exit(1)
}

function assertNotPlaceholder(label, value) {
  const normalized = String(value ?? '')
  const hit = FORBIDDEN_PLACEHOLDERS.find((token) =>
    normalized.toLowerCase().includes(token.toLowerCase()),
  )
  if (hit) {
    fail(
      `${label} still contains placeholder text (${hit}). Replace it with a real development value in .env (or unset a stale shell export of this variable).`,
    )
  }
}

function formatAdminError(error) {
  if (error == null) {
    return 'name=(none); message=(null error); status=(none); code=(none)'
  }

  const name = typeof error.name === 'string' && error.name ? error.name : '(none)'
  const message =
    typeof error.message === 'string' && error.message.trim()
      ? error.message.trim()
      : '(empty message)'
  const status =
    typeof error.status === 'number'
      ? error.status
      : typeof error.statusCode === 'number'
        ? error.statusCode
        : '(none)'
  const code =
    typeof error.code === 'string' && error.code
      ? error.code
      : typeof error.error_code === 'string' && error.error_code
        ? error.error_code
        : '(none)'

  return `name=${name}; message=${message}; status=${status}; code=${code}`
}

function classifyAdminFailure(error) {
  const status =
    typeof error?.status === 'number'
      ? error.status
      : typeof error?.statusCode === 'number'
        ? error.statusCode
        : null
  const message = String(error?.message ?? '').toLowerCase()
  const name = String(error?.name ?? '').toLowerCase()

  if (status === 401 || message.includes('unauthorized') || message.includes('invalid api key')) {
    return '401 unauthorized (wrong or non-admin key is the usual cause)'
  }
  if (status === 403 || message.includes('forbidden') || message.includes('not allowed')) {
    return '403 forbidden'
  }
  if (status === 404 || message.includes('not found') || message.includes('user not found')) {
    return '404 not found'
  }
  if (
    name.includes('fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('certificate') ||
    message.includes('getaddrinfo') ||
    status === 500 ||
    status === 502 ||
    status === 503
  ) {
    if (status === 500 || name.includes('retryable')) {
      return '500 server/auth-data error (often malformed auth.users rows)'
    }
    return 'network'
  }
  if (message.includes('invalid url') || message.includes('unsupported protocol')) {
    return 'url'
  }
  return 'unknown'
}

function failAdmin(action, error) {
  fail(
    `Auth Admin API ${action} failed [${classifyAdminFailure(error)}]: ${formatAdminError(error)}`,
  )
}

function peekJwtRole(token) {
  const parts = String(token).split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(json)
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

function assertServiceRoleKeyShape(serviceRole) {
  if (serviceRole.startsWith('sb_publishable_')) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY looks like a publishable key (sb_publishable_*). Use the service-role / secret key from Project Settings → API (sb_secret_* or legacy service_role JWT).',
    )
  }

  if (serviceRole.startsWith('sb_anon_')) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY looks like an anon key (sb_anon_*). Use the service-role / secret key instead.',
    )
  }

  const anonCandidates = [
    process.env.SUPABASE_ANON_KEY?.trim(),
    process.env.VITE_SUPABASE_ANON_KEY?.trim(),
  ].filter(Boolean)

  if (anonCandidates.some((anon) => anon === serviceRole)) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY matches the anon/publishable key from .env. Admin APIs require the service-role / secret key, not the anon key.',
    )
  }

  if (serviceRole.startsWith('sb_secret_')) {
    return 'sb_secret'
  }

  const jwtRole = peekJwtRole(serviceRole)
  if (jwtRole === 'anon') {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY appears to be an anon JWT (payload role=anon). Replace it with the service_role secret from the Supabase dashboard.',
    )
  }
  if (jwtRole === 'service_role') {
    return 'legacy_service_role_jwt'
  }

  if (serviceRole.startsWith('eyJ')) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY looks like a JWT but is not a service_role token. Use the service_role key (or sb_secret_*) from Project Settings → API.',
    )
  }

  fail(
    'SUPABASE_SERVICE_ROLE_KEY was not recognized as sb_secret_* or a legacy service_role JWT. Copy the service-role / secret key from Project Settings → API (never the anon/publishable key).',
  )
}

function parseSupabaseHostname(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    fail('SUPABASE_URL is not a valid URL.')
  }
  if (parsed.protocol !== 'https:') {
    fail('SUPABASE_URL must use https.')
  }
  return parsed.hostname
}

function resolvePassword(passwordEnv) {
  const specific = process.env[passwordEnv]?.trim()
  const shared = process.env.DEV_AUTH_PASSWORD?.trim()
  const password = specific || shared
  if (!password) {
    fail(
      `Missing password for ${passwordEnv}. Set ${passwordEnv} or shared DEV_AUTH_PASSWORD in .env.`,
    )
  }
  assertNotPlaceholder(passwordEnv, password)
  if (shared && !specific) {
    assertNotPlaceholder('DEV_AUTH_PASSWORD', shared)
  }
  if (password.length < 8) {
    fail(`Password for ${passwordEnv} must be at least 8 characters.`)
  }
  return password
}

function assertSafetyGuards() {
  const rawUrl = process.env.SUPABASE_URL?.trim()
  if (!rawUrl) {
    fail(
      'Missing SUPABASE_URL. Set it in project-root .env (loaded via node --env-file=.env). If a shell export exists, unset it or fix it — shell vars override .env.',
    )
  }
  assertNotPlaceholder('SUPABASE_URL', rawUrl)

  const hostname = parseSupabaseHostname(rawUrl)
  if (hostname !== REQUIRED_HOST) {
    fail(
      `Refusing to run: SUPABASE_URL hostname must be exactly "${REQUIRED_HOST}". Got "${hostname}". If this looks like a placeholder, check .env and unset any shell SUPABASE_URL export.`,
    )
  }

  const confirm = process.env.CONFIRM_DEV_AUTH_BOOTSTRAP?.trim()
  if (confirm !== REQUIRED_CONFIRM) {
    fail(
      `Refusing to run: CONFIRM_DEV_AUTH_BOOTSTRAP must be exactly "${REQUIRED_CONFIRM}".`,
    )
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRole) {
    fail('Missing SUPABASE_SERVICE_ROLE_KEY (local/dev script only — never use VITE_*).')
  }
  assertNotPlaceholder('SUPABASE_SERVICE_ROLE_KEY', serviceRole)
  const keyKind = assertServiceRoleKeyShape(serviceRole)

  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    fail('VITE_SUPABASE_SERVICE_ROLE_KEY must not be set. Remove it immediately.')
  }

  return { url: rawUrl.replace(/\/$/, ''), hostname, serviceRole, keyKind }
}

function createAdminSupabaseClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * Connectivity probe that does NOT enumerate Auth users.
 * Expects 404 / user_not_found for a synthetic UUID.
 */
async function preflightAdminAccess(admin) {
  console.log('Preflight: auth.admin.getUserById(synthetic) [read-only, no enumeration]')
  const syntheticId = '00000000-0000-0000-0000-000000000000'
  const { data, error } = await admin.getUserById(syntheticId)

  if (!error) {
    // Extremely unlikely; treat as OK connectivity.
    console.log(`Preflight OK (unexpected user returned for synthetic id; continuing).`)
    console.log('')
    return
  }

  const status = typeof error.status === 'number' ? error.status : null
  const code = String(error.code ?? '')
  const message = String(error.message ?? '').toLowerCase()
  const notFound =
    status === 404 ||
    code.includes('not_found') ||
    message.includes('not found') ||
    message.includes('user not found')

  if (notFound) {
    console.log('Preflight OK (Admin API reachable; synthetic user not found as expected).')
    console.log('')
    return
  }

  fail(
    `Admin preflight failed before any user processing [${classifyAdminFailure(error)}]: ${formatAdminError(error)}. Fix SUPABASE_SERVICE_ROLE_KEY / network / URL, then retry.`,
  )

  // silence unused
  void data
}

/**
 * Fetch a single Auth user by id. Never uses listUsers.
 * @returns {{ user: object | null, malformed: boolean, missing: boolean, error: object | null }}
 */
async function getAuthUserByIdSafe(admin, id) {
  const { data, error } = await admin.getUserById(id)
  if (!error && data?.user) {
    return { user: data.user, malformed: false, missing: false, error: null }
  }

  if (error) {
    const status = typeof error.status === 'number' ? error.status : null
    const classification = classifyAdminFailure(error)
    if (status === 404 || classification === '404 not found') {
      return { user: null, malformed: false, missing: true, error }
    }
    if (status === 500 || classification.includes('500')) {
      return { user: null, malformed: true, missing: false, error }
    }
    failAdmin(`getUserById(${id})`, error)
  }

  return { user: null, malformed: false, missing: true, error: null }
}

async function loadProfileByEmail(db, email) {
  const { data, error } = await db
    .from('profiles')
    .select('id, email, role, is_active, full_name, deleted_at')
    .eq('email', email)
    .maybeSingle()
  if (error) {
    fail(`Failed reading profiles for ${email}: ${error.message}`)
  }
  return data
}

async function loadProfileById(db, id) {
  const { data, error } = await db
    .from('profiles')
    .select('id, email, role, is_active, full_name, deleted_at')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    fail(`Failed reading profiles id ${id}: ${error.message}`)
  }
  return data
}

async function remapProfileForeignKeys(db, oldId, newId) {
  for (const [table, column] of PROFILE_FK_REMAP_TARGETS) {
    const { error } = await db.from(table).update({ [column]: newId }).eq(column, oldId)
    if (error) {
      if (/does not exist|Could not find/i.test(error.message)) continue
      fail(`Failed remapping ${table}.${column}: ${error.message}`)
    }
  }
}

async function ensureProfile(db, { id, email, fullName, role }) {
  const existing = await loadProfileById(db, id)

  if (!existing) {
    const { error: insertError } = await db.from('profiles').insert({
      id,
      email,
      full_name: fullName,
      role,
      is_active: true,
      deleted_at: null,
    })
    if (insertError) {
      fail(`Failed inserting profile for ${email}: ${insertError.message}`)
    }
    return
  }

  const { error: updateError } = await db
    .from('profiles')
    .update({
      email,
      full_name: fullName,
      role,
      is_active: true,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    fail(`Failed updating profile for ${email}: ${updateError.message}`)
  }
}

async function ensureAdvisorProfile(db, { userId, fullName, slug, email }) {
  const { data: byUser, error: byUserError } = await db
    .from('advisor_profiles')
    .select('id, user_id, slug')
    .eq('user_id', userId)
    .maybeSingle()

  if (byUserError) {
    fail(`Failed reading advisor_profiles for ${email}: ${byUserError.message}`)
  }

  if (byUser) {
    const { error } = await db
      .from('advisor_profiles')
      .update({
        display_name: fullName,
        slug,
        email,
        is_active: true,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', byUser.id)
    if (error) {
      fail(`Failed updating advisor_profiles for ${email}: ${error.message}`)
    }
    return byUser.id
  }

  const { data: bySlug, error: bySlugError } = await db
    .from('advisor_profiles')
    .select('id, user_id, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (bySlugError) {
    fail(`Failed reading advisor_profiles slug ${slug}: ${bySlugError.message}`)
  }

  if (bySlug) {
    const { error } = await db
      .from('advisor_profiles')
      .update({
        user_id: userId,
        display_name: fullName,
        email,
        is_active: true,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bySlug.id)
    if (error) {
      fail(`Failed re-linking advisor_profiles slug ${slug}: ${error.message}`)
    }
    return bySlug.id
  }

  const { data: inserted, error: insertError } = await db
    .from('advisor_profiles')
    .insert({
      user_id: userId,
      display_name: fullName,
      slug,
      email,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertError) {
    fail(`Failed inserting advisor_profiles for ${email}: ${insertError.message}`)
  }
  return inserted.id
}

/**
 * Read-only: scan public CRM tables for the three known placeholder profile UUIDs.
 * Does not query auth.users password hashes, tokens, or secrets.
 */
async function diagnosePlaceholders(db) {
  console.log('Valtoris CRM — placeholder Auth UUID diagnostic (READ-ONLY)')
  console.log('------------------------------------------------------------')
  console.log('Scanning public CRM tables only. No writes. No auth secrets.\n')

  console.log('Known placeholder UUIDs:')
  for (const spec of DEV_USERS) {
    console.log(`  - ${spec.placeholderId}  (${spec.email}, role=${spec.role})`)
  }
  console.log('')

  /** @type {Array<{ table: string, column: string, id: string, count: number, sampleIds: string[] }>} */
  const hits = []

  for (const placeholderId of PLACEHOLDER_USER_IDS) {
    const profile = await loadProfileById(db, placeholderId)
    console.log(
      `profiles.id=${placeholderId}: ${
        profile
          ? `FOUND email=${profile.email} role=${profile.role} active=${profile.is_active}`
          : 'not found'
      }`,
    )
  }
  console.log('')

  for (const [table, column] of PROFILE_FK_TARGETS) {
    const { data, error } = await db
      .from(table)
      .select(column === 'id' && table === 'profiles' ? 'id, email, role' : column)
      .in(column, PLACEHOLDER_USER_IDS)

    if (error) {
      if (/does not exist|Could not find/i.test(error.message)) {
        console.log(`  skip ${table}.${column} (not available): ${error.message}`)
        continue
      }
      fail(`Diagnostic query failed for ${table}.${column}: ${error.message}`)
    }

    const rows = data ?? []
    if (rows.length === 0) continue

    const grouped = new Map()
    for (const row of rows) {
      const value = row[column]
      if (!value) continue
      grouped.set(value, (grouped.get(value) ?? 0) + 1)
    }

    for (const [id, count] of grouped.entries()) {
      hits.push({
        table,
        column,
        id,
        count,
        sampleIds: rows.slice(0, 5).map((r) => String(r[column])),
      })
      console.log(`HIT  ${table}.${column} = ${id}  (rows=${count})`)
    }
  }

  const { data: advisorRows, error: advisorError } = await db
    .from('advisor_profiles')
    .select('id, user_id, slug, display_name, is_active')
    .in('user_id', PLACEHOLDER_USER_IDS)

  if (advisorError) {
    fail(`Diagnostic advisor_profiles query failed: ${advisorError.message}`)
  }

  console.log('\nadvisor_profiles linked to placeholder user_ids:')
  if (!advisorRows?.length) {
    console.log('  (none)')
  } else {
    for (const row of advisorRows) {
      console.log(
        `  advisor_profiles.id=${row.id} user_id=${row.user_id} slug=${row.slug} active=${row.is_active}`,
      )
    }
  }

  console.log('\nSummary')
  console.log(`  Reference hit groups: ${hits.length}`)
  if (hits.length === 0) {
    console.log('  No public CRM FK references to the three placeholder UUIDs were found.')
  } else {
    console.log('  Preserve advisor_profiles.id values during repair so household/opportunity FKs stay valid.')
  }
  console.log('\nNext: review scripts/sql/repair-dev-placeholder-auth.sql (do not apply until approved).')
  console.log('Bootstrap writes are blocked until Auth Admin can address these identities without listUsers.\n')
}

/**
 * Read-only plan for all three accounts. Aborts before any write if Auth rows are malformed.
 */
async function buildAuthPlans(admin, db) {
  /** @type {Array<object>} */
  const plans = []

  for (const spec of DEV_USERS) {
    const profileByEmail = await loadProfileByEmail(db, spec.email)
    const profileByPlaceholder = await loadProfileById(db, spec.placeholderId)
    const placeholderAuth = await getAuthUserByIdSafe(admin, spec.placeholderId)

    let currentAuth = null
    let currentAuthId = null

    if (profileByEmail?.id) {
      const byProfile = await getAuthUserByIdSafe(admin, profileByEmail.id)
      if (byProfile.malformed) {
        fail(
          `Auth getUserById failed with 500 for profile ${profileByEmail.id} (${spec.email}). Run npm run bootstrap:dev-auth:diagnose and apply the reviewed SQL repair before bootstrap writes.`,
        )
      }
      if (byProfile.user) {
        currentAuth = byProfile.user
        currentAuthId = byProfile.user.id
      }
    }

    if (placeholderAuth.malformed) {
      fail(
        `Auth getUserById failed with 500 for known placeholder ${spec.placeholderId} (${spec.email}). Malformed auth.users row likely. Run diagnose + reviewed SQL repair before any bootstrap writes.`,
      )
    }

    /** @type {'replace_placeholder' | 'update_existing' | 'create_new'} */
    let action
    if (placeholderAuth.user) {
      action = 'replace_placeholder'
      currentAuth = placeholderAuth.user
      currentAuthId = placeholderAuth.user.id
    } else if (currentAuth && !PLACEHOLDER_USER_IDS.includes(currentAuth.id)) {
      action = 'update_existing'
    } else if (profileByEmail && PLACEHOLDER_USER_IDS.includes(profileByEmail.id) && placeholderAuth.missing) {
      // Profile points at placeholder id but Auth row missing / already removed.
      action = 'create_new'
    } else if (currentAuth) {
      action = PLACEHOLDER_USER_IDS.includes(currentAuth.id)
        ? 'replace_placeholder'
        : 'update_existing'
    } else {
      action = 'create_new'
    }

    plans.push({
      spec,
      action,
      currentAuthId,
      profileByEmail,
      profileByPlaceholder,
      placeholderPresent: Boolean(placeholderAuth.user),
    })
  }

  return plans
}

async function executeReplacePlaceholder(admin, db, spec, password) {
  const oldId = spec.placeholderId
  const archiveEmail = `dev-archive-${spec.slug}-${Date.now()}@valtoris.test`

  console.log(`  → placeholder Auth user ${oldId}`)
  console.log(`  → archiving placeholder profile email (profiles.email is unique)`)
  const { error: archiveProfileError } = await db
    .from('profiles')
    .update({ email: archiveEmail, updated_at: new Date().toISOString() })
    .eq('id', oldId)
  if (archiveProfileError) {
    fail(`Failed archiving profile email for ${oldId}: ${archiveProfileError.message}`)
  }

  console.log(`  → freeing Auth email by renaming placeholder Auth user`)
  const { error: renameError } = await admin.updateUserById(oldId, {
    email: archiveEmail,
    email_confirm: true,
  })
  if (renameError) {
    failAdmin(`updateUserById(rename ${spec.email})`, renameError)
  }

  console.log(`  → creating real Auth user`)
  const { data: created, error: createError } = await admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName },
  })
  if (createError || !created?.user) {
    failAdmin(`createUser(${spec.email})`, createError)
  }

  const newId = created.user.id
  console.log(`  → new Auth UUID: ${newId}`)

  await ensureProfile(db, {
    id: newId,
    email: spec.email,
    fullName: spec.fullName,
    role: spec.role,
  })

  const { data: oldAdvisor, error: oldAdvisorError } = await db
    .from('advisor_profiles')
    .select('id')
    .eq('user_id', oldId)
    .maybeSingle()
  if (oldAdvisorError) {
    fail(`Failed reading old advisor_profiles: ${oldAdvisorError.message}`)
  }

  if (oldAdvisor) {
    const { error } = await db
      .from('advisor_profiles')
      .update({
        user_id: newId,
        display_name: spec.fullName,
        slug: spec.slug,
        email: spec.email,
        is_active: true,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', oldAdvisor.id)
    if (error) {
      fail(`Failed remapping advisor_profiles.user_id for ${spec.email}: ${error.message}`)
    }
    console.log(`  → remapped advisor_profiles ${oldAdvisor.id} → user ${newId}`)
  } else {
    await ensureAdvisorProfile(db, {
      userId: newId,
      fullName: spec.fullName,
      slug: spec.slug,
      email: spec.email,
    })
  }

  console.log(`  → remapping profile foreign keys ${oldId} → ${newId}`)
  await remapProfileForeignKeys(db, oldId, newId)

  // Soft-delete / remove old profile row if it still exists (Auth delete cascades; remaps first).
  console.log(`  → deleting placeholder Auth user`)
  const { error: deleteError } = await admin.deleteUser(oldId)
  if (deleteError) {
    failAdmin(`deleteUser(${oldId})`, deleteError)
  }

  return newId
}

async function executeUpdateExisting(admin, db, spec, password, userId) {
  console.log(`  → existing real Auth user (${userId}); updating password + confirmation`)
  const { error } = await admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName },
  })
  if (error) {
    failAdmin(`updateUserById(${spec.email})`, error)
  }
  await ensureProfile(db, {
    id: userId,
    email: spec.email,
    fullName: spec.fullName,
    role: spec.role,
  })
  await ensureAdvisorProfile(db, {
    userId,
    fullName: spec.fullName,
    slug: spec.slug,
    email: spec.email,
  })
  return userId
}

async function executeCreateNew(admin, db, spec, password) {
  console.log(`  → creating real Auth user`)
  const { data: created, error: createError } = await admin.createUser({
    email: spec.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: spec.fullName },
  })
  if (createError || !created?.user) {
    failAdmin(`createUser(${spec.email})`, createError)
  }

  await ensureProfile(db, {
    id: created.user.id,
    email: spec.email,
    fullName: spec.fullName,
    role: spec.role,
  })
  await ensureAdvisorProfile(db, {
    userId: created.user.id,
    fullName: spec.fullName,
    slug: spec.slug,
    email: spec.email,
  })
  return created.user.id
}

async function verify(db, admin) {
  console.log('\nVerification')
  for (const spec of DEV_USERS) {
    const profile = await loadProfileByEmail(db, spec.email)
    if (!profile) {
      fail(`Verification failed: missing profile for ${spec.email}`)
    }

    const auth = await getAuthUserByIdSafe(admin, profile.id)
    if (auth.malformed) {
      fail(`Verification failed: Auth getUserById 500 for ${profile.id}`)
    }

    const authOk =
      Boolean(auth.user?.id) &&
      auth.user.id === profile.id &&
      !PLACEHOLDER_USER_IDS.includes(auth.user.id)
    const profileOk =
      profile.role === spec.role && profile.is_active === true && profile.email === spec.email

    console.log(
      `  ${spec.email}: auth=${authOk ? 'ok' : 'FAIL'} profile=${profileOk ? 'ok' : 'FAIL'} role=${profile.role} id=${profile.id}`,
    )

    if (!authOk || !profileOk) {
      fail(`Verification failed for ${spec.email}`)
    }
  }
}

async function runBootstrap() {
  const { url, hostname, serviceRole, keyKind } = assertSafetyGuards()

  console.log('Valtoris CRM — development Auth bootstrap')
  console.log('----------------------------------------')
  console.log(`Target project hostname: ${hostname}`)
  console.log(`Service key kind: ${keyKind} (value not printed)`)
  console.log('Planned affected emails:')
  for (const spec of DEV_USERS) {
    console.log(`  - ${spec.email} → role=${spec.role} (placeholder ${spec.placeholderId})`)
  }
  console.log('')

  const passwords = Object.fromEntries(
    DEV_USERS.map((spec) => [spec.email, resolvePassword(spec.passwordEnv)]),
  )

  const supabase = createAdminSupabaseClient(url, serviceRole)
  const admin = supabase.auth.admin
  const db = supabase

  await preflightAdminAccess(admin)

  console.log('Resolving Auth plan for all accounts (read-only; no writes yet)…')
  const plans = await buildAuthPlans(admin, db)
  for (const plan of plans) {
    console.log(
      `  plan ${plan.spec.email}: action=${plan.action}; authId=${plan.currentAuthId ?? 'none'}; placeholderPresent=${plan.placeholderPresent}`,
    )
  }
  console.log('')

  console.log('Executing writes only after full plan resolved…')
  for (const plan of plans) {
    const { spec, action, currentAuthId } = plan
    console.log(`Processing ${spec.email} (${action})`)
    const password = passwords[spec.email]

    if (action === 'replace_placeholder') {
      await executeReplacePlaceholder(admin, db, spec, password)
    } else if (action === 'update_existing') {
      if (!currentAuthId) {
        fail(`Plan for ${spec.email} is update_existing but auth id is missing.`)
      }
      await executeUpdateExisting(admin, db, spec, password, currentAuthId)
    } else {
      await executeCreateNew(admin, db, spec, password)
    }
    console.log(`  ✓ ${spec.email}`)
  }

  await verify(db, admin)
  console.log('\nBootstrap complete. You can sign in at /crm/login with the configured passwords.')
  console.log('Passwords and service-role key were not printed.\n')
}

async function runDiagnose() {
  const { url, hostname, serviceRole, keyKind } = assertSafetyGuards()
  console.log(`Target project hostname: ${hostname}`)
  console.log(`Service key kind: ${keyKind} (value not printed)\n`)

  const supabase = createAdminSupabaseClient(url, serviceRole)
  await diagnosePlaceholders(supabase)

  console.log('Auth Admin probe for known placeholder UUIDs (getUserById only):')
  for (const spec of DEV_USERS) {
    const result = await getAuthUserByIdSafe(supabase.auth.admin, spec.placeholderId)
    if (result.malformed) {
      console.log(
        `  ${spec.placeholderId}: MALFORMED/500 — ${formatAdminError(result.error)}`,
      )
    } else if (result.missing) {
      console.log(`  ${spec.placeholderId}: missing (404/not found)`)
    } else {
      console.log(
        `  ${spec.placeholderId}: present email=${result.user?.email ?? '(none)'} confirmed=${Boolean(result.user?.email_confirmed_at)}`,
      )
    }
  }
  console.log('')
}

async function main() {
  loadDotEnvFallback()

  const diagnose = process.argv.includes('--diagnose-placeholders')
  if (diagnose) {
    await runDiagnose()
    return
  }

  await runBootstrap()
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
