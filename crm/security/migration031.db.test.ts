/**
 * Local Supabase integration for hardened Migration 031 Quick Add Contact.
 * Skips automatically when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass031!'
const PREFIX = 'm031qa'

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
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
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

describe.skipIf(!localEnv)('migration 031 Quick Add Contact foundation (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorB: SupabaseClient
  let anon: SupabaseClient

  let ownerId = ''
  let advisorAUserId = ''
  let advisorBUserId = ''
  let advisorAProfileId = ''
  let advisorBProfileId = ''

  const created = {
    households: [] as string[],
    leads: [] as string[],
    members: [] as string[],
    notes: [] as string[],
    tasks: [] as string[],
  }

  async function ensureUser(
    email: string,
    fullName: string,
    role: 'owner' | 'advisor',
  ): Promise<string> {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) throw list.error
    const existing = (list.data?.users || []).find(
      (u) => (u.email || '').toLowerCase() === email.toLowerCase(),
    )
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
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: `${PREFIX}.${suffix}@example.com`,
      phone: '4155550100',
      company: 'Analytical Engines',
      job_title: 'Mathematician',
      website: 'https://example.com/ada',
      city: 'London',
      state: 'UK',
      contact_category: 'potential_client',
      how_we_met: 'Business card meetup',
      ...overrides,
    }
  }

  function trackCreateResult(result: Record<string, unknown> | null | undefined) {
    if (!result) return
    if (typeof result.household_id === 'string') created.households.push(result.household_id)
    if (typeof result.lead_id === 'string') created.leads.push(result.lead_id)
    if (typeof result.member_id === 'string') created.members.push(result.member_id)
    if (typeof result.note_id === 'string') created.notes.push(result.note_id)
    if (typeof result.task_id === 'string') created.tasks.push(result.task_id)
  }

  async function quickCreate(
    client: SupabaseClient,
    overrides: Record<string, unknown> = {},
  ) {
    const payload = basePayload(overrides)
    const { data, error } = await client.rpc('quick_add_contact', {
      p_payload: payload,
      p_mode: 'create',
    })
    return { data, error, payload }
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    ownerId = await ensureUser(`${PREFIX}.owner@example.com`, 'M031 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}.advA@example.com`, 'M031 AdvA', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}.advB@example.com`, 'M031 AdvB', 'advisor')
    await ensureAdvisorProfile(ownerId, `${PREFIX}-owner`)
    advisorAProfileId = await ensureAdvisorProfile(advisorAUserId, `${PREFIX}-a`)
    advisorBProfileId = await ensureAdvisorProfile(advisorBUserId, `${PREFIX}-b`)

    owner = await signIn(`${PREFIX}.owner@example.com`)
    advisorA = await signIn(`${PREFIX}.advA@example.com`)
    advisorB = await signIn(`${PREFIX}.advB@example.com`)
  }, 120_000)

  afterAll(async () => {
    if (!admin) return
    for (const id of created.tasks) await admin.from('tasks').delete().eq('id', id)
    for (const id of created.notes) await admin.from('notes').delete().eq('id', id)
    for (const id of created.leads) await admin.from('leads').delete().eq('id', id)
    for (const id of created.members) await admin.from('household_members').delete().eq('id', id)
    for (const id of created.households) {
      await admin.from('advisor_assignments').delete().eq('household_id', id)
      await admin.from('households').delete().eq('id', id)
    }
    sqlQuery(
      `DELETE FROM public.quick_add_duplicate_tokens WHERE actor_user_id IN ('${ownerId}','${advisorAUserId}','${advisorBUserId}')`,
    )
  }, 120_000)

  describe('schema', () => {
    it('typed columns, token purpose columns, grants; 031 present (032 allowed after P1A)', () => {
      expect(
        sqlQuery(`SELECT count(*) FROM information_schema.columns
          WHERE table_schema='public' AND table_name='household_members'
          AND column_name IN ('company','job_title','website')`),
      ).toBe('3')
      expect(
        sqlQuery(`SELECT count(*) FROM information_schema.columns
          WHERE table_schema='public' AND table_name='quick_add_duplicate_tokens'
          AND column_name IN ('operation','subject_lead_id','subject_household_id')`),
      ).toBe('3')
      expect(
        sqlQuery(
          `SELECT has_table_privilege('authenticated','public.quick_add_duplicate_tokens','SELECT')::text`,
        ),
      ).toBe('false')
      expect(
        sqlQuery(
          `SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version LIKE '031%'`,
        ),
      ).toBe('1')
    })
  })

  describe('happy path create/update', () => {
    it('owner create persists typed columns; no Activity/assessment/duplicate_review', async () => {
      const { data, error } = await quickCreate(owner, {
        note: 'Met at chamber mixer',
        follow_up_task_title: 'Call Ada',
        follow_up_due_date: '2030-01-15',
        assigned_advisor_id: advisorAProfileId,
        first_name: 'Owner',
        last_name: 'Create',
        company: 'OwnerCreate Co',
        email: `${PREFIX}.ownercreate@example.com`,
        phone: '4155551101',
      })
      expect(errMsg(error)).toBe('')
      expect(data?.ok).toBe(true)
      trackCreateResult(data)

      const { data: lead } = await admin
        .from('leads')
        .select(
          'lead_type,contact_category,how_we_met,created_by_user_id,consent_snapshot,raw_payload,ingest_match_status',
        )
        .eq('id', data.lead_id)
        .single()
      expect(lead?.lead_type).toBe('Manual Contact')
      expect(lead?.created_by_user_id).toBe(ownerId)
      expect(lead?.ingest_match_status).toBeNull()
      expect(lead?.raw_payload).toEqual({})
      expect(lead?.consent_snapshot?.consentedAt ?? null).toBeNull()

      const { data: member } = await admin
        .from('household_members')
        .select('company,job_title,website')
        .eq('id', data.member_id)
        .single()
      expect(member?.company).toBe('OwnerCreate Co')
      expect(member?.website).toBe('https://example.com/ada')

      expect(
        (
          await admin.from('assessments').select('id').eq('lead_id', data.lead_id)
        ).data ?? [],
      ).toHaveLength(0)
      expect(
        (
          await admin.from('activities').select('id').eq('household_id', data.household_id)
        ).data ?? [],
      ).toHaveLength(0)
      expect(
        (
          await admin
            .from('duplicate_reviews')
            .select('id')
            .eq('incoming_lead_id', data.lead_id)
        ).data ?? [],
      ).toHaveLength(0)
    })

    it('advisor self-assign and assignment spoof denial', async () => {
      const ok = await quickCreate(advisorA, {
        first_name: 'Self',
        last_name: 'Assign',
        company: 'Self Co',
        email: `${PREFIX}.self@example.com`,
        phone: '4155551102',
      })
      expect(ok.data?.ok).toBe(true)
      trackCreateResult(ok.data)
      const { data: hh } = await admin
        .from('households')
        .select('assigned_advisor_id')
        .eq('id', ok.data.household_id)
        .single()
      expect(hh?.assigned_advisor_id).toBe(advisorAProfileId)

      const spoof = await quickCreate(advisorA, {
        first_name: 'Spoof',
        last_name: 'Me',
        company: 'Spoof Co',
        email: `${PREFIX}.spoof2@example.com`,
        phone: '4155551103',
        assigned_advisor_id: advisorBProfileId,
      })
      expect(errMsg(spoof.error)).toMatch(/QUICK_ADD:assignment_spoof/)
    })

    it('update authorized fields via RPC; rejects unknown keys', async () => {
      const createdRes = await quickCreate(advisorA, {
        first_name: 'Upd',
        last_name: 'Target',
        company: 'UpdCo',
        email: `${PREFIX}.updtarget@example.com`,
        phone: '4155551104',
      })
      trackCreateResult(createdRes.data)
      const leadId = createdRes.data.lead_id as string

      const ok = await advisorA.rpc('update_manual_contact', {
        p_lead_id: leadId,
        p_payload: { job_title: 'Chief Analyst', how_we_met: 'Updated' },
      })
      expect(errMsg(ok.error)).toBe('')
      expect(ok.data?.ok).toBe(true)

      const badKey = await advisorA.rpc('update_manual_contact', {
        p_lead_id: leadId,
        p_payload: { job_title: 'X', assigned_advisor_id: advisorBProfileId },
      })
      expect(errMsg(badKey.error)).toMatch(/QUICK_ADD:invalid_payload/)
    })
  })

  describe('direct-write denial matrix', () => {
    let hhId = ''
    let leadId = ''
    let memberId = ''

    beforeAll(async () => {
      const seed = await quickCreate(owner, {
        first_name: 'Bypass',
        last_name: 'Seed',
        company: 'BypassCo',
        email: `${PREFIX}.bypassseed@example.com`,
        phone: '4155551200',
        assigned_advisor_id: advisorAProfileId,
      })
      expect(seed.data?.ok).toBe(true)
      trackCreateResult(seed.data)
      hhId = seed.data.household_id
      leadId = seed.data.lead_id
      memberId = seed.data.member_id
    })

    it('denies Manual Contact lead insert outside RPC', async () => {
      const ownerIns = await owner.from('leads').insert({
        household_id: hhId,
        lead_type: 'Manual Contact',
        status: 'assigned',
        sheets_sync_status: 'skipped',
        contact_category: 'vendor',
        created_by_user_id: advisorBUserId,
      })
      expect(errMsg(ownerIns.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const advIns = await advisorA.from('leads').insert({
        household_id: hhId,
        lead_type: 'Manual Contact',
        status: 'assigned',
        sheets_sync_status: 'skipped',
      })
      expect(errMsg(advIns.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const anonIns = await anon.from('leads').insert({
        household_id: hhId,
        lead_type: 'Manual Contact',
        status: 'new',
        sheets_sync_status: 'skipped',
      })
      expect(errMsg(anonIns.error)).toMatch(/permission denied|QUICK_ADD/)
    })

    it('denies direct lead field mutations', async () => {
      for (const [label, patch] of [
        ['created_by', { created_by_user_id: advisorBUserId }],
        [
          'consent',
          {
            consent_snapshot: {
              contactPermission: true,
              consentedAt: '2019-01-01T00:00:00Z',
            },
          },
        ],
        ['category', { contact_category: 'vendor' }],
        ['how_we_met', { how_we_met: 'forged' }],
      ] as const) {
        const res = await owner.from('leads').update(patch).eq('id', leadId)
        expect(errMsg(res.error), label).toMatch(/QUICK_ADD:manual_contact_rpc_required/)
      }
    })

    it('denies direct member identity mutations on Manual Contact household', async () => {
      const res = await advisorA
        .from('household_members')
        .update({
          company: 'Hacked',
          job_title: 'Hacker',
          website: 'https://evil.example',
          email: 'collide@example.com',
          phone: '4155559999',
        })
        .eq('id', memberId)
      expect(errMsg(res.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)
    })

    it('denies household identity/lifecycle bypasses; assignment still RPC-gated', async () => {
      const email = await owner
        .from('households')
        .update({ primary_email: 'hacked@example.com', normalized_email: 'hacked@example.com' })
        .eq('id', hhId)
      expect(errMsg(email.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const source = await owner
        .from('households')
        .update({ lead_source: 'hacked' })
        .eq('id', hhId)
      expect(errMsg(source.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const status = await owner.from('households').update({ status: 'client' }).eq('id', hhId)
      expect(errMsg(status.error)).toMatch(/households\.status requires|QUICK_ADD/)

      const assign = await owner
        .from('households')
        .update({ assigned_advisor_id: advisorBProfileId })
        .eq('id', hhId)
      expect(errMsg(assign.error)).toMatch(/assign_household/)
    })

    it('denies token table read/write for all clients', async () => {
      for (const client of [owner, advisorA, anon]) {
        const sel = await client.from('quick_add_duplicate_tokens').select('id').limit(1)
        expect(errMsg(sel.error)).toMatch(/permission denied/)
        const ins = await client.from('quick_add_duplicate_tokens').insert({
          actor_user_id: ownerId,
          token_hash: 'a'.repeat(64),
          operation: 'create',
          payload_fingerprint: 'b'.repeat(64),
          acknowledged: {},
          expires_at: new Date(Date.now() + 600000).toISOString(),
        })
        expect(errMsg(ins.error)).toMatch(/permission denied/)
      }
    })

    it('unrelated advisor cannot see/update Manual Contact rows', async () => {
      const upd = await advisorB
        .from('household_members')
        .update({ company: 'Nope' })
        .eq('id', memberId)
        .select('id')
      expect(errMsg(upd.error) || '').toBe('')
      expect(upd.data ?? []).toHaveLength(0)
    })
  })

  describe('token purpose / misuse matrix', () => {
    it('create token cannot update; update token cannot create; cross-contact denied', async () => {
      const a = await quickCreate(owner, {
        first_name: 'Tok',
        last_name: 'Alpha',
        company: 'TokA',
        email: `${PREFIX}.toka@example.com`,
        phone: '4155551301',
      })
      trackCreateResult(a.data)
      const b = await quickCreate(owner, {
        first_name: 'Tok',
        last_name: 'Beta',
        company: 'TokB',
        email: `${PREFIX}.tokb@example.com`,
        phone: '4155551302',
      })
      trackCreateResult(b.data)

      // Force collision for create preview
      const createPreview = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: {
          operation: 'create',
          first_name: 'Tok',
          last_name: 'Gamma',
          email: `${PREFIX}.toka@example.com`,
          phone: '4155551303',
          company: 'TokG',
        },
      })
      expect(createPreview.data?.create_token).toBeTruthy()
      const createToken = createPreview.data.create_token as string

      const updatePreview = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: {
          operation: 'update',
          lead_id: a.data.lead_id,
          first_name: 'Tok',
          last_name: 'Alpha',
          email: `${PREFIX}.tokb@example.com`,
          phone: '4155551301',
          company: 'TokA',
        },
      })
      expect(updatePreview.data?.create_token).toBeTruthy()
      const updateToken = updatePreview.data.create_token as string

      // create token used for update_separate
      const createAsUpdate = await owner.rpc('update_manual_contact', {
        p_lead_id: a.data.lead_id,
        p_payload: {
          mode: 'update_separate',
          create_token: createToken,
          email: `${PREFIX}.tokb@example.com`,
        },
      })
      expect(errMsg(createAsUpdate.error)).toMatch(/QUICK_ADD:invalid_token/)

      // update token used for create_separate
      const updateAsCreate = await owner.rpc('quick_add_contact', {
        p_payload: basePayload({
          first_name: 'Tok',
          last_name: 'Gamma',
          email: `${PREFIX}.toka@example.com`,
          phone: '4155551303',
          company: 'TokG',
        }),
        p_mode: 'create_separate',
        p_create_token: updateToken,
      })
      expect(errMsg(updateAsCreate.error)).toMatch(/QUICK_ADD:invalid_token/)

      // update token for contact A used on contact B
      const cross = await owner.rpc('update_manual_contact', {
        p_lead_id: b.data.lead_id,
        p_payload: {
          mode: 'update_separate',
          create_token: updateToken,
          email: `${PREFIX}.toka@example.com`,
        },
      })
      expect(errMsg(cross.error)).toMatch(/QUICK_ADD:invalid_token/)

      // modified identity invalidates token
      const mod = await owner.rpc('quick_add_contact', {
        p_payload: basePayload({
          first_name: 'Tok',
          last_name: 'Gamma',
          email: `${PREFIX}.toka@example.com`,
          phone: '4155551303',
          company: 'Different',
        }),
        p_mode: 'create_separate',
        p_create_token: createToken,
      })
      expect(errMsg(mod.error)).toMatch(/QUICK_ADD:invalid_token/)
    })

    it('create_separate succeeds once then replay denied', async () => {
      const email = `${PREFIX}.sep@example.com`
      const seed = await quickCreate(owner, {
        first_name: 'Sep',
        last_name: 'Seed',
        company: 'SepSeed',
        email,
        phone: '4155551401',
      })
      trackCreateResult(seed.data)

      const identity = {
        first_name: 'Sep',
        last_name: 'Two',
        email,
        phone: '4155551402',
        company: 'SepTwo',
      }
      const createPayload = {
        ...identity,
        contact_category: 'vendor',
      }
      const preview = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: { operation: 'create', ...identity },
      })
      expect(errMsg(preview.error)).toBe('')
      const token = preview.data.create_token as string
      expect(token).toBeTruthy()
      const first = await owner.rpc('quick_add_contact', {
        p_payload: createPayload,
        p_mode: 'create_separate',
        p_create_token: token,
      })
      expect(errMsg(first.error)).toBe('')
      expect(first.data?.ok).toBe(true)
      trackCreateResult(first.data)

      const replay = await owner.rpc('quick_add_contact', {
        p_payload: createPayload,
        p_mode: 'create_separate',
        p_create_token: token,
      })
      expect(errMsg(replay.error)).toMatch(/QUICK_ADD:invalid_token/)
    })

    it('rejects unknown preview keys and client exclude_household_id', async () => {
      const bad = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: {
          operation: 'create',
          first_name: 'X',
          last_name: 'Y',
          email: `${PREFIX}.previewbad@example.com`,
          exclude_household_id: randomUUID(),
        },
      })
      expect(errMsg(bad.error)).toMatch(/QUICK_ADD:invalid_payload/)
    })
  })

  describe('genuine concurrency', () => {
    it('identical double create: one success, one collision', async () => {
      const payload = basePayload({
        first_name: 'Race',
        last_name: 'One',
        company: 'RaceOne',
        email: `${PREFIX}.race1@example.com`,
        phone: '4155551501',
      })
      const [r1, r2] = await Promise.all([
        owner.rpc('quick_add_contact', { p_payload: payload, p_mode: 'create' }),
        owner.rpc('quick_add_contact', { p_payload: { ...payload }, p_mode: 'create' }),
      ])
      for (const r of [r1, r2]) if (r.data?.ok) trackCreateResult(r.data)
      expect([r1, r2].filter((r) => r.data?.ok === true)).toHaveLength(1)
      expect(
        [r1, r2].filter((r) => r.data?.ok === false && r.data?.reason === 'collision'),
      ).toHaveLength(1)
    })

    it('reversed email/phone lock ordering does not deadlock', async () => {
      const email = `${PREFIX}.lockorder@example.com`
      const phone = '4155551502'
      const pEmailFirst = basePayload({
        first_name: 'Lock',
        last_name: 'A',
        company: 'LockA',
        email,
        phone: '4155551503',
      })
      const pPhoneFirst = basePayload({
        first_name: 'Lock',
        last_name: 'B',
        company: 'LockB',
        email: `${PREFIX}.lockorderb@example.com`,
        phone,
      })
      // Seed both identifiers on different contacts first
      const s1 = await quickCreate(owner, {
        first_name: 'Seed',
        last_name: 'Email',
        company: 'SeedE',
        email,
        phone: '4155551591',
      })
      const s2 = await quickCreate(owner, {
        first_name: 'Seed',
        last_name: 'Phone',
        company: 'SeedP',
        email: `${PREFIX}.seedphone@example.com`,
        phone,
      })
      trackCreateResult(s1.data)
      trackCreateResult(s2.data)

      // Concurrent creates that each collide on different keys — locks acquired sorted
      const [c1, c2] = await Promise.all([
        owner.rpc('quick_add_contact', { p_payload: pEmailFirst, p_mode: 'create' }),
        owner.rpc('quick_add_contact', { p_payload: pPhoneFirst, p_mode: 'create' }),
      ])
      expect(c1.error || c2.error || null).toBeNull()
      expect(c1.data?.ok === false || c2.data?.ok === false).toBe(true)
    }, 30_000)

    it('create_separate token cannot be consumed twice concurrently', async () => {
      const email = `${PREFIX}.dblconsume@example.com`
      const seed = await quickCreate(owner, {
        first_name: 'Dbl',
        last_name: 'Seed',
        company: 'DblSeed',
        email,
        phone: '4155551510',
      })
      trackCreateResult(seed.data)
      const identity = {
        first_name: 'Dbl',
        last_name: 'New',
        email,
        phone: '4155551511',
        company: 'DblNew',
      }
      const createPayload = { ...identity, contact_category: 'other' }
      const preview = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: { operation: 'create', ...identity },
      })
      expect(errMsg(preview.error)).toBe('')
      const token = preview.data.create_token as string
      expect(token).toBeTruthy()
      const [a, b] = await Promise.all([
        owner.rpc('quick_add_contact', {
          p_payload: createPayload,
          p_mode: 'create_separate',
          p_create_token: token,
        }),
        owner.rpc('quick_add_contact', {
          p_payload: { ...createPayload },
          p_mode: 'create_separate',
          p_create_token: token,
        }),
      ])
      const successes = [a, b].filter((r) => r.data?.ok === true)
      const failures = [a, b].filter((r) => errMsg(r.error).includes('invalid_token') || r.data?.ok === false)
      expect(successes).toHaveLength(1)
      expect(failures.length).toBeGreaterThanOrEqual(1)
      for (const s of successes) trackCreateResult(s.data)
    })
  })

  describe('consent + validation', () => {
    it('default no consent; explicit server timestamp; fabricated denied; website validated', async () => {
      const plain = await quickCreate(owner, {
        first_name: 'No',
        last_name: 'Consent2',
        company: 'NoC2',
        email: `${PREFIX}.noc2@example.com`,
        phone: '4155551601',
      })
      expect(plain.data?.ok).toBe(true)
      trackCreateResult(plain.data)

      const fab = await quickCreate(owner, {
        first_name: 'Fab',
        last_name: 'C2',
        company: 'Fab2',
        email: `${PREFIX}.fab2@example.com`,
        phone: '4155551602',
        consentedAt: '2020-01-01T00:00:00Z',
      })
      expect(errMsg(fab.error)).toMatch(/QUICK_ADD:invalid_(consent|payload)/)

      const before = Date.now()
      const explicit = await quickCreate(owner, {
        first_name: 'Yes',
        last_name: 'C2',
        company: 'Yes2',
        email: `${PREFIX}.yes2@example.com`,
        phone: '4155551603',
        consent: {
          privacyAcknowledged: true,
          contactPermission: true,
          emailMarketingConsent: false,
          smsMarketingConsent: false,
          evidenceDescription: 'Verbal consent',
        },
      })
      expect(explicit.data?.ok).toBe(true)
      trackCreateResult(explicit.data)
      const { data: lead } = await admin
        .from('leads')
        .select('consent_snapshot')
        .eq('id', explicit.data.lead_id)
        .single()
      expect(lead?.consent_snapshot?.contactPermission).toBe(true)
      expect(typeof lead?.consent_snapshot?.consentedAt).toBe('string')
      expect(Date.parse(lead!.consent_snapshot.consentedAt)).toBeGreaterThanOrEqual(before - 5000)

      const badWeb = await quickCreate(owner, {
        first_name: 'Bad',
        last_name: 'Web',
        company: 'BadWeb',
        email: `${PREFIX}.badweb@example.com`,
        phone: '4155551604',
        website: 'javascript:alert(1)',
      })
      expect(errMsg(badWeb.error)).toMatch(/QUICK_ADD:invalid_website/)
    })
  })

  describe('Family / DI / assignment / non-manual member regressions', () => {
    it('Family Report Card ingest still works', async () => {
      const key = randomUUID()
      const email = `${PREFIX}.family@example.com`
      const { data, error } = await admin.rpc('ingest_public_family_report_card', {
        p_payload: {
          idempotency_key: key,
          match_status: 'new_prospect',
          display_name: `${PREFIX} Family`,
          first_name: 'Fam',
          last_name: 'Lead',
          email,
          phone: '4155551701',
          normalized_email: email,
          normalized_phone: '+14155551701',
          submitted_at: new Date().toISOString(),
          source_page: '/family-report-card',
          overall_score: 50,
          overall_grade: 'C',
          scoring_version: 1,
          consent_snapshot: {
            assessmentStorageAcknowledged: true,
            privacyAcknowledged: true,
            contactPermission: false,
          },
          answers: {},
          raw_payload: { source: PREFIX },
        },
      })
      expect(errMsg(error)).toBe('')
      expect(data?.household_id).toBeTruthy()
      if (data?.household_id) created.households.push(data.household_id)
      if (data?.lead_id) created.leads.push(data.lead_id)
      if (data?.member_id) created.members.push(data.member_id)
    })

    it('Digital Identity connect still works', async () => {
      const key = randomUUID()
      const email = `${PREFIX}.di@example.com`
      const { data, error } = await admin.rpc('ingest_digital_identity_connect', {
        p_payload: {
          idempotency_key: key,
          match_status: 'new_prospect',
          display_name: `${PREFIX} DI`,
          first_name: 'Di',
          last_name: 'Lead',
          email,
          phone: '4155551702',
          normalized_email: email,
          normalized_phone: '+14155551702',
          submitted_at: new Date().toISOString(),
          source_page: '/c/connect',
          consent_snapshot: {
            privacyAcknowledged: true,
            contactPermission: false,
          },
          original_source_metadata: { company: 'DI Co' },
          raw_payload: { source: PREFIX, company: 'DI Co' },
        },
      })
      expect(errMsg(error)).toBe('')
      expect(data?.household_id).toBeTruthy()
      if (data?.household_id) created.households.push(data.household_id)
      if (data?.lead_id) created.leads.push(data.lead_id)
      if (data?.member_id) created.members.push(data.member_id)
    })

    it('assign_household still works for Manual Contact', async () => {
      const createdRes = await quickCreate(owner, {
        first_name: 'Asgn',
        last_name: 'HH',
        company: 'AsgnCo',
        email: `${PREFIX}.asgn@example.com`,
        phone: '4155551703',
        assigned_advisor_id: advisorAProfileId,
      })
      trackCreateResult(createdRes.data)
      const { error } = await owner.rpc('assign_household', {
        p_household_id: createdRes.data.household_id,
        p_advisor_id: advisorBProfileId,
        p_reason: 'manual',
      })
      expect(errMsg(error)).toBe('')
      const { data: hh } = await admin
        .from('households')
        .select('assigned_advisor_id')
        .eq('id', createdRes.data.household_id)
        .single()
      expect(hh?.assigned_advisor_id).toBe(advisorBProfileId)
    })

    it('non-Manual Contact member edits still work for assigned advisor', async () => {
      // Create a non-manual household via service role (lead_source family_report_card)
      const hhId = randomUUID()
      const memberId = randomUUID()
      const { error: hhErr } = await admin.from('households').insert({
        id: hhId,
        display_name: `${PREFIX} NonManual`,
        status: 'lead',
        lead_source: 'family_report_card',
        relationship_pipeline_id: '22222222-2222-2222-2222-222222222201',
        relationship_stage_id: '33333333-3333-3333-3333-333333333001',
        assigned_advisor_id: advisorAProfileId,
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: ownerId,
        assignment_reason: 'manual',
        created_by_user_id: ownerId,
      })
      expect(errMsg(hhErr)).toBe('')
      created.households.push(hhId)
      await admin.from('advisor_assignments').insert({
        household_id: hhId,
        advisor_id: advisorAProfileId,
        assignment_role: 'primary',
        reason: 'manual',
        assigned_by_user_id: ownerId,
      })
      const { error: mErr } = await admin.from('household_members').insert({
        id: memberId,
        household_id: hhId,
        first_name: 'Non',
        last_name: 'Manual',
        relationship: 'primary',
        is_primary_contact: true,
        email: `${PREFIX}.nonmanual@example.com`,
        normalized_email: `${PREFIX}.nonmanual@example.com`,
      })
      expect(errMsg(mErr)).toBe('')
      created.members.push(memberId)

      const upd = await advisorA
        .from('household_members')
        .update({ company: 'Allowed Co', job_title: 'Advisor Edit' })
        .eq('id', memberId)
        .select('id,company')
      expect(errMsg(upd.error)).toBe('')
      expect(upd.data?.[0]?.company).toBe('Allowed Co')
    })

    it('tasks and notes remain creatable on Manual Contact household', async () => {
      const createdRes = await quickCreate(owner, {
        first_name: 'Note',
        last_name: 'Task',
        company: 'NoteTask',
        email: `${PREFIX}.notetask@example.com`,
        phone: '4155551704',
        assigned_advisor_id: advisorAProfileId,
      })
      trackCreateResult(createdRes.data)
      const note = await advisorA.from('notes').insert({
        household_id: createdRes.data.household_id,
        author_user_id: advisorAUserId,
        body: 'Follow-up note',
        visibility: 'internal',
      }).select('id').single()
      expect(errMsg(note.error)).toBe('')
      if (note.data?.id) created.notes.push(note.data.id)

      const task = await advisorA.from('tasks').insert({
        household_id: createdRes.data.household_id,
        lead_id: createdRes.data.lead_id,
        title: 'Manual follow-up',
        due_date: '2030-02-01',
        source_type: 'manual',
        created_by_user_id: advisorAUserId,
        assigned_user_id: advisorAUserId,
      }).select('id').single()
      expect(errMsg(task.error)).toBe('')
      if (task.data?.id) created.tasks.push(task.data.id)
    })
  })

  describe('additional direct-write denial matrix', () => {
    let hhId = ''
    let leadId = ''
    let memberId = ''
    let nonManualLeadId = ''
    let nonManualHhId = ''

    beforeAll(async () => {
      const seed = await quickCreate(owner, {
        first_name: 'Addl',
        last_name: 'Bypass',
        company: 'AddlCo',
        email: `${PREFIX}.addl@example.com`,
        phone: '4155551801',
        assigned_advisor_id: advisorAProfileId,
      })
      expect(seed.data?.ok).toBe(true)
      trackCreateResult(seed.data)
      hhId = seed.data.household_id
      leadId = seed.data.lead_id
      memberId = seed.data.member_id

      nonManualHhId = randomUUID()
      nonManualLeadId = randomUUID()
      await admin.from('households').insert({
        id: nonManualHhId,
        display_name: `${PREFIX} NM2`,
        status: 'lead',
        lead_source: 'family_report_card',
        relationship_pipeline_id: '22222222-2222-2222-2222-222222222201',
        relationship_stage_id: '33333333-3333-3333-3333-333333333001',
        assigned_advisor_id: advisorAProfileId,
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: ownerId,
        assignment_reason: 'manual',
        created_by_user_id: ownerId,
      })
      created.households.push(nonManualHhId)
      await admin.from('leads').insert({
        id: nonManualLeadId,
        household_id: nonManualHhId,
        lead_type: 'Family Report Card',
        status: 'assigned',
        sheets_sync_status: 'skipped',
        assigned_advisor_id: advisorAProfileId,
      })
      created.leads.push(nonManualLeadId)
    })

    it('denies piecemeal Manual Contact assembly and type transforms', async () => {
      const hhIns = await owner.from('households').insert({
        display_name: 'Piecemeal',
        status: 'lead',
        lead_source: 'manual_contact',
        relationship_pipeline_id: '22222222-2222-2222-2222-222222222201',
        relationship_stage_id: '33333333-3333-3333-3333-333333333001',
      })
      expect(errMsg(hhIns.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const memIns = await advisorA.from('household_members').insert({
        household_id: hhId,
        first_name: 'Extra',
        last_name: 'Person',
        relationship: 'spouse',
        is_primary_contact: false,
      })
      expect(errMsg(memIns.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const toManual = await owner
        .from('leads')
        .update({ lead_type: 'Manual Contact' })
        .eq('id', nonManualLeadId)
      expect(errMsg(toManual.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const fromManual = await owner
        .from('leads')
        .update({ lead_type: 'Family Report Card' })
        .eq('id', leadId)
      expect(errMsg(fromManual.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)
    })

    it('denies primary-contact flip, household move, soft/hard delete', async () => {
      const primary = await advisorA
        .from('household_members')
        .update({ is_primary_contact: false })
        .eq('id', memberId)
      expect(errMsg(primary.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const move = await owner
        .from('leads')
        .update({ household_id: nonManualHhId })
        .eq('id', leadId)
      expect(errMsg(move.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required/)

      const softLead = await owner
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', leadId)
      expect(errMsg(softLead.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required|row-level security/)

      const softHh = await owner
        .from('households')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', hhId)
      expect(errMsg(softHh.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required|row-level security/)

      const hard = await owner.from('leads').delete().eq('id', leadId)
      expect(errMsg(hard.error)).toMatch(/QUICK_ADD:manual_contact_rpc_required|permission denied/)

      const { data: still } = await admin
        .from('leads')
        .select('deleted_at,household_id,lead_type')
        .eq('id', leadId)
        .single()
      expect(still?.deleted_at).toBeNull()
      expect(still?.household_id).toBe(hhId)
      expect(still?.lead_type).toBe('Manual Contact')
    })

    it('denies token metadata mutation for all client roles', async () => {
      const preview = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: {
          operation: 'create',
          first_name: 'Addl',
          last_name: 'Tok',
          email: `${PREFIX}.addl@example.com`,
          phone: '4155551809',
          company: 'Z',
        },
      })
      const token = preview.data.create_token as string
      const hash = sqlQuery(`SELECT encode(digest('${token}', 'sha256'), 'hex')`)
      for (const client of [owner, advisorA, advisorB, anon]) {
        const upd = await client
          .from('quick_add_duplicate_tokens')
          .update({
            operation: 'update',
            subject_lead_id: leadId,
            payload_fingerprint: 'c'.repeat(64),
            expires_at: new Date(Date.now() + 999999).toISOString(),
            consumed_at: new Date().toISOString(),
          })
          .eq('token_hash', hash)
        expect(errMsg(upd.error)).toMatch(/permission denied/)
      }
    })
  })

  describe('token-at-rest and collision coverage', () => {
    it('stores hash only; ack has no raw token/PII email; cleanup keeps valid tokens', async () => {
      const seed = await quickCreate(owner, {
        first_name: 'Hash',
        last_name: 'Store',
        company: 'HashCo',
        email: `${PREFIX}.hashstore@example.com`,
        phone: '4155551901',
      })
      trackCreateResult(seed.data)
      const preview = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: {
          operation: 'create',
          first_name: 'Hash',
          last_name: 'Two',
          email: `${PREFIX}.hashstore@example.com`,
          phone: '4155551902',
          company: 'HashTwo',
        },
      })
      const raw = preview.data.create_token as string
      expect(raw).toHaveLength(64)
      const hash = sqlQuery(`SELECT encode(digest('${raw}', 'sha256'), 'hex')`)
      expect(hash).toHaveLength(64)
      expect(
        sqlQuery(
          `SELECT count(*) FROM quick_add_duplicate_tokens WHERE token_hash = '${raw}' OR acknowledged::text ILIKE '%${raw}%'`,
        ),
      ).toBe('0')
      expect(
        sqlQuery(`SELECT count(*) FROM quick_add_duplicate_tokens WHERE token_hash = '${hash}'`),
      ).toBe('1')
      const ack = sqlQuery(
        `SELECT acknowledged::text FROM quick_add_duplicate_tokens WHERE token_hash = '${hash}'`,
      )
      expect(ack).not.toMatch(/hashstore@example\.com/i)
      expect(ack).not.toMatch(/\+14155551901/)
      expect(ack).toContain('accessible_household_ids')
      expect(ack).toContain('has_restricted_collision')

      // Cleanup must not remove valid unexpired unused token
      sqlQuery(`SELECT public.quick_add_cleanup_tokens()`)
      expect(
        sqlQuery(
          `SELECT count(*) FROM quick_add_duplicate_tokens WHERE token_hash = '${hash}' AND consumed_at IS NULL AND expires_at > now()`,
        ),
      ).toBe('1')
    })

    it('advisor restricted collision ack contains no inaccessible household IDs', async () => {
      const hidden = await quickCreate(advisorB, {
        first_name: 'Hide',
        last_name: 'Me',
        company: 'HideCo',
        email: `${PREFIX}.hide@example.com`,
        phone: '4155551910',
      })
      trackCreateResult(hidden.data)
      const preview = await advisorA.rpc('preview_quick_add_contact_duplicates', {
        p_payload: {
          operation: 'create',
          first_name: 'Probe',
          last_name: 'Hide',
          email: `${PREFIX}.hide@example.com`,
          phone: '4155551911',
          company: 'Probe',
        },
      })
      expect(preview.data?.has_restricted_collision).toBe(true)
      const raw = preview.data.create_token as string
      const hash = sqlQuery(`SELECT encode(digest('${raw}', 'sha256'), 'hex')`)
      const ack = JSON.parse(
        sqlQuery(`SELECT acknowledged::text FROM quick_add_duplicate_tokens WHERE token_hash = '${hash}'`),
      )
      expect(ack.has_restricted_collision).toBe(true)
      expect(ack.accessible_household_ids ?? []).toEqual([])
      expect(JSON.stringify(ack)).not.toContain(hidden.data.household_id)
      for (const m of preview.data.matches || []) {
        expect(m.visibility).toBe('restricted')
        expect(m.household_id).toBeUndefined()
      }
    })

    it('new collision after preview requires re-preview; removed collision keeps fingerprint binding', async () => {
      const email = `${PREFIX}.stale@example.com`
      const a = await quickCreate(owner, {
        first_name: 'Stale',
        last_name: 'A',
        company: 'StaleA',
        email,
        phone: '4155551920',
      })
      trackCreateResult(a.data)

      const identity = {
        first_name: 'Stale',
        last_name: 'New',
        email,
        phone: '4155551921',
        company: 'StaleNew',
      }
      const preview1 = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: { operation: 'create', ...identity },
      })
      const token1 = preview1.data.create_token as string

      // New exact phone collision appears after preview
      const b = await quickCreate(owner, {
        first_name: 'Stale',
        last_name: 'B',
        company: 'StaleB',
        email: `${PREFIX}.staleb@example.com`,
        phone: '4155551921',
      })
      trackCreateResult(b.data)

      const stale = await owner.rpc('quick_add_contact', {
        p_payload: { ...identity, contact_category: 'vendor' },
        p_mode: 'create_separate',
        p_create_token: token1,
      })
      expect(errMsg(stale.error)).toMatch(/QUICK_ADD:invalid_token/)

      // Fresh preview acknowledges both; create_separate works
      const preview2 = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: { operation: 'create', ...identity },
      })
      const ok = await owner.rpc('quick_add_contact', {
        p_payload: { ...identity, contact_category: 'vendor' },
        p_mode: 'create_separate',
        p_create_token: preview2.data.create_token,
      })
      expect(errMsg(ok.error)).toBe('')
      expect(ok.data?.ok).toBe(true)
      trackCreateResult(ok.data)

      // Disappeared collision: preview then admin-remove colliders, same fingerprint still ok
      const email2 = `${PREFIX}.gone@example.com`
      const c = await quickCreate(owner, {
        first_name: 'Gone',
        last_name: 'C',
        company: 'GoneC',
        email: email2,
        phone: '4155551930',
      })
      trackCreateResult(c.data)
      const identity2 = {
        first_name: 'Gone',
        last_name: 'D',
        email: email2,
        phone: '4155551931',
        company: 'GoneD',
      }
      const previewGone = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: { operation: 'create', ...identity2 },
      })
      const tokenGone = previewGone.data.create_token as string
      // Remove colliding household via service_role
      await admin.from('leads').delete().eq('id', c.data.lead_id)
      await admin.from('household_members').delete().eq('household_id', c.data.household_id)
      await admin.from('advisor_assignments').delete().eq('household_id', c.data.household_id)
      await admin.from('households').delete().eq('id', c.data.household_id)

      const afterGone = await owner.rpc('quick_add_contact', {
        p_payload: { ...identity2, contact_category: 'other' },
        p_mode: 'create_separate',
        p_create_token: tokenGone,
      })
      expect(errMsg(afterGone.error)).toBe('')
      expect(afterGone.data?.ok).toBe(true)
      trackCreateResult(afterGone.data)

      // Changed payload with same token denied
      const changed = await owner.rpc('quick_add_contact', {
        p_payload: { ...identity2, company: 'Changed', contact_category: 'other' },
        p_mode: 'create_separate',
        p_create_token: tokenGone,
      })
      expect(errMsg(changed.error)).toMatch(/QUICK_ADD:invalid_token/)
    })

    it('update token invalidated when contact identity changes before consume', async () => {
      const target = await quickCreate(owner, {
        first_name: 'Mut',
        last_name: 'Target',
        company: 'MutCo',
        email: `${PREFIX}.mut@example.com`,
        phone: '4155551940',
        assigned_advisor_id: advisorAProfileId,
      })
      trackCreateResult(target.data)
      const other = await quickCreate(owner, {
        first_name: 'Mut',
        last_name: 'Other',
        company: 'OtherCo',
        email: `${PREFIX}.mutother@example.com`,
        phone: '4155551941',
      })
      trackCreateResult(other.data)

      const preview = await owner.rpc('preview_quick_add_contact_duplicates', {
        p_payload: {
          operation: 'update',
          lead_id: target.data.lead_id,
          first_name: 'Mut',
          last_name: 'Target',
          email: `${PREFIX}.mutother@example.com`,
          phone: '4155551940',
          company: 'MutCo',
        },
      })
      const token = preview.data.create_token as string

      // Change identity via authorized RPC before consuming token
      const mid = await owner.rpc('update_manual_contact', {
        p_lead_id: target.data.lead_id,
        p_payload: { company: 'MutCoChanged' },
      })
      expect(mid.data?.ok).toBe(true)

      const use = await owner.rpc('update_manual_contact', {
        p_lead_id: target.data.lead_id,
        p_payload: {
          mode: 'update_separate',
          create_token: token,
          email: `${PREFIX}.mutother@example.com`,
          company: 'MutCo',
        },
      })
      expect(errMsg(use.error)).toMatch(/QUICK_ADD:invalid_token/)
    })
  })

  describe('complete concurrency matrix', () => {
    it('create versus update targeting colliding identity', async () => {
      const email = `${PREFIX}.cu@example.com`
      const existing = await quickCreate(owner, {
        first_name: 'CU',
        last_name: 'Exist',
        company: 'CUExist',
        email: `${PREFIX}.cuexist@example.com`,
        phone: '4155551950',
        assigned_advisor_id: advisorAProfileId,
      })
      trackCreateResult(existing.data)

      const createPayload = basePayload({
        first_name: 'CU',
        last_name: 'Create',
        company: 'CUCreate',
        email,
        phone: '4155551951',
      })
      const [c, u] = await Promise.all([
        owner.rpc('quick_add_contact', { p_payload: createPayload, p_mode: 'create' }),
        owner.rpc('update_manual_contact', {
          p_lead_id: existing.data.lead_id,
          p_payload: { email, phone: '4155551950' },
        }),
      ])
      if (c.data?.ok) trackCreateResult(c.data)
      // Exactly one may claim the new email; the other collides or both collide if race loses
      const createOk = c.data?.ok === true
      const updateOk = u.data?.ok === true
      const createCollide = c.data?.ok === false && c.data?.reason === 'collision'
      const updateCollide = u.data?.ok === false && u.data?.reason === 'collision'
      expect(createOk || createCollide).toBe(true)
      expect(updateOk || updateCollide).toBe(true)
      expect(Number(createOk) + Number(updateOk)).toBeLessThanOrEqual(1)
    })

    it('update versus update on same Manual Contact', async () => {
      const target = await quickCreate(owner, {
        first_name: 'UU',
        last_name: 'Same',
        company: 'UUSame',
        email: `${PREFIX}.uusame@example.com`,
        phone: '4155551960',
        assigned_advisor_id: advisorAProfileId,
      })
      trackCreateResult(target.data)
      const [a, b] = await Promise.all([
        owner.rpc('update_manual_contact', {
          p_lead_id: target.data.lead_id,
          p_payload: { job_title: 'TitleA', how_we_met: 'A' },
        }),
        owner.rpc('update_manual_contact', {
          p_lead_id: target.data.lead_id,
          p_payload: { job_title: 'TitleB', how_we_met: 'B' },
        }),
      ])
      expect(errMsg(a.error)).toBe('')
      expect(errMsg(b.error)).toBe('')
      expect(a.data?.ok && b.data?.ok).toBe(true)
      const { data: member } = await admin
        .from('household_members')
        .select('job_title')
        .eq('id', target.data.member_id)
        .single()
      expect(['TitleA', 'TitleB']).toContain(member?.job_title)
    })

    it('update versus update on different contacts becoming duplicates', async () => {
      const a = await quickCreate(owner, {
        first_name: 'Dup',
        last_name: 'Left',
        company: 'DupL',
        email: `${PREFIX}.dupl@example.com`,
        phone: '4155551970',
        assigned_advisor_id: advisorAProfileId,
      })
      const b = await quickCreate(owner, {
        first_name: 'Dup',
        last_name: 'Right',
        company: 'DupR',
        email: `${PREFIX}.dupr@example.com`,
        phone: '4155551971',
        assigned_advisor_id: advisorAProfileId,
      })
      trackCreateResult(a.data)
      trackCreateResult(b.data)
      const shared = `${PREFIX}.dupshared@example.com`
      const [u1, u2] = await Promise.all([
        owner.rpc('update_manual_contact', {
          p_lead_id: a.data.lead_id,
          p_payload: { email: shared },
        }),
        owner.rpc('update_manual_contact', {
          p_lead_id: b.data.lead_id,
          p_payload: { email: shared },
        }),
      ])
      const oks = [u1, u2].filter((r) => r.data?.ok === true)
      const collisions = [u1, u2].filter((r) => r.data?.ok === false && r.data?.reason === 'collision')
      expect(oks.length + collisions.length).toBe(2)
      expect(oks.length).toBeLessThanOrEqual(1)
    })

    it('reversed phone/email lock order from overlapping sessions', async () => {
      const email = `${PREFIX}.revlock@example.com`
      const phone = '4155551980'
      await quickCreate(owner, {
        first_name: 'Rev',
        last_name: 'Email',
        company: 'RevE',
        email,
        phone: '4155551988',
      }).then((r) => trackCreateResult(r.data))
      await quickCreate(owner, {
        first_name: 'Rev',
        last_name: 'Phone',
        company: 'RevP',
        email: `${PREFIX}.revphone@example.com`,
        phone,
      }).then((r) => trackCreateResult(r.data))

      const [r1, r2] = await Promise.all([
        owner.rpc('quick_add_contact', {
          p_payload: basePayload({
            first_name: 'Rev',
            last_name: 'X',
            company: 'RevX',
            email,
            phone: '4155551981',
          }),
          p_mode: 'create',
        }),
        owner.rpc('quick_add_contact', {
          p_payload: basePayload({
            first_name: 'Rev',
            last_name: 'Y',
            company: 'RevY',
            email: `${PREFIX}.revy@example.com`,
            phone,
          }),
          p_mode: 'create',
        }),
      ])
      expect(r1.error || r2.error || null).toBeNull()
      expect(r1.data?.ok === false || r2.data?.ok === false).toBe(true)
    })
  })

  describe('Family/DI duplicate-resolution regression', () => {
    it('Family possible_match keep_separate and confirm_same still work', async () => {
      const candidateEmail = `${PREFIX}.famcand@example.com`
      const cand = await admin.rpc('ingest_public_family_report_card', {
        p_payload: {
          idempotency_key: randomUUID(),
          match_status: 'new_prospect',
          display_name: `${PREFIX} FamCand`,
          first_name: 'Fam',
          last_name: 'Cand',
          email: candidateEmail,
          phone: '4155551990',
          normalized_email: candidateEmail,
          normalized_phone: '+14155551990',
          submitted_at: new Date().toISOString(),
          source_page: '/family-report-card',
          overall_score: 60,
          overall_grade: 'C',
          scoring_version: 1,
          consent_snapshot: {
            assessmentStorageAcknowledged: true,
            privacyAcknowledged: true,
            contactPermission: false,
          },
          answers: {},
          raw_payload: { source: PREFIX },
        },
      })
      expect(errMsg(cand.error)).toBe('')
      trackCreateResult({
        household_id: cand.data.household_id,
        lead_id: cand.data.lead_id,
        member_id: cand.data.member_id,
      })

      const incomingKeep = await admin.rpc('ingest_public_family_report_card', {
        p_payload: {
          idempotency_key: randomUUID(),
          match_status: 'possible_match',
          candidate_household_id: cand.data.household_id,
          display_name: `${PREFIX} FamKeep`,
          first_name: 'Fam',
          last_name: 'Keep',
          email: candidateEmail,
          phone: '4155551991',
          normalized_email: candidateEmail,
          normalized_phone: '+14155551991',
          submitted_at: new Date().toISOString(),
          source_page: '/family-report-card',
          overall_score: 61,
          overall_grade: 'C',
          scoring_version: 1,
          consent_snapshot: {
            assessmentStorageAcknowledged: true,
            privacyAcknowledged: true,
            contactPermission: false,
          },
          answers: {},
          raw_payload: { source: PREFIX },
        },
      })
      expect(errMsg(incomingKeep.error)).toBe('')
      trackCreateResult({
        household_id: incomingKeep.data.household_id,
        lead_id: incomingKeep.data.lead_id,
        member_id: incomingKeep.data.member_id,
      })
      const reviewKeepId = incomingKeep.data.duplicate_review_id as string
      expect(reviewKeepId).toBeTruthy()

      const keep = await owner.rpc('resolve_public_family_duplicate_review', {
        p_duplicate_review_id: reviewKeepId,
        p_action: 'keep_separate',
        p_resolution_notes: 'm031 keep',
      })
      expect(errMsg(keep.error)).toBe('')

      const cand2 = await admin.rpc('ingest_public_family_report_card', {
        p_payload: {
          idempotency_key: randomUUID(),
          match_status: 'new_prospect',
          display_name: `${PREFIX} FamCand2`,
          first_name: 'Fam',
          last_name: 'Cand2',
          email: `${PREFIX}.famcand2@example.com`,
          phone: '4155551992',
          normalized_email: `${PREFIX}.famcand2@example.com`,
          normalized_phone: '+14155551992',
          submitted_at: new Date().toISOString(),
          source_page: '/family-report-card',
          overall_score: 62,
          overall_grade: 'C',
          scoring_version: 1,
          consent_snapshot: {
            assessmentStorageAcknowledged: true,
            privacyAcknowledged: true,
            contactPermission: false,
          },
          answers: {},
          raw_payload: { source: PREFIX },
        },
      })
      trackCreateResult({
        household_id: cand2.data.household_id,
        lead_id: cand2.data.lead_id,
        member_id: cand2.data.member_id,
      })

      const incomingConfirm = await admin.rpc('ingest_public_family_report_card', {
        p_payload: {
          idempotency_key: randomUUID(),
          match_status: 'possible_match',
          candidate_household_id: cand2.data.household_id,
          display_name: `${PREFIX} FamConfirm`,
          first_name: 'Fam',
          last_name: 'Confirm',
          email: `${PREFIX}.famcand2@example.com`,
          phone: '4155551993',
          normalized_email: `${PREFIX}.famcand2@example.com`,
          normalized_phone: '+14155551993',
          submitted_at: new Date().toISOString(),
          source_page: '/family-report-card',
          overall_score: 63,
          overall_grade: 'C',
          scoring_version: 1,
          consent_snapshot: {
            assessmentStorageAcknowledged: true,
            privacyAcknowledged: true,
            contactPermission: false,
          },
          answers: {},
          raw_payload: { source: PREFIX },
        },
      })
      trackCreateResult({
        household_id: incomingConfirm.data.household_id,
        lead_id: incomingConfirm.data.lead_id,
        member_id: incomingConfirm.data.member_id,
      })
      const reviewConfirmId = incomingConfirm.data.duplicate_review_id as string

      const confirm = await owner.rpc('resolve_public_family_duplicate_review', {
        p_duplicate_review_id: reviewConfirmId,
        p_action: 'confirm_same_household',
        p_resolution_notes: 'm031 confirm',
      })
      expect(errMsg(confirm.error)).toBe('')

      const { data: movedLead } = await admin
        .from('leads')
        .select('household_id')
        .eq('id', incomingConfirm.data.lead_id)
        .single()
      expect(movedLead?.household_id).toBe(cand2.data.household_id)
    })

    it('Digital Identity possible_match keep_separate still works', async () => {
      const email = `${PREFIX}.dicand@example.com`
      const cand = await admin.rpc('ingest_digital_identity_connect', {
        p_payload: {
          idempotency_key: randomUUID(),
          match_status: 'new_prospect',
          display_name: `${PREFIX} DICand`,
          first_name: 'Di',
          last_name: 'Cand',
          email,
          phone: '4155551994',
          normalized_email: email,
          normalized_phone: '+14155551994',
          submitted_at: new Date().toISOString(),
          source_page: '/c/connect',
          consent_snapshot: { privacyAcknowledged: true, contactPermission: false },
          original_source_metadata: {},
          raw_payload: { source: PREFIX },
        },
      })
      expect(errMsg(cand.error)).toBe('')
      trackCreateResult({
        household_id: cand.data.household_id,
        lead_id: cand.data.lead_id,
        member_id: cand.data.member_id,
      })

      const incoming = await admin.rpc('ingest_digital_identity_connect', {
        p_payload: {
          idempotency_key: randomUUID(),
          match_status: 'possible_match',
          candidate_household_id: cand.data.household_id,
          display_name: `${PREFIX} DIKeep`,
          first_name: 'Di',
          last_name: 'Keep',
          email,
          phone: '4155551995',
          normalized_email: email,
          normalized_phone: '+14155551995',
          submitted_at: new Date().toISOString(),
          source_page: '/c/connect',
          consent_snapshot: { privacyAcknowledged: true, contactPermission: false },
          original_source_metadata: {},
          raw_payload: { source: PREFIX },
        },
      })
      expect(errMsg(incoming.error)).toBe('')
      trackCreateResult({
        household_id: incoming.data.household_id,
        lead_id: incoming.data.lead_id,
        member_id: incoming.data.member_id,
      })
      expect(incoming.data.duplicate_review_id).toBeTruthy()

      const keep = await owner.rpc('resolve_digital_identity_duplicate_review', {
        p_duplicate_review_id: incoming.data.duplicate_review_id,
        p_action: 'keep_separate',
        p_resolution_notes: 'm031 di keep',
      })
      expect(errMsg(keep.error)).toBe('')
    })
  })
})
