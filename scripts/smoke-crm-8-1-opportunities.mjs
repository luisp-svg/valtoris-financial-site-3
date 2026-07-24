/**
 * Read-only CRM-8.1 smoke against valtoris-crm-dev.
 * Does not mutate data. Loads passwords from .env via --env-file.
 *
 * Usage:
 *   node --env-file=.env scripts/smoke-crm-8-1-opportunities.mjs
 */
import { createClient } from '@supabase/supabase-js'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'

const OPPORTUNITY_SELECT = `
  id,
  title,
  status,
  household_id,
  pipeline_id,
  stage_id,
  service_vertical_id,
  assigned_advisor_id,
  updated_at,
  household:households!household_id ( id, display_name ),
  pipeline:pipelines!pipeline_id ( id, name ),
  stage:pipeline_stages!stage_id ( id, name, code ),
  service_vertical:service_verticals!service_vertical_id ( id, code, name ),
  assigned_advisor:advisor_profiles!assigned_advisor_id ( id, display_name )
`

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

function asSingle(value) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
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

async function listOpportunities(supabase) {
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(25)
  assert(!error, `opportunities list failed: ${error?.message}`)
  return data ?? []
}

function summarizeRow(row) {
  const household = asSingle(row.household)
  const pipeline = asSingle(row.pipeline)
  const stage = asSingle(row.stage)
  const vertical = asSingle(row.service_vertical)
  const owner = asSingle(row.assigned_advisor)
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    household: household?.display_name ?? null,
    pipeline: pipeline?.name ?? null,
    stage: stage?.name ?? null,
    stageCode: stage?.code ?? null,
    service: vertical?.name ?? null,
    owner: owner?.display_name ?? null,
  }
}

async function runAs(label, email, password, { optional = false } = {}) {
  let supabase
  try {
    supabase = await signIn(email, password)
  } catch (error) {
    if (optional) {
      console.log(`\n[${label}] ${email}`)
      console.log(`  SKIPPED sign-in: ${error instanceof Error ? error.message : error}`)
      return null
    }
    throw error
  }
  const rows = await listOpportunities(supabase)
  const summaries = rows.map(summarizeRow)

  console.log(`\n[${label}] ${email}`)
  console.log(`  accessible opportunities: ${summaries.length}`)
  if (summaries[0]) {
    const sample = summaries[0]
    console.log(`  sample: ${sample.title}`)
    console.log(`    household=${sample.household}`)
    console.log(`    pipeline=${sample.pipeline}`)
    console.log(`    stage=${sample.stage} (${sample.stageCode})`)
    console.log(`    service=${sample.service}`)
    console.log(`    owner=${sample.owner}`)
    console.log(`    detail path=/crm/opportunities/${sample.id}`)
    console.log(`    household path=/crm/households/${rows[0].household_id}`)

    const { data: detail, error: detailError } = await supabase
      .from('opportunities')
      .select(OPPORTUNITY_SELECT)
      .eq('id', sample.id)
      .is('deleted_at', null)
      .maybeSingle()
    assert(!detailError, `detail failed: ${detailError?.message}`)
    assert(detail, 'detail row missing')
    assert(asSingle(detail.pipeline)?.name, 'pipeline relationship missing on detail')
    assert(asSingle(detail.stage)?.name, 'stage relationship missing on detail')
    assert(asSingle(detail.service_vertical)?.name, 'service vertical missing on detail')
    assert(asSingle(detail.household)?.display_name, 'household missing on detail')

    const { data: activities, error: activityError } = await supabase
      .from('activities')
      .select('id, opportunity_id, activity_type, title')
      .eq('opportunity_id', sample.id)
      .is('deleted_at', null)
      .limit(5)
    assert(!activityError, `activities failed: ${activityError?.message}`)
    console.log(`    opportunity-scoped activities: ${(activities ?? []).length}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle()
  console.log(`  profile role=${profile?.role ?? 'unknown'}`)

  await supabase.auth.signOut()
  return summaries
}

async function assertAdvisorCannotAccessOpportunity(opportunityId) {
  const supabase = await signIn(
    'advisor.a@valtoris.test',
    requireEnv('DEV_ADVISOR_A_PASSWORD'),
  )
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title')
    .eq('id', opportunityId)
    .is('deleted_at', null)
    .maybeSingle()
  assert(!error, `advisor leak probe failed: ${error?.message}`)
  assert(data === null, `advisor.a unexpectedly can read opportunity ${opportunityId}`)
  console.log(`\n[rls] advisor.a cannot read owner-visible opportunity ${opportunityId}`)
  await supabase.auth.signOut()
}

async function main() {
  const ownerRows = await runAs(
    'owner',
    'owner.dev@valtoris.test',
    requireEnv('DEV_OWNER_PASSWORD'),
  )
  const advisorARows = await runAs(
    'advisor-a',
    'advisor.a@valtoris.test',
    requireEnv('DEV_ADVISOR_A_PASSWORD'),
  )
  const advisorBRows = await runAs(
    'advisor-b',
    'advisor.b@valtoris.test',
    requireEnv('DEV_ADVISOR_B_PASSWORD'),
    { optional: true },
  )

  assert(Array.isArray(ownerRows), 'owner rows required')
  assert(Array.isArray(advisorARows), 'advisor-a rows required')

  const ownerIds = new Set(ownerRows.map((row) => row.id))
  for (const row of advisorARows) {
    assert(ownerIds.has(row.id), `advisor-a saw opportunity ${row.id} not visible to owner`)
  }
  if (advisorBRows) {
    for (const row of advisorBRows) {
      assert(ownerIds.has(row.id), `advisor-b saw opportunity ${row.id} not visible to owner`)
    }
  }

  if (ownerRows[0] && advisorARows.every((row) => row.id !== ownerRows[0].id)) {
    await assertAdvisorCannotAccessOpportunity(ownerRows[0].id)
  }

  console.log('\nCRM-8.1 opportunity smoke passed (read-only).')
}

main().catch((error) => {
  console.error('\nCRM-8.1 opportunity smoke FAILED')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
