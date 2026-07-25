/**
 * CRM-9A dashboard smoke against valtoris-crm-dev (read-only).
 * Verifies RLS-scoped counts, due/overdue task queries, stage grouping,
 * recent activities, and recently added households.
 *
 * Usage:
 *   node --env-file=.env scripts/smoke-crm-9a-dashboard.mjs
 */
import { createClient } from '@supabase/supabase-js'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'

function requireEnv(name) {
  const value = process.env[name]
  if (!value || /YOUR_|choose_a_secure|your_project/i.test(value)) {
    throw new Error(`Missing or placeholder env: ${name}`)
  }
  return value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function signIn(email, password) {
  const url = requireEnv('VITE_SUPABASE_URL') || requireEnv('SUPABASE_URL')
  const anon = requireEnv('VITE_SUPABASE_ANON_KEY') || requireEnv('SUPABASE_ANON_KEY')
  const host = new URL(url).hostname
  assert(host === REQUIRED_HOST, `Refusing smoke outside ${REQUIRED_HOST} (got ${host})`)

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  assert(!error, `sign-in failed for ${email}: ${error?.message}`)
  assert(data.session, `no session for ${email}`)
  return supabase
}

async function count(supabase, table, apply = (q) => q) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  query = apply(query)
  const { count: value, error } = await query
  assert(!error, `${table} count failed: ${error?.message}`)
  return value ?? 0
}

async function probeRole(label, supabase) {
  const today = localDateString()
  const soft = (q) => q.is('deleted_at', null)
  const hhSoft = (q) => q.is('deleted_at', null).is('merged_into_household_id', null)

  const households = await count(supabase, 'households', hhSoft)
  const openOpps = await count(supabase, 'opportunities', (q) =>
    soft(q).in('status', ['open', 'on_hold']),
  )
  const won = await count(supabase, 'opportunities', (q) => soft(q).eq('status', 'won'))
  const lost = await count(supabase, 'opportunities', (q) => soft(q).eq('status', 'lost'))
  const tasksDueToday = await count(supabase, 'tasks', (q) =>
    soft(q).in('status', ['open', 'in_progress']).eq('due_date', today),
  )
  const overdueTasks = await count(supabase, 'tasks', (q) =>
    soft(q).in('status', ['open', 'in_progress']).lt('due_date', today).not('due_date', 'is', null),
  )
  const activities = await count(supabase, 'activities', soft)

  const { data: openRows, error: openErr } = await supabase
    .from('opportunities')
    .select('id, stage_id, status, pipeline_stages!stage_id(name)')
    .is('deleted_at', null)
    .in('status', ['open', 'on_hold'])
    .limit(200)
  assert(!openErr, `open opportunities failed: ${openErr?.message}`)

  const stageMap = {}
  for (const row of openRows ?? []) {
    const name = row.pipeline_stages?.name || row.stage_id
    stageMap[name] = (stageMap[name] || 0) + 1
  }

  const { data: recentHH, error: hhErr } = await supabase
    .from('households')
    .select('id, display_name, created_at')
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
    .order('created_at', { ascending: false })
    .limit(5)
  assert(!hhErr, `recent households failed: ${hhErr?.message}`)

  const { data: acts, error: actErr } = await supabase
    .from('activities')
    .select('id, household_id, activity_type')
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(15)
  assert(!actErr, `activities failed: ${actErr?.message}`)

  const { data: visibleHH } = await supabase
    .from('households')
    .select('id')
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
  const hhSet = new Set((visibleHH ?? []).map((h) => h.id))
  const leaked = (acts ?? []).filter((a) => !hhSet.has(a.household_id))
  assert(leaked.length === 0, `${label}: activity leak across households`)

  console.log(`\n[${label}]`)
  console.log(
    JSON.stringify(
      {
        households,
        openOpps,
        won,
        lost,
        tasksDueToday,
        overdueTasks,
        activities,
        stageMap,
        recentHouseholds: (recentHH ?? []).map((h) => h.display_name),
        recentActivityTypes: [...new Set((acts ?? []).map((a) => a.activity_type))],
      },
      null,
      2,
    ),
  )

  return { households, openOpps }
}

async function main() {
  const owner = await signIn('owner.dev@valtoris.test', requireEnv('DEV_OWNER_PASSWORD'))
  const advisor = await signIn('advisor.a@valtoris.test', requireEnv('DEV_ADVISOR_A_PASSWORD'))

  const ownerMetrics = await probeRole('owner', owner)
  const advisorMetrics = await probeRole('advisor.a', advisor)

  assert(
    ownerMetrics.households >= advisorMetrics.households,
    'owner household visibility should be >= advisor',
  )

  // Cross-advisor restriction: advisor must not read a household assigned to someone else.
  const { data: ownerHouseholds } = await owner
    .from('households')
    .select('id, assigned_advisor_id')
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
  const { data: advisorProfile } = await advisor.from('advisor_profiles').select('id').maybeSingle()
  const other = (ownerHouseholds ?? []).find(
    (h) => h.assigned_advisor_id && h.assigned_advisor_id !== advisorProfile?.id,
  )
  if (other) {
    const { data: probe } = await advisor.from('households').select('id').eq('id', other.id).maybeSingle()
    assert(!probe, 'advisor unexpectedly read another advisor household')
    console.log('\n[rls] advisor.a cannot read other-assigned household')
  }

  await owner.auth.signOut()
  await advisor.auth.signOut()
  console.log('\nCRM-9A dashboard smoke passed.')
}

main().catch((error) => {
  console.error('\nCRM-9A dashboard smoke failed:', error.message || error)
  process.exit(1)
})
