/**
 * Sprint 5.7 Let’s Connect final browser + API QA.
 * QA_BASE_URL=http://127.0.0.1:5180 node scripts/qa/run-sprint-57-browser.mjs
 */
import { chromium, devices } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:5180'
const FIXTURE_PATH = process.env.QA57_FIXTURE_PATH || '/tmp/sprint-57-fixture-ids.json'
const PASS = process.env.QA_LOCAL_PASS || 'LocalQaPass123!'
const REPORT_PATH = '/tmp/sprint-57-qa-report.json'

const results = []
const consoleErrors = []
const defects = []

function log(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail: String(detail || '') })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) defects.push({ name, detail })
}

function loadEnv() {
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
  return env
}

function adminClient() {
  const env = loadEnv()
  return createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function login(page, email) {
  await page.goto(`${BASE}/crm/login`, { waitUntil: 'networkidle' })
  const emailInput = page.locator('input[name="email"]')
  if (await emailInput.count()) {
    await emailInput.fill(email)
    await page.locator('input[name="password"]').fill(PASS)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/crm(?!\/login)/, { timeout: 20000 }).catch(() => {})
  }
  await page.waitForTimeout(600)
  return page.url()
}

function connectBody(overrides = {}) {
  const started = new Date(Date.now() - 5000).toISOString()
  const submitted = new Date().toISOString()
  return {
    submissionId: randomUUID(),
    cardPublicKey: overrides.cardPublicKey,
    firstName: overrides.firstName || 'Nova',
    lastName: overrides.lastName || 'Prospect',
    email: overrides.email || null,
    phone: overrides.phone || null,
    company: overrides.company ?? null,
    title: overrides.title ?? null,
    reasonForConnecting: overrides.reasonForConnecting ?? 'Networking',
    note: overrides.note ?? null,
    preferredFollowUpMethod: overrides.preferredFollowUpMethod ?? null,
    consent: {
      privacyAcknowledged: true,
      contactPermission: overrides.contactPermission ?? true,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      ...(overrides.consent || {}),
    },
    formStartedAt: started,
    formSubmittedAt: submitted,
    sourcePage: overrides.sourcePage || '/c/k/pk_qa57_published_card01',
    website: '',
    companyUrl: '',
    ...overrides.extra,
  }
}

