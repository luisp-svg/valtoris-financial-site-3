/**
 * CRM-8.2B Opportunity lifecycle smoke against valtoris-crm-dev.
 * Exercises move_opportunity_stage only (open→open, won, reopen, lost, reopen).
 * Probes wrong-pipeline + unauthorized advisor. Owner hard-delete cleanup.
 *
 * Usage:
 *   node --env-file=.env scripts/smoke-crm-8-2b-lifecycle.mjs
 */
import { createClient } from '@supabase/supabase-js'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const MARKER = `CRM-8.2B-LIFECYCLE ${new Date().toISOString()}`

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

async function fetchOpp(supabase, id) {
  const { data, error } = await supabase
    .from('opportunities')
    .select(
      'id, title, status, stage_id, pipeline_id, closed_at, stage_entered_at, household_id, deleted_at',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  assert(!error, `fetch opp failed: ${error?.message}`)
  return data
}

async function move(supabase, opportunityId, stageId) {
  const { data, error } = await supabase.rpc('move_opportunity_stage', {
    p_opportunity_id: opportunityId,
    p_stage_id: stageId,
  })
  return { data, error }
}

async function main() {
  const createdIds = []
  const owner = await signIn('owner.dev@valtoris.test', requireEnv('DEV_OWNER_PASSWORD'))
  console.log('\n[owner] signed in')

  try {
    const { data: households, error: hhErr } = await owner
      .from('households')
      .select('id, display_name')
      .is('deleted_at', null)
      .is('merged_into_household_id', null)
      .order('updated_at', { ascending: false })
      .limit(5)
    assert(!hhErr && households?.length, `households failed: ${hhErr?.message}`)
    const household = households[0]

    const { data: verticals } = await owner
      .from('service_verticals')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
    assert(verticals?.[0], 'vertical required')
    const vertical = verticals[0]

    const { data: pipelines } = await owner
      .from('pipelines')
      .select('id, name')
      .eq('service_vertical_id', vertical.id)
      .eq('pipeline_type', 'service')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
    assert(pipelines?.[0], 'pipeline required')
    const pipeline = pipelines[0]

    const { data: stages } = await owner
      .from('pipeline_stages')
      .select('id, name, code, sort_order, is_won, is_lost, is_terminal, pipeline_id')
      .eq('pipeline_id', pipeline.id)
      .order('sort_order', { ascending: true })
    assert(stages?.length, 'stages required')

    const openA =
      stages.find((s) => s.code === 'opportunity_identified') ||
      stages.find((s) => !s.is_won && !s.is_lost && !s.is_terminal)
    const openB =
      stages.find(
        (s) =>
          s.id !== openA.id && !s.is_won && !s.is_lost && !s.is_terminal && s.code !== 'annual_review',
      ) || stages.find((s) => s.id !== openA.id && !s.is_won && !s.is_lost && !s.is_terminal)
    const won = stages.find((s) => s.is_won)
    const reopen =
      stages.find((s) => s.code === 'annual_review' || s.code === 'renewal_review') ||
      stages.find((s) => !s.is_won && !s.is_lost && !s.is_terminal && s.id !== openA.id)
    const lost = stages.find((s) => s.is_lost) || stages.find((s) => s.is_terminal)
    assert(openA && openB && won && reopen && lost, 'need open/won/reopen/lost stages')

    const { data: otherPipeStages } = await owner
      .from('pipeline_stages')
      .select('id, pipeline_id')
      .neq('pipeline_id', pipeline.id)
      .limit(1)
    const foreignStage = otherPipeStages?.[0]

    console.log(
      `  pipeline=${pipeline.name} openA=${openA.name} openB=${openB.name} won=${won.name} reopen=${reopen.name} lost=${lost.name}`,
    )

    const title = `${MARKER} lifecycle`
    const nowIso = new Date().toISOString()
    const { data: created, error: createErr } = await owner
      .from('opportunities')
      .insert({
        title,
        household_id: household.id,
        service_vertical_id: vertical.id,
        pipeline_id: pipeline.id,
        stage_id: openA.id,
        need_identified: true,
        next_action: 'CRM-8.2B smoke',
        stage_entered_at: nowIso,
      })
      .select('id')
      .single()
    assert(!createErr && created?.id, `create failed: ${createErr?.message}`)
    createdIds.push(created.id)
    console.log(`  created ${created.id}`)

    // Open → Open
    let { error } = await move(owner, created.id, openB.id)
    assert(!error, `open→open failed: ${error?.message}`)
    let row = await fetchOpp(owner, created.id)
    assert(row.status === 'open', `expected open after open move, got ${row.status}`)
    assert(row.stage_id === openB.id, 'stage should be openB')
    assert(row.closed_at == null, 'closed_at should be null after open move')
    assert(row.stage_entered_at, 'stage_entered_at should be set')
    console.log('PASS open→open')

    // Open → Won
    ;({ error } = await move(owner, created.id, won.id))
    assert(!error, `open→won failed: ${error?.message}`)
    row = await fetchOpp(owner, created.id)
    assert(row.status === 'won', `expected won, got ${row.status}`)
    assert(row.closed_at, 'closed_at required for won')
    console.log('PASS open→won')

    // Won → Annual Review / open (reopen)
    ;({ error } = await move(owner, created.id, reopen.id))
    assert(!error, `won→reopen failed: ${error?.message}`)
    row = await fetchOpp(owner, created.id)
    assert(row.status === 'open', `expected open after reopen, got ${row.status}`)
    assert(row.closed_at == null, 'closed_at cleared on reopen')
    assert(row.stage_id === reopen.id, 'reopen stage applied')
    console.log('PASS won→open (reopen)')

    // Open → Lost
    ;({ error } = await move(owner, created.id, lost.id))
    assert(!error, `open→lost failed: ${error?.message}`)
    row = await fetchOpp(owner, created.id)
    assert(row.status === 'lost', `expected lost, got ${row.status}`)
    assert(row.closed_at, 'closed_at required for lost')
    console.log('PASS open→lost')

    // Lost → Open
    ;({ error } = await move(owner, created.id, openA.id))
    assert(!error, `lost→open failed: ${error?.message}`)
    row = await fetchOpp(owner, created.id)
    assert(row.status === 'open', `expected open after lost reopen, got ${row.status}`)
    assert(row.closed_at == null, 'closed_at cleared after lost→open')
    console.log('PASS lost→open')

    // Activity written
    const { data: acts, error: actErr } = await owner
      .from('activities')
      .select('id, activity_type, title, body, metadata')
      .eq('opportunity_id', created.id)
      .eq('activity_type', 'stage_changed')
      .is('deleted_at', null)
    assert(!actErr, `activities failed: ${actErr?.message}`)
    assert((acts?.length || 0) >= 4, `expected stage_changed activities, got ${acts?.length}`)
    console.log(`PASS activity count=${acts.length}`)

    // Wrong pipeline
    if (foreignStage) {
      const bad = await move(owner, created.id, foreignStage.id)
      assert(bad.error, 'wrong-pipeline stage should fail')
      console.log(`PASS wrong-pipeline rejected (${bad.error.message})`)
    } else {
      console.log('INFO wrong-pipeline unverified (no foreign stage)')
    }

    // Unauthorized advisor
    const advisor = await signIn('advisor.a@valtoris.test', requireEnv('DEV_ADVISOR_A_PASSWORD'))
    const visible = await fetchOpp(advisor, created.id)
    if (!visible) {
      const denied = await move(advisor, created.id, openB.id)
      assert(denied.error, 'unauthorized advisor move should fail')
      console.log(`PASS unauthorized advisor rejected (${denied.error.message})`)
    } else {
      console.log('INFO unauthorized advisor unverified (advisor can access this household/opp)')
    }
    await advisor.auth.signOut()
  } finally {
    for (const id of createdIds) {
      const { data: row } = await owner
        .from('opportunities')
        .select('id, title')
        .eq('id', id)
        .maybeSingle()
      if (row && String(row.title).includes('CRM-8.2B-LIFECYCLE')) {
        const { error } = await owner.from('opportunities').delete().eq('id', id)
        assert(!error, `cleanup delete failed: ${error?.message}`)
        console.log(`CLEANUP deleted ${id}`)
      }
    }
    const { data: leftovers } = await owner
      .from('opportunities')
      .select('id, title')
      .ilike('title', '%CRM-8.2B-LIFECYCLE%')
      .is('deleted_at', null)
    assert(!leftovers?.length, `leftover QA rows: ${JSON.stringify(leftovers)}`)
    await owner.auth.signOut()
  }

  console.log('\nCRM-8.2B lifecycle smoke PASSED')
}

main().catch((err) => {
  console.error('\nCRM-8.2B lifecycle smoke FAILED')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
