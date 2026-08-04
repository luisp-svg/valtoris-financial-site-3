/**
 * Sprint 5.9 local QA seed (NOT a migration).
 * Requires scripts/qa/sprint-59-bootstrap-auth.mjs first.
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const FIXTURE_PATH = process.env.QA59_FIXTURE_PATH || '/tmp/sprint-59-fixture-ids.json'
const PIPELINE = '22222222-2222-2222-2222-222222222201'
const STAGE = '33333333-3333-3333-3333-333333333001'
const NOW = '2026-08-04T12:00:00.000Z'

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
  return env
}

function psql(sql) {
  execSync(
    `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -v ON_ERROR_STOP=1`,
    { input: sql, stdio: ['pipe', 'pipe', 'inherit'] },
  )
}

async function main() {
  const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const a = fixtures.accounts.advisorA.advisorProfileId
  const b = fixtures.accounts.advisorB.advisorProfileId
  const ownerId = fixtures.accounts.owner.userId
  if (!a || !b || !ownerId) throw new Error('Missing fixture advisor/owner IDs')

  psql(`
SET session_replication_role = replica;
DELETE FROM public.digital_identity_photo_upload_grants
WHERE lead_id IN (SELECT id FROM public.leads WHERE source_page LIKE '/qa-sprint-59%' OR lead_type = 'Digital Identity')
   OR household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA59]%');
DELETE FROM public.documents
WHERE household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA59]%')
   OR lead_id IN (SELECT id FROM public.leads WHERE source_page LIKE '/qa-sprint-59%');
DELETE FROM public.tasks
WHERE title LIKE '[QA59]%' OR household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA59]%');
DELETE FROM public.activities
WHERE title LIKE '[QA59]%' OR metadata->>'qa_tag' = 'QA59'
   OR household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA59]%');
DELETE FROM public.duplicate_reviews
WHERE provisional_household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA59]%')
   OR candidate_household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA59]%')
   OR incoming_lead_id IN (SELECT id FROM public.leads WHERE source_page LIKE '/qa-sprint-59%' OR lead_type = 'Digital Identity');
DELETE FROM public.leads
WHERE source_page LIKE '/qa-sprint-59%'
   OR lead_type = 'Digital Identity'
   OR household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA59]%');
DELETE FROM public.household_members
WHERE household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA59]%');
DELETE FROM public.digital_card_campaigns
WHERE digital_card_id IN (SELECT id FROM public.digital_cards WHERE slug LIKE 'qa59-%');
DELETE FROM public.digital_cards WHERE slug LIKE 'qa59-%';
DELETE FROM public.households WHERE display_name LIKE '[QA59]%';
SET session_replication_role = DEFAULT;
`)

  const sb = loadLocalSupabaseEnv()
  const admin = createClient(sb.API_URL, sb.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const cardA = {
    id: 'c5910001-0001-4000-8000-000000000001',
    public_key: 'pk_qa59_advisor_a_card01',
    slug: 'qa59-advisor-a',
    status: 'published',
    advisor_profile_id: a,
    published_at: NOW,
    publish_profile: {
      displayName: 'QA59 Advisor A',
      approvedTitle: 'Advisor',
      approvedCompany: 'Valtoris QA',
    },
    cta_config: { primaryLabel: "Let's Connect" },
  }
  const cardB = {
    id: 'c5910002-0002-4000-8000-000000000002',
    public_key: 'pk_qa59_advisor_b_card02',
    slug: 'qa59-advisor-b',
    status: 'published',
    advisor_profile_id: b,
    published_at: NOW,
    publish_profile: {
      displayName: 'QA59 Advisor B',
      approvedTitle: 'Advisor',
      approvedCompany: 'Valtoris QA',
    },
    cta_config: { primaryLabel: "Let's Connect" },
  }

  const { error: cardErr } = await admin.from('digital_cards').insert([cardA, cardB])
  if (cardErr) throw cardErr

  const campaigns = [
    {
      id: 'c59a0001-0001-4000-8000-000000000001',
      digital_card_id: cardA.id,
      campaign_code: 'qa59-active-event',
      event_code: 'breakfast-aug-12',
      label: 'QA59 Active Event Campaign',
      description: 'Active campaign with event code',
      status: 'active',
      default_utms: { utmSource: 'flyer', utmMedium: 'offline' },
      source_channel_default: 'link',
      starts_at: '2026-08-12T14:00:00.000Z',
      ends_at: '2026-08-12T16:00:00.000Z',
      location_label: 'Round Rock Chamber',
      organizer: 'Chamber Board',
      advisor_notes: 'PRIVATE QA59 NOTES — never public',
      created_by_user_id: ownerId,
    },
    {
      id: 'c59a0002-0002-4000-8000-000000000002',
      digital_card_id: cardA.id,
      campaign_code: 'qa59-active-plain',
      event_code: null,
      label: 'QA59 Active Plain Campaign',
      description: 'Active without event code',
      status: 'active',
      default_utms: { utmCampaign: 'summer' },
      source_channel_default: 'qr',
      created_by_user_id: fixtures.accounts.advisorA.userId,
    },
    {
      id: 'c59a0003-0003-4000-8000-000000000003',
      digital_card_id: cardA.id,
      campaign_code: 'qa59-disabled',
      event_code: null,
      label: 'QA59 Disabled Campaign',
      status: 'disabled',
      default_utms: {},
      source_channel_default: 'link',
      created_by_user_id: fixtures.accounts.advisorA.userId,
    },
    {
      id: 'c59a0004-0004-4000-8000-000000000004',
      digital_card_id: cardA.id,
      campaign_code: 'qa59-deleted',
      event_code: 'old-event',
      label: 'QA59 Soft Deleted Campaign',
      status: 'disabled',
      default_utms: {},
      source_channel_default: 'link',
      deleted_at: NOW,
      created_by_user_id: fixtures.accounts.advisorA.userId,
    },
    {
      id: 'c59b0001-0001-4000-8000-000000000001',
      digital_card_id: cardB.id,
      campaign_code: 'qa59-b-active',
      event_code: 'b-event-1',
      label: 'QA59 Advisor B Active',
      status: 'active',
      default_utms: {},
      source_channel_default: 'link',
      advisor_notes: 'B private notes',
      created_by_user_id: fixtures.accounts.advisorB.userId,
    },
  ]

  const { error: campErr } = await admin.from('digital_card_campaigns').insert(campaigns)
  if (campErr) throw campErr

  // Exact-match household (canonical contact)
  const exactHh = 'c59e0011-0011-4000-8000-000000000011'
  const { error: hhErr } = await admin.from('households').insert({
    id: exactHh,
    display_name: '[QA59] Exact Match Household',
    status: 'lead',
    primary_email: 'qa59.exact@example.test',
    normalized_email: 'qa59.exact@example.test',
    primary_phone: '5551002002',
    normalized_phone: '+15551002002',
    relationship_pipeline_id: PIPELINE,
    relationship_stage_id: STAGE,
    assigned_advisor_id: a,
    assigned_at: NOW,
    assignment_reason: 'manual',
  })
  if (hhErr) throw hhErr
  const { error: memErr } = await admin.from('household_members').insert({
    household_id: exactHh,
    first_name: 'Exact',
    last_name: 'Match',
    relationship: 'primary',
    is_primary_contact: true,
    email: 'qa59.exact@example.test',
    normalized_email: 'qa59.exact@example.test',
    phone: '5551002002',
    normalized_phone: '+15551002002',
  })
  if (memErr) throw memErr

  // Possible-match candidate household (email overlap only)
  const possibleHh = 'c59e0012-0012-4000-8000-000000000012'
  const { error: phErr } = await admin.from('households').insert({
    id: possibleHh,
    display_name: '[QA59] Possible Candidate Household',
    status: 'lead',
    primary_email: 'qa59.possible@example.test',
    normalized_email: 'qa59.possible@example.test',
    relationship_pipeline_id: PIPELINE,
    relationship_stage_id: STAGE,
    assigned_advisor_id: a,
    assigned_at: NOW,
    assignment_reason: 'manual',
  })
  if (phErr) throw phErr
  const { error: pmErr } = await admin.from('household_members').insert({
    household_id: possibleHh,
    first_name: 'Other',
    last_name: 'Person',
    relationship: 'primary',
    is_primary_contact: true,
    email: 'qa59.possible@example.test',
    normalized_email: 'qa59.possible@example.test',
    phone: '5559998888',
    normalized_phone: '+15559998888',
  })
  if (pmErr) throw pmErr

  fixtures.seed = {
    cardA,
    cardB,
    campaigns: {
      activeEvent: campaigns[0],
      activePlain: campaigns[1],
      disabled: campaigns[2],
      deleted: campaigns[3],
      advisorB: campaigns[4],
    },
    households: {
      exactMatch: exactHh,
      possibleCandidate: possibleHh,
    },
  }
  writeFileSync(FIXTURE_PATH, JSON.stringify(fixtures, null, 2) + '\n')
  console.log(`Seeded Sprint 5.9 fixtures → ${FIXTURE_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
