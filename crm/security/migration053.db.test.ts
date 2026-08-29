/**
 * Local Supabase integration for Migration 053 owner-only bulk lead import writer.
 * Skips automatically when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BULK_LEAD_IMPORT_BATCH_ID, BULK_LEAD_IMPORT_LEAD_TYPE } from '../../modules/bulkLeadImport'
import { archiveIntakeLead } from '../intake/intakeArchive'
import { fetchIntakeQueue } from '../intake/intakeApi'
import {
  MIGRATION_053_ARCHIVE_RPC,
  MIGRATION_053_HELPERS,
  MIGRATION_053_RPC,
} from './migration053Contract'

const PASS = 'LocalQaPass053!'
const PREFIX = 'm053qa'

type LocalEnv = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string }

function tryLoadLocalEnv(): LocalEnv | null {
  try {
    const raw = execSync('npx supabase status -o env', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const env: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      env[m[1]] = v
    }
    if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) return null
    if (!/127\.0\.0\.1|localhost/.test(env.API_URL)) return null
    return {
      API_URL: env.API_URL,
      ANON_KEY: env.ANON_KEY,
      SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
    }
  } catch {
    return null
  }
}

function errMsg(error: { message?: string } | null | undefined): string {
  return error?.message || ''
}

function sqlQuery(sql: string): string {
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  return execSync(
    `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c ${JSON.stringify(oneLine)}`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim()
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 053 bulk lead import writer (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisor: SupabaseClient
  let anon: SupabaseClient
  let _ownerId = ''
  let _advisorUserId = ''
  let _advisorProfileId = ''

  const created = {
    households: [] as string[],
    leads: [] as string[],
    members: [] as string[],
    reviews: [] as string[],
    activities: [] as string[],
  }

  async function ensureUser(email: string, fullName: string, role: 'owner' | 'advisor'): Promise<string> {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) throw list.error
    const existing = (list.data?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    let userId: string
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password: PASS,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) throw error
      userId = existing.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASS,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) throw error
      userId = data.user!.id
    }
    const { error: profileError } = await admin.from('profiles').upsert(
      { id: userId, email, full_name: fullName, role, is_active: true },
      { onConflict: 'id' },
    )
    if (profileError) throw profileError
    return userId
  }

  async function ensureAdvisorProfile(userId: string, slug: string): Promise<string> {
    const { data: existing } = await admin
      .from('advisor_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (existing?.id) {
      await admin
        .from('advisor_profiles')
        .update({ is_active: true, slug, display_name: slug, deleted_at: null })
        .eq('id', existing.id)
      return existing.id
    }
    const { data, error } = await admin
      .from('advisor_profiles')
      .insert({ user_id: userId, slug, display_name: slug, is_active: true })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  async function signIn(email: string): Promise<SupabaseClient> {
    const client = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await client.auth.signInWithPassword({ email, password: PASS })
    if (error) throw error
    return client
  }

  function basePayload(overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID().slice(0, 8)
    return {
      import_batch_id: BULK_LEAD_IMPORT_BATCH_ID,
      source_workbook: '2026 leads crm',
      source_sheet: 'Leads',
      canonical_source_row: 900000 + Number.parseInt(suffix.slice(0, 4), 16),
      all_source_rows: [900000 + Number.parseInt(suffix.slice(0, 4), 16)],
      first_name: 'Ada',
      last_name: 'Lovelace',
      raw_email: `${PREFIX}.${suffix}@example.com`,
      raw_phone: `555${suffix.replace(/\D/g, '').padEnd(7, '0').slice(0, 7)}`,
      city: 'London',
      state: 'CA',
      source_tag: 'Juliana',
      ruleset_version: 'phase_c_consumer_v1',
      ...overrides,
    }
  }

  function track(result: Record<string, unknown> | null | undefined) {
    if (!result) return
    if (typeof result.household_id === 'string') created.households.push(result.household_id)
    if (typeof result.lead_id === 'string') created.leads.push(result.lead_id)
    if (typeof result.member_id === 'string') created.members.push(result.member_id)
    if (typeof result.duplicate_review_id === 'string') created.reviews.push(result.duplicate_review_id)
  }

  async function importOne(client: SupabaseClient, overrides: Record<string, unknown> = {}) {
    const payload = basePayload(overrides)
    const { data, error } = await client.rpc(MIGRATION_053_RPC, { p_payload: payload })
    track(data as Record<string, unknown> | null)
    return { data, error, payload }
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    _ownerId = await ensureUser(`${PREFIX}.owner@example.com`, 'M053 Owner', 'owner')
    _advisorUserId = await ensureUser(`${PREFIX}.adv@example.com`, 'M053 Adv', 'advisor')
    _advisorProfileId = await ensureAdvisorProfile(_advisorUserId, `${PREFIX}-adv`)
    owner = await signIn(`${PREFIX}.owner@example.com`)
    advisor = await signIn(`${PREFIX}.adv@example.com`)
  }, 120_000)

  afterAll(async () => {
    if (!admin) return
    for (const id of created.reviews) await admin.from('duplicate_reviews').delete().eq('id', id)
    for (const id of created.activities) await admin.from('activities').delete().eq('id', id)
    for (const householdId of created.households) {
      await admin.from('activities').delete().eq('household_id', householdId)
    }
    for (const id of created.leads) await admin.from('leads').delete().eq('id', id)
    for (const id of created.members) await admin.from('household_members').delete().eq('id', id)
    for (const id of created.households) await admin.from('households').delete().eq('id', id)
  }, 120_000)

  function functionAudit(name: string): string {
    return sqlQuery(`
      SELECT prosecdef::text
        || '|' || pg_get_userbyid(p.proowner)
        || '|' || coalesce(array_to_string(p.proconfig, ','), '')
        || '|' || pg_get_function_identity_arguments(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = '${name}'
    `)
  }

  function executeGrantees(name: string): string {
    return sqlQuery(`
      SELECT coalesce(string_agg(DISTINCT grantee, ',' ORDER BY grantee), '')
      FROM information_schema.role_routine_grants
      WHERE routine_schema = 'public'
        AND routine_name = '${name}'
        AND privilege_type = 'EXECUTE'
    `)
  }

  async function seedSyntheticLead(leadType: string) {
    const hhId = randomUUID()
    const leadId = randomUUID()
    const { error: hhErr } = await admin.from('households').insert({
      id: hhId,
      display_name: `${PREFIX} ${leadType}`,
      status: 'lead',
      lead_source: leadType === 'Digital Identity' ? 'digital_identity_connect' : 'family_report_card',
      relationship_pipeline_id: '22222222-2222-2222-2222-222222222201',
      relationship_stage_id: '33333333-3333-3333-3333-333333333001',
      created_by_user_id: _ownerId,
    })
    if (hhErr) throw hhErr
    created.households.push(hhId)
    if (leadType === 'Manual Contact') {
      sqlQuery(`
        SELECT set_config('crm.rpc_context', 'quick_add_contact', true);
        INSERT INTO public.leads (
          id, household_id, lead_type, status, sheets_sync_status, consent_snapshot
        ) VALUES (
          '${leadId}', '${hhId}', 'Manual Contact', 'unassigned', 'skipped', '{}'::jsonb
        )
      `)
    } else {
      const { error: leadErr } = await admin.from('leads').insert({
        id: leadId,
        household_id: hhId,
        lead_type: leadType,
        status: 'unassigned',
        sheets_sync_status: 'skipped',
        consent_snapshot: {},
      })
      if (leadErr) throw leadErr
    }
    created.leads.push(leadId)
    return { householdId: hhId, leadId }
  }

  it('exposes one writer signature, postgres owner, and authenticated-only execute', () => {
    expect(sqlQuery(`SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '053'`)).toBe('1')
    expect(sqlQuery(`SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('051','052','053')`)).toBe('3')
    const writer = functionAudit(MIGRATION_053_RPC)
    expect(writer).toMatch(/^true\|postgres\|search_path=pg_catalog, public, extensions\|p_payload jsonb$/)
    const writerGrants = executeGrantees(MIGRATION_053_RPC)
    expect(writerGrants).toMatch(/authenticated/)
    expect(writerGrants).not.toMatch(/anon/)
    expect(
      sqlQuery(`
        SELECT count(*) FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = '${MIGRATION_053_RPC}'
      `),
    ).toBe('1')
  })

  it('locks search_path and grants for helpers and archive_intake_lead', () => {
    expect(functionAudit('bulk_lead_import_collect_candidates')).toMatch(
      /^true\|postgres\|search_path=pg_catalog, public, extensions\|/,
    )
    expect(functionAudit('bulk_lead_import_classify_match')).toMatch(
      /^true\|postgres\|search_path=pg_catalog, public, extensions\|/,
    )
    expect(functionAudit(MIGRATION_053_ARCHIVE_RPC)).toBe(
      'true|postgres|search_path=pg_catalog, public, extensions|p_lead_id uuid, p_reason text',
    )
    for (const helper of MIGRATION_053_HELPERS) {
      const grants = executeGrantees(helper)
      expect(grants).not.toMatch(/anon/)
      expect(grants).not.toMatch(/authenticated/)
      expect(grants).not.toMatch(/PUBLIC/i)
    }
    const archiveGrants = executeGrantees(MIGRATION_053_ARCHIVE_RPC)
    expect(archiveGrants).toMatch(/authenticated/)
    expect(archiveGrants).not.toMatch(/anon/)
    const archiveDef = sqlQuery(`
      SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = '${MIGRATION_053_ARCHIVE_RPC}'
    `)
    expect(archiveDef).toContain("'Bulk Lead Import'")
    expect(archiveDef).toContain("'Family Report Card'")
    expect(archiveDef).toContain("'Digital Identity'")
    expect(archiveDef.indexOf('PERFORM public.crm_write_activity(')).toBeLessThan(
      archiveDef.indexOf('UPDATE public.leads'),
    )
  })

  it('blocks anon and non-owner callers', async () => {
    const payload = basePayload()
    const anonResult = await anon.rpc(MIGRATION_053_RPC, { p_payload: payload })
    expect(anonResult.error).toBeTruthy()
    const advisorResult = await advisor.rpc(MIGRATION_053_RPC, { p_payload: payload })
    expect(advisorResult.error).toBeTruthy()
    expect(errMsg(advisorResult.error)).toMatch(/not_authorized|42501/i)
  })

  it('rejects unsupported batch, missing last name, malformed contact, and protected fields', async () => {
    const batch = await importOne(owner, { import_batch_id: 'other_batch' })
    expect(errMsg(batch.error)).toMatch(/unsupported_batch/)
    const last = await importOne(owner, { last_name: '' })
    expect(errMsg(last.error)).toMatch(/missing_last_name|invalid_name/)
    const contact = await importOne(owner, { raw_email: 'not-an-email', raw_phone: '' })
    expect(errMsg(contact.error)).toMatch(/malformed_contact/)
    const protectedField = await owner.rpc(MIGRATION_053_RPC, {
      p_payload: { ...basePayload(), assigned_advisor_id: randomUUID() },
    })
    expect(errMsg(protectedField.error)).toMatch(/protected_field/)
  })

  it('creates household + primary member + lead for a new prospect and stores {} consent', async () => {
    const first = await importOne(owner, {
      first_name: 'Andre',
      last_name: 'Quek',
      city: 'Park Row',
      state: 'TX',
      source_tag: '',
    })
    expect(first.error).toBeNull()
    const row = first.data as Record<string, unknown>
    expect(row.created).toBe(true)
    expect(row.outcome).toBe('created')
    expect(row.match_status).toBe('new_prospect')
    expect(row.duplicate_review_id).toBeNull()

    const householdId = String(row.household_id)
    const leadId = String(row.lead_id)
    const household = sqlQuery(`
      SELECT status || '|' || lead_source || '|' || relationship_pipeline_id || '|' || relationship_stage_id
        || '|' || coalesce(assigned_advisor_id::text, 'null') || '|' || coalesce(original_advisor_id::text, 'null')
      FROM public.households WHERE id = '${householdId}'
    `)
    expect(household).toBe(
      'lead|bulk_lead_import_2026_leads_crm|22222222-2222-2222-2222-222222222201|33333333-3333-3333-3333-333333333001|null|null',
    )
    expect(
      sqlQuery(`SELECT count(*) FROM public.household_members WHERE household_id = '${householdId}' AND is_primary_contact = true AND deleted_at IS NULL`),
    ).toBe('1')
    const lead = sqlQuery(`
      SELECT lead_type || '|' || status || '|' || sheets_sync_status || '|' || consent_snapshot::text
        || '|' || coalesce(assessment_type::text, 'null') || '|' || coalesce(assigned_advisor_id::text, 'null')
      FROM public.leads WHERE id = '${leadId}'
    `)
    expect(lead).toBe(`${BULK_LEAD_IMPORT_LEAD_TYPE}|unassigned|skipped|{}|null|null`)
    expect(sqlQuery(`SELECT count(*) FROM public.opportunities WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.activities WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.assessments WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.policy_applications WHERE household_id = '${householdId}'`)).toBe('0')

    const retry = await owner.rpc(MIGRATION_053_RPC, { p_payload: first.payload })
    expect(retry.error).toBeNull()
    const retryRow = retry.data as Record<string, unknown>
    expect(retryRow.created).toBe(false)
    expect(retryRow.outcome).toBe('already_exists')
    expect(retryRow.lead_id).toBe(leadId)
    expect(
      sqlQuery(`SELECT count(*) FROM public.leads WHERE household_id = '${householdId}' AND deleted_at IS NULL`),
    ).toBe('1')
  })

  it('skips exact trusted match, routes possible match to review, and does not match name-only', async () => {
    const existing = await importOne(owner, {
      first_name: 'Exact',
      last_name: 'Trusted',
      raw_email: `${PREFIX}.exact@example.com`,
      raw_phone: '4155550199',
    })
    expect(existing.error).toBeNull()

    const exact = await importOne(owner, {
      canonical_source_row: 910001,
      all_source_rows: [910001],
      first_name: 'Exact',
      last_name: 'Trusted',
      raw_email: `${PREFIX}.exact@example.com`,
      raw_phone: '4155550199',
    })
    expect(exact.error).toBeNull()
    const exactRow = exact.data as Record<string, unknown>
    expect(exactRow.created).toBe(false)
    expect(exactRow.match_status).toBe('exact_trusted_match')
    expect(exactRow.outcome).toBe('already_exists')
    expect(exactRow.lead_id).toBeNull()

    const possible = await importOne(owner, {
      canonical_source_row: 910002,
      all_source_rows: [910002],
      first_name: 'Other',
      last_name: 'Person',
      raw_email: `${PREFIX}.exact@example.com`,
      raw_phone: '4155550188',
    })
    expect(possible.error).toBeNull()
    const possibleRow = possible.data as Record<string, unknown>
    expect(possibleRow.created).toBe(true)
    expect(possibleRow.match_status).toBe('possible_match')
    expect(possibleRow.outcome).toBe('review_required')
    expect(possibleRow.duplicate_review_id).toBeTruthy()
    expect(
      sqlQuery(`SELECT status FROM public.leads WHERE id = '${String(possibleRow.lead_id)}'`),
    ).toBe('duplicate_review')

    const nameOnly = await importOne(owner, {
      canonical_source_row: 910003,
      all_source_rows: [910003],
      first_name: 'Exact',
      last_name: 'Trusted',
      raw_email: `${PREFIX}.nameonly@example.com`,
      raw_phone: '4155550177',
    })
    expect(nameOnly.error).toBeNull()
    expect((nameOnly.data as Record<string, unknown>).match_status).toBe('new_prospect')
  })

  it('preserves both source rows for a collapsed duplicate and uses the import-row lock namespace', async () => {
    const result = await importOne(owner, {
      canonical_source_row: 910010,
      all_source_rows: [910010, 910763],
      first_name: 'Jesus',
      last_name: 'Gutierrez',
      source_tag: '',
      duplicate_type: 'EXACT_PHONE_EMAIL',
      duplicate_group: 'EXACT-4ef163f8',
    })
    expect(result.error).toBeNull()
    const leadId = String((result.data as Record<string, unknown>).lead_id)
    const meta = sqlQuery(`
      SELECT original_source_metadata->>'canonical_source_row'
        || '|' || (original_source_metadata->'all_source_rows')::text
        || '|' || coalesce(original_source_metadata->>'source_tag', '')
        || '|' || external_sheet_row_ref
      FROM public.leads WHERE id = '${leadId}'
    `)
    expect(meta).toContain('910010')
    expect(meta).toContain('910763')
    expect(meta).toContain('2026_leads_crm:Leads:910010')
    expect(
      sqlQuery(`
        SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = '${MIGRATION_053_RPC}'
      `),
    ).toContain("bulk_import_row:' || v_batch_id || ':' || v_row_ref")
    expect(
      sqlQuery(`
        SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'quick_add_acquire_identity_locks'
      `),
    ).toContain('quick_add_email:')
  })

  it('does not expose matcher helpers as authenticated or anon RPCs', async () => {
    const payload = { p_email: `${PREFIX}.helper@example.com`, p_phone: '4155550100' }
    const ownerHelper = await owner.rpc(MIGRATION_053_HELPERS[0], payload)
    expect(ownerHelper.error).toBeTruthy()
    expect(errMsg(ownerHelper.error)).toMatch(/permission denied|42501|not found|PGRST/i)
    const advisorHelper = await advisor.rpc(MIGRATION_053_HELPERS[1], {
      p_email: `${PREFIX}.helper@example.com`,
      p_phone: '4155550100',
      p_first_name: 'Ada',
      p_last_name: 'Lovelace',
      p_candidates: [],
    })
    expect(advisorHelper.error).toBeTruthy()
    const anonHelper = await anon.rpc(MIGRATION_053_HELPERS[0], payload)
    expect(anonHelper.error).toBeTruthy()
  })

  it('creates a Bulk Lead Import through the writer, shows it in Intake, and archives it with 052 semantics', async () => {
    const imported = await importOne(owner, {
      first_name: 'Archive',
      last_name: 'Lifecycle',
      raw_email: `${PREFIX}.archive@example.com`,
      raw_phone: '4155550144',
    })
    expect(imported.error).toBeNull()
    const row = imported.data as Record<string, unknown>
    const householdId = String(row.household_id)
    const leadId = String(row.lead_id)
    expect(row.created).toBe(true)
    expect(sqlQuery(`SELECT consent_snapshot::text || '|' || status FROM public.leads WHERE id = '${leadId}'`)).toBe(
      '{}|unassigned',
    )
    expect(sqlQuery(`SELECT coalesce(assigned_advisor_id::text, 'null') FROM public.leads WHERE id = '${leadId}'`)).toBe(
      'null',
    )
    expect(sqlQuery(`SELECT count(*) FROM public.opportunities WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.policies WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.policy_applications WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.policy_writing_commission_events e JOIN public.policies p ON p.id = e.policy_id WHERE p.household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.tasks WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.activities WHERE household_id = '${householdId}'`)).toBe('0')

    const queue = await fetchIntakeQueue(owner, { limit: 200 })
    const queued = queue.find((item) => item.leadId === leadId)
    expect(queued).toBeTruthy()
    expect(queued?.leadType).toBe(BULK_LEAD_IMPORT_LEAD_TYPE)
    expect(queued?.assignedAdvisor).toBeNull()

    const denied = await archiveIntakeLead(advisor, { leadId, reason: 'not_a_fit' })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('not_authorized')

    const anonArchive = await anon.rpc(MIGRATION_053_ARCHIVE_RPC, {
      p_lead_id: leadId,
      p_reason: 'not_a_fit',
    })
    expect(anonArchive.error).toBeTruthy()

    const archived = await archiveIntakeLead(owner, { leadId, reason: 'not_a_fit' })
    expect(archived).toEqual({
      ok: true,
      lead_id: leadId,
      archived: true,
      reason: 'not_a_fit',
      follow_up_task_completed: false,
    })

    const after = sqlQuery(`
      SELECT (deleted_at IS NOT NULL)::text
        || '|' || (SELECT count(*)::text FROM public.activities WHERE household_id = '${householdId}')
        || '|' || (SELECT coalesce(max(title), '') FROM public.activities WHERE household_id = '${householdId}')
        || '|' || (SELECT coalesce(max(body), '') FROM public.activities WHERE household_id = '${householdId}')
        || '|' || (
          SELECT (a.created_at <= l.deleted_at)::text
          FROM public.activities a
          JOIN public.leads l ON l.id = a.lead_id
          WHERE a.household_id = '${householdId}' AND a.title = 'Intake archived'
          LIMIT 1
        )
      FROM public.leads WHERE id = '${leadId}'
    `)
    expect(after).toBe('true|1|Intake archived|Bulk Lead Import Intake archived as Not a Fit.|true')
    expect(sqlQuery(`SELECT count(*) FROM public.opportunities WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.policies WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.policy_applications WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.tasks WHERE household_id = '${householdId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.assessments WHERE household_id = '${householdId}'`)).toBe('0')

    const gone = await fetchIntakeQueue(owner, { limit: 200 })
    expect(gone.some((item) => item.leadId === leadId)).toBe(false)

    const repeat = await archiveIntakeLead(owner, { leadId, reason: 'not_a_fit' })
    expect(repeat.ok).toBe(false)
    if (!repeat.ok) expect(repeat.code).toBe('already_archived')
  })

  it('still archives Report Card and Digital Identity leads and rejects unsupported types', async () => {
    const family = await seedSyntheticLead('Family Report Card')
    const di = await seedSyntheticLead('Digital Identity')
    const unsupported = await seedSyntheticLead('Future Widget')
    const manual = await seedSyntheticLead('Manual Contact')

    const familyResult = await archiveIntakeLead(owner, { leadId: family.leadId, reason: 'dismissed' })
    expect(familyResult.ok).toBe(true)
    expect(sqlQuery(`SELECT title FROM public.activities WHERE lead_id = '${family.leadId}'`)).toBe('Intake archived')
    expect(sqlQuery(`SELECT (deleted_at IS NOT NULL)::text FROM public.leads WHERE id = '${family.leadId}'`)).toBe(
      'true',
    )

    const diResult = await archiveIntakeLead(owner, { leadId: di.leadId, reason: 'spam' })
    expect(diResult.ok).toBe(true)
    expect(sqlQuery(`SELECT body FROM public.activities WHERE lead_id = '${di.leadId}'`)).toBe(
      'Digital Identity Intake archived as Spam.',
    )

    const future = await archiveIntakeLead(owner, { leadId: unsupported.leadId, reason: 'dismissed' })
    expect(future.ok).toBe(false)
    if (!future.ok) expect(future.code).toBe('not_intake_lead')
    expect(sqlQuery(`SELECT (deleted_at IS NULL)::text FROM public.leads WHERE id = '${unsupported.leadId}'`)).toBe(
      'true',
    )

    const manualResult = await archiveIntakeLead(owner, { leadId: manual.leadId, reason: 'dismissed' })
    expect(manualResult.ok).toBe(false)
    if (!manualResult.ok) expect(manualResult.code).toBe('not_intake_lead')
  })
})