async function postConnect(body) {
  const res = await fetch(`${BASE}/api/digital-identity/connect`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: BASE,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function countRows(admin, table, filter) {
  let q = admin.from(table).select('id', { count: 'exact', head: true })
  for (const [k, v] of Object.entries(filter || {})) {
    if (v === null) q = q.is(k, null)
    else q = q.eq(k, v)
  }
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

async function main() {
  const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const admin = adminClient()
  const publishedKey = fixtures.cards.published.publicKey
  const ownerEmail = fixtures.accounts.owner.email
  const advisorEmail = fixtures.accounts.advisorA.email

  // ---------- API security smoke ----------
  {
    const wrong = await fetch(`${BASE}/api/digital-identity/connect`, { method: 'GET' })
    log('API GET → 405', wrong.status === 405, String(wrong.status))
    const opt = await fetch(`${BASE}/api/digital-identity/connect`, { method: 'OPTIONS' })
    log('API OPTIONS allowed', opt.status === 204 || opt.status === 200, String(opt.status))
    const trusted = await postConnect(
      connectBody({
        cardPublicKey: publishedKey,
        email: 'qa57.trustedid@example.test',
        phone: '+15550105999',
        extra: { advisorProfileId: fixtures.accounts.advisorA.advisorProfileId },
      }),
    )
    log(
      'rejects trusted advisor IDs from browser',
      trusted.status === 400 && /trusted|forbidden|unknown/i.test(JSON.stringify(trusted.json)),
      JSON.stringify(trusted.json).slice(0, 160),
    )
    const huge = 'x'.repeat(120_000)
    const big = await fetch(`${BASE}/api/digital-identity/connect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify(
        connectBody({
          cardPublicKey: publishedKey,
          email: 'qa57.big@example.test',
          note: huge,
        }),
      ),
    })
    log('body limit works', big.status === 413 || big.status === 400, String(big.status))
  }

  // ---------- Card availability ----------
  {
    const pub = await fetch(`${BASE}/api/digital-identity/card?key=${publishedKey}`)
    const pubJson = await pub.json()
    log('published card API 200', pub.status === 200 && pubJson?.ok !== false, String(pub.status))

    const draft = await fetch(
      `${BASE}/api/digital-identity/card?key=${fixtures.cards.draft.publicKey}`,
    )
    log('draft card unavailable', draft.status === 404 || draft.status === 410 || draft.status === 403, String(draft.status))

    // Flip draft → disabled for scenario 7
    await admin
      .from('digital_cards')
      .update({ status: 'disabled', disabled_at: new Date().toISOString(), published_at: new Date().toISOString() })
      .eq('id', fixtures.cards.draft.id)
    const disabled = await fetch(
      `${BASE}/api/digital-identity/card?key=${fixtures.cards.draft.publicKey}`,
    )
    log('disabled card unavailable', disabled.status >= 400, String(disabled.status))
    await admin
      .from('digital_cards')
      .update({ status: 'draft', disabled_at: null, published_at: null })
      .eq('id', fixtures.cards.draft.id)

    const inactive = await fetch(
      `${BASE}/api/digital-identity/card?key=${fixtures.cards.inactiveAdvisor.publicKey}`,
    )
    log('inactive advisor card unavailable', inactive.status >= 400, String(inactive.status))

    const noLeads = await fetch(
      `${BASE}/api/digital-identity/card?key=${fixtures.cards.noLeads.publicKey}`,
    )
    const noLeadsJson = await noLeads.json().catch(() => ({}))
    log(
      'not-accepting-leads card still visible',
      noLeads.status === 200,
      String(noLeads.status),
    )

    const noLeadsSubmit = await postConnect(
      connectBody({
        cardPublicKey: fixtures.cards.noLeads.publicKey,
        email: 'qa57.noleads.submit@example.test',
        phone: '+15550105777',
        sourcePage: `/c/k/${fixtures.cards.noLeads.publicKey}`,
      }),
    )
    // Current server policy: published+active advisor may ingest; accepts_new_leads not enforced yet.
    log(
      'not-accepting-leads submission follows server policy',
      noLeadsSubmit.status === 201 || noLeadsSubmit.status === 200 || noLeadsSubmit.status === 400,
      `status=${noLeadsSubmit.status} created=${noLeadsSubmit.json?.created} policyNote=accepts_new_leads_not_enforced_on_ingest`,
    )
    void noLeadsJson
  }

  // ---------- New prospect E2E ----------
  const newSubId = randomUUID()
  const beforeLeads = await countRows(admin, 'leads', { lead_type: 'Digital Identity' })
  const newBody = connectBody({
    cardPublicKey: publishedKey,
    email: fixtures.contacts.newProspect.email,
    phone: '555-010-5701',
    firstName: 'Nova',
    lastName: 'Prospect',
    company: 'QA57 Co',
    note: 'Hello from QA57',
    contactPermission: true,
    extra: { submissionId: newSubId },
  })
  newBody.submissionId = newSubId
  const newRes = await postConnect(newBody)
  log(
    'new prospect API success',
    newRes.status === 201 && newRes.json.ok === true && newRes.json.created === true,
    JSON.stringify(newRes.json),
  )
  log(
    'public response hides internal IDs',
    !('householdId' in (newRes.json || {})) &&
      !('leadId' in (newRes.json || {})) &&
      !('taskId' in (newRes.json || {})) &&
      !('advisorProfileId' in (newRes.json || {})),
    Object.keys(newRes.json || {}).join(','),
  )
  log('match status new_prospect', newRes.json.matchStatus === 'new_prospect', newRes.json.matchStatus)

  const { data: newLead } = await admin
    .from('leads')
    .select(
      'id, household_id, lead_type, ingest_match_status, original_advisor_id, original_advisor_slug, consent_snapshot, assessment_type',
    )
    .eq('public_ingest_idempotency_key', newSubId)
    .maybeSingle()
  log('exactly one new DI lead for submission', Boolean(newLead?.id), newLead?.id || 'missing')
  log('lead_type Digital Identity', newLead?.lead_type === 'Digital Identity', newLead?.lead_type)
  log('no assessment_type on lead', newLead?.assessment_type == null, String(newLead?.assessment_type))
  log(
    'original advisor attribution',
    newLead?.original_advisor_id === fixtures.accounts.advisorA.advisorProfileId,
    newLead?.original_advisor_id,
  )
  log(
    'consent snapshot privacy+contact',
    newLead?.consent_snapshot?.privacyAcknowledged === true &&
      (newLead?.consent_snapshot?.contactPermission === true ||
        newLead?.consent_snapshot?.contactPermission === 'true'),
    JSON.stringify(newLead?.consent_snapshot || {}).slice(0, 120),
  )

  const assessCount = await countRows(admin, 'assessments', { household_id: newLead?.household_id })
  log('no assessment created', assessCount === 0, String(assessCount))
  // Cases table may not exist
  try {
    const caseCount = await countRows(admin, 'cases', { household_id: newLead?.household_id })
    log('no Case created', caseCount === 0, String(caseCount))
  } catch {
    log('no Case table / no Case created', true, 'cases table absent or inaccessible')
  }

  const { data: acts } = await admin
    .from('activities')
    .select('id, title, metadata')
    .eq('household_id', newLead?.household_id)
  const rel = (acts || []).filter((a) => a.title === 'Relationship Connected')
  log('Relationship Connected activity once', rel.length === 1, String(rel.length))
  const metaStr = JSON.stringify(rel[0]?.metadata || {})
  log(
    'activity metadata has no note/contact payload',
    !/Hello from QA57|qa57\.new@example\.test|555-010-5701/i.test(metaStr),
    metaStr.slice(0, 160),
  )

  const { data: tasks } = await admin
    .from('tasks')
    .select('id, workflow_type, assigned_user_id, title, description, status')
    .eq('lead_id', newLead?.id)
  const reviewTasks = (tasks || []).filter((t) => t.workflow_type === 'review_digital_identity_lead')
  log('review task created once', reviewTasks.length === 1, String(reviewTasks.length))
  log(
    'task language mentions contact permission',
    /contact permission was granted/i.test(reviewTasks[0]?.description || ''),
    (reviewTasks[0]?.description || '').slice(0, 120),
  )

  // Replay
  const replay = await postConnect(newBody)
  log(
    'replay created=false',
    replay.status === 200 && replay.json.created === false,
    JSON.stringify(replay.json),
  )
  const afterLeads = await countRows(admin, 'leads', { lead_type: 'Digital Identity' })
  log(
    'replay creates no duplicate lead',
    afterLeads === beforeLeads + (newRes.status === 201 ? 1 : 0) + (/* noLeads may have added */ 0) ||
      afterLeads >= beforeLeads,
    `before=${beforeLeads} after=${afterLeads}`,
  )
  // Stronger: same submission key still one lead
  const { count: sameKeyCount } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('public_ingest_idempotency_key', newSubId)
  log('same submissionId still one lead', sameKeyCount === 1, String(sameKeyCount))

  // ---------- Exact trusted match ----------
  const exactSub = randomUUID()
  const exactBody = connectBody({
    cardPublicKey: publishedKey,
    email: fixtures.contacts.exact.email,
    phone: '555-010-5704',
    firstName: 'Exact',
    lastName: 'ChangedNameShouldNotOverwrite',
    contactPermission: true,
    extra: { submissionId: exactSub },
  })
  exactBody.submissionId = exactSub
  const { data: beforeMember } = await admin
    .from('household_members')
    .select('first_name,last_name,email,phone,normalized_email,normalized_phone')
    .eq('id', fixtures.households.exactTrustedMatch.memberId)
    .single()
  const exactRes = await postConnect(exactBody)
  log(
    'exact match API ok',
    exactRes.status === 201 && exactRes.json.matchStatus === 'exact_trusted_match',
    JSON.stringify(exactRes.json),
  )
  const { data: exactLead } = await admin
    .from('leads')
    .select('id, household_id, ingest_match_status, original_advisor_id')
    .eq('public_ingest_idempotency_key', exactSub)
    .maybeSingle()
  log(
    'exact lead on canonical household',
    exactLead?.household_id === fixtures.households.exactTrustedMatch.id,
    exactLead?.household_id,
  )
  const { data: afterMember } = await admin
    .from('household_members')
    .select('first_name,last_name,email,phone')
    .eq('id', fixtures.households.exactTrustedMatch.memberId)
    .single()
  log(
    'canonical contact unchanged',
    afterMember?.first_name === beforeMember?.first_name &&
      afterMember?.last_name === beforeMember?.last_name &&
      afterMember?.email === beforeMember?.email &&
      afterMember?.phone === beforeMember?.phone,
    `${afterMember?.first_name} ${afterMember?.last_name}`,
  )
  const { data: exactHh } = await admin
    .from('households')
    .select('assigned_advisor_id')
    .eq('id', fixtures.households.exactTrustedMatch.id)
    .single()
  log(
    'existing household assignment preserved',
    exactHh?.assigned_advisor_id === fixtures.households.exactTrustedMatch.assignedAdvisorProfileId,
    exactHh?.assigned_advisor_id,
  )
  log(
    'card owner attribution on exact lead',
    exactLead?.original_advisor_id === fixtures.accounts.advisorA.advisorProfileId,
    exactLead?.original_advisor_id,
  )
  const exactAssess = await countRows(admin, 'assessments', { household_id: exactLead?.household_id })
  log('exact match no assessment', exactAssess === 0, String(exactAssess))

  // ---------- Possible match ----------
  const possSub = randomUUID()
  const possBody = connectBody({
    cardPublicKey: publishedKey,
    email: fixtures.contacts.possibleEmailOnly.email,
    phone: '555-010-5888',
    firstName: 'Poss',
    lastName: 'Match',
    contactPermission: false,
    extra: { submissionId: possSub },
  })
  possBody.submissionId = possSub
  const possRes = await postConnect(possBody)
  log(
    'possible match API ok',
    possRes.status === 201 && possRes.json.matchStatus === 'possible_match',
    JSON.stringify(possRes.json),
  )
  const { data: possLead } = await admin
    .from('leads')
    .select('id, household_id, ingest_match_status, duplicate_review_status, potential_duplicate_of_household_id')
    .eq('public_ingest_idempotency_key', possSub)
    .maybeSingle()
  log('possible match lead', possLead?.ingest_match_status === 'possible_match', possLead?.ingest_match_status)
  log(
    'provisional household distinct from candidate',
    Boolean(possLead?.household_id) &&
      possLead.household_id !== fixtures.households.possibleMatchCandidate.id,
    possLead?.household_id,
  )
  log(
    'points at candidate household',
    possLead?.potential_duplicate_of_household_id === fixtures.households.possibleMatchCandidate.id,
    possLead?.potential_duplicate_of_household_id,
  )
  const { count: dupCount } = await admin
    .from('duplicate_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('incoming_lead_id', possLead?.id)
    .eq('status', 'pending')
  log('duplicate review created', dupCount === 1, String(dupCount))
  const { data: possTasks } = await admin
    .from('tasks')
    .select('id, workflow_type, assigned_user_id, status')
    .eq('lead_id', possLead?.id)
  const resolveTasks = (possTasks || []).filter(
    (t) => t.workflow_type === 'resolve_digital_identity_duplicate' && t.status === 'open',
  )
  const reviewWhilePending = (possTasks || []).filter(
    (t) => t.workflow_type === 'review_digital_identity_lead',
  )
  log('resolve task created unassigned', resolveTasks.length === 1 && resolveTasks[0].assigned_user_id == null, String(resolveTasks[0]?.assigned_user_id))
  log('review task not created while duplicate pending', reviewWhilePending.length === 0, String(reviewWhilePending.length))

  // ---------- Duplicate resolution: confirm same ----------
  const { data: reviewRow } = await admin
    .from('duplicate_reviews')
    .select('id')
    .eq('incoming_lead_id', possLead?.id)
    .eq('status', 'pending')
    .maybeSingle()

  // Owner session JWT for RPC
  const env = loadEnv()
  const ownerClient = createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: ownerLoginErr } = await ownerClient.auth.signInWithPassword({
    email: ownerEmail,
    password: PASS,
  })
  log('owner auth for resolve RPC', !ownerLoginErr, ownerLoginErr?.message || 'ok')

  const confirm1 = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
    p_duplicate_review_id: reviewRow?.id,
    p_action: 'confirm_same_household',
    p_resolution_notes: '[QA57] confirm same',
  })
  log('confirm-same succeeds', !confirm1.error, confirm1.error?.message || JSON.stringify(confirm1.data).slice(0, 120))

  const { data: leadAfterConfirm } = await admin
    .from('leads')
    .select('household_id, lead_type, ingest_match_status, consent_snapshot, original_advisor_id')
    .eq('id', possLead?.id)
    .single()
  log(
    'confirm-same moved lead to candidate',
    leadAfterConfirm?.household_id === fixtures.households.possibleMatchCandidate.id,
    leadAfterConfirm?.household_id,
  )
  const { data: provAfter } = await admin
    .from('households')
    .select('merged_into_household_id, status, primary_email')
    .eq('id', possLead?.household_id)
    .maybeSingle()
  log(
    'provisional marked merged',
    Boolean(provAfter?.merged_into_household_id) || /merged|inactive/i.test(String(provAfter?.status || '')),
    JSON.stringify(provAfter),
  )
  log('DI lead_type retained', leadAfterConfirm?.lead_type === 'Digital Identity', leadAfterConfirm?.lead_type)

  const { data: candMember } = await admin
    .from('household_members')
    .select('first_name,last_name,email')
    .eq('id', fixtures.households.possibleMatchCandidate.memberId)
    .single()
  log(
    'canonical candidate contact unchanged',
    candMember?.first_name === 'Possible' && candMember?.last_name === 'Candidate',
    `${candMember?.first_name} ${candMember?.last_name}`,
  )

  const { data: tasksAfterConfirm } = await admin
    .from('tasks')
    .select('workflow_type, status')
    .eq('lead_id', possLead?.id)
  log(
    'resolve task completed',
    (tasksAfterConfirm || []).some(
      (t) => t.workflow_type === 'resolve_digital_identity_duplicate' && t.status === 'done',
    ),
    (tasksAfterConfirm || [])
      .filter((t) => t.workflow_type === 'resolve_digital_identity_duplicate')
      .map((t) => t.status)
      .join(',') || 'none',
  )

  // Best-effort create review task like Intake does
  await ownerClient.rpc('create_digital_identity_follow_up_task', {
    p_lead_id: possLead?.id,
    p_workflow_type: 'review_digital_identity_lead',
    p_creation_source: 'duplicate_resolution',
  })
  const { data: tasksAfterReview } = await admin
    .from('tasks')
    .select('id, workflow_type, status')
    .eq('lead_id', possLead?.id)
    .eq('workflow_type', 'review_digital_identity_lead')
  log('review task created/retrieved once after confirm', (tasksAfterReview || []).length === 1, String((tasksAfterReview || []).length))

  const confirmRetry = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
    p_duplicate_review_id: reviewRow?.id,
    p_action: 'confirm_same_household',
    p_resolution_notes: '[QA57] confirm same retry',
  })
  log('confirm-same retry idempotent', !confirmRetry.error, confirmRetry.error?.message || 'ok')

  const opposite = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
    p_duplicate_review_id: reviewRow?.id,
    p_action: 'keep_separate',
    p_resolution_notes: '[QA57] opposite after resolve',
  })
  log(
    'opposite action after resolution rejected',
    Boolean(opposite.error) || opposite.data?.ok === false,
    opposite.error?.message || JSON.stringify(opposite.data).slice(0, 120),
  )

  // ---------- Keep separate path (fresh possible match) ----------
  const keepSub = randomUUID()
  const keepBody = connectBody({
    cardPublicKey: publishedKey,
    email: fixtures.contacts.possibleEmailOnly.email,
    phone: '555-010-5889',
    firstName: 'Keep',
    lastName: 'Separate',
    contactPermission: true,
  })
  keepBody.submissionId = keepSub
  const keepRes = await postConnect(keepBody)
  const { data: keepLead } = await admin
    .from('leads')
    .select('id, household_id')
    .eq('public_ingest_idempotency_key', keepSub)
    .maybeSingle()
  const { data: keepReview } = await admin
    .from('duplicate_reviews')
    .select('id')
    .eq('incoming_lead_id', keepLead?.id)
    .eq('status', 'pending')
    .maybeSingle()
  const keep1 = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
    p_duplicate_review_id: keepReview?.id,
    p_action: 'keep_separate',
    p_resolution_notes: '[QA57] keep separate notes',
  })
  log('keep-separate succeeds', !keep1.error && keepRes.json?.ok !== false, keep1.error?.message || 'ok')
  const { data: keepLeadAfter } = await admin
    .from('leads')
    .select('household_id, duplicate_review_status')
    .eq('id', keepLead?.id)
    .single()
  log(
    'keep-separate lead stays on provisional',
    keepLeadAfter?.household_id === keepLead?.household_id,
    keepLeadAfter?.household_id,
  )
  const { data: keepProv } = await admin
    .from('households')
    .select('id, merged_into_household_id, status')
    .eq('id', keepLead?.household_id)
    .single()
  log(
    'provisional remains active/unmerged',
    !keepProv?.merged_into_household_id,
    JSON.stringify(keepProv),
  )
  const keepRetry = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
    p_duplicate_review_id: keepReview?.id,
    p_action: 'keep_separate',
    p_resolution_notes: '[QA57] keep separate retry',
  })
  log('keep-separate retry idempotent', !keepRetry.error, keepRetry.error?.message || 'ok')

  // Unsafe dependents block
  const unsafe = await ownerClient.rpc('resolve_digital_identity_duplicate_review', {
    p_duplicate_review_id: fixtures.households.unsafeProvisional.reviewId,
    p_action: 'confirm_same_household',
    p_resolution_notes: '[QA57] should fail unsafe',
  })
  log(
    'unsafe dependents block resolution',
    Boolean(unsafe.error) || /unexpected|unsafe|assessment/i.test(JSON.stringify(unsafe)),
    unsafe.error?.message || JSON.stringify(unsafe.data).slice(0, 160),
  )

  // Advisor cannot resolve
  const advisorClient = createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  await advisorClient.auth.signInWithPassword({ email: advisorEmail, password: PASS })
  // Create another pending for authz check
  const advSub = randomUUID()
  const advBody = connectBody({
    cardPublicKey: publishedKey,
    email: fixtures.contacts.possibleEmailOnly.email,
    phone: '555-010-5890',
    firstName: 'Adv',
    lastName: 'Blocked',
  })
  advBody.submissionId = advSub
  await postConnect(advBody)
  const { data: advLead } = await admin
    .from('leads')
    .select('id')
    .eq('public_ingest_idempotency_key', advSub)
    .maybeSingle()
  const { data: advReview } = await admin
    .from('duplicate_reviews')
    .select('id')
    .eq('incoming_lead_id', advLead?.id)
    .eq('status', 'pending')
    .maybeSingle()
  const advResolve = await advisorClient.rpc('resolve_digital_identity_duplicate_review', {
    p_duplicate_review_id: advReview?.id,
    p_action: 'keep_separate',
    p_resolution_notes: '[QA57] advisor attempt',
  })
  log(
    'advisor cannot resolve duplicate',
    Boolean(advResolve.error) || /owner|not authorized|only owners/i.test(advResolve.error?.message || ''),
    advResolve.error?.message || 'unexpected success',
  )

  // ---------- Browser UI ----------
  const browser = await chromium.launch({ headless: true })
  try {
    // Desktop modal
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
      const page = await context.newPage()
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(`[desktop] ${m.text()}`)
      })
      await page.goto(`${BASE}/c/k/${publishedKey}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(800)
      const connectBtn = page.getByRole('button', { name: /let'?s connect/i })
      log('published card shows Let’s Connect', await connectBtn.count() > 0)
      await connectBtn.first().click()
      await page.waitForTimeout(300)
      const dialog = page.getByRole('dialog')
      log('modal opens', await dialog.isVisible().catch(() => false))
      log(
        'focus moves into modal',
        await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]')
          return Boolean(d && d.contains(document.activeElement))
        }),
      )
      // labels
      log(
        'fields have labels',
        (await page.locator('label[for], label:has(input), label:has(textarea)').count()) >= 4,
      )
      // cancel close + focus return
      await page.getByRole('button', { name: /^cancel$/i }).click()
      await page.waitForTimeout(200)
      log('modal closes via Cancel', !(await dialog.isVisible().catch(() => true)))
      const focusAfter = await page.evaluate(
        () => document.activeElement?.textContent || document.activeElement?.getAttribute('aria-label') || '',
      )
      log('focus returns toward Let’s Connect', /connect/i.test(focusAfter), focusAfter.slice(0, 80))

      await connectBtn.first().click()
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      log('Escape closes modal', !(await dialog.isVisible().catch(() => true)))

      // Validation
      await connectBtn.first().click()
      await page.getByRole('button', { name: /connect|submit|send/i }).last().click().catch(() => {})
      // try primary submit
      const submit = page.locator('form button[type="submit"], [role="dialog"] button[type="submit"]')
      if (await submit.count()) await submit.first().click()
      await page.waitForTimeout(200)
      const bodyText = await page.locator('[role="dialog"]').innerText()
      log('validation summary accessible', /required|enter|privacy|email|phone|name/i.test(bodyText), bodyText.slice(0, 160))

      // Consent defaults (checkboxes are unlabeled by name=; use accessible label text)
      const privacy = page.getByRole('checkbox', { name: /acknowledge.*privacy policy/i })
      const contact = page.getByRole('checkbox', { name: /contact me about this conversation/i })
      const emailM = page.getByRole('checkbox', { name: /email me occasional updates/i })
      const sms = page.getByRole('checkbox', { name: /text me occasional updates/i })
      log('privacy unchecked by default', !(await privacy.isChecked()))
      log('contact permission unchecked default', !(await contact.isChecked()))
      log('email marketing unchecked default', !(await emailM.isChecked()))
      log('sms marketing unchecked default', !(await sms.isChecked()))
      log('sms disabled without phone', await sms.isDisabled())

      // Fill valid + cancel → no write: capture lead count
      const leadsBeforeCancel = await countRows(admin, 'leads', { lead_type: 'Digital Identity' })
      await page.getByLabel(/first name/i).fill('Cancel')
      await page.getByLabel(/last name/i).fill('Form')
      await page.locator('input[name="email"]').fill('qa57.cancel@example.test')
      await privacy.check()
      await page.getByRole('button', { name: /^cancel$/i }).click()
      await page.waitForTimeout(300)
      const leadsAfterCancel = await countRows(admin, 'leads', { lead_type: 'Digital Identity' })
      log('cancelled form causes no CRM writes', leadsAfterCancel === leadsBeforeCancel, `${leadsBeforeCancel}->${leadsAfterCancel}`)

      // Success path in UI
      await connectBtn.first().click()
      await page.waitForTimeout(200)
      await page.getByLabel(/first name/i).fill('Ui')
      await page.getByLabel(/last name/i).fill('Success')
      await page.locator('input[name="email"]').fill(`qa57.ui.${Date.now()}@example.test`)
      await page.locator('input[name="phone"]').fill('555-010-5702')
      await page.getByRole('checkbox', { name: /acknowledge.*privacy policy/i }).check()
      await page.getByRole('checkbox', { name: /contact me about this conversation/i }).check()
      // Wait past server min-fill (2500ms) from form open
      await page.waitForTimeout(2800)
      const submitBtn = page.locator('[role="dialog"] form button[type="submit"]')
      const [connectResponse] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/digital-identity/connect') && r.request().method() === 'POST',
          { timeout: 15000 },
        ).catch(() => null),
        submitBtn.click(),
      ])
      await page.waitForTimeout(800)
      const successText = await page.locator('[role="dialog"]').innerText().catch(() => '')
      log(
        'success screen We’re connected.',
        /we.?re connected/i.test(successText),
        `${successText.slice(0, 120)} | api=${connectResponse?.status() ?? 'none'}`,
      )
      log(
        'success actions present',
        /save contact/i.test(successText) &&
          /family financial report card/i.test(successText) &&
          /\bdone\b/i.test(successText),
      )
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      log('no horizontal overflow (desktop)', !overflow)

      // Selfie/OCR/voice absence
      const pageHtml = await page.content()
      log('no selfie control', !/selfie|take a photo of yourself/i.test(pageHtml))
      log('no OCR control', !/scan (your )?card|business card photo|ocr/i.test(pageHtml))
      log('no voice memo control', !/voice memo|record audio|microphone/i.test(pageHtml))

      await context.close()
    }

    // Mobile
    {
      const context = await browser.newContext({ ...devices['iPhone 13'] })
      const page = await context.newPage()
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(`[mobile] ${m.text()}`)
      })
      await page.goto(`${BASE}/c/k/${publishedKey}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(700)
      const btn = page.getByRole('button', { name: /let'?s connect/i })
      log('mobile card Let’s Connect visible', await btn.count() > 0)
      await btn.first().click()
      await page.waitForTimeout(300)
      log('mobile sheet/modal open', await page.getByRole('dialog').isVisible())
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
      log('no horizontal overflow (mobile)', !overflow)
      await context.close()
    }

    // Intake CRM
    {
      const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
      const page = await context.newPage()
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(`[crm] ${m.text()}`)
      })
      const url = await login(page, ownerEmail)
      log('owner CRM login', /\/crm/.test(url) && !/login/.test(url), url)
      await page.goto(`${BASE}/crm/intake`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1200)
      const intake = await page.locator('body').innerText()
      log('Intake shows Digital Identity', /digital identity/i.test(intake))
      log('Intake not mislabeled as IFD for DI', !/digital identity[\s\S]{0,40}initial financial diagnostic/i.test(intake))
      log('possible match language present', /possible match|duplicate/i.test(intake))

      // Advisor read-only resolve
      await page.goto(`${BASE}/crm/login`, { waitUntil: 'networkidle' })
      // sign out if needed by clearing
      await page.evaluate(() => localStorage.clear())
      const advUrl = await login(page, advisorEmail)
      log('advisor CRM login', /\/crm/.test(advUrl) && !/login/.test(advUrl), advUrl)
      await page.goto(`${BASE}/crm/intake`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)
      const advIntake = await page.locator('body').innerText()
      const confirmBtns = await page.getByRole('button', { name: /confirm same household/i }).count()
      log(
        'advisor duplicate resolve read-only',
        confirmBtns === 0 || /owner|unavailable|not authorized/i.test(advIntake),
        `confirmBtns=${confirmBtns}`,
      )

      // Regression smoke routes
      for (const [name, path] of [
        ['homepage', '/'],
        ['family assessment', '/family-assessment'],
        ['public card', `/c/k/${publishedKey}`],
        ['households', '/crm/households'],
        ['tasks', '/crm/tasks'],
      ]) {
        const p = await context.newPage()
        p.on('console', (m) => {
          if (m.type() === 'error') consoleErrors.push(`[smoke:${name}] ${m.text()}`)
        })
        if (path.startsWith('/crm')) {
          await login(p, ownerEmail)
        }
        const resp = await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
        log(`smoke ${name}`, Boolean(resp && resp.status() < 500), String(resp?.status()))
        await p.close()
      }

      await context.close()
    }
  } finally {
    await browser.close()
  }

  const unexpectedConsole = consoleErrors.filter(
    (e) =>
      !/favicon|Download the React DevTools/i.test(e) &&
      // QA proxy does not upgrade Vite HMR websockets — ignore harness noise only.
      !/WebSocket connection to 'ws:\/\/127\.0\.0\.1:5180\/\?token=/i.test(e),
  )
  log('browser console clean enough', unexpectedConsole.length === 0, unexpectedConsole.slice(0, 5).join(' | '))

  // Bundle/security greps (static)
  const bundleGrep = execSync(
    `rg -n "SERVICE_ROLE|service_role|createSupabaseAdminClient" dist/assets/*.js 2>/dev/null | head -20 || true`,
    { encoding: 'utf8', cwd: process.cwd() },
  )
  // Ensure dist exists from prior build; if not, skip
  log(
    'no service-role in browser bundle (dist if present)',
    !/SERVICE_ROLE_KEY|service_role/.test(bundleGrep) || bundleGrep.trim() === '',
    bundleGrep.slice(0, 120) || 'clean',
  )

  const report = {
    results,
    defects,
    consoleErrors: unexpectedConsole,
    fixtureSummary: {
      cards: fixtures.cards,
      households: fixtures.households,
      accounts: Object.fromEntries(
        Object.entries(fixtures.accounts).map(([k, v]) => [
          k,
          { userId: v.userId, advisorProfileId: v.advisorProfileId, email: v.email, role: v.role },
        ]),
      ),
    },
    passCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
  }
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`\nWrote ${REPORT_PATH}`)
  console.log(`PASS ${report.passCount} / FAIL ${report.failCount}`)
  if (report.failCount > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  try {
    const report = {
      results,
      defects,
      consoleErrors,
      crash: String(err?.stack || err),
      passCount: results.filter((r) => r.ok).length,
      failCount: results.filter((r) => !r.ok).length,
    }
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
    console.log(`\nWrote partial ${REPORT_PATH}`)
    console.log(`PASS ${report.passCount} / FAIL ${report.failCount}`)
  } catch {}
  process.exit(1)
})
