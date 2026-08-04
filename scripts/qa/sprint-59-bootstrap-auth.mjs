/**
 * Sprint 5.9 local Auth bootstrap (NOT for hosted/prod).
 * Creates owner + Advisor A/B through Auth Admin API only.
 *
 *   node scripts/qa/sprint-59-bootstrap-auth.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PASS = process.env.QA_LOCAL_PASS || 'LocalQaPass123!'
const OUT = process.env.QA59_FIXTURE_PATH || '/tmp/sprint-59-fixture-ids.json'

const ACCOUNTS = [
  {
    key: 'owner',
    email: 'owner.localqa59@valtoris.test',
    fullName: 'QA59 Owner',
    role: 'owner',
    advisorSlug: null,
  },
  {
    key: 'advisorA',
    email: 'advisor.a.localqa59@valtoris.test',
    fullName: 'QA59 Advisor A',
    role: 'advisor',
    advisorSlug: 'qa59-advisor-a',
  },
  {
    key: 'advisorB',
    email: 'advisor.b.localqa59@valtoris.test',
    fullName: 'QA59 Advisor B',
    role: 'advisor',
    advisorSlug: 'qa59-advisor-b',
  },
]

function loadLocalSupabaseEnv() {
  const raw = execSync('npx supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
  if (!env.API_URL || !env.SERVICE_ROLE_KEY) {
    throw new Error('Could not read local Supabase API_URL / SERVICE_ROLE_KEY')
  }
  if (!String(env.API_URL).includes('127.0.0.1') && !String(env.API_URL).includes('localhost')) {
    throw new Error(`Refusing non-local Supabase URL: ${env.API_URL}`)
  }
  return env
}

async function ensureUser(admin, account) {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (list.error) throw list.error
  const existing = (list.data?.users || []).find(
    (u) => (u.email || '').toLowerCase() === account.email.toLowerCase(),
  )
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: PASS,
      email_confirm: true,
      user_metadata: { full_name: account.fullName },
    })
    if (error) throw error
    return existing.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: account.fullName },
  })
  if (error) throw error
  return data.user.id
}

async function main() {
  const sb = loadLocalSupabaseEnv()
  const admin = createClient(sb.API_URL, sb.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const ids = {
    passHint: 'QA_LOCAL_PASS env or default LocalQaPass123!',
    apiUrl: sb.API_URL,
    anonKey: sb.ANON_KEY,
    accounts: {},
  }

  for (const account of ACCOUNTS) {
    const userId = await ensureUser(admin, account)
    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: userId,
        email: account.email,
        full_name: account.fullName,
        role: account.role,
        is_active: true,
      },
      { onConflict: 'id' },
    )
    if (profileError) throw profileError

    let advisorProfileId = null
    if (account.advisorSlug) {
      const { data: existingAdv } = await admin
        .from('advisor_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      if (existingAdv?.id) {
        const { error } = await admin
          .from('advisor_profiles')
          .update({
            display_name: account.fullName,
            slug: account.advisorSlug,
            email: account.email,
            accepts_new_leads: true,
            is_active: true,
            deleted_at: null,
          })
          .eq('id', existingAdv.id)
        if (error) throw error
        advisorProfileId = existingAdv.id
      } else {
        const { data: created, error } = await admin
          .from('advisor_profiles')
          .insert({
            user_id: userId,
            display_name: account.fullName,
            slug: account.advisorSlug,
            email: account.email,
            accepts_new_leads: true,
            is_active: true,
          })
          .select('id')
          .single()
        if (error) throw error
        advisorProfileId = created.id
      }
    }

    ids.accounts[account.key] = {
      userId,
      email: account.email,
      role: account.role,
      advisorSlug: account.advisorSlug,
      advisorProfileId,
    }
    console.log(`OK ${account.key} userId=${userId} advisorProfileId=${advisorProfileId ?? 'n/a'}`)
  }

  writeFileSync(OUT, JSON.stringify(ids, null, 2) + '\n')
  console.log(`Wrote ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
