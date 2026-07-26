/**
 * CRM-9B owner operations smoke against valtoris-crm-dev (read-only).
 * Verifies owner agency-wide exact counts, full-set open opp pagination,
 * unassigned visibility, month closed filters, and advisor RLS bounds.
 *
 * Usage:
 *   node --env-file=.env scripts/smoke-crm-9b-owner-ops.mjs
 */
import { createClient } from '@supabase/supabase-js'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PAGE_SIZE = 1000
const AGENCY_TZ = 'America/Chicago'

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

function zonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function zonedLocalDateTimeToUtc(year, month, day, hour = 0, minute = 0, second = 0, timeZone = AGENCY_TZ) {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  for (let i = 0; i < 4; i += 1) {
    const wall = zonedParts(utc, timeZone)
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
    const wallAsUtc = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    )
    const diff = desiredAsUtc - wallAsUtc
    if (diff === 0) break
    utc = new Date(utc.getTime() + diff)
  }
  return utc
}

function agencyMonthBounds(now = new Date()) {
  const parts = zonedParts(now, AGENCY_TZ)
  const start = zonedLocalDateTimeToUtc(parts.year, parts.month, 1)
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1
  const nextYear = parts.month === 12 ? parts.year + 1 : parts.year
  const end = zonedLocalDateTimeToUtc(nextYear, nextMonth, 1)
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    monthKey: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
  }
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

async function fetchAllOpenOppIds(supabase) {
  const ids = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id')
      .is('deleted_at', null)
      .in('status', ['open', 'on_hold'])
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    assert(!error, `open opp page failed: ${error?.message}`)
    const page = data ?? []
    ids.push(...page.map((row) => row.id))
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return ids
}

async function probeRole(label, supabase) {
  const today = localDateString()
  const month = agencyMonthBounds()
  const soft = (q) => q.is('deleted_at', null)
  const hhSoft = (q) => q.is('deleted_at', null).is('merged_into_household_id', null)

  const activeHouseholds = await count(supabase, 'households', hhSoft)
  const openOpps = await count(supabase, 'opportunities', (q) =>
    soft(q).in('status', ['open', 'on_hold']),
  )
  const wonThisMonth = await count(supabase, 'opportunities', (q) =>
    soft(q).eq('status', 'won').gte('closed_at', month.startIso).lt('closed_at', month.endIso),
  )
  const lostThisMonth = await count(supabase, 'opportunities', (q) =>
    soft(q).eq('status', 'lost').gte('closed_at', month.startIso).lt('closed_at', month.endIso),
  )
  const unassignedHouseholds = await count(supabase, 'households', (q) =>
    hhSoft(q).is('assigned_advisor_id', null),
  )
  const unassignedOpportunities = await count(supabase, 'opportunities', (q) =>
    soft(q).in('status', ['open', 'on_hold']).is('assigned_advisor_id', null),
  )
  const tasksDueToday = await count(supabase, 'tasks', (q) =>
    soft(q).in('status', ['open', 'in_progress']).eq('due_date', today),
  )
  const overdueTasks = await count(supabase, 'tasks', (q) =>
    soft(q).in('status', ['open', 'in_progress']).lt('due_date', today).not('due_date', 'is', null),
  )

  const openIds = await fetchAllOpenOppIds(supabase)
  assert(
    openIds.length === openOpps,
    `${label}: paginated open opp rows (${openIds.length}) != exact count (${openOpps})`,
  )

  const { data: activities, error: actErr } = await supabase
    .from('activities')
    .select('id, household_id, activity_type')
    .is('deleted_at', null)
    .in('activity_type', ['stage_changed', 'assignment_changed', 'recommendation_converted'])
    .order('occurred_at', { ascending: false })
    .limit(20)
  assert(!actErr, `activities failed: ${actErr?.message}`)

  const { data: visibleHH } = await supabase
    .from('households')
    .select('id')
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
  const hhSet = new Set((visibleHH ?? []).map((h) => h.id))
  const leaked = (activities ?? []).filter((a) => !hhSet.has(a.household_id))
  assert(leaked.length === 0, `${label}: activity leak across households`)

  const metrics = {
    activeHouseholds,
    openOpps,
    wonThisMonth,
    lostThisMonth,
    unassignedHouseholds,
    unassignedOpportunities,
    tasksDueToday,
    overdueTasks,
    monthKey: month.monthKey,
    activityTypes: [...new Set((activities ?? []).map((a) => a.activity_type))],
  }

  console.log(`\n[${label}]`)
  console.log(JSON.stringify(metrics, null, 2))
  return metrics
}

async function main() {
  const owner = await signIn('owner.dev@valtoris.test', requireEnv('DEV_OWNER_PASSWORD'))
  const advisor = await signIn('advisor.a@valtoris.test', requireEnv('DEV_ADVISOR_A_PASSWORD'))

  const ownerMetrics = await probeRole('owner', owner)
  const advisorMetrics = await probeRole('advisor.a', advisor)

  assert(
    ownerMetrics.activeHouseholds >= advisorMetrics.activeHouseholds,
    'owner household visibility should be >= advisor',
  )
  assert(
    ownerMetrics.openOpps >= advisorMetrics.openOpps,
    'owner open opportunity visibility should be >= advisor',
  )

  // Advisor must not see another advisor's household by id.
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
    const { data: probe } = await advisor
      .from('households')
      .select('id')
      .eq('id', other.id)
      .maybeSingle()
    assert(!probe, 'advisor unexpectedly read another advisor household')
    console.log('\n[rls] advisor.a cannot read other-assigned household')
  }

  // Owner can read active advisor directory (workload join).
  const { data: advisors, error: advErr } = await owner
    .from('advisor_profiles')
    .select('id, display_name, is_active')
    .is('deleted_at', null)
    .eq('is_active', true)
    .limit(50)
  assert(!advErr, `advisor directory failed: ${advErr?.message}`)
  assert((advisors ?? []).length > 0, 'owner should see at least one active advisor')

  await owner.auth.signOut()
  await advisor.auth.signOut()
  console.log('\nCRM-9B owner ops smoke passed.')
}

main().catch((error) => {
  console.error('\nCRM-9B owner ops smoke failed:', error.message || error)
  process.exit(1)
})
