/**
 * Local Supabase integration for Migration 038 historical import support:
 * owner-only canonical clients without contact, inactive product preservation,
 * and explicit historical dates.
 *
 * Skips automatically when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass038!'
const PREFIX = 'm038hi'

const RELATIONSHIP_PIPELINE_ID = '22222222-2222-2222-2222-222222222201'
const RELATIONSHIP_STAGE_ID = '33333333-3333-3333-3333-333333333001'

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

function sqlIdList(ids: string[]): string {
  return ids.map((id) => `'${id}'`).join(',')
}

function compositeRow(data: unknown): Record<string, unknown> {
  return (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 038 historical import support (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let anon: SupabaseClient

  let ownerId = ''
  let advisorAUserId = ''
  let advisorAProfileId = ''

  let householdA = ''
  let memberA1 = ''

  let carrierId = ''
  let productActiveId = ''
  let productInactiveId = ''

  const created = {
    households: [] as string[],
    applications: [] as string[],
    carriers: [] as string[],
    members: [] as string[],
  }

  let numberSeq = 0
  function uniq(label: string): string {
    numberSeq += 1
    return `${PREFIX}-${label}-${randomUUID().slice(0, 8)}-${numberSeq}`
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
    sqlQuery(
      `UPDATE public.profiles SET role = '${role}', is_active = true, deleted_at = NULL WHERE id = '${userId}'`,
    )
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

  async function seedHousehold(label: string, advisorProfileId: string): Promise<string> {
    const id = randomUUID()
    const { error } = await admin.from('households').insert({
      id,
      display_name: `${PREFIX} ${label}`,
      status: 'client',
      lead_source: 'family_report_card',
      relationship_pipeline_id: RELATIONSHIP_PIPELINE_ID,
      relationship_stage_id: RELATIONSHIP_STAGE_ID,
      assigned_advisor_id: advisorProfileId,
      assigned_at: new Date().toISOString(),
      assigned_by_user_id: ownerId,
      assignment_reason: 'manual',
      created_by_user_id: ownerId,
    })
    if (error) throw error
    created.households.push(id)
    await admin.from('advisor_assignments').insert({
      household_id: id,
      advisor_id: advisorProfileId,
      assignment_role: 'primary',
      reason: 'manual',
      assigned_by_user_id: ownerId,
    })
    return id
  }

  async function seedMember(
    householdId: string,
    firstName: string,
    lastName: string,
    isPrimary: boolean,
  ): Promise<string> {
    const id = randomUUID()
    const { error } = await admin.from('household_members').insert({
      id,
      household_id: householdId,
      first_name: firstName,
      last_name: lastName,
      relationship: isPrimary ? 'primary' : 'spouse',
      is_primary_contact: isPrimary,
    })
    if (error) throw error
    created.members.push(id)
    return id
  }

  function participantsLife(memberId: string) {
    return [
      { household_member_id: memberId, role: 'primary_client' },
      { household_member_id: memberId, role: 'insured' },
      { household_member_id: memberId, role: 'owner' },
    ]
  }

  function writingFull(advisorProfileId: string) {
    return [
      {
        recipient_type: 'advisor',
        advisor_id: advisorProfileId,
        allocation_role: 'writing',
        commission_bps: 10000,
        production_credit_bps: 10000,
        contract_level_snapshot: '100%',
      },
    ]
  }

  function lifePayload(over: Record<string, unknown> = {}) {
    return {
      household_id: householdA,
      carrier_id: carrierId,
      product_id: productActiveId,
      product_line: 'life_term',
      state: 'TX',
      submitted_premium_cents: 240000,
      premium_mode: 'annual',
      participants: participantsLife(memberA1),
      allocations: writingFull(advisorAProfileId),
      ...over,
    }
  }

  async function createApp(client: SupabaseClient, payload: Record<string, unknown>) {
    const res = await client.rpc('create_policy_application', { p_payload: payload })
    const id = res.data?.application_id
    if (typeof id === 'string') created.applications.push(id)
    return res
  }

  async function newLifeApp(over: Record<string, unknown> = {}): Promise<string> {
    const res = await createApp(owner, lifePayload(over))
    expect(errMsg(res.error), 'life fixture create').toBe('')
    return res.data.application_id as string
  }

  async function transition(
    client: SupabaseClient,
    applicationId: string,
    toStage: string,
    opts: {
      reason?: string | null
      fields?: Record<string, unknown>
      delivery?: string | null
    } = {},
  ) {
    return client.rpc('transition_policy_application_stage', {
      p_application_id: applicationId,
      p_to_stage: toStage,
      p_disposition: null,
      p_delivery_status: opts.delivery ?? null,
      p_reason: opts.reason ?? null,
      p_fields: opts.fields ?? {},
    })
  }

  async function advanceToApproved(applicationId: string, submissionDate?: string) {
    expect(
      errMsg(
        (
          await transition(owner, applicationId, 'submitted', {
            fields: submissionDate ? { submission_date: submissionDate } : {},
          })
        ).error,
      ),
    ).toBe('')
    expect(errMsg((await transition(owner, applicationId, 'approved')).error)).toBe('')
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    ownerId = await ensureUser(`${PREFIX}.owner@example.com`, 'M038 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}.advA@example.com`, 'M038 AdvA', 'advisor')
    await ensureAdvisorProfile(ownerId, `${PREFIX}-owner`)
    advisorAProfileId = await ensureAdvisorProfile(advisorAUserId, `${PREFIX}-a`)

    owner = await signIn(`${PREFIX}.owner@example.com`)
    advisorA = await signIn(`${PREFIX}.advA@example.com`)

    householdA = await seedHousehold('Household A', advisorAProfileId)
    memberA1 = await seedMember(householdA, 'Ada', 'Alpha', true)

    const carrier = await owner.rpc('create_carrier', {
      p_code: uniq('c-main'),
      p_name: `${PREFIX} Carrier ${randomUUID().slice(0, 8)}`,
    })
    expect(errMsg(carrier.error)).toBe('')
    carrierId = compositeRow(carrier.data).id as string
    created.carriers.push(carrierId)

    const active = await owner.rpc('create_insurance_product', {
      p_carrier_id: carrierId,
      p_name: `${PREFIX} Active Term ${randomUUID().slice(0, 8)}`,
      p_product_line: 'life_term',
    })
    expect(errMsg(active.error)).toBe('')
    productActiveId = compositeRow(active.data).id as string

    const inactive = await owner.rpc('create_insurance_product', {
      p_carrier_id: carrierId,
      p_name: `${PREFIX} Inactive Term ${randomUUID().slice(0, 8)}`,
      p_product_line: 'life_term',
    })
    expect(errMsg(inactive.error)).toBe('')
    productInactiveId = compositeRow(inactive.data).id as string
    const deactivated = await owner.rpc('update_insurance_product', {
      p_id: productInactiveId,
      p_name: null,
      p_is_active: false,
    })
    expect(errMsg(deactivated.error)).toBe('')
  }, 180_000)

  afterAll(async () => {
    if (!admin) return
    const apps = sqlIdList(created.applications)
    const households = sqlIdList(created.households)
    const carriers = sqlIdList(created.carriers)
    if (created.applications.length) {
      sqlQuery(
        `DELETE FROM public.policy_application_expected_compensations WHERE application_id IN (${apps})`,
      )
      sqlQuery(`DELETE FROM public.policies WHERE source_application_id IN (${apps})`)
      sqlQuery(`DELETE FROM public.policy_applications WHERE id IN (${apps})`)
    }
    if (created.households.length) {
      sqlQuery(`DELETE FROM public.leads WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.notes WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.tasks WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.policies WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.household_members WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.advisor_assignments WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.households WHERE id IN (${households})`)
    }
    if (created.carriers.length) {
      sqlQuery(`DELETE FROM public.insurance_products WHERE carrier_id IN (${carriers})`)
      sqlQuery(`DELETE FROM public.carriers WHERE id IN (${carriers})`)
    }
  }, 180_000)

  describe('canonical client creation', () => {
    it('lets the owner create a household/member without email or phone', async () => {
      const res = await owner.rpc('create_canonical_client', {
        p_payload: { first_name: 'NoContact', last_name: `${PREFIX} One` },
      })
      expect(errMsg(res.error)).toBe('')
      expect(res.data?.ok).toBe(true)
      expect(res.data?.created).toBe(true)
      const householdId = res.data.household_id as string
      const memberId = res.data.member_id as string
      created.households.push(householdId)
      created.members.push(memberId)

      const household = await admin
        .from('households')
        .select('display_name,status,primary_email,primary_phone,normalized_email,normalized_phone')
        .eq('id', householdId)
        .single()
      expect(household.data?.display_name).toBe(`NoContact ${PREFIX} One`)
      expect(household.data?.status).toBe('client')
      expect(household.data?.primary_email).toBeNull()
      expect(household.data?.primary_phone).toBeNull()
      expect(household.data?.normalized_email).toBeNull()
      expect(household.data?.normalized_phone).toBeNull()

      const member = await admin
        .from('household_members')
        .select('first_name,last_name,email,phone,date_of_birth,is_primary_contact')
        .eq('id', memberId)
        .single()
      expect(member.data?.first_name).toBe('NoContact')
      expect(member.data?.email).toBeNull()
      expect(member.data?.phone).toBeNull()
      expect(member.data?.date_of_birth).toBeNull()
      expect(member.data?.is_primary_contact).toBe(true)
    })

    it('treats DOB as optional and writes only household_members.date_of_birth', async () => {
      const omitted = await owner.rpc('create_canonical_client', {
        p_payload: { first_name: 'DobOmit', last_name: `${PREFIX} Two` },
      })
      expect(errMsg(omitted.error)).toBe('')
      created.households.push(omitted.data.household_id as string)
      created.members.push(omitted.data.member_id as string)
      const omittedDob = sqlQuery(
        `SELECT date_of_birth::text FROM public.household_members WHERE id = '${omitted.data.member_id}'`,
      )
      expect(omittedDob).toBe('')

      const withDob = await owner.rpc('create_canonical_client', {
        p_payload: {
          first_name: 'DobKeep',
          last_name: `${PREFIX} Three`,
          date_of_birth: '1977-10-08',
        },
      })
      expect(errMsg(withDob.error)).toBe('')
      created.households.push(withDob.data.household_id as string)
      created.members.push(withDob.data.member_id as string)
      const stored = sqlQuery(
        `SELECT date_of_birth::text FROM public.household_members WHERE id = '${withDob.data.member_id}'`,
      )
      expect(stored).toBe('1977-10-08')

      const extraDobCols = sqlQuery(
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name = 'date_of_birth'
            AND table_name <> 'household_members'`,
      )
      expect(extraDobCols).toBe('0')
    })

    it('rejects advisor and anon use of the owner-only client RPC', async () => {
      const advisorRes = await advisorA.rpc('create_canonical_client', {
        p_payload: { first_name: 'Advisor', last_name: `${PREFIX} Denied` },
      })
      expect(errMsg(advisorRes.error)).toMatch(/CRM_PP:not_authorized/)

      const anonRes = await anon.rpc('create_canonical_client', {
        p_payload: { first_name: 'Anon', last_name: `${PREFIX} Denied` },
      })
      expect(errMsg(anonRes.error)).toMatch(/permission denied|not_authenticated|not_authorized/)
    })

    it('raises a deterministic conflict when supplied contact already exists', async () => {
      const email = `${PREFIX}.${randomUUID().slice(0, 8)}@example.com`
      const first = await owner.rpc('create_canonical_client', {
        p_payload: { first_name: 'Dup', last_name: `${PREFIX} Mail`, email },
      })
      expect(errMsg(first.error)).toBe('')
      created.households.push(first.data.household_id as string)
      created.members.push(first.data.member_id as string)

      const second = await owner.rpc('create_canonical_client', {
        p_payload: { first_name: 'Dup', last_name: `${PREFIX} Mail2`, email },
      })
      expect(errMsg(second.error)).toMatch(/HISTORICAL_CLIENT:duplicate_identity/)
    })

    it('does not weaken quick_add_contact contact requirements', async () => {
      const res = await owner.rpc('quick_add_contact', {
        p_payload: {
          first_name: 'Still',
          last_name: 'Required',
          contact_category: 'potential_client',
        },
        p_mode: 'create',
      })
      expect(errMsg(res.error)).toMatch(/QUICK_ADD:contact_required/)
    })
  })

  describe('historical inactive product', () => {
    it('rejects inactive products on the ordinary new-business path', async () => {
      const res = await createApp(
        owner,
        lifePayload({ product_id: productInactiveId }),
      )
      expect(errMsg(res.error)).toMatch(/CRM_PP:catalog_inactive/)
    })

    it('lets the owner historical path keep the exact inactive product without reactivating it', async () => {
      const res = await createApp(
        owner,
        lifePayload({
          product_id: productInactiveId,
          historical_entry: true,
        }),
      )
      expect(errMsg(res.error)).toBe('')
      const appId = res.data.application_id as string
      const row = await admin
        .from('policy_applications')
        .select('product_id,carrier_id')
        .eq('id', appId)
        .single()
      expect(row.data?.product_id).toBe(productInactiveId)
      expect(row.data?.carrier_id).toBe(carrierId)

      const product = await admin
        .from('insurance_products')
        .select('id,is_active,name')
        .eq('id', productInactiveId)
        .single()
      expect(product.data?.is_active).toBe(false)
      expect(product.data?.id).toBe(productInactiveId)
    })

    it('rejects advisor historical_entry on an inactive product', async () => {
      const res = await createApp(
        advisorA,
        lifePayload({
          product_id: productInactiveId,
          historical_entry: true,
        }),
      )
      expect(errMsg(res.error)).toMatch(/CRM_PP:not_authorized|CRM_PP:catalog_inactive/)
    })
  })

  describe('historical dates and ordinary workflow', () => {
    it('preserves explicit historical issue and in-force dates exactly', async () => {
      const appId = await newLifeApp()
      await advanceToApproved(appId, '2026-05-01')
      const issued = await transition(owner, appId, 'issued', {
        fields: {
          policy_number: uniq('pn-hist'),
          issue_date: '2026-06-16',
          historical_entry: true,
        },
      })
      expect(errMsg(issued.error)).toBe('')
      expect(issued.data?.policy_id).toBeTruthy()

      const afterIssue = await admin
        .from('policy_applications')
        .select('issue_date,in_force_date,production_stage')
        .eq('id', appId)
        .single()
      expect(afterIssue.data?.production_stage).toBe('issued')
      expect(afterIssue.data?.issue_date).toBe('2026-06-16')

      const policy = await admin
        .from('policies')
        .select('id,source_application_id,effective_date,status')
        .eq('source_application_id', appId)
        .single()
      expect(policy.data?.source_application_id).toBe(appId)
      expect(policy.data?.effective_date).toBe('2026-06-16')
      expect(policy.data?.status).toBe('issued')

      const inForce = await transition(owner, appId, 'in_force', {
        delivery: 'complete',
        fields: {
          in_force_date: '2026-07-29',
          historical_entry: true,
        },
      })
      expect(errMsg(inForce.error)).toBe('')
      const afterForce = await admin
        .from('policy_applications')
        .select('issue_date,in_force_date,production_stage')
        .eq('id', appId)
        .single()
      expect(afterForce.data?.issue_date).toBe('2026-06-16')
      expect(afterForce.data?.in_force_date).toBe('2026-07-29')
      expect(afterForce.data?.production_stage).toBe('in_force')
    })

    it('does not replace an unknown historical date with CURRENT_DATE', async () => {
      const appId = await newLifeApp()
      await advanceToApproved(appId, '2026-05-01')
      const issued = await transition(owner, appId, 'issued', {
        fields: {
          policy_number: uniq('pn-null'),
          historical_entry: true,
        },
      })
      expect(errMsg(issued.error)).toBe('')
      const afterIssue = await admin
        .from('policy_applications')
        .select('issue_date,in_force_date')
        .eq('id', appId)
        .single()
      expect(afterIssue.data?.issue_date).toBeNull()
      expect(afterIssue.data?.issue_date).not.toBe(todayIso())

      const inForce = await transition(owner, appId, 'in_force', {
        delivery: 'complete',
        fields: { historical_entry: true },
      })
      expect(errMsg(inForce.error)).toBe('')
      const afterForce = await admin
        .from('policy_applications')
        .select('issue_date,in_force_date')
        .eq('id', appId)
        .single()
      expect(afterForce.data?.issue_date).toBeNull()
      expect(afterForce.data?.in_force_date).toBeNull()
      expect(afterForce.data?.in_force_date).not.toBe(todayIso())
    })

    it('keeps the ordinary issue / in-force workflow manufacturing today when dates are omitted', async () => {
      const appId = await newLifeApp()
      await advanceToApproved(appId)
      const issued = await transition(owner, appId, 'issued', {
        fields: { policy_number: uniq('pn-ord') },
      })
      expect(errMsg(issued.error)).toBe('')
      const afterIssue = await admin
        .from('policy_applications')
        .select('issue_date,production_stage')
        .eq('id', appId)
        .single()
      expect(afterIssue.data?.production_stage).toBe('issued')
      expect(afterIssue.data?.issue_date).toBe(todayIso())

      const inForce = await transition(owner, appId, 'in_force', {
        delivery: 'complete',
      })
      expect(errMsg(inForce.error)).toBe('')
      const afterForce = await admin
        .from('policy_applications')
        .select('in_force_date,production_stage')
        .eq('id', appId)
        .single()
      expect(afterForce.data?.production_stage).toBe('in_force')
      expect(afterForce.data?.in_force_date).toBe(todayIso())
    })

    it('still rejects premium_drafted → in_force', async () => {
      const appId = await newLifeApp()
      expect(errMsg((await transition(owner, appId, 'submitted')).error)).toBe('')
      expect(errMsg((await transition(owner, appId, 'approved')).error)).toBe('')
      expect(errMsg((await transition(owner, appId, 'sent_to_draft')).error)).toBe('')
      expect(errMsg((await transition(owner, appId, 'premium_drafted')).error)).toBe('')
      expect(errMsg((await transition(owner, appId, 'in_force')).error)).toMatch(
        /CRM_PP:invalid_transition/,
      )
    })

    it('does not introduce a second client or policy system and leaves 034/035/036 RPCs in place', () => {
      const extraTables = sqlQuery(
        `SELECT coalesce(string_agg(table_name, ','), '')
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN (
              'clients', 'canonical_clients', 'historical_clients',
              'historical_policies', 'import_policies'
            )`,
      )
      expect(extraTables).toBe('')

      const rpcFlags = sqlQuery(
        `SELECT string_agg(proname, ',' ORDER BY proname)
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.proname IN (
              'create_canonical_client',
              'create_commission_import_batch',
              'pp_refresh_application_expected_compensation',
              'record_policy_writing_commission_event',
              'transition_policy_application_stage'
            )`,
      )
      expect(rpcFlags).toBe(
        'create_canonical_client,create_commission_import_batch,pp_refresh_application_expected_compensation,record_policy_writing_commission_event,transition_policy_application_stage',
      )

      const grants = sqlQuery(
        `SELECT has_function_privilege('anon','public.create_canonical_client(jsonb)','EXECUTE')::text || ',' ||
                has_function_privilege('authenticated','public.create_canonical_client(jsonb)','EXECUTE')::text || ',' ||
                has_function_privilege('anon','public.transition_policy_application_stage(uuid,text,text,text,text,jsonb)','EXECUTE')::text || ',' ||
                has_function_privilege('authenticated','public.transition_policy_application_stage(uuid,text,text,text,text,jsonb)','EXECUTE')::text`,
      )
      expect(grants).toBe('false,true,false,true')
    })
  })
})
