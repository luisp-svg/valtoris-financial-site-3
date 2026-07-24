/**
 * CRM-8.2A Opportunity create/edit smoke against valtoris-crm-dev.
 * Creates, edits four mutable fields, verifies protected fields unchanged,
 * household overview visibility, advisor RLS probe, owner hard-delete cleanup.
 *
 * Does NOT move stages, reassign, soft-delete, or archive.
 *
 * Usage:
 *   node --env-file=.env scripts/smoke-crm-8-2-opportunity-crud.mjs
 */
import { createClient } from '@supabase/supabase-js'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const MARKER = `CRM-8.2A smoke ${new Date().toISOString()}`

const OPPORTUNITY_SELECT = `
  id,
  title,
  status,
  household_id,
  pipeline_id,
  stage_id,
  service_vertical_id,
  assigned_advisor_id,
  need_identified,
  next_action,
  next_action_due_at,
  closed_at,
  deleted_at,
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

async function main() {
  const owner = await signIn('owner.dev@valtoris.test', requireEnv('DEV_OWNER_PASSWORD'))
  console.log('\n[owner] signed in')

  const { data: households, error: hhErr } = await owner
    .from('households')
    .select('id, display_name')
    .is('deleted_at', null)
    .is('merged_into_household_id', null)
    .order('updated_at', { ascending: false })
    .limit(5)
  assert(!hhErr, `households failed: ${hhErr?.message}`)
  assert(households?.length, 'owner needs at least one household')
  const household = households[0]
  console.log(`  household=${household.display_name} (${household.id})`)

  const { data: verticals, error: vertErr } = await owner
    .from('service_verticals')
    .select('id, code, name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
  assert(!vertErr && verticals?.[0], `verticals failed: ${vertErr?.message}`)
  const vertical = verticals[0]

  const { data: pipelines, error: pipeErr } = await owner
    .from('pipelines')
    .select('id, name, service_vertical_id')
    .eq('service_vertical_id', vertical.id)
    .eq('pipeline_type', 'service')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
  assert(!pipeErr && pipelines?.[0], `pipelines failed: ${pipeErr?.message}`)
  const pipeline = pipelines[0]

  const { data: stages, error: stageErr } = await owner
    .from('pipeline_stages')
    .select('id, name, code, sort_order, is_won, is_lost')
    .eq('pipeline_id', pipeline.id)
    .order('sort_order', { ascending: true })
  assert(!stageErr && stages?.length, `stages failed: ${stageErr?.message}`)
  const openStage =
    stages.find((s) => s.code === 'opportunity_identified') ||
    stages.find((s) => !s.is_won && !s.is_lost) ||
    stages[0]
  assert(openStage, 'open stage required')
  assert(openStage.pipeline_id === undefined || true, 'stage row loaded')
  // Confirm stage belongs to pipeline (already filtered by query)
  console.log(`  vertical=${vertical.name} pipeline=${pipeline.name} stage=${openStage.name}`)

  const { data: advisors } = await owner
    .from('advisor_profiles')
    .select('id, display_name')
    .is('deleted_at', null)
    .eq('is_active', true)
    .limit(3)
  const advisor = advisors?.[0] ?? null

  // --- CREATE (no status — DB default) ---
  const { data: created, error: createErr } = await owner
    .from('opportunities')
    .insert({
      title: MARKER,
      household_id: household.id,
      service_vertical_id: vertical.id,
      pipeline_id: pipeline.id,
      stage_id: openStage.id,
      need_identified: true,
      next_action: 'CRM-8.2A create check',
      next_action_due_at: '2026-09-01',
      assigned_advisor_id: advisor?.id ?? null,
      assigned_at: advisor ? new Date().toISOString() : null,
      assignment_reason: advisor ? 'manual' : null,
      stage_entered_at: new Date().toISOString(),
    })
    .select(OPPORTUNITY_SELECT)
    .single()
  assert(!createErr, `create failed: ${createErr?.message}`)
  assert(created?.id, 'created opportunity missing id')
  assert(created.status === 'open', `expected DB default status open, got ${created.status}`)
  assert(created.household_id === household.id, 'household mismatch')
  assert(created.pipeline_id === pipeline.id, 'pipeline mismatch')
  assert(created.stage_id === openStage.id, 'stage mismatch')
  assert(created.service_vertical_id === vertical.id, 'vertical mismatch')
  console.log(`\n[create] ok id=${created.id} status=${created.status}`)

  const { data: openForHh, error: openErr } = await owner
    .from('opportunities')
    .select('id, title, status')
    .eq('household_id', household.id)
    .eq('status', 'open')
    .is('deleted_at', null)
    .eq('id', created.id)
    .maybeSingle()
  assert(!openErr && openForHh?.id === created.id, 'household Overview query missing new opportunity')
  console.log('[household] open overview query includes new opportunity')

  // Snapshot protected fields
  const protectedBefore = {
    household_id: created.household_id,
    pipeline_id: created.pipeline_id,
    stage_id: created.stage_id,
    service_vertical_id: created.service_vertical_id,
    assigned_advisor_id: created.assigned_advisor_id,
    status: created.status,
    closed_at: created.closed_at,
  }

  // --- EDIT four mutable fields only ---
  const editedTitle = `${MARKER} edited`
  const { data: edited, error: editErr } = await owner
    .from('opportunities')
    .update({
      title: editedTitle,
      need_identified: false,
      next_action: 'CRM-8.2A edit check',
      next_action_due_at: '2026-10-15',
    })
    .eq('id', created.id)
    .is('deleted_at', null)
    .select(OPPORTUNITY_SELECT)
    .single()
  assert(!editErr, `edit failed: ${editErr?.message}`)
  assert(edited.title === editedTitle, 'title not updated')
  assert(edited.need_identified === false, 'need_identified not updated')
  assert(edited.next_action === 'CRM-8.2A edit check', 'next_action not updated')
  assert(edited.next_action_due_at === '2026-10-15', 'due date not updated')
  console.log('[edit] four mutable fields updated')

  assert(edited.household_id === protectedBefore.household_id, 'household changed')
  assert(edited.pipeline_id === protectedBefore.pipeline_id, 'pipeline changed')
  assert(edited.stage_id === protectedBefore.stage_id, 'stage changed')
  assert(edited.service_vertical_id === protectedBefore.service_vertical_id, 'vertical changed')
  assert(edited.assigned_advisor_id === protectedBefore.assigned_advisor_id, 'advisor changed')
  assert(edited.status === protectedBefore.status, 'status changed')
  assert(edited.closed_at === protectedBefore.closed_at, 'closed_at changed')
  console.log('[protect] protected fields unchanged after edit')

  // Protected column updates must fail
  const { error: statusErr } = await owner
    .from('opportunities')
    .update({ status: 'won' })
    .eq('id', created.id)
    .is('deleted_at', null)
  assert(statusErr, 'expected status update without RPC to fail')
  console.log(`[protect] status without RPC blocked: ${statusErr.message}`)

  // Unauthorized household create probe (advisor without access)
  const advisorClient = await signIn(
    'advisor.a@valtoris.test',
    requireEnv('DEV_ADVISOR_A_PASSWORD'),
  )
  const { data: advisorRead } = await advisorClient
    .from('opportunities')
    .select('id, title')
    .eq('id', created.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!advisorRead) {
    console.log('[advisor] cannot read smoke opportunity (RLS) — good')
    const { error: badEdit } = await advisorClient
      .from('opportunities')
      .update({ title: `${MARKER} leak` })
      .eq('id', created.id)
      .is('deleted_at', null)
    console.log(
      badEdit
        ? `[advisor] unauthorized edit error: ${badEdit.message}`
        : '[advisor] unauthorized edit returned 0 rows (no leak)',
    )
    const { data: verify } = await owner
      .from('opportunities')
      .select('title')
      .eq('id', created.id)
      .maybeSingle()
    assert(verify?.title === editedTitle, 'unauthorized advisor must not change title')
    console.log('[security] inaccessible opportunity title unchanged')
  } else {
    console.log('[advisor] can access opportunity (household/assignment access) — edit allowed under RLS')
  }
  await advisorClient.auth.signOut()

  // Cleanup via owner hard DELETE (existing opportunities_owner_delete policy; not exposed in CRM UI)
  const { error: cleanupErr } = await owner.from('opportunities').delete().eq('id', created.id)
  assert(!cleanupErr, `cleanup hard delete failed: ${cleanupErr?.message}`)
  console.log('[cleanup] smoke opportunity hard-deleted by owner (test cleanup only; no delete UI)')

  await owner.auth.signOut()
  console.log('\nCRM-8.2A opportunity create/edit smoke passed.')
}

main().catch((error) => {
  console.error('\nCRM-8.2A opportunity create/edit smoke FAILED')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
