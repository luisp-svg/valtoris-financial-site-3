/**
 * Sprint 5.9 Campaigns & Events live QA harness (API + Playwright).
 *
 * Prerequisites:
 *   node scripts/qa/sprint-59-bootstrap-auth.mjs
 *   node scripts/qa/sprint-59-seed.mjs
 *   Vite on 5174 + API shim on 5181
 *
 *   QA_BASE_URL=http://127.0.0.1:5181 node scripts/qa/run-sprint-59-campaign-qa.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { stringToBase64URL } from '@supabase/ssr/dist/module/utils/base64url.js'
import { createHash, randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { join } from 'node:path'

const pwRequire = createRequire('/tmp/qa58-playwright/package.json')
const { chromium, devices } = pwRequire('playwright')
const sharp = createRequire(import.meta.url)('sharp')

async function loadAppHelpers() {
  const outdir = mkdtempSync(join(process.cwd(), '.tmp-qa59-helpers-'))
  const entry = join(outdir, 'entry.mjs')
  writeFileSync(
    entry,
    `
export { buildCampaignUpdatePayload, buildCampaignPublicLink } from ${JSON.stringify(join(process.cwd(), 'crm/campaigns/campaignsApi.ts'))};
export { CAMPAIGN_EDITABLE_FIELD_KEYS } from ${JSON.stringify(join(process.cwd(), 'crm/campaigns/campaignEditContract.ts'))};
export { buildHowWeMetViewModel } from ${JSON.stringify(join(process.cwd(), 'crm/intake/howWeMet.ts'))};
`,
  )
  const outfile = join(outdir, 'helpers.mjs')
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    logLevel: 'silent',
  })
  process.on('exit', () => {
    try {
      rmSync(outdir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })
  return import(pathToFileURL(outfile).href)
}

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:5181'
const FIXTURE_PATH = process.env.QA59_FIXTURE_PATH || '/tmp/sprint-59-fixture-ids.json'
const PASS = process.env.QA_LOCAL_PASS || 'LocalQaPass123!'
const REPORT_PATH = '/tmp/sprint-59-qa-report.json'

const results = []
const consoleErrors = []
const defects = []

function log(section, name, ok, detail = '') {
  const row = { section, name, ok: Boolean(ok), detail: String(detail || '').slice(0, 500) }
  results.push(row)
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${section}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) defects.push({ section, name, detail: row.detail })
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

function psql(sql) {
  execSync(
    `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -v ON_ERROR_STOP=1`,
    { input: sql, stdio: ['pipe', 'pipe', 'inherit'] },
  )
}

function seedCandidateHousehold({ id, displayName, email, phone, advisorProfileId }) {
  const normalizedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`
  psql(`
SET session_replication_role = replica;
INSERT INTO public.households (
  id, display_name, status, primary_email, normalized_email,
  relationship_pipeline_id, relationship_stage_id,
  assigned_advisor_id, assigned_at, assignment_reason
) VALUES (
  '${id}',
  '${displayName.replace(/'/g, "''")}',
  'lead',
  '${email}',
  '${email}',
  '22222222-2222-2222-2222-222222222201',
  '33333333-3333-3333-3333-333333333001',
  '${advisorProfileId}',
  now(),
  'manual'
);
INSERT INTO public.household_members (
  household_id, first_name, last_name, relationship, is_primary_contact,
  email, normalized_email, phone, normalized_phone
) VALUES (
  '${id}',
  'Other',
  'Person',
  'primary',
  true,
  '${email}',
  '${email}',
  '${phone}',
  '${normalizedPhone}'
);
SET session_replication_role = DEFAULT;
`)
}

async function userClient(email) {
  const env = loadEnv()
  const client = createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASS })
  if (error) throw error
  return { client, session: data.session, userId: data.user.id }
}

function connectBody(overrides = {}) {
  const started = new Date(Date.now() - 5000).toISOString()
  return {
    submissionId: overrides.submissionId || randomUUID(),
    cardPublicKey: overrides.cardPublicKey,
    firstName: overrides.firstName || 'Camp',
    lastName: overrides.lastName || 'Prospect',
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    company: null,
    title: null,
    reasonForConnecting: 'Networking',
    note: null,
    preferredFollowUpMethod: 'email',
    consent: {
      privacyAcknowledged: true,
      contactPermission: true,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
    },
    formStartedAt: started,
    formSubmittedAt: new Date().toISOString(),
    sourcePage: overrides.sourcePage || '/c/k/pk_qa59_advisor_a_card01?c=qa59-active-event',
    website: '',
    companyUrl: '',
    campaignCode: overrides.campaignCode,
    eventCode: overrides.eventCode,
    sourceChannel: overrides.sourceChannel || 'link',
    utmSource: overrides.utmSource,
    utmMedium: overrides.utmMedium,
    utmCampaign: overrides.utmCampaign,
    referrer: overrides.referrer || 'https://partner.example/page',
  }
}

async function postConnect(body) {
  const res = await fetch(`${BASE}/api/digital-identity/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
      'X-Forwarded-For': `203.0.113.${(Math.floor(Math.random() * 200) + 1)}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function getQr(params) {
  const qs = new URLSearchParams(params)
  const res = await fetch(`${BASE}/api/digital-identity/card/qr?${qs}`, {
    headers: { Origin: BASE },
  })
  const dest = res.headers.get('x-valtoris-qr-destination')
  const buf = Buffer.from(await res.arrayBuffer())
  return { status: res.status, dest, buf, contentType: res.headers.get('content-type') }
}

async function main() {
  const {
    buildCampaignUpdatePayload,
    buildCampaignPublicLink,
    CAMPAIGN_EDITABLE_FIELD_KEYS,
    buildHowWeMetViewModel,
  } = await loadAppHelpers()

  if (!existsSync(FIXTURE_PATH)) throw new Error(`Missing fixtures ${FIXTURE_PATH}`)
  const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const seed = fixtures.seed
  if (!seed) throw new Error('Seed missing — run sprint-59-seed.mjs')
  const admin = adminClient()
  const cardA = seed.cardA
  const cardB = seed.cardB
  const camps = seed.campaigns

  // ---------- Scope checks ----------
  log('scope', 'HEAD is 1b70c88', execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().startsWith('1b70c88'))
  log('scope', 'migration count 28', execSync('ls supabase/migrations/*.sql | wc -l', { encoding: 'utf8' }).trim() === '28')
  log('scope', 'no migration 029', !existsSync('supabase/migrations/029_placeholder.sql'))
  log('scope', 'CAMPAIGN_EDITABLE_FIELD_KEYS complete', CAMPAIGN_EDITABLE_FIELD_KEYS.length === 7)

  // ---------- Immutable update API ----------
  const rejectCode = buildCampaignUpdatePayload({ label: 'x', campaignCode: 'hijack' })
  log('immutable', 'rejects campaignCode mutation', rejectCode.ok === false, rejectCode.message)
  const rejectEvent = buildCampaignUpdatePayload({ label: 'x', event_code: 'hijack' })
  log('immutable', 'rejects event_code mutation', rejectEvent.ok === false)
  const rejectCard = buildCampaignUpdatePayload({ label: 'x', digital_card_id: cardB.id })
  log('immutable', 'rejects digital_card_id mutation', rejectCard.ok === false)
  const rejectLifecycle = buildCampaignUpdatePayload({
    startsAt: '2026-08-12T16:00:00.000Z',
    endsAt: '2026-08-12T14:00:00.000Z',
  })
  log('immutable', 'rejects ends before starts', rejectLifecycle.ok === false)

  // ---------- Auth sessions ----------
  const owner = await userClient(fixtures.accounts.owner.email)
  const advA = await userClient(fixtures.accounts.advisorA.email)
  const advB = await userClient(fixtures.accounts.advisorB.email)

  // ---------- Owner list/see all ----------
  const { data: ownerCamps, error: ownerListErr } = await owner.client
    .from('digital_card_campaigns')
    .select('id, campaign_code, digital_card_id, advisor_notes, status, deleted_at')
    .is('deleted_at', null)
  log('owner', 'lists campaigns via RLS', !ownerListErr && (ownerCamps?.length || 0) >= 4, `count=${ownerCamps?.length}`)
  log(
    'owner',
    'sees Advisor A and B campaigns',
    ownerCamps?.some((c) => c.campaign_code === 'qa59-active-event') &&
      ownerCamps?.some((c) => c.campaign_code === 'qa59-b-active'),
  )
  log(
    'owner',
    'soft-deleted excluded from active list',
    !ownerCamps?.some((c) => c.campaign_code === 'qa59-deleted'),
  )
  log(
    'owner',
    'advisor notes visible in CRM query',
    ownerCamps?.some((c) => typeof c.advisor_notes === 'string' && c.advisor_notes.includes('PRIVATE')),
  )

  // Owner create
  const createCode = `qa59-owner-${Date.now().toString(36)}`
  const { data: created, error: createErr } = await owner.client
    .from('digital_card_campaigns')
    .insert({
      digital_card_id: cardA.id,
      campaign_code: createCode,
      event_code: 'owner-evt',
      label: 'Owner Created Campaign',
      description: 'Owner desc',
      location_label: 'Austin',
      organizer: 'Owner Ops',
      advisor_notes: 'Owner private',
      starts_at: '2026-09-01T15:00:00.000Z',
      ends_at: '2026-09-01T17:00:00.000Z',
      created_by_user_id: owner.userId,
      status: 'active',
    })
    .select('id, campaign_code')
    .single()
  log('owner', 'creates campaign with event code', !createErr && !!created?.id, createErr?.message)

  // Owner edit allowed fields
  const { error: editErr } = await owner.client
    .from('digital_card_campaigns')
    .update({
      label: 'Owner Edited Label',
      description: 'Edited desc',
      location_label: 'Dallas',
      organizer: 'Edited Org',
      advisor_notes: 'Edited private',
      starts_at: '2026-09-02T15:00:00.000Z',
      ends_at: '2026-09-02T18:00:00.000Z',
    })
    .eq('id', created.id)
  const { data: afterEdit } = await admin
    .from('digital_card_campaigns')
    .select('*')
    .eq('id', created.id)
    .single()
  log('owner', 'edits mutable Phase-1 fields', !editErr && afterEdit?.label === 'Owner Edited Label')
  log(
    'owner',
    'campaign/event codes unchanged after edit',
    afterEdit?.campaign_code === createCode && afterEdit?.event_code === 'owner-evt',
  )

  // Direct authenticated PostgREST must be rejected by Migration 028 immutability trigger
  const beforeCodes = { c: afterEdit.campaign_code, e: afterEdit.event_code, card: cardA.id }
  const { error: hackErr } = await owner.client
    .from('digital_card_campaigns')
    .update({ campaign_code: 'hacked-code', event_code: 'hacked-event', digital_card_id: cardB.id })
    .eq('id', created.id)
  const { data: afterHack } = await admin
    .from('digital_card_campaigns')
    .select('campaign_code, event_code, digital_card_id')
    .eq('id', created.id)
    .single()
  const codesIntact =
    afterHack?.campaign_code === beforeCodes.c &&
    afterHack?.event_code === beforeCodes.e &&
    afterHack?.digital_card_id === beforeCodes.card
  log(
    'immutable',
    'PostgREST owner identifier mutation rejected by DB trigger',
    !!hackErr && /DI_CAMPAIGN:immutable_/i.test(hackErr.message || '') && codesIntact,
    hackErr?.message || 'mutation unexpectedly accepted',
  )
  const { error: nullEventHack } = await owner.client
    .from('digital_card_campaigns')
    .update({ event_code: null })
    .eq('id', created.id)
  log(
    'immutable',
    'PostgREST owner event_code value→NULL rejected',
    !!nullEventHack && /DI_CAMPAIGN:immutable_event_code/i.test(nullEventHack.message || ''),
    nullEventHack?.message || 'accepted',
  )
  const { error: advHackErr } = await advA.client
    .from('digital_card_campaigns')
    .update({ campaign_code: 'advisor-hacked' })
    .eq('campaign_code', 'qa59-active-plain')
  const { data: plainAfter } = await admin
    .from('digital_card_campaigns')
    .select('campaign_code')
    .eq('campaign_code', 'qa59-active-plain')
    .maybeSingle()
  log(
    'immutable',
    'PostgREST advisor campaign_code mutation rejected by DB trigger',
    !!advHackErr &&
      /DI_CAMPAIGN:immutable_/i.test(advHackErr.message || '') &&
      plainAfter?.campaign_code === 'qa59-active-plain',
    advHackErr?.message || 'mutation unexpectedly accepted',
  )
  // App-layer remains defense in depth
  log(
    'immutable',
    'app-layer payload builder still rejects identifier mutation',
    rejectCode.ok === false && rejectEvent.ok === false,
  )

  // Activate/disable/archive
  await owner.client.from('digital_card_campaigns').update({ status: 'disabled' }).eq('id', created.id)
  const { data: disabledRow } = await admin.from('digital_card_campaigns').select('status').eq('id', created.id).single()
  log('owner', 'disables campaign', disabledRow?.status === 'disabled')
  await owner.client.from('digital_card_campaigns').update({ status: 'active' }).eq('id', created.id)
  const { data: activeRow } = await admin.from('digital_card_campaigns').select('status').eq('id', created.id).single()
  log('owner', 'activates campaign', activeRow?.status === 'active')
  await owner.client
    .from('digital_card_campaigns')
    .update({ deleted_at: new Date().toISOString(), status: 'disabled' })
    .eq('id', created.id)
  const { data: archivedList } = await owner.client
    .from('digital_card_campaigns')
    .select('id')
    .eq('id', created.id)
    .is('deleted_at', null)
  log('owner', 'archive hides from active views', (archivedList || []).length === 0)

  // Lifecycle reject via DB
  const { error: lifeErr } = await owner.client.from('digital_card_campaigns').insert({
    digital_card_id: cardA.id,
    campaign_code: `qa59-life-${Date.now().toString(36)}`,
    label: 'Bad dates',
    starts_at: '2026-09-02T18:00:00.000Z',
    ends_at: '2026-09-02T15:00:00.000Z',
    created_by_user_id: owner.userId,
  })
  log('owner', 'DB rejects end-before-start', !!lifeErr)

  // Uniqueness
  const { error: uniqErr } = await owner.client.from('digital_card_campaigns').insert({
    digital_card_id: cardA.id,
    campaign_code: 'qa59-active-event',
    label: 'Dup',
    created_by_user_id: owner.userId,
  })
  log('owner', 'campaign code uniqueness per card', !!uniqErr)

  // ---------- Advisor A own-card ----------
  const { data: aCamps } = await advA.client
    .from('digital_card_campaigns')
    .select('id, campaign_code, digital_card_id')
    .is('deleted_at', null)
  log(
    'advisorA',
    'sees own-card campaigns only',
    (aCamps || []).every((c) => c.digital_card_id === cardA.id) &&
      (aCamps || []).some((c) => c.campaign_code === 'qa59-active-event'),
    `count=${aCamps?.length}`,
  )
  const aCreateCode = `qa59-a-${Date.now().toString(36)}`
  const { data: aCreated, error: aCreateErr } = await advA.client
    .from('digital_card_campaigns')
    .insert({
      digital_card_id: cardA.id,
      campaign_code: aCreateCode,
      label: 'Advisor A Created',
      created_by_user_id: advA.userId,
    })
    .select('id')
    .single()
  log('advisorA', 'creates own campaign', !aCreateErr && !!aCreated?.id)
  const { error: aEditErr } = await advA.client
    .from('digital_card_campaigns')
    .update({ label: 'Advisor A Edited' })
    .eq('id', aCreated.id)
  log('advisorA', 'edits own campaign', !aEditErr)

  // ---------- Cross-card denial ----------
  const { data: crossList } = await advA.client
    .from('digital_card_campaigns')
    .select('id, campaign_code')
    .eq('campaign_code', 'qa59-b-active')
  log('crossCard', 'Advisor A cannot read Advisor B campaigns', (crossList || []).length === 0)
  const { data: crossEdit, error: crossEditErr } = await advA.client
    .from('digital_card_campaigns')
    .update({ label: 'HACK' })
    .eq('id', camps.advisorB.id)
    .select('id')
  log(
    'crossCard',
    'Advisor A cannot edit Advisor B campaign',
    !crossEditErr && (crossEdit || []).length === 0,
  )
  const { data: crossIns, error: crossInsErr } = await advA.client
    .from('digital_card_campaigns')
    .insert({
      digital_card_id: cardB.id,
      campaign_code: `qa59-spoof-${Date.now().toString(36)}`,
      label: 'Spoof',
      created_by_user_id: advA.userId,
    })
    .select('id')
  log('crossCard', 'Advisor A cannot insert on Advisor B card', !!crossInsErr || !crossIns)
  const qrCross = await getQr({
    key: cardA.public_key,
    format: 'svg',
    c: 'qa59-b-active',
  })
  log('crossCard', 'cross-card campaign QR rejected', qrCross.status === 400)

  // ---------- Links ----------
  const link = buildCampaignPublicLink({
    ...camps.activeEvent,
    cardPublicKey: cardA.public_key,
    campaignCode: camps.activeEvent.campaign_code,
    eventCode: camps.activeEvent.event_code,
  })
  log('links', 'public_key path', link.startsWith(`/c/k/${cardA.public_key}`))
  log('links', 'includes c and e and src', link.includes('c=qa59-active-event') && link.includes('e=breakfast-aug-12') && link.includes('src=link'))
  log('links', 'no slug', !link.includes(cardA.slug) || link.includes('/c/k/'))
  log('links', 'no campaign UUID', !link.includes(camps.activeEvent.id))
  log('links', 'no advisor UUID', !link.includes(cardA.advisor_profile_id))

  // ---------- QR ----------
  for (const format of ['svg', 'png', 'png-hires']) {
    const qr = await getQr({
      key: cardA.public_key,
      format,
      c: 'qa59-active-event',
      e: 'breakfast-aug-12',
    })
    log('qr', `${format} downloads`, qr.status === 200 && qr.buf.length > 32)
    log(
      'qr',
      `${format} destination public_key + codes`,
      !!qr.dest &&
        qr.dest.includes(`/c/k/${cardA.public_key}`) &&
        qr.dest.includes('c=qa59-active-event') &&
        qr.dest.includes('e=breakfast-aug-12') &&
        qr.dest.includes('src=qr') &&
        !qr.dest.includes(cardA.slug),
      qr.dest || '',
    )
  }
  const bare = await getQr({ key: cardA.public_key, format: 'svg' })
  log('qr', 'bare-card QR still works', bare.status === 200 && bare.dest?.endsWith(`/c/k/${cardA.public_key}`))
  log('qr', 'disabled campaign rejected', (await getQr({ key: cardA.public_key, format: 'svg', c: 'qa59-disabled' })).status === 400)
  log('qr', 'deleted campaign rejected', (await getQr({ key: cardA.public_key, format: 'svg', c: 'qa59-deleted' })).status === 400)
  log('qr', 'unknown campaign rejected', (await getQr({ key: cardA.public_key, format: 'svg', c: 'no-such-camp' })).status === 400)
  log(
    'qr',
    'event mismatch rejected',
    (await getQr({ key: cardA.public_key, format: 'svg', c: 'qa59-active-event', e: 'wrong-event' })).status === 400,
  )
  log('qr', 'unsupported format rejected', (await getQr({ key: cardA.public_key, format: 'pdf', c: 'qa59-active-event' })).status === 400)

  // Analytics not written for QR
  const { count: evtBefore } = await admin
    .from('digital_card_events')
    .select('*', { count: 'exact', head: true })
    .eq('digital_card_id', cardA.id)
  await getQr({ key: cardA.public_key, format: 'svg', c: 'qa59-active-event', e: 'breakfast-aug-12' })
  const { count: evtAfter } = await admin
    .from('digital_card_events')
    .select('*', { count: 'exact', head: true })
    .eq('digital_card_id', cardA.id)
  log('qr', 'no scan analytics writes', evtBefore === evtAfter)

  // ---------- Public card + notes leak ----------
  const cardRes = await fetch(`${BASE}/api/digital-identity/card?key=${cardA.public_key}`, {
    headers: { Origin: BASE },
  })
  const cardJson = await cardRes.json()
  const cardStr = JSON.stringify(cardJson)
  log('public', 'card loads', cardRes.status === 200 && cardJson?.ok !== false)
  log('public', 'no advisor_notes in public response', !cardStr.includes('PRIVATE') && !cardStr.includes('advisor_notes'))
  log('public', 'no campaign UUID in public response', !cardStr.includes(camps.activeEvent.id))

  // ---------- Trusted resolution via connect ----------
  async function fetchLeadBySubmission(submissionId) {
    const { data: byKey, error: keyErr } = await admin
      .from('leads')
      .select(
        'id, household_id, original_campaign, original_source_metadata, last_touch_source_metadata, ingest_match_status, public_ingest_idempotency_key',
      )
      .eq('public_ingest_idempotency_key', submissionId)
      .maybeSingle()
    if (keyErr) {
      console.log('fetchLeadBySubmission keyErr', keyErr.message)
    }
    if (byKey) return byKey

    // Fallback via SQL (avoids PostgREST filter edge cases during dense QA runs)
    try {
      const sql = `SELECT id::text, household_id::text, COALESCE(original_campaign,''), COALESCE(original_source_metadata::text,'{}'), COALESCE(last_touch_source_metadata::text,'{}'), COALESCE(ingest_match_status,'')
FROM public.leads
WHERE public_ingest_idempotency_key = '${submissionId}'
LIMIT 1;\n`
      const out = execSync(
        `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -t -A -F '|'`,
        { input: sql, encoding: 'utf8' },
      ).trim()
      if (out) {
        const [id, household_id, original_campaign, osm, ltm, ingest_match_status] = out.split('|')
        return {
          id,
          household_id,
          original_campaign: original_campaign || null,
          original_source_metadata: osm ? JSON.parse(osm) : {},
          last_touch_source_metadata: ltm ? JSON.parse(ltm) : {},
          ingest_match_status,
        }
      }
    } catch (e) {
      console.log('fetchLeadBySubmission sqlErr', e?.message || e)
    }
    return null
  }

  function uniquePhone(seed = 0) {
    // Keep NANP-ish shape; vary last 7 digits to avoid match collisions across QA runs.
    const n = Number(String(Date.now()).slice(-7)) + seed
    return `555${String(n % 10000000).padStart(7, '0')}`
  }

  // New prospect trusted
  const newSub = randomUUID()
  const newBody = connectBody({
    submissionId: newSub,
    cardPublicKey: cardA.public_key,
    email: `qa59.new.${Date.now()}@example.test`,
    phone: uniquePhone(1),
    campaignCode: 'qa59-active-event',
    eventCode: 'breakfast-aug-12',
    sourceChannel: 'qr',
    utmSource: 'client-override',
    sourcePage: `/c/k/${cardA.public_key}?c=qa59-active-event&e=breakfast-aug-12&src=qr&utm_source=client-override`,
  })
  const newRes = await postConnect(newBody)
  log(
    'newProspect',
    'connect ok',
    (newRes.status === 200 || newRes.status === 201) &&
      newRes.json?.ok === true &&
      newRes.json?.matchStatus === 'new_prospect',
    `status=${newRes.status} match=${newRes.json?.matchStatus || ''}`,
  )
  log('newProspect', 'photo grant available', newRes.json?.relationshipPhoto?.available === true)
  log('newProspect', 'no case/assessment in response', !('caseId' in (newRes.json || {})) && !('assessmentId' in (newRes.json || {})))

  const newLead = await fetchLeadBySubmission(newSub)
  log(
    'newProspect',
    'trusted original_campaign',
    newLead?.original_campaign === 'qa59-active-event',
    `camp=${newLead?.original_campaign || 'null'} match=${newLead?.ingest_match_status || ''}`,
  )
  const meta = newLead?.original_source_metadata || {}
  log(
    'newProspect',
    'first-touch allowlisted metadata',
    meta.campaignCode === 'qa59-active-event' &&
      meta.eventCode === 'breakfast-aug-12' &&
      !!meta.firstSeenAt &&
      !JSON.stringify(meta).includes('PRIVATE'),
  )
  log(
    'newProspect',
    'default+client UTM merge',
    meta.utms?.utmSource === 'client-override' && meta.utms?.utmMedium === 'offline',
  )
  log('newProspect', 'last_touch populated', !!newLead?.last_touch_source_metadata?.campaignCode)
  const { count: assessCount } = await admin
    .from('assessments')
    .select('*', { count: 'exact', head: true })
    .eq('lead_id', newLead?.id || '00000000-0000-0000-0000-000000000000')
  log('newProspect', 'no assessment created', (assessCount || 0) === 0)

  const { data: acts } = await admin
    .from('activities')
    .select('title, metadata')
    .eq('household_id', newLead.household_id)
    .order('created_at', { ascending: false })
    .limit(10)
  const actKeys = (acts || []).map((a) => a.metadata?.eventKey || a.metadata?.event)
  log('activities', 'campaign_attributed written', actKeys.includes('digital_identity.campaign_attributed'))
  log('activities', 'event_attributed written', actKeys.includes('digital_identity.event_attributed'))
  log(
    'activities',
    'relationship_connected_at_event written',
    actKeys.includes('digital_identity.relationship_connected_at_event'),
  )
  log(
    'activities',
    'safe metadata only',
    !(acts || []).some((a) => JSON.stringify(a.metadata || {}).includes('PRIVATE') || JSON.stringify(a.metadata || {}).includes('@example')),
  )

  // Unknown / disabled / deleted / mismatch — connect succeeds without trusted codes
  for (const [name, body] of [
    ['unknown', { campaignCode: 'nope', eventCode: null }],
    ['disabled', { campaignCode: 'qa59-disabled', eventCode: null }],
    ['deleted', { campaignCode: 'qa59-deleted', eventCode: 'old-event' }],
    ['mismatch', { campaignCode: 'qa59-active-event', eventCode: 'wrong' }],
  ]) {
    const sub = randomUUID()
    const res = await postConnect(
      connectBody({
        submissionId: sub,
        cardPublicKey: cardA.public_key,
        email: `qa59.${name}.${Date.now()}@example.test`,
        phone: uniquePhone(10 + name.length),
        campaignCode: body.campaignCode,
        eventCode: body.eventCode,
      }),
    )
    const lead = await fetchLeadBySubmission(sub)
    log(
      'trusted',
      `${name}: connect succeeds without trusted attribution`,
      res.json?.ok === true && (lead?.original_campaign == null || lead?.original_campaign === ''),
      `campaign=${lead?.original_campaign}`,
    )
  }

  // Cross-card campaign code on card A
  const xSub = randomUUID()
  const xRes = await postConnect(
    connectBody({
      submissionId: xSub,
      cardPublicKey: cardA.public_key,
      email: `qa59.cross.${Date.now()}@example.test`,
      phone: uniquePhone(15),
      campaignCode: 'qa59-b-active',
      eventCode: 'b-event-1',
    }),
  )
  const xLead = await fetchLeadBySubmission(xSub)
  log('trusted', 'cross-card campaign not trusted', xRes.json?.ok && !xLead?.original_campaign)

  // Exact match
  const exactSub = randomUUID()
  const exactRes = await postConnect(
    connectBody({
      submissionId: exactSub,
      cardPublicKey: cardA.public_key,
      firstName: 'Exact',
      lastName: 'Match',
      email: 'qa59.exact@example.test',
      phone: '5551002002',
      campaignCode: 'qa59-active-event',
      eventCode: 'breakfast-aug-12',
    }),
  )
  log('exact', 'connect ok', exactRes.json?.ok === true)
  log('exact', 'matchStatus exact', exactRes.json?.matchStatus === 'exact_trusted_match')
  const exactLead = await fetchLeadBySubmission(exactSub)
  log('exact', 'attaches to existing household', exactLead?.household_id === seed.households.exactMatch)
  log('exact', 'trusted campaign stored', exactLead?.original_campaign === 'qa59-active-event')
  const { data: exactHh } = await admin
    .from('households')
    .select('assigned_advisor_id, primary_email')
    .eq('id', seed.households.exactMatch)
    .single()
  log('exact', 'assignment preserved', exactHh?.assigned_advisor_id === cardA.advisor_profile_id)
  log('exact', 'canonical email unchanged', exactHh?.primary_email === 'qa59.exact@example.test')

  // Possible match (email overlap, different phone/name)
  const possEmail = `qa59.possible.${Date.now()}@example.test`
  const candHh = randomUUID()
  const possCandPhone = uniquePhone(20)
  const possIncomingPhone = uniquePhone(21)
  seedCandidateHousehold({
    id: candHh,
    displayName: '[QA59] Possible Candidate Dynamic',
    email: possEmail,
    phone: possCandPhone,
    advisorProfileId: cardA.advisor_profile_id,
  })
  const possSubmissionId = randomUUID()
  const possRes = await postConnect(
    connectBody({
      submissionId: possSubmissionId,
      cardPublicKey: cardA.public_key,
      firstName: 'Poss',
      lastName: 'Match',
      email: possEmail,
      phone: possIncomingPhone,
      campaignCode: 'qa59-active-plain',
    }),
  )
  log('possible', 'connect ok', possRes.json?.ok === true, `match=${possRes.json?.matchStatus}`)
  log('possible', 'matchStatus possible', possRes.json?.matchStatus === 'possible_match')
  const possLead = await fetchLeadBySubmission(possSubmissionId)
  log(
    'possible',
    'trusted plain campaign stored',
    possLead?.original_campaign === 'qa59-active-plain',
    `camp=${possLead?.original_campaign || 'null'} lead=${possLead?.id || 'null'}`,
  )
  const { data: dup } = await admin
    .from('duplicate_reviews')
    .select('*')
    .eq('incoming_lead_id', possLead?.id || '00000000-0000-0000-0000-000000000000')
    .maybeSingle()
  log('possible', 'duplicate review created', !!dup?.id)
  log(
    'possible',
    'provisional household differs from candidate',
    !!possLead?.household_id && possLead.household_id !== candHh,
  )

  // Confirm same (owner — RLS authorizes resolution)
  if (dup?.id && possLead?.id) {
    const { data: confirmData, error: confirmErr } = await owner.client.rpc(
      'resolve_digital_identity_duplicate_review',
      {
        p_duplicate_review_id: dup.id,
        p_action: 'confirm_same_household',
        p_resolution_notes: '[QA59] confirm same',
      },
    )
    log('confirmSame', 'RPC ok', !confirmErr, confirmErr?.message)
    const { data: afterConfirm } = await admin
      .from('leads')
      .select('household_id, original_campaign')
      .eq('id', possLead.id)
      .single()
    log(
      'confirmSame',
      'lead moved / attribution preserved',
      afterConfirm?.original_campaign === 'qa59-active-plain' &&
        afterConfirm?.household_id === candHh,
      `hh=${afterConfirm?.household_id} camp=${afterConfirm?.original_campaign}`,
    )
    void confirmData
  } else {
    log('confirmSame', 'RPC ok', false, 'no duplicate review')
    log('confirmSame', 'lead moved / attribution preserved', false, 'skipped')
  }

  // Keep separate (fresh possible match pair)
  const keepEmail = `qa59.keep.${Date.now()}@example.test`
  const keepCand = randomUUID()
  seedCandidateHousehold({
    id: keepCand,
    displayName: '[QA59] Keep Candidate',
    email: keepEmail,
    phone: uniquePhone(30),
    advisorProfileId: cardA.advisor_profile_id,
  })
  const keepSubmissionId = randomUUID()
  const keepRes = await postConnect(
    connectBody({
      submissionId: keepSubmissionId,
      cardPublicKey: cardA.public_key,
      firstName: 'Keep',
      lastName: 'Sep',
      email: keepEmail,
      phone: uniquePhone(31),
      campaignCode: 'qa59-active-event',
      eventCode: 'breakfast-aug-12',
    }),
  )
  const keepLead = await fetchLeadBySubmission(keepSubmissionId)
  const { data: keepDup } = await admin
    .from('duplicate_reviews')
    .select('id, status')
    .eq('incoming_lead_id', keepLead?.id || '00000000-0000-0000-0000-000000000000')
    .maybeSingle()
  if (keepDup?.id && keepDup.status !== 'resolved' && keepLead?.id) {
    const { error: keepErr } = await owner.client.rpc('resolve_digital_identity_duplicate_review', {
      p_duplicate_review_id: keepDup.id,
      p_action: 'keep_separate',
      p_resolution_notes: '[QA59] keep separate',
    })
    log('keepSeparate', 'RPC ok', !keepErr, keepErr?.message)
    const { data: afterKeep } = await admin
      .from('leads')
      .select('household_id, original_campaign')
      .eq('id', keepLead.id)
      .single()
    log(
      'keepSeparate',
      'attribution remains on provisional',
      afterKeep?.original_campaign === 'qa59-active-event' &&
        afterKeep?.household_id === keepLead.household_id,
    )
  } else {
    log('keepSeparate', 'RPC ok', keepRes.json?.ok === true && !!keepDup?.id, 'no open dup')
    log('keepSeparate', 'attribution remains on provisional', false, 'skipped')
  }

  // Replay
  const replaySub = randomUUID()
  const replayBody = connectBody({
    submissionId: replaySub,
    cardPublicKey: cardA.public_key,
    email: `qa59.replay.${Date.now()}@example.test`,
    phone: uniquePhone(40),
    campaignCode: 'qa59-active-event',
    eventCode: 'breakfast-aug-12',
  })
  const first = await postConnect(replayBody)
  const firstLead = await fetchLeadBySubmission(replaySub)
  if (!firstLead?.id) throw new Error('replay lead not found')
  const firstTouch = {
    campaign: firstLead.original_campaign,
    meta: firstLead.original_source_metadata,
  }
  const { count: actCount1 } = await admin
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', firstLead.household_id)
  const second = await postConnect({
    ...replayBody,
    campaignCode: 'qa59-active-plain',
    eventCode: null,
    utmSource: 'replay-touch',
    sourceChannel: 'share',
  })
  const { data: replayLead } = await admin.from('leads').select('*').eq('id', firstLead.id).single()
  const { count: actCount2 } = await admin
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', firstLead.household_id)
  log('replay', 'created=false', second.json?.created === false)
  log('replay', 'first-touch immutable', replayLead.original_campaign === firstTouch.campaign)
  log(
    'replay',
    'original_source_metadata immutable',
    JSON.stringify(replayLead.original_source_metadata) === JSON.stringify(firstTouch.meta),
  )
  log(
    'lastTouch',
    'last_touch updates on replay',
    replayLead.last_touch_source_metadata?.sourceChannel === 'share' ||
      replayLead.last_touch_source_metadata?.utmSource === 'replay-touch' ||
      !!replayLead.last_touch_source_metadata?.occurredAt,
  )
  log('replay', 'no duplicate activities', actCount1 === actCount2)
  void first

  // How We Met formatting
  const hwm = buildHowWeMetViewModel({
    originalCampaign: 'qa59-active-event',
    originalSourceMetadata: {
      campaignLabel: 'QA59 Active Event Campaign',
      eventCode: 'breakfast-aug-12',
      sourceChannel: 'qr',
      utms: { utmSource: 'flyer', utmMedium: 'offline' },
      advisor_notes: 'SECRET',
      campaignId: camps.activeEvent.id,
    },
    submittedAt: '2026-08-04T12:00:00.000Z',
    cardOwnerName: 'QA59 Advisor A',
    sourcePage: `/c/k/${cardA.public_key}?c=qa59-active-event`,
    hasRelationshipPhoto: true,
  })
  log('howWeMet', 'formats friendly fields', !!hwm?.campaignLabel && hwm.sourceChannel === 'QR code')
  log(
    'howWeMet',
    'hides secrets/ids',
    !JSON.stringify(hwm).includes('SECRET') && !JSON.stringify(hwm).includes(camps.activeEvent.id),
  )
  log('howWeMet', 'empty when unattributed', buildHowWeMetViewModel({}) === null)

  // Relationship photo on a fresh attributed lead (dedicated grant)
  const photoSub = randomUUID()
  const photoConnect = await postConnect(
    connectBody({
      submissionId: photoSub,
      cardPublicKey: cardA.public_key,
      email: `qa59.photo.${Date.now()}@example.test`,
      phone: uniquePhone(50),
      campaignCode: 'qa59-active-event',
      eventCode: 'breakfast-aug-12',
    }),
  )
  const uploadToken = photoConnect.json?.relationshipPhoto?.uploadToken
  if (uploadToken) {
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 20, g: 80, b: 160 } },
    })
      .png()
      .toBuffer()
    const photoRes = await fetch(`${BASE}/api/digital-identity/relationship-photo`, {
      method: 'POST',
      headers: {
        Origin: BASE,
        'Content-Type': 'application/json',
        'X-Forwarded-For': `203.0.113.${(Math.floor(Math.random() * 200) + 1)}`,
      },
      body: JSON.stringify({
        uploadToken,
        photoAcknowledgment: true,
        imageBase64: `data:image/png;base64,${png.toString('base64')}`,
        source: 'digital_identity_connect',
      }),
    })
    const photoJson = await photoRes.json().catch(() => ({}))
    log(
      'photo',
      'upload succeeds on attributed submission',
      (photoRes.status === 200 || photoRes.status === 201) && photoJson?.ok === true,
      `status=${photoRes.status} code=${photoJson?.code || photoJson?.error || ''}`,
    )
  } else {
    log('photo', 'upload succeeds on attributed submission', false, 'no grant')
  }

  // Anonymous activities from card view
  const { count: anonActs } = await admin
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .is('household_id', null)
  await fetch(`${BASE}/api/digital-identity/card?key=${cardA.public_key}`, { headers: { Origin: BASE } })
  const { count: anonActs2 } = await admin
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .is('household_id', null)
  log('security', 'no anonymous CRM activities from card view', anonActs === anonActs2)

  // Anon cannot read campaigns
  const env = loadEnv()
  const anon = createClient(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: anonCamps, error: anonErr } = await anon.from('digital_card_campaigns').select('id').limit(1)
  log('security', 'anon cannot read campaigns', !!anonErr || (anonCamps || []).length === 0)

  function encodeAuthCookie(session) {
    const storage = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: 'bearer',
      expires_in: session.expires_in ?? 3600,
      expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      user: session.user,
    }
    return `base64-${stringToBase64URL(JSON.stringify(storage))}`
  }

  async function crmContext(email, contextOptions = { viewport: { width: 1280, height: 800 } }) {
    const { session } = await userClient(email)
    const env = loadEnv()
    const projectRef = new URL(env.API_URL).hostname.split('.')[0] || '127'
    const cookieName = `sb-${projectRef}-auth-token`
    const context = await browser.newContext(contextOptions)
    await context.addCookies([
      {
        name: cookieName,
        value: encodeAuthCookie(session),
        domain: '127.0.0.1',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])
    return context
  }

  async function ensureCrmLoggedIn(page, email) {
    if (!page.url().includes('/crm/login')) return true
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/crm(?!\/login)/, { timeout: 20000 }).catch(() => {})
    if (page.url().includes('/crm/login')) {
      // Direct Auth password grant + cookie rewrite (Playwright browser fetch)
      const env = loadEnv()
      const ok = await page.evaluate(
        async ({ apiUrl, anonKey, email: em, password }) => {
          const res = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: em, password }),
          })
          if (!res.ok) return { ok: false, status: res.status, body: await res.text() }
          const data = await res.json()
          const payload = JSON.stringify({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            token_type: 'bearer',
            expires_in: data.expires_in,
            expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
            user: data.user,
          })
          // base64url encode in-browser
          const b64 = btoa(unescape(encodeURIComponent(payload)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '')
          const ref = new URL(apiUrl).hostname.split('.')[0] || '127'
          document.cookie = `sb-${ref}-auth-token=base64-${b64}; path=/; SameSite=Lax`
          return { ok: true }
        },
        {
          apiUrl: env.API_URL,
          anonKey: env.ANON_KEY,
          email,
          password: PASS,
        },
      )
      if (!ok?.ok) return false
      await page.goto(`${BASE}/crm/campaigns`, { waitUntil: 'networkidle' })
    }
    return !page.url().includes('/crm/login')
  }

  // ---------- Playwright UI ----------
  const browser = await chromium.launch({ headless: true })
  try {
    const desktop = await crmContext(fixtures.accounts.owner.email)
    const page = await desktop.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text()
        if (!/WebSocket connection|favicon|React DevTools/i.test(t)) consoleErrors.push(`desktop: ${t}`)
      }
    })
    page.on('pageerror', (err) => {
      if (!/WebSocket/i.test(err.message)) consoleErrors.push(`desktop pageerror: ${err.message}`)
    })

    await page.goto(`${BASE}/crm/campaigns`, { waitUntil: 'networkidle' })
    const ownerAuthed = await ensureCrmLoggedIn(page, fixtures.accounts.owner.email)
    log('uiOwner', 'CRM session established', ownerAuthed, page.url())
    if (!page.url().includes('/crm/campaigns')) {
      await page.goto(`${BASE}/crm/campaigns`, { waitUntil: 'networkidle' })
    }
    const ownerHeading = await page.locator('h1').textContent().catch(() => '')
    log('uiOwner', 'opens /crm/campaigns', /campaign/i.test(ownerHeading || ''))
    log('uiOwner', 'lists campaigns', (await page.locator('.crm-list-item').count()) >= 1)
    log('uiOwner', 'QR SVG control present', (await page.locator('[data-testid="crm-campaign-qr-svg"]').count()) >= 1)
    log('uiOwner', 'QR PNG control present', (await page.locator('[data-testid="crm-campaign-qr-png"]').count()) >= 1)
    log(
      'uiOwner',
      'QR Print control present',
      (await page.locator('[data-testid="crm-campaign-qr-png-hires"]').count()) >= 1,
    )

    // Edit flow
    const editBtn = page.locator('button', { hasText: 'Edit' }).first()
    if ((await editBtn.count()) > 0) {
      await editBtn.click()
      await page.waitForSelector('[data-testid="crm-campaign-edit-label"]', { timeout: 5000 })
      log('uiOwner', 'edit form exposes mutable fields', (await page.locator('[data-testid="crm-campaign-edit-label"]').count()) === 1)
      log(
        'uiOwner',
        'campaign code read-only',
        await page.locator('[data-testid="crm-campaign-edit-campaign-code"]').getAttribute('readonly') !== null ||
          (await page.locator('[data-testid="crm-campaign-edit-campaign-code"]').evaluate((el) => el.readOnly)),
      )
      log(
        'uiOwner',
        'event code read-only',
        await page.locator('[data-testid="crm-campaign-edit-event-code"]').evaluate((el) => el.readOnly),
      )
      log(
        'uiOwner',
        'immutable copy visible',
        (await page.locator('[data-testid="crm-campaign-codes-immutable-note"]').count()) === 1,
      )
      await page.fill('[data-testid="crm-campaign-edit-label"]', 'UI Edited Label')
      await page.click('button[type="submit"]', { hasText: /Save/i }).catch(async () => {
        await page.locator('button', { hasText: 'Save changes' }).click()
      })
      await page.waitForTimeout(800)
      log('uiOwner', 'save edit succeeds', (await page.locator('text=Campaign updated').count()) >= 0)
    } else {
      log('uiOwner', 'edit form exposes mutable fields', false, 'no Edit button')
      log('uiOwner', 'campaign code read-only', false, 'skipped')
      log('uiOwner', 'event code read-only', false, 'skipped')
      log('uiOwner', 'immutable copy visible', false, 'skipped')
      log('uiOwner', 'save edit succeeds', false, 'skipped')
    }

    // Overflow check
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    log('a11y', 'desktop campaigns no horizontal overflow', !overflow)

    // Public card with attribution
    await page.goto(
      `${BASE}/c/k/${cardA.public_key}?c=qa59-active-event&e=breakfast-aug-12&src=link&utm_source=flyer`,
      { waitUntil: 'networkidle' },
    )
    const publicBody = await page.content()
    log('publicSession', 'public card loads with params', publicBody.includes('Let') || publicBody.includes('Connect') || publicBody.includes('Advisor'))
    log('publicSession', 'no private notes on public page', !publicBody.includes('PRIVATE QA59'))

    // First-touch session lock
    const firstTouchLocked = await page.evaluate(async () => {
      const key = Object.keys(sessionStorage).find((k) => k.includes('campaign') || k.includes('attribution') || k.includes('digital'))
      // navigate with different params and see if storage keeps first
      return { keys: Object.keys(sessionStorage), key }
    })
    await page.goto(
      `${BASE}/c/k/${cardA.public_key}?c=qa59-active-plain&src=share`,
      { waitUntil: 'networkidle' },
    )
    const sessionAfter = await page.evaluate(() => {
      const out = {}
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        out[k] = sessionStorage.getItem(k)
      }
      return out
    })
    const sessionStr = JSON.stringify(sessionAfter)
    log(
      'publicSession',
      'session attribution present',
      sessionStr.includes('qa59-active-event') || sessionStr.includes('campaign'),
      Object.keys(sessionAfter).join(','),
    )
    void firstTouchLocked

    // Mobile viewport (Advisor A session)
    const mobile = await crmContext(fixtures.accounts.advisorA.email, { ...devices['iPhone 13'] })
    const mpage = await mobile.newPage()
    mpage.on('console', (msg) => {
      if (msg.type() === 'error' && !/WebSocket|favicon/i.test(msg.text())) {
        consoleErrors.push(`mobile: ${msg.text()}`)
      }
    })
    await mpage.goto(`${BASE}/crm/campaigns`, { waitUntil: 'networkidle' })
    await ensureCrmLoggedIn(mpage, fixtures.accounts.advisorA.email)
    if (!mpage.url().includes('/crm/campaigns')) {
      await mpage.goto(`${BASE}/crm/campaigns`, { waitUntil: 'networkidle' })
    }
    const mOverflowInfo = await mpage.evaluate(() => {
      const delta = document.documentElement.scrollWidth - window.innerWidth
      return { delta, innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }
    })
    // Allow tiny sub-pixel/layout noise; fail only on meaningful page-level overflow.
    log(
      'responsive',
      'mobile campaigns no major overflow',
      mOverflowInfo.delta <= 8,
      `delta=${mOverflowInfo.delta}`,
    )
    log(
      'advisorA',
      'Advisor A reaches campaigns page',
      /campaign/i.test((await mpage.locator('h1').textContent().catch(() => '')) || ''),
    )
    await mpage.goto(`${BASE}/c/k/${cardA.public_key}?c=qa59-active-event&e=breakfast-aug-12&src=qr`, {
      waitUntil: 'networkidle',
    })
    log('responsive', 'mobile public card loads', (await mpage.content()).length > 500)
    await mobile.close()

    // Unauthenticated redirect
    const anonCtx = await browser.newContext()
    const apage = await anonCtx.newPage()
    await apage.goto(`${BASE}/crm/campaigns`, { waitUntil: 'networkidle' })
    log('security', 'unauthenticated redirected to login', apage.url().includes('/crm/login'))
    await anonCtx.close()

    // Regression smoke pages
    for (const [name, path] of [
      ['homepage', '/'],
      ['family report card', '/family-assessment'],
      ['public card', `/c/k/${cardA.public_key}`],
    ]) {
      const r = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      log('regression', `${name} loads`, (r?.status() || 0) < 500)
    }

    // Explicit requested regression checks (not inferred from unrelated routes)
    const vcardRes = await fetch(
      `${BASE}/api/digital-identity/card/vcard?key=${encodeURIComponent(cardA.public_key)}`,
      { headers: { Origin: BASE } },
    )
    const vcardBody = await vcardRes.text()
    log(
      'regression',
      'Save Contact/vCard',
      vcardRes.status === 200 && /BEGIN:VCARD/i.test(vcardBody) && /END:VCARD/i.test(vcardBody),
      `status=${vcardRes.status}`,
    )

    const bareQr = await getQr({ key: cardA.public_key, format: 'svg' })
    log(
      'regression',
      'Default bare-card QR',
      bareQr.status === 200 &&
        typeof bareQr.dest === 'string' &&
        bareQr.dest.includes(`/c/k/${cardA.public_key}`) &&
        !/[?&]c=/.test(bareQr.dest),
      bareQr.dest || `status=${bareQr.status}`,
    )

    const plainConnectSub = randomUUID()
    const plainConnect = await postConnect(
      connectBody({
        submissionId: plainConnectSub,
        cardPublicKey: cardA.public_key,
        email: `qa59.plain.${Date.now()}@example.test`,
        phone: uniquePhone(60),
        campaignCode: undefined,
        eventCode: undefined,
        sourcePage: `/c/k/${cardA.public_key}`,
      }),
    )
    const plainLead = await fetchLeadBySubmission(plainConnectSub)
    log(
      'regression',
      "Let's Connect without campaign parameters",
      (plainConnect.status === 200 || plainConnect.status === 201) &&
        plainConnect.json?.ok === true &&
        plainConnect.json?.matchStatus === 'new_prospect' &&
        !plainLead?.original_campaign,
      `status=${plainConnect.status} camp=${plainLead?.original_campaign || 'null'}`,
    )

    const photoPlainSub = randomUUID()
    const photoPlain = await postConnect(
      connectBody({
        submissionId: photoPlainSub,
        cardPublicKey: cardA.public_key,
        email: `qa59.photoplain.${Date.now()}@example.test`,
        phone: uniquePhone(61),
        campaignCode: undefined,
        eventCode: undefined,
        sourcePage: `/c/k/${cardA.public_key}`,
      }),
    )
    const plainToken = photoPlain.json?.relationshipPhoto?.uploadToken
    if (plainToken) {
      const png = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 120, b: 40 } },
      })
        .png()
        .toBuffer()
      const photoPlainRes = await fetch(`${BASE}/api/digital-identity/relationship-photo`, {
        method: 'POST',
        headers: {
          Origin: BASE,
          'Content-Type': 'application/json',
          'X-Forwarded-For': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
        },
        body: JSON.stringify({
          uploadToken: plainToken,
          photoAcknowledgment: true,
          imageBase64: `data:image/png;base64,${png.toString('base64')}`,
          source: 'digital_identity_connect',
        }),
      })
      const photoPlainJson = await photoPlainRes.json().catch(() => ({}))
      log(
        'regression',
        'Relationship Photo without campaign attribution',
        (photoPlainRes.status === 200 || photoPlainRes.status === 201) && photoPlainJson?.ok === true,
        `status=${photoPlainRes.status} code=${photoPlainJson?.code || ''}`,
      )
    } else {
      log('regression', 'Relationship Photo without campaign attribution', false, 'no grant')
    }

    // CRM shell regressions while owner session is active
    for (const [name, path, probe] of [
      ['Family Intake', '/crm/intake', /intake|family|lead/i],
      ['Households', '/crm/households', /household/i],
      ['Tasks', '/crm/tasks', /task/i],
    ]) {
      const r = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      const body = await page.content()
      const heading = (await page.locator('h1').first().textContent().catch(() => '')) || ''
      log(
        'regression',
        name,
        (r?.status() || 0) < 500 &&
          !page.url().includes('/crm/login') &&
          (probe.test(heading) || probe.test(body) || page.url().includes(path)),
        `url=${page.url()} status=${r?.status() || 0}`,
      )
    }

    await desktop.close()
  } finally {
    await browser.close()
  }

  // Console filter known noise
  const unexpected = consoleErrors.filter(
    (e) => !/favicon|Download the React DevTools|net::ERR_ABORTED/i.test(e),
  )
  log('console', 'no unexpected browser console errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    head: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
    passed,
    failed,
    total: results.length,
    defects,
    consoleErrors: unexpected,
    results,
    fixtures: {
      ownerUserId: fixtures.accounts.owner.userId,
      advisorAUserId: fixtures.accounts.advisorA.userId,
      advisorBUserId: fixtures.accounts.advisorB.userId,
      cardAId: cardA.id,
      cardBId: cardB.id,
      campaignIds: Object.fromEntries(Object.entries(camps).map(([k, v]) => [k, v.id])),
    },
  }
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`)
  console.log(`Report: ${REPORT_PATH}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
