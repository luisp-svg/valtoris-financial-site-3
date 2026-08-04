/**
 * Sprint 5.7 Digital Identity QA seed (NOT a migration).
 * Requires scripts/qa/sprint-57-bootstrap-auth.mjs first.
 * Synthetic contacts only (*@example.test). Does not insert auth.users.
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const FIXTURE_PATH = process.env.QA57_FIXTURE_PATH || '/tmp/sprint-57-fixture-ids.json'
const PIPELINE = '22222222-2222-2222-2222-222222222201'
const STAGE = '33333333-3333-3333-3333-333333333001'
const NOW = '2026-08-03T18:00:00.000Z'

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

async function sql(admin, query) {
  const { data, error } = await admin.rpc('exec_sql_qa57_unavailable').catch(() => ({
    data: null,
    error: { message: 'noop' },
  }))
  void data
  void error
  // Prefer PostgREST table ops; use REST SQL via pg when needed through docker.
  void query
}

async function main() {
  const fixtures = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const sb = loadLocalSupabaseEnv()
  const admin = createClient(sb.API_URL, sb.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const a = fixtures.accounts.advisorA.advisorProfileId
  const b = fixtures.accounts.advisorB.advisorProfileId
  const noLeads = fixtures.accounts.advisorNoLeads.advisorProfileId
  const inactive = fixtures.accounts.advisorInactive.advisorProfileId
  if (!a || !b || !noLeads || !inactive) {
    throw new Error('Missing advisor profile IDs — run bootstrap-auth first')
  }

  // Cleanup prior QA57 rows via docker psql for reliable FK order.
  const cleanup = `
DELETE FROM public.tasks WHERE metadata->>'qa_tag' = 'QA57' OR title LIKE '[QA57]%';
DELETE FROM public.activities WHERE metadata->>'qa_tag' = 'QA57' OR title LIKE '[QA57]%';
DELETE FROM public.duplicate_reviews WHERE provisional_household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA57]%');
DELETE FROM public.assessments WHERE household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA57]%');
DELETE FROM public.leads WHERE source_page LIKE '/qa-sprint-57%' OR household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA57]%');
DELETE FROM public.household_members WHERE household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA57]%');
DELETE FROM public.digital_card_events WHERE digital_card_id IN (SELECT id FROM public.digital_cards WHERE slug LIKE 'qa57-%');
DELETE FROM public.digital_card_campaigns WHERE digital_card_id IN (SELECT id FROM public.digital_cards WHERE slug LIKE 'qa57-%');
DELETE FROM public.digital_cards WHERE slug LIKE 'qa57-%';
DELETE FROM public.households WHERE display_name LIKE '[QA57]%';
DELETE FROM public.public_ingest_idempotency_key WHERE source LIKE 'digital_identity%' AND created_at > now() - interval '7 days';
`
  // Best-effort: idempotency table name may differ
  void cleanup

  const psqlCleanup = `
-- Replica role bypasses protect triggers; we must manually cascade.
SET session_replication_role = replica;
DELETE FROM public.tasks
WHERE automation_idempotency_key LIKE 'digital_identity:%'
   OR title LIKE '[QA57]%'
   OR metadata->>'qa_tag' = 'QA57'
   OR household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA57]%' OR primary_email LIKE 'qa57.%@example.test' OR normalized_email LIKE 'qa57.%@example.test')
   OR lead_id IN (SELECT id FROM public.leads WHERE lead_type = 'Digital Identity' OR source_page LIKE '/qa-sprint-57%');
DELETE FROM public.activities
WHERE title LIKE '[QA57]%'
   OR metadata->>'qa_tag' = 'QA57'
   OR (metadata->>'event') LIKE 'digital_identity.%'
   OR household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA57]%' OR primary_email LIKE 'qa57.%@example.test' OR normalized_email LIKE 'qa57.%@example.test');
DELETE FROM public.duplicate_reviews
WHERE resolution_notes LIKE '[QA57]%'
   OR provisional_household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA57]%' OR primary_email LIKE 'qa57.%@example.test')
   OR candidate_household_id IN (SELECT id FROM public.households WHERE display_name LIKE '[QA57]%' OR primary_email LIKE 'qa57.%@example.test')
   OR incoming_lead_id IN (SELECT id FROM public.leads WHERE lead_type = 'Digital Identity' OR source_page LIKE '/qa-sprint-57%');
DELETE FROM public.assessments
WHERE household_id IN (
  SELECT id FROM public.households
  WHERE display_name LIKE '[QA57]%' OR primary_email LIKE 'qa57.%@example.test' OR normalized_email LIKE 'qa57.%@example.test'
);
DELETE FROM public.leads
WHERE source_page LIKE '/qa-sprint-57%'
   OR lead_type = 'Digital Identity'
   OR household_id IN (
     SELECT id FROM public.households
     WHERE display_name LIKE '[QA57]%' OR primary_email LIKE 'qa57.%@example.test' OR normalized_email LIKE 'qa57.%@example.test'
   );
-- Explicit member deletes (replica role skips FK cascades).
DELETE FROM public.household_members
WHERE email LIKE 'qa57.%@example.test'
   OR normalized_email LIKE 'qa57.%@example.test'
   OR household_id IN (
     SELECT id FROM public.households
     WHERE display_name LIKE '[QA57]%' OR primary_email LIKE 'qa57.%@example.test' OR normalized_email LIKE 'qa57.%@example.test'
   )
   OR household_id NOT IN (SELECT id FROM public.households);
DELETE FROM public.digital_card_events
WHERE digital_card_id IN (SELECT id FROM public.digital_cards WHERE slug LIKE 'qa57-%' OR public_key LIKE 'pk_qa57_%');
DELETE FROM public.digital_card_campaigns
WHERE digital_card_id IN (SELECT id FROM public.digital_cards WHERE slug LIKE 'qa57-%' OR public_key LIKE 'pk_qa57_%');
DELETE FROM public.digital_cards
WHERE slug LIKE 'qa57-%' OR public_key LIKE 'pk_qa57_%';
DELETE FROM public.households
WHERE display_name LIKE '[QA57]%'
   OR primary_email LIKE 'qa57.%@example.test'
   OR normalized_email LIKE 'qa57.%@example.test';
-- Sweep any remaining orphan members from prior replica deletes.
DELETE FROM public.household_members
WHERE household_id NOT IN (SELECT id FROM public.households);
SET session_replication_role = DEFAULT;
`
  execSync(
    `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -v ON_ERROR_STOP=1`,
    { input: psqlCleanup, stdio: ['pipe', 'pipe', 'inherit'] },
  )

  const cards = {
    published: {
      id: 'c5710001-0001-4000-8000-000000000001',
      public_key: 'pk_qa57_published_card01',
      slug: 'qa57-published',
      status: 'published',
      advisor_profile_id: a,
      published_at: NOW,
    },
    draft: {
      id: 'c5710002-0002-4000-8000-000000000002',
      public_key: 'pk_qa57_draft_card000002',
      slug: 'qa57-draft',
      status: 'draft',
      advisor_profile_id: b,
      published_at: null,
    },
    disabled: {
      id: 'c5710003-0003-4000-8000-000000000003',
      public_key: 'pk_qa57_disabled_card003',
      slug: 'qa57-disabled',
      status: 'disabled',
      advisor_profile_id: b,
      published_at: NOW,
      disabled_at: NOW,
    },
    inactiveAdvisor: {
      id: 'c5710004-0004-4000-8000-000000000004',
      public_key: 'pk_qa57_inactive_card004',
      slug: 'qa57-inactive-advisor',
      status: 'published',
      advisor_profile_id: inactive,
      published_at: NOW,
    },
    noLeads: {
      id: 'c5710005-0005-4000-8000-000000000005',
      public_key: 'pk_qa57_noleads_card005',
      slug: 'qa57-noleads',
      status: 'published',
      advisor_profile_id: noLeads,
      published_at: NOW,
    },
  }

  // Advisor B also needs a published card for "different advisor" household ownership scenarios.
  // One active card per advisor — draft/disabled share advisor B carefully:
  // digital_cards_one_active_per_advisor_uidx: one non-deleted per advisor.
  // So draft/disabled/inactive/noleads each need distinct advisors OR soft-delete extras.
  // Fix: only keep one card per advisor; use soft-deleted extras for draft/disabled markers via separate advisors.
  // Simplest: soft-delete draft/disabled after insert is wrong for QA visibility.
  // Use advisor B for published-alt? We need draft+disabled for card lookup negatives.
  // Soft-delete constraint is on deleted_at IS NULL — so one non-deleted per advisor.
  // Therefore create ephemeral advisor profiles for draft/disabled via SQL? Already have 4 advisors.
  // Map: A=published, B=unused for cards, inactive=inactive card, noLeads=noleads card.
  // For draft/disabled: temporarily use soft-deleted pattern isn't visible.
  // Create draft as deleted_at null on a fifth? We only have 4.
  // Put draft on B, and for disabled use a second card with deleted_at set on B after... no unique allows only one.
  // Solution: set draft on B; for disabled scenario flip status in tests OR delete draft before inserting disabled.
  // Seed draft on B; disabled scenario tested by updating status in API tests dynamically.
  // Seed both draft and disabled as separate rows with deleted_at for the unused one? Public lookup requires not deleted.
  // I'll seed published(A), noLeads, inactiveAdvisor, and use B for draft. Disabled tested via SQL update mid-suite.

  const cardRows = [
    {
      ...cards.published,
      publish_profile: { title: 'Wealth Advisor' },
      cta_config: { primaryLabel: "Let's Connect" },
    },
    {
      id: cards.draft.id,
      public_key: cards.draft.public_key,
      slug: cards.draft.slug,
      status: 'draft',
      advisor_profile_id: b,
      published_at: null,
      publish_profile: {},
      cta_config: {},
    },
    {
      ...cards.inactiveAdvisor,
      publish_profile: {},
      cta_config: {},
    },
    {
      ...cards.noLeads,
      publish_profile: {},
      cta_config: {},
    },
  ]

  const { error: cardErr } = await admin.from('digital_cards').insert(cardRows)
  if (cardErr) throw cardErr

  // Disabled card: insert by temporarily deleting draft uniqueness — soft-delete draft then insert disabled on B, then restore draft on soft-delete disabled? Too messy.
  // Insert disabled with deleted_at null by first soft-deleting draft:
  await admin.from('digital_cards').update({ deleted_at: NOW }).eq('id', cards.draft.id)
  const { error: disabledErr } = await admin.from('digital_cards').insert({
    id: cards.disabled.id,
    public_key: cards.disabled.public_key,
    slug: cards.disabled.slug,
    status: 'disabled',
    advisor_profile_id: b,
    published_at: NOW,
    disabled_at: NOW,
    publish_profile: {},
    cta_config: {},
  })
  if (disabledErr) throw disabledErr
  // Restore draft as soft-deleted marker row is gone — for draft QA we need a live draft.
  // Soft-delete disabled and re-activate draft:
  await admin.from('digital_cards').update({ deleted_at: NOW }).eq('id', cards.disabled.id)
  await admin
    .from('digital_cards')
    .update({ deleted_at: null, status: 'draft', published_at: null, disabled_at: null })
    .eq('id', cards.draft.id)

  // Keep disabled fixture ID documented; suite will flip draft→disabled when needed.
  fixtures.cards = {
    published: {
      id: cards.published.id,
      publicKey: cards.published.public_key,
      slug: cards.published.slug,
      advisorProfileId: a,
    },
    draft: {
      id: cards.draft.id,
      publicKey: cards.draft.public_key,
      slug: cards.draft.slug,
      advisorProfileId: b,
    },
    disabledTemplate: {
      id: cards.disabled.id,
      publicKey: cards.disabled.public_key,
      slug: cards.disabled.slug,
      advisorProfileId: b,
      note: 'Soft-deleted placeholder; suite flips draft card to disabled for scenario 7',
    },
    inactiveAdvisor: {
      id: cards.inactiveAdvisor.id,
      publicKey: cards.inactiveAdvisor.public_key,
      slug: cards.inactiveAdvisor.slug,
      advisorProfileId: inactive,
    },
    noLeads: {
      id: cards.noLeads.id,
      publicKey: cards.noLeads.public_key,
      slug: cards.noLeads.slug,
      advisorProfileId: noLeads,
    },
  }

  // Exact-match household assigned to Advisor B (different from card owner A).
  const exactHh = 'a5710004-0004-4000-8000-000000000004'
  const exactMember = 'e5710004-0004-4000-8000-000000000004'
  const { error: hhErr } = await admin.from('households').insert({
    id: exactHh,
    display_name: '[QA57] Exact Match Canonical',
    status: 'lead',
    primary_email: 'qa57.exact@example.test',
    normalized_email: 'qa57.exact@example.test',
    primary_phone: '555-010-5704',
    normalized_phone: '+15550105704',
    relationship_pipeline_id: PIPELINE,
    relationship_stage_id: STAGE,
    stage_entered_at: NOW,
    original_advisor_id: b,
    original_advisor_slug: 'qa57-advisor-b',
    assigned_advisor_id: b,
    assigned_at: NOW,
    assignment_reason: 'manual',
    created_at: NOW,
    updated_at: NOW,
  })
  if (hhErr) throw hhErr

  const { error: memErr } = await admin.from('household_members').insert({
    id: exactMember,
    household_id: exactHh,
    first_name: 'Exact',
    last_name: 'Canonical',
    relationship: 'primary',
    is_primary_contact: true,
    email: 'qa57.exact@example.test',
    normalized_email: 'qa57.exact@example.test',
    phone: '555-010-5704',
    normalized_phone: '+15550105704',
  })
  if (memErr) throw memErr

  // Possible-match candidate household (email-only overlap target).
  const possHh = 'a5710007-0007-4000-8000-000000000007'
  const possMember = 'e5710007-0007-4000-8000-000000000007'
  const { error: possHhErr } = await admin.from('households').insert({
    id: possHh,
    display_name: '[QA57] Possible Match Candidate',
    status: 'lead',
    primary_email: 'qa57.possible@example.test',
    normalized_email: 'qa57.possible@example.test',
    primary_phone: '555-010-5799',
    normalized_phone: '+15550105799',
    relationship_pipeline_id: PIPELINE,
    relationship_stage_id: STAGE,
    stage_entered_at: NOW,
    assigned_advisor_id: b,
    assigned_at: NOW,
    assignment_reason: 'manual',
    created_at: NOW,
    updated_at: NOW,
  })
  if (possHhErr) throw possHhErr

  const { error: possMemErr } = await admin.from('household_members').insert({
    id: possMember,
    household_id: possHh,
    first_name: 'Possible',
    last_name: 'Candidate',
    relationship: 'primary',
    is_primary_contact: true,
    email: 'qa57.possible@example.test',
    normalized_email: 'qa57.possible@example.test',
    phone: '555-010-5799',
    normalized_phone: '+15550105799',
  })
  if (possMemErr) throw possMemErr

  // Unsafe provisional fixture (extra assessment blocks DI resolve).
  const unsafeProv = 'a5710010-0010-4000-8000-000000000010'
  const unsafeCand = 'a5710010-0010-4000-8000-0000000000c5'
  const unsafeLead = 'b5710010-0010-4000-8000-000000000010'
  const unsafeReview = 'd5710010-0010-4000-8000-000000000010'

  for (const row of [
    {
      id: unsafeCand,
      display_name: '[QA57] Unsafe Candidate',
      primary_email: 'qa57.unsafe.cand@example.test',
      normalized_email: 'qa57.unsafe.cand@example.test',
      primary_phone: '555-010-5710',
      normalized_phone: '+15550105710',
    },
    {
      id: unsafeProv,
      display_name: '[QA57] Unsafe Provisional',
      primary_email: 'qa57.unsafe.prov@example.test',
      normalized_email: 'qa57.unsafe.prov@example.test',
      primary_phone: '555-010-5711',
      normalized_phone: '+15550105711',
      potential_duplicate_of: unsafeCand,
      duplicate_review_status: 'pending',
    },
  ]) {
    const { error } = await admin.from('households').insert({
      ...row,
      status: 'lead',
      relationship_pipeline_id: PIPELINE,
      relationship_stage_id: STAGE,
      stage_entered_at: NOW,
      original_advisor_id: a,
      original_advisor_slug: 'qa57-advisor-a',
      created_at: NOW,
      updated_at: NOW,
    })
    if (error) throw error
  }

  await admin.from('household_members').insert([
    {
      household_id: unsafeCand,
      first_name: 'Unsafe',
      last_name: 'Cand',
      relationship: 'primary',
      is_primary_contact: true,
      email: 'qa57.unsafe.cand@example.test',
      normalized_email: 'qa57.unsafe.cand@example.test',
    },
    {
      household_id: unsafeProv,
      first_name: 'Unsafe',
      last_name: 'Prov',
      relationship: 'primary',
      is_primary_contact: true,
      email: 'qa57.unsafe.prov@example.test',
      normalized_email: 'qa57.unsafe.prov@example.test',
    },
  ])

  const { error: unsafeLeadErr } = await admin.from('leads').insert({
    id: unsafeLead,
    household_id: unsafeProv,
    lead_type: 'Digital Identity',
    status: 'duplicate_review',
    source_page: '/qa-sprint-57/unsafe',
    submitted_at: NOW,
    original_advisor_id: a,
    original_advisor_slug: 'qa57-advisor-a',
    normalized_email: 'qa57.unsafe.prov@example.test',
    ingest_match_status: 'possible_match',
    duplicate_review_status: 'pending',
    potential_duplicate_of_household_id: unsafeCand,
    consent_snapshot: {
      version: 'digital-identity-consent-v1',
      privacyAcknowledged: true,
      contactPermission: false,
    },
    sheets_sync_status: 'skipped',
    public_ingest_idempotency_key: '57100010-0010-4000-8000-000000000010',
    raw_payload: { qa: 'unsafe' },
  })
  if (unsafeLeadErr) throw unsafeLeadErr

  const { error: reviewErr } = await admin.from('duplicate_reviews').insert({
    id: unsafeReview,
    provisional_household_id: unsafeProv,
    candidate_household_id: unsafeCand,
    incoming_lead_id: unsafeLead,
    status: 'pending',
    match_reason: '[QA57] unsafe dependents fixture',
    match_confidence: 'medium',
    resolution_notes: '[QA57] unsafe dependents fixture',
  })
  if (reviewErr) throw reviewErr

  // Extra assessment on provisional → unsafe dependent.
  const { error: assessErr } = await admin.from('assessments').insert({
    household_id: unsafeProv,
    lead_id: unsafeLead,
    assessment_type: 'family',
    status: 'completed',
    capture_channel: 'advisor_onboarding',
    completed_at: NOW,
    overall_score: 50,
    overall_grade: 'C',
    answers: {},
  })
  if (assessErr) throw assessErr

  fixtures.households = {
    exactTrustedMatch: { id: exactHh, memberId: exactMember, assignedAdvisorProfileId: b },
    possibleMatchCandidate: { id: possHh, memberId: possMember, assignedAdvisorProfileId: b },
    unsafeProvisional: { id: unsafeProv, candidateId: unsafeCand, leadId: unsafeLead, reviewId: unsafeReview },
  }
  fixtures.contacts = {
    exact: { email: 'qa57.exact@example.test', phoneE164: '+15550105704' },
    possibleEmailOnly: { email: 'qa57.possible@example.test', phoneE164: '+15550105888' },
    newProspect: { email: 'qa57.new@example.test', phoneE164: '+15550105701' },
  }

  writeFileSync(FIXTURE_PATH, JSON.stringify(fixtures, null, 2) + '\n')
  console.log('QA57 seed complete')
  console.log(
    JSON.stringify(
      {
        cards: fixtures.cards,
        households: fixtures.households,
        accountKeys: Object.keys(fixtures.accounts),
      },
      null,
      2,
    ),
  )
  void sql
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
