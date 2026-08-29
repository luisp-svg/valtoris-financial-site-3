/**
 * Local Supabase integration for Migration 032 Policy Production P1A foundation.
 *
 * Covers the 45 hardening requirements for the carrier/product catalog, the
 * policy_applications production record, its participant / allocation /
 * stage-history satellites and the CRM_PP RPC surface.
 *
 * Two shapes of the migration drive most of the assertions here:
 *
 *   * There is exactly ONE application <-> policy link column,
 *     public.policies.source_application_id. policy_applications carries no
 *     mirror column, so the linked policy is always resolved by querying
 *     policies WHERE source_application_id = <application id>. Its uniqueness
 *     has no deleted_at predicate, so an application can never acquire a
 *     second policy, not even after the first one is soft deleted.
 *   * Delivery is a gate, not a label: issue leaves delivery at not_started and
 *     in_force only accepts the settled outcomes complete or not_required.
 *
 * Skips automatically when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass032!'
const PREFIX = 'm032pp'

const RELATIONSHIP_PIPELINE_ID = '22222222-2222-2222-2222-222222222201'
const RELATIONSHIP_STAGE_ID = '33333333-3333-3333-3333-333333333001'
const LIFE_VERTICAL_ID = '11111111-1111-1111-1111-111111111101'
const LIFE_PIPELINE_ID = '22222222-2222-2222-2222-222222222211'
const LIFE_STAGE_ID = '33333333-3333-3333-3333-333333333101'

/** Every table introduced (or re-granted) by 032. */
const PP_TABLES = [
  'carriers',
  'insurance_products',
  'policy_applications',
  'policy_application_participants',
  'policy_application_stage_history',
  'policy_agent_allocations',
] as const

/** Tables that migration 032 must NOT have created (deferred phases). */
const OUT_OF_SCOPE_TABLES = [
  'commission_expectations',
  'commission_transactions',
  'cases',
  'workflow_runs',
  'policy_requirements',
] as const

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

/** create_carrier / create_insurance_product return a composite row. */
function compositeRow(data: unknown): Record<string, unknown> {
  return (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 032 policy production foundation (local DB)', () => {
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

  // householdA is assigned to advisorA, householdB to advisorB.
  let householdA = ''
  let householdB = ''
  let memberA1 = ''
  let memberA2 = ''
  let memberB1 = ''
  let opportunityA = ''
  let opportunityB = ''

  let carrierId = ''
  let carrierAltId = ''
  let productTermId = ''
  let productPermId = ''
  let productFiaId = ''
  let productAltId = ''

  const created = {
    households: [] as string[],
    applications: [] as string[],
    carriers: [] as string[],
  }

  let numberSeq = 0
  /** Unique-per-run identifier so reruns never collide on the carrier indexes. */
  function uniq(label: string): string {
    numberSeq += 1
    return `${PREFIX}-${label}-${randomUUID().slice(0, 8)}-${numberSeq}`
  }

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------

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
    // Role is trigger-guarded on the authenticated path; assert it directly so
    // the owner really is an owner even if the profile row pre-existed.
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
    return id
  }

  async function seedOpportunity(householdId: string, title: string): Promise<string> {
    const id = randomUUID()
    const { error } = await admin.from('opportunities').insert({
      id,
      household_id: householdId,
      service_vertical_id: LIFE_VERTICAL_ID,
      pipeline_id: LIFE_PIPELINE_ID,
      stage_id: LIFE_STAGE_ID,
      title: `${PREFIX} ${title}`,
      status: 'open',
    })
    if (error) throw error
    return id
  }

  async function createCarrier(label: string): Promise<string> {
    const { data, error } = await owner.rpc('create_carrier', {
      p_code: uniq(`c-${label}`),
      p_name: `${PREFIX} Carrier ${label} ${randomUUID().slice(0, 8)}`,
    })
    if (error) throw error
    const carrierRowId = compositeRow(data).id as string
    created.carriers.push(carrierRowId)
    return carrierRowId
  }

  async function createProduct(
    ownerCarrierId: string,
    label: string,
    productLine: 'life_term' | 'life_permanent' | 'fia',
  ): Promise<string> {
    const { data, error } = await owner.rpc('create_insurance_product', {
      p_carrier_id: ownerCarrierId,
      p_name: `${PREFIX} Product ${label} ${randomUUID().slice(0, 8)}`,
      p_product_line: productLine,
    })
    if (error) throw error
    return compositeRow(data).id as string
  }

  // ---------------------------------------------------------------------------
  // Payload builders
  // ---------------------------------------------------------------------------

  function participantsLife(memberId: string) {
    return [
      { household_member_id: memberId, role: 'primary_client' },
      { household_member_id: memberId, role: 'insured' },
      { household_member_id: memberId, role: 'owner' },
    ]
  }

  function participantsFia(memberId: string) {
    return [
      { household_member_id: memberId, role: 'primary_client' },
      { household_member_id: memberId, role: 'owner' },
      { household_member_id: memberId, role: 'annuitant' },
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
      product_id: productTermId,
      product_line: 'life_term',
      state: 'TX',
      submitted_premium_cents: 240000,
      premium_mode: 'annual',
      participants: participantsLife(memberA1),
      allocations: writingFull(advisorAProfileId),
      ...over,
    }
  }

  function fiaPayload(over: Record<string, unknown> = {}) {
    return {
      household_id: householdA,
      carrier_id: carrierId,
      product_id: productFiaId,
      product_line: 'fia',
      state: 'TX',
      annuity_deposit_cents: 25000000,
      participants: participantsFia(memberA1),
      allocations: writingFull(advisorAProfileId),
      ...over,
    }
  }

  // ---------------------------------------------------------------------------
  // RPC wrappers
  // ---------------------------------------------------------------------------

  async function createApp(client: SupabaseClient, payload: Record<string, unknown>) {
    const res = await client.rpc('create_policy_application', { p_payload: payload })
    const id = res.data?.application_id
    if (typeof id === 'string') created.applications.push(id)
    return res
  }

  /** Creates a life application and fails loudly if the fixture itself broke. */
  async function newLifeApp(over: Record<string, unknown> = {}): Promise<string> {
    const res = await createApp(owner, lifePayload(over))
    expect(errMsg(res.error), 'life fixture create').toBe('')
    return res.data.application_id as string
  }

  async function newFiaApp(over: Record<string, unknown> = {}): Promise<string> {
    const res = await createApp(owner, fiaPayload(over))
    expect(errMsg(res.error), 'fia fixture create').toBe('')
    return res.data.application_id as string
  }

  type TransitionOpts = {
    disposition?: string | null
    delivery?: string | null
    reason?: string | null
    fields?: Record<string, unknown>
  }

  async function transition(
    client: SupabaseClient,
    applicationId: string,
    toStage: string,
    opts: TransitionOpts = {},
  ) {
    return client.rpc('transition_policy_application_stage', {
      p_application_id: applicationId,
      p_to_stage: toStage,
      p_disposition: opts.disposition ?? null,
      p_delivery_status: opts.delivery ?? null,
      p_reason: opts.reason ?? null,
      p_fields: opts.fields ?? {},
    })
  }

  async function setParticipants(
    client: SupabaseClient,
    applicationId: string,
    participants: unknown[],
    reason: string | null = null,
  ) {
    return client.rpc('set_policy_application_participants', {
      p_application_id: applicationId,
      p_participants: participants,
      p_reason: reason,
    })
  }

  async function setAllocations(
    client: SupabaseClient,
    applicationId: string,
    allocations: unknown[],
    reason: string | null = null,
  ) {
    return client.rpc('set_policy_application_allocations', {
      p_application_id: applicationId,
      p_allocations: allocations,
      p_reason: reason,
    })
  }

  /** draft -> submitted -> in_underwriting -> approved. */
  async function advanceToApproved(applicationId: string) {
    const submitted = await transition(owner, applicationId, 'submitted')
    expect(errMsg(submitted.error), 'advance submitted').toBe('')
    const underwriting = await transition(owner, applicationId, 'in_underwriting')
    expect(errMsg(underwriting.error), 'advance in_underwriting').toBe('')
    const approved = await transition(owner, applicationId, 'approved', {
      disposition: 'approved_as_applied',
    })
    expect(errMsg(approved.error), 'advance approved').toBe('')
  }

  /**
   * Full ladder up to issued; returns the created policy id. Deliberately stops
   * at issued: delivery lands on not_started there, so nothing here is allowed
   * to pre-settle the in_force gate for a caller.
   */
  async function advanceToIssued(applicationId: string, policyNumber: string): Promise<string> {
    await advanceToApproved(applicationId)
    const issued = await transition(owner, applicationId, 'issued', {
      fields: { policy_number: policyNumber },
    })
    expect(errMsg(issued.error), 'advance issued').toBe('')
    return issued.data.policy_id as string
  }

  /**
   * Walks delivery from the not_started default to complete. Every in_force
   * path has to do this (or pass p_delivery_status on the transition itself),
   * because in_force refuses every in-flight delivery status.
   */
  async function setDeliveryComplete(client: SupabaseClient, applicationId: string) {
    return client.rpc('update_policy_application', {
      p_id: applicationId,
      p_payload: { delivery_status: 'complete' },
    })
  }

  /** issued -> delivery complete -> in_force; returns the linked policy id. */
  async function advanceToInForce(applicationId: string, policyNumber: string): Promise<string> {
    const policyId = await advanceToIssued(applicationId, policyNumber)
    const delivered = await setDeliveryComplete(owner, applicationId)
    expect(errMsg(delivered.error), 'delivery complete').toBe('')
    const inForce = await transition(owner, applicationId, 'in_force')
    expect(errMsg(inForce.error), 'advance in_force').toBe('')
    return policyId
  }

  /**
   * The linked policy, resolved the only way 032 allows: through
   * policies.source_application_id. Soft-deleted rows are included on purpose —
   * the link (and its uniqueness) outlives a soft delete.
   */
  async function linkedPolicy(applicationId: string, columns = 'id') {
    const { data, error } = await admin
      .from('policies')
      .select(columns)
      .eq('source_application_id', applicationId)
      .single()
    expect(errMsg(error), 'linked policy lookup').toBe('')
    return data as unknown as Record<string, unknown>
  }

  /** Every policy row ever linked to the application, soft-deleted included. */
  async function linkedPolicyRows(applicationId: string) {
    const { data, error } = await admin
      .from('policies')
      .select('id,deleted_at')
      .eq('source_application_id', applicationId)
    expect(errMsg(error), 'linked policy rows').toBe('')
    return data ?? []
  }

  /** An unlinked, pre-existing-style policy row written straight through RLS. */
  function legacyPolicy(over: Record<string, unknown> = {}) {
    return {
      household_id: householdA,
      carrier: `${PREFIX} Legacy ${randomUUID().slice(0, 8)}`,
      policy_type: 'life_term',
      policy_number: uniq('pn-legacy').toUpperCase(),
      status: 'pending',
      ...over,
    }
  }

  async function appRow(applicationId: string, columns: string) {
    const { data, error } = await admin
      .from('policy_applications')
      .select(columns)
      .eq('id', applicationId)
      .single()
    expect(errMsg(error), 'read application').toBe('')
    return data as unknown as Record<string, unknown>
  }

  // ---------------------------------------------------------------------------
  // Setup / teardown
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    ownerId = await ensureUser(`${PREFIX}.owner@example.com`, 'M032 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}.advA@example.com`, 'M032 AdvA', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}.advB@example.com`, 'M032 AdvB', 'advisor')
    advisorAProfileId = await ensureAdvisorProfile(advisorAUserId, `${PREFIX}-a`)
    advisorBProfileId = await ensureAdvisorProfile(advisorBUserId, `${PREFIX}-b`)

    owner = await signIn(`${PREFIX}.owner@example.com`)
    advisorA = await signIn(`${PREFIX}.advA@example.com`)
    advisorB = await signIn(`${PREFIX}.advB@example.com`)

    householdA = await seedHousehold('Household A', advisorAProfileId)
    householdB = await seedHousehold('Household B', advisorBProfileId)
    memberA1 = await seedMember(householdA, 'Ada', 'Alpha', true)
    memberA2 = await seedMember(householdA, 'Alan', 'Alpha', false)
    memberB1 = await seedMember(householdB, 'Bea', 'Bravo', true)
    opportunityA = await seedOpportunity(householdA, 'Opp A')
    opportunityB = await seedOpportunity(householdB, 'Opp B')

    carrierId = await createCarrier('main')
    carrierAltId = await createCarrier('alt')
    productTermId = await createProduct(carrierId, 'term', 'life_term')
    productPermId = await createProduct(carrierId, 'perm', 'life_permanent')
    productFiaId = await createProduct(carrierId, 'fia', 'fia')
    productAltId = await createProduct(carrierAltId, 'alt-term', 'life_term')
  }, 180_000)

  afterAll(async () => {
    if (!admin) return
    const apps = sqlIdList(created.applications)
    const households = sqlIdList(created.households)
    const carriers = sqlIdList(created.carriers)

    if (created.applications.length) {
      // The link is one-directional, so the policies rows simply go first;
      // there is no mirror column on policy_applications to unwind.
      // Migration 034 expected-compensation rows RESTRICT application delete.
      sqlQuery(
        `DELETE FROM public.policy_application_expected_compensations WHERE application_id IN (${apps})`,
      )
      sqlQuery(`DELETE FROM public.policies WHERE source_application_id IN (${apps})`)
      sqlQuery(
        `DELETE FROM public.audit_logs WHERE entity_table = 'policy_applications' AND entity_id IN (${apps})`,
      )
      sqlQuery(`DELETE FROM public.policy_applications WHERE id IN (${apps})`)
    }
    if (created.households.length) {
      sqlQuery(`DELETE FROM public.policies WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.opportunities WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.household_members WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.advisor_assignments WHERE household_id IN (${households})`)
      sqlQuery(`DELETE FROM public.households WHERE id IN (${households})`)
    }
    if (created.carriers.length) {
      sqlQuery(`DELETE FROM public.insurance_products WHERE carrier_id IN (${carriers})`)
      sqlQuery(`DELETE FROM public.carriers WHERE id IN (${carriers})`)
    }
  }, 180_000)

  // ===========================================================================
  // Grants, RLS shape and deferred scope
  // ===========================================================================

  describe('grants, RLS and scope', () => {
    it('every production table is SELECT-only for authenticated and invisible to anon/PUBLIC', () => {
      // #6 #7
      for (const table of PP_TABLES) {
        const flags = sqlQuery(`SELECT
          has_table_privilege('authenticated','public.${table}','SELECT')::text || ',' ||
          has_table_privilege('authenticated','public.${table}','INSERT')::text || ',' ||
          has_table_privilege('authenticated','public.${table}','UPDATE')::text || ',' ||
          has_table_privilege('authenticated','public.${table}','DELETE')::text || ',' ||
          has_table_privilege('anon','public.${table}','SELECT')::text || ',' ||
          has_table_privilege('public','public.${table}','SELECT')::text`)
        expect(flags, `${table} privileges`).toBe('true,false,false,false,false,false')

        const rls = sqlQuery(
          `SELECT relrowsecurity::text || ',' || relforcerowsecurity::text
             FROM pg_class WHERE oid = 'public.${table}'::regclass`,
        )
        expect(rls, `${table} rls`).toBe('true,true')
      }

      // #7 — the RPC surface is authenticated-only.
      for (const signature of [
        'public.create_carrier(text,text)',
        'public.create_insurance_product(uuid,text,text)',
        'public.create_policy_application(jsonb)',
        'public.transition_policy_application_stage(uuid,text,text,text,text,jsonb)',
        'public.soft_delete_policy_application(uuid)',
      ]) {
        expect(
          sqlQuery(
            `SELECT has_function_privilege('anon','${signature}','EXECUTE')::text || ',' ||
                    has_function_privilege('authenticated','${signature}','EXECUTE')::text`,
          ),
          signature,
        ).toBe('false,true')
      }
    })

    it('does not create commission, case or requirement tables', () => {
      // #45
      expect(
        sqlQuery(`SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN (${OUT_OF_SCOPE_TABLES.map((t) => `'${t}'`).join(',')})`),
      ).toBe('0')
    })

    it('denies anon table reads and RPC execution', async () => {
      // #7
      for (const table of PP_TABLES) {
        const sel = await anon.from(table).select('id').limit(1)
        expect(errMsg(sel.error), `${table} anon select`).toMatch(/permission denied/)
      }
      const rpc = await anon.rpc('create_carrier', { p_code: 'anonx', p_name: 'Anon X' })
      expect(errMsg(rpc.error)).toMatch(/permission denied|not_authenticated/)
      const createRpc = await anon.rpc('create_policy_application', {
        p_payload: { household_id: householdA },
      })
      expect(errMsg(createRpc.error)).toMatch(/permission denied|not_authenticated/)
    })

    it('denies direct INSERT / UPDATE / DELETE for owner and advisor clients', async () => {
      // #6
      for (const [label, client] of [
        ['owner', owner],
        ['advisorA', advisorA],
      ] as const) {
        for (const table of PP_TABLES) {
          const ins = await client.from(table).insert({ id: randomUUID() })
          expect(errMsg(ins.error), `${label} ${table} insert`).toMatch(/permission denied/)
          const upd = await client
            .from(table)
            .update({ id: randomUUID() })
            .eq('id', randomUUID())
          expect(errMsg(upd.error), `${label} ${table} update`).toMatch(/permission denied/)
          const del = await client.from(table).delete().eq('id', randomUUID())
          expect(errMsg(del.error), `${label} ${table} delete`).toMatch(/permission denied/)
        }
      }
    }, 60_000)
  })

  // ===========================================================================
  // Catalog
  // ===========================================================================

  describe('carrier / product catalog', () => {
    it('owner manages the catalog via RPC; advisors cannot', async () => {
      // #8
      const code = uniq('crud')
      const name = `${PREFIX} CRUD Carrier ${randomUUID().slice(0, 8)}`
      const createdCarrier = await owner.rpc('create_carrier', { p_code: code, p_name: name })
      expect(errMsg(createdCarrier.error)).toBe('')
      expect(compositeRow(createdCarrier.data).is_active).toBe(true)
      const newCarrierId = compositeRow(createdCarrier.data).id as string
      created.carriers.push(newCarrierId)

      // Carrier codes collide case-insensitively with whitespace stripped.
      const dupCode = await owner.rpc('create_carrier', {
        p_code: code.toUpperCase().replace(/-/g, ' - '),
        p_name: `${name} Two`,
      })
      expect(errMsg(dupCode.error)).toMatch(/CRM_PP:invalid_payload/)

      const renamed = await owner.rpc('update_carrier', {
        p_id: newCarrierId,
        p_name: `${name} Renamed`,
      })
      expect(errMsg(renamed.error)).toBe('')
      expect(compositeRow(renamed.data).name).toBe(`${name} Renamed`)

      const productName = `${PREFIX} CRUD Product ${randomUUID().slice(0, 8)}`
      const product = await owner.rpc('create_insurance_product', {
        p_carrier_id: newCarrierId,
        p_name: productName,
        p_product_line: 'life_permanent',
      })
      expect(errMsg(product.error)).toBe('')
      expect(compositeRow(product.data).product_line).toBe('life_permanent')

      const dupProduct = await owner.rpc('create_insurance_product', {
        p_carrier_id: newCarrierId,
        p_name: productName.toUpperCase(),
        p_product_line: 'life_permanent',
      })
      expect(errMsg(dupProduct.error)).toMatch(/CRM_PP:invalid_payload/)

      const deactivated = await owner.rpc('update_insurance_product', {
        p_id: compositeRow(product.data).id,
        p_is_active: false,
      })
      expect(errMsg(deactivated.error)).toBe('')
      expect(compositeRow(deactivated.data).is_active).toBe(false)

      const noop = await owner.rpc('update_carrier', { p_id: newCarrierId })
      expect(errMsg(noop.error)).toMatch(/CRM_PP:missing_required_fields/)

      const missing = await owner.rpc('update_carrier', {
        p_id: randomUUID(),
        p_is_active: false,
      })
      expect(errMsg(missing.error)).toMatch(/CRM_PP:not_found/)

      // Advisors are locked out of the whole catalog write surface.
      const advisorCreate = await advisorA.rpc('create_carrier', {
        p_code: uniq('adv'),
        p_name: `${PREFIX} Advisor Carrier`,
      })
      expect(errMsg(advisorCreate.error)).toMatch(/CRM_PP:not_authorized/)
      const advisorUpdate = await advisorA.rpc('update_carrier', {
        p_id: newCarrierId,
        p_is_active: false,
      })
      expect(errMsg(advisorUpdate.error)).toMatch(/CRM_PP:not_authorized/)
      const advisorProduct = await advisorA.rpc('create_insurance_product', {
        p_carrier_id: newCarrierId,
        p_name: `${PREFIX} Advisor Product`,
        p_product_line: 'life_term',
      })
      expect(errMsg(advisorProduct.error)).toMatch(/CRM_PP:not_authorized/)

      // Products may only be added under an active carrier.
      const off = await owner.rpc('update_carrier', { p_id: newCarrierId, p_is_active: false })
      expect(errMsg(off.error)).toBe('')
      const underInactive = await owner.rpc('create_insurance_product', {
        p_carrier_id: newCarrierId,
        p_name: `${PREFIX} Blocked Product ${randomUUID().slice(0, 8)}`,
        p_product_line: 'life_term',
      })
      expect(errMsg(underInactive.error)).toMatch(/CRM_PP:catalog_inactive/)
    }, 60_000)

    it('advisors see only active catalog entries; owners see everything', async () => {
      // #9
      const hiddenCarrierId = await createCarrier('hidden')
      const hiddenCarrierProduct = await createProduct(hiddenCarrierId, 'hidden', 'life_term')
      const inactiveProductId = await createProduct(carrierId, 'inactive', 'life_term')

      expect(
        errMsg(
          (await owner.rpc('update_carrier', { p_id: hiddenCarrierId, p_is_active: false })).error,
        ),
      ).toBe('')
      expect(
        errMsg(
          (
            await owner.rpc('update_insurance_product', {
              p_id: inactiveProductId,
              p_is_active: false,
            })
          ).error,
        ),
      ).toBe('')

      const advisorCarriers = await advisorA
        .from('carriers')
        .select('id')
        .in('id', [carrierId, hiddenCarrierId])
      expect(errMsg(advisorCarriers.error)).toBe('')
      expect((advisorCarriers.data ?? []).map((r) => r.id)).toEqual([carrierId])

      const ownerCarriers = await owner
        .from('carriers')
        .select('id')
        .in('id', [carrierId, hiddenCarrierId])
      expect((ownerCarriers.data ?? [])).toHaveLength(2)

      // Inactive product, and an active product under an inactive carrier, are
      // both hidden from advisors.
      const advisorProducts = await advisorA
        .from('insurance_products')
        .select('id')
        .in('id', [productTermId, inactiveProductId, hiddenCarrierProduct])
      expect(errMsg(advisorProducts.error)).toBe('')
      expect((advisorProducts.data ?? []).map((r) => r.id)).toEqual([productTermId])

      const ownerProducts = await owner
        .from('insurance_products')
        .select('id')
        .in('id', [productTermId, inactiveProductId, hiddenCarrierProduct])
      expect((ownerProducts.data ?? [])).toHaveLength(3)
    }, 60_000)

    it('deactivated catalog blocks new applications but existing ones keep moving', async () => {
      // #10 #11
      const tempCarrierId = await createCarrier('temp')
      const tempProductId = await createProduct(tempCarrierId, 'temp', 'life_term')

      const appId = await newLifeApp({
        carrier_id: tempCarrierId,
        product_id: tempProductId,
      })
      const submitted = await transition(owner, appId, 'submitted')
      expect(errMsg(submitted.error)).toBe('')

      expect(
        errMsg(
          (
            await owner.rpc('update_insurance_product', {
              p_id: tempProductId,
              p_is_active: false,
            })
          ).error,
        ),
      ).toBe('')
      expect(
        errMsg(
          (await owner.rpc('update_carrier', { p_id: tempCarrierId, p_is_active: false })).error,
        ),
      ).toBe('')

      // #10 — the state machine never re-resolves the catalog.
      const forward = await transition(owner, appId, 'in_underwriting')
      expect(errMsg(forward.error)).toBe('')
      expect(forward.data?.to_stage).toBe('in_underwriting')

      // #11 — new production on a dead catalog entry is rejected.
      const blockedProduct = await createApp(
        owner,
        lifePayload({ carrier_id: tempCarrierId, product_id: tempProductId }),
      )
      expect(errMsg(blockedProduct.error)).toMatch(/CRM_PP:catalog_inactive/)
    }, 60_000)
  })

  // ===========================================================================
  // Row-level access
  // ===========================================================================

  describe('application visibility', () => {
    it('owner and assigned advisor read the application and its satellites', async () => {
      // #1
      const appId = await newLifeApp()

      for (const [label, client] of [
        ['owner', owner],
        ['advisorA', advisorA],
      ] as const) {
        const app = await client
          .from('policy_applications')
          .select('id,household_id,production_stage')
          .eq('id', appId)
        expect(errMsg(app.error), `${label} application`).toBe('')
        expect(app.data ?? [], `${label} application`).toHaveLength(1)
        expect(app.data![0].production_stage).toBe('draft')

        const participants = await client
          .from('policy_application_participants')
          .select('id')
          .eq('application_id', appId)
        expect(errMsg(participants.error), `${label} participants`).toBe('')
        expect(participants.data ?? [], `${label} participants`).toHaveLength(3)

        const allocations = await client
          .from('policy_agent_allocations')
          .select('id')
          .eq('application_id', appId)
        expect(allocations.data ?? [], `${label} allocations`).toHaveLength(1)

        const history = await client
          .from('policy_application_stage_history')
          .select('to_stage')
          .eq('application_id', appId)
        expect(history.data ?? [], `${label} history`).toHaveLength(1)
        expect(history.data![0].to_stage).toBe('draft')
      }
    })

    it('an advisor on another household sees nothing and gets not_found from the RPCs', async () => {
      // #2
      const appId = await newLifeApp()

      const sel = await advisorB.from('policy_applications').select('id').eq('id', appId)
      expect(errMsg(sel.error)).toBe('')
      expect(sel.data ?? []).toHaveLength(0)

      for (const table of [
        'policy_application_participants',
        'policy_agent_allocations',
        'policy_application_stage_history',
      ]) {
        const rows = await advisorB.from(table).select('id').eq('application_id', appId)
        expect(errMsg(rows.error), table).toBe('')
        expect(rows.data ?? [], table).toHaveLength(0)
      }

      const upd = await advisorB.rpc('update_policy_application', {
        p_id: appId,
        p_payload: { notes: 'cross household' },
      })
      expect(errMsg(upd.error)).toMatch(/CRM_PP:not_found/)

      const moved = await advisorB.rpc('transition_policy_application_stage', {
        p_application_id: appId,
        p_to_stage: 'submitted',
      })
      expect(errMsg(moved.error)).toMatch(/CRM_PP:not_found/)

      // Advisors also cannot create production on a household they do not hold.
      const createdForeign = await createApp(advisorB, lifePayload())
      expect(errMsg(createdForeign.error)).toMatch(/CRM_PP:not_authorized/)
    })

    it('a writing advisor without household access still cannot read the application', async () => {
      // #3
      const appId = await newLifeApp()
      const alloc = await setAllocations(owner, appId, [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 5000,
          production_credit_bps: 5000,
        },
        {
          recipient_type: 'advisor',
          advisor_id: advisorBProfileId,
          allocation_role: 'writing',
          commission_bps: 5000,
          production_credit_bps: 5000,
        },
      ])
      expect(errMsg(alloc.error)).toBe('')

      const app = await advisorB.from('policy_applications').select('id').eq('id', appId)
      expect(errMsg(app.error)).toBe('')
      expect(app.data ?? []).toHaveLength(0)

      const own = await advisorB
        .from('policy_agent_allocations')
        .select('id')
        .eq('advisor_id', advisorBProfileId)
        .eq('application_id', appId)
      expect(errMsg(own.error)).toBe('')
      expect(own.data ?? []).toHaveLength(0)
    })

    it('soft-deleted applications stay visible to the owner and vanish for advisors', async () => {
      // #4 #5
      const appId = await newLifeApp()
      const deleted = await owner.rpc('soft_delete_policy_application', {
        p_application_id: appId,
      })
      expect(errMsg(deleted.error)).toBe('')

      const ownerView = await owner
        .from('policy_applications')
        .select('id,deleted_at')
        .eq('id', appId)
      expect(ownerView.data ?? []).toHaveLength(1)
      expect(ownerView.data![0].deleted_at).not.toBeNull()

      const advisorView = await advisorA.from('policy_applications').select('id').eq('id', appId)
      expect(errMsg(advisorView.error)).toBe('')
      expect(advisorView.data ?? []).toHaveLength(0)

      const advisorSatellites = await advisorA
        .from('policy_application_participants')
        .select('id')
        .eq('application_id', appId)
      expect(advisorSatellites.data ?? []).toHaveLength(0)

      const ownerSatellites = await owner
        .from('policy_application_participants')
        .select('id')
        .eq('application_id', appId)
      expect(ownerSatellites.data ?? []).toHaveLength(3)

      // Deleted applications are closed to further writes for everyone.
      const reuse = await owner.rpc('update_policy_application', {
        p_id: appId,
        p_payload: { notes: 'after delete' },
      })
      expect(errMsg(reuse.error)).toMatch(/CRM_PP:not_found/)
    })
  })

  // ===========================================================================
  // Participants
  // ===========================================================================

  describe('participants', () => {
    it('life submission requires primary_client, insured and owner', async () => {
      // #12
      const appId = await newLifeApp({
        participants: [
          { household_member_id: memberA1, role: 'primary_client' },
          { household_member_id: memberA1, role: 'owner' },
        ],
      })
      const blocked = await transition(owner, appId, 'submitted')
      expect(errMsg(blocked.error)).toMatch(/CRM_PP:invalid_participants/)

      const fixed = await setParticipants(owner, appId, participantsLife(memberA1))
      expect(errMsg(fixed.error)).toBe('')
      expect(fixed.data?.participant_count).toBe(3)

      const submitted = await transition(owner, appId, 'submitted')
      expect(errMsg(submitted.error)).toBe('')
    })

    it('FIA submission requires an annuitant and never an insured', async () => {
      // #13
      const appId = await newFiaApp({
        participants: [
          { household_member_id: memberA1, role: 'primary_client' },
          { household_member_id: memberA1, role: 'owner' },
        ],
      })
      const blocked = await transition(owner, appId, 'submitted')
      expect(errMsg(blocked.error)).toMatch(/CRM_PP:invalid_participants/)

      // Annuitant only — no insured row at all.
      const fixed = await setParticipants(owner, appId, participantsFia(memberA1))
      expect(errMsg(fixed.error)).toBe('')

      const submitted = await transition(owner, appId, 'submitted')
      expect(errMsg(submitted.error)).toBe('')

      const roles = await admin
        .from('policy_application_participants')
        .select('role')
        .eq('application_id', appId)
        .is('effective_to', null)
      expect((roles.data ?? []).map((r) => r.role).sort()).toEqual([
        'annuitant',
        'owner',
        'primary_client',
      ])
    })

    it('rejects a participant from another household', async () => {
      // #14
      const appId = await newLifeApp()
      const cross = await setParticipants(owner, appId, [
        { household_member_id: memberA1, role: 'primary_client' },
        { household_member_id: memberB1, role: 'insured' },
        { household_member_id: memberA1, role: 'owner' },
      ])
      expect(errMsg(cross.error)).toMatch(/CRM_PP:household_mismatch/)

      const atCreate = await createApp(
        owner,
        lifePayload({
          participants: [
            { household_member_id: memberB1, role: 'primary_client' },
            { household_member_id: memberB1, role: 'insured' },
            { household_member_id: memberB1, role: 'owner' },
          ],
        }),
      )
      expect(errMsg(atCreate.error)).toMatch(/CRM_PP:household_mismatch/)
    })

    it('the assigned advisor may restructure participants before submission', async () => {
      // #15
      const appId = await newLifeApp()
      const replaced = await setParticipants(advisorA, appId, [
        { household_member_id: memberA1, role: 'primary_client' },
        { household_member_id: memberA1, role: 'insured' },
        { household_member_id: memberA2, role: 'owner' },
        { household_member_id: memberA2, role: 'payor' },
      ])
      expect(errMsg(replaced.error)).toBe('')
      expect(replaced.data?.participant_count).toBe(4)

      const current = await admin
        .from('policy_application_participants')
        .select('household_member_id,role')
        .eq('application_id', appId)
        .is('effective_to', null)
      expect(current.data ?? []).toHaveLength(4)
      const ownerRow = (current.data ?? []).find((r) => r.role === 'owner')
      expect(ownerRow?.household_member_id).toBe(memberA2)
    })

    it('post-submit participant changes are owner-only, need a reason and preserve history', async () => {
      // #16
      const appId = await newLifeApp()
      const submitted = await transition(owner, appId, 'submitted')
      expect(errMsg(submitted.error)).toBe('')

      const advisorAttempt = await setParticipants(
        advisorA,
        appId,
        participantsLife(memberA2),
        'advisor tries',
      )
      expect(errMsg(advisorAttempt.error)).toMatch(/CRM_PP:participant_change_denied/)

      const noReason = await setParticipants(owner, appId, participantsLife(memberA2))
      expect(errMsg(noReason.error)).toMatch(/CRM_PP:missing_required_fields/)

      const ok = await setParticipants(
        owner,
        appId,
        [
          { household_member_id: memberA1, role: 'primary_client' },
          { household_member_id: memberA1, role: 'insured' },
          { household_member_id: memberA2, role: 'owner' },
        ],
        'ownership restructured at carrier request',
      )
      expect(errMsg(ok.error)).toBe('')

      const all = await admin
        .from('policy_application_participants')
        .select('household_member_id,role,effective_to,change_reason')
        .eq('application_id', appId)
      const current = (all.data ?? []).filter((r) => r.effective_to === null)
      const superseded = (all.data ?? []).filter((r) => r.effective_to !== null)
      expect(current).toHaveLength(3)
      expect(superseded).toHaveLength(3)
      // Nothing is rewritten: the original owner row survives, closed out.
      expect(
        superseded.some((r) => r.role === 'owner' && r.household_member_id === memberA1),
      ).toBe(true)
      expect(
        superseded.every((r) => r.change_reason === 'ownership restructured at carrier request'),
      ).toBe(true)
      expect(current.find((r) => r.role === 'owner')?.household_member_id).toBe(memberA2)

      // An incomplete post-submit set is rejected outright.
      const incomplete = await setParticipants(
        owner,
        appId,
        [{ household_member_id: memberA1, role: 'primary_client' }],
        'dropping roles',
      )
      expect(errMsg(incomplete.error)).toMatch(/CRM_PP:invalid_participants/)
    }, 60_000)

    it('post-issue participant changes are refused for everyone', async () => {
      // #17
      const appId = await newLifeApp()
      await advanceToIssued(appId, uniq('pn-part').toUpperCase())

      const ownerAttempt = await setParticipants(
        owner,
        appId,
        participantsLife(memberA2),
        'post issue',
      )
      expect(errMsg(ownerAttempt.error)).toMatch(/CRM_PP:participant_change_denied/)

      const advisorAttempt = await setParticipants(
        advisorA,
        appId,
        participantsLife(memberA2),
        'post issue',
      )
      expect(errMsg(advisorAttempt.error)).toMatch(/CRM_PP:participant_change_denied/)
    }, 60_000)
  })

  // ===========================================================================
  // Money
  // ===========================================================================

  describe('premium and deposit validation', () => {
    it('life submission needs a modal premium and mode; face amount stays optional', async () => {
      // #18 — permanent life, the line most likely to be assumed to require a face amount.
      const appId = await newLifeApp({
        product_id: productPermId,
        product_line: 'life_permanent',
        submitted_premium_cents: undefined,
        premium_mode: undefined,
      })
      const noMoney = await transition(owner, appId, 'submitted')
      expect(errMsg(noMoney.error)).toMatch(/CRM_PP:invalid_premium/)

      const premiumOnly = await owner.rpc('update_policy_application', {
        p_id: appId,
        p_payload: { submitted_premium_cents: 180000 },
      })
      expect(errMsg(premiumOnly.error)).toBe('')
      const noMode = await transition(owner, appId, 'submitted')
      expect(errMsg(noMode.error)).toMatch(/CRM_PP:invalid_premium/)

      const withMode = await owner.rpc('update_policy_application', {
        p_id: appId,
        p_payload: { premium_mode: 'monthly' },
      })
      expect(errMsg(withMode.error)).toBe('')

      const submitted = await transition(owner, appId, 'submitted')
      expect(errMsg(submitted.error)).toBe('')

      // Face amount was never supplied and is not required in P1.
      const money = await appRow(
        appId,
        'product_line,face_amount_cents,submitted_premium_cents,premium_mode',
      )
      expect(money.product_line).toBe('life_permanent')
      expect(money.face_amount_cents).toBeNull()
      expect(Number(money.submitted_premium_cents)).toBe(180000)
      expect(money.premium_mode).toBe('monthly')
    }, 60_000)

    it('FIA submission needs a positive deposit and no life premium', async () => {
      // #19
      const appId = await newFiaApp({ annuity_deposit_cents: undefined })
      const noDeposit = await transition(owner, appId, 'submitted')
      expect(errMsg(noDeposit.error)).toMatch(/CRM_PP:invalid_premium/)

      const zero = await owner.rpc('update_policy_application', {
        p_id: appId,
        p_payload: { annuity_deposit_cents: 0 },
      })
      expect(errMsg(zero.error)).toBe('')
      const zeroSubmit = await transition(owner, appId, 'submitted')
      expect(errMsg(zeroSubmit.error)).toMatch(/CRM_PP:invalid_premium/)

      const funded = await owner.rpc('update_policy_application', {
        p_id: appId,
        p_payload: { annuity_deposit_cents: 15000000 },
      })
      expect(errMsg(funded.error)).toBe('')
      const submitted = await transition(owner, appId, 'submitted')
      expect(errMsg(submitted.error)).toBe('')

      // Life-shaped money is refused on an FIA record.
      const face = await owner.rpc('update_policy_application', {
        p_id: appId,
        p_payload: { face_amount_cents: 50000000 },
      })
      expect(errMsg(face.error)).toMatch(/CRM_PP:invalid_premium|CRM_PP:invalid_payload/)
    }, 60_000)

    it('an issued FIA never writes the deposit into policies.premium', async () => {
      // #20
      const appId = await newFiaApp()
      const policyId = await advanceToIssued(appId, uniq('pn-fia').toUpperCase())

      const { data: policy, error } = await admin
        .from('policies')
        .select(
          'premium,coverage_amount,payment_frequency,insured_member_id,policy_owner_member_id,status,details,source_application_id',
        )
        .eq('id', policyId)
        .single()
      expect(errMsg(error)).toBe('')
      expect(policy!.premium).toBeNull()
      expect(policy!.coverage_amount).toBeNull()
      expect(policy!.payment_frequency).toBeNull()
      expect(policy!.insured_member_id).toBeNull()
      expect(policy!.policy_owner_member_id).toBe(memberA1)
      expect(policy!.source_application_id).toBe(appId)

      const details = policy!.details as Record<string, unknown>
      expect(details.source).toBe('policy_production')
      expect(details.product_line).toBe('fia')
      expect(Number(details.annuity_deposit_cents)).toBe(25000000)
      expect(details.annuitant_member_id).toBe(memberA1)

      const row = await appRow(appId, 'annuity_deposit_cents,submitted_premium_cents,premium_mode')
      expect(Number(row.annuity_deposit_cents)).toBe(25000000)
      expect(row.submitted_premium_cents).toBeNull()
    }, 60_000)
  })

  // ===========================================================================
  // Allocations
  // ===========================================================================

  describe('allocations', () => {
    it('commission and production credit each have to reach exactly 10000 bps', async () => {
      // #21
      const appId = await newLifeApp()

      const split = await setAllocations(owner, appId, [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 6000,
          production_credit_bps: 4000,
        },
        {
          recipient_type: 'advisor',
          advisor_id: advisorBProfileId,
          allocation_role: 'writing',
          commission_bps: 4000,
          production_credit_bps: 6000,
        },
      ])
      expect(errMsg(split.error)).toBe('')
      expect(split.data?.allocation_count).toBe(2)

      const totals = await admin
        .from('policy_agent_allocations')
        .select('commission_bps,production_credit_bps,allocation_role')
        .eq('application_id', appId)
        .is('effective_to', null)
      const writing = (totals.data ?? []).filter((r) => r.allocation_role === 'writing')
      expect(writing.reduce((sum, r) => sum + Number(r.commission_bps), 0)).toBe(10000)
      expect(writing.reduce((sum, r) => sum + Number(r.production_credit_bps), 0)).toBe(10000)

      // Credit axis short by 1000 bps even though commission balances.
      const creditShort = await setAllocations(owner, appId, [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 6000,
          production_credit_bps: 4000,
        },
        {
          recipient_type: 'advisor',
          advisor_id: advisorBProfileId,
          allocation_role: 'writing',
          commission_bps: 4000,
          production_credit_bps: 5000,
        },
      ])
      expect(errMsg(creditShort.error)).toMatch(/CRM_PP:invalid_allocations/)

      const commissionShort = await setAllocations(owner, appId, [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 5000,
          production_credit_bps: 10000,
        },
      ])
      expect(errMsg(commissionShort.error)).toMatch(/CRM_PP:invalid_allocations/)

      const empty = await setAllocations(owner, appId, [])
      expect(errMsg(empty.error)).toMatch(/CRM_PP:invalid_allocations/)

      const duplicateRow = await setAllocations(owner, appId, [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 5000,
          production_credit_bps: 5000,
        },
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 5000,
          production_credit_bps: 5000,
        },
      ])
      expect(errMsg(duplicateRow.error)).toMatch(/CRM_PP:invalid_allocations/)
    }, 60_000)

    it('house allocations are owner-only', async () => {
      // #22
      const appId = await newLifeApp()
      const houseSet = [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 7000,
          production_credit_bps: 7000,
        },
        {
          recipient_type: 'house',
          allocation_role: 'writing',
          commission_bps: 3000,
          production_credit_bps: 3000,
        },
      ]

      const advisorAttempt = await setAllocations(advisorA, appId, houseSet)
      expect(errMsg(advisorAttempt.error)).toMatch(/CRM_PP:not_authorized/)

      const ownerAttempt = await setAllocations(owner, appId, houseSet)
      expect(errMsg(ownerAttempt.error)).toBe('')

      const rows = await admin
        .from('policy_agent_allocations')
        .select('recipient_type,advisor_id,commission_bps')
        .eq('application_id', appId)
        .is('effective_to', null)
      const house = (rows.data ?? []).find((r) => r.recipient_type === 'house')
      expect(house).toBeTruthy()
      expect(house!.advisor_id).toBeNull()
      expect(Number(house!.commission_bps)).toBe(3000)

      // An advisor cannot smuggle a house row in at creation time either.
      const atCreate = await createApp(advisorA, lifePayload({ allocations: houseSet }))
      expect(errMsg(atCreate.error)).toMatch(/CRM_PP:not_authorized/)
    }, 60_000)

    it('servicing rows must be zeroed and never count toward the totals', async () => {
      // #23
      const appId = await newLifeApp()
      const ok = await setAllocations(owner, appId, [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 10000,
          production_credit_bps: 10000,
        },
        {
          recipient_type: 'advisor',
          advisor_id: advisorBProfileId,
          allocation_role: 'servicing',
          commission_bps: 0,
          production_credit_bps: 0,
        },
      ])
      expect(errMsg(ok.error)).toBe('')
      expect(ok.data?.allocation_count).toBe(2)

      const servicing = await admin
        .from('policy_agent_allocations')
        .select('advisor_id,commission_bps,production_credit_bps')
        .eq('application_id', appId)
        .eq('allocation_role', 'servicing')
        .is('effective_to', null)
      expect(servicing.data ?? []).toHaveLength(1)
      expect(Number(servicing.data![0].commission_bps)).toBe(0)
      expect(Number(servicing.data![0].production_credit_bps)).toBe(0)

      const paidServicing = await setAllocations(owner, appId, [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 10000,
          production_credit_bps: 10000,
        },
        {
          recipient_type: 'advisor',
          advisor_id: advisorBProfileId,
          allocation_role: 'servicing',
          commission_bps: 500,
          production_credit_bps: 0,
        },
      ])
      expect(errMsg(paidServicing.error)).toMatch(/CRM_PP:invalid_allocations/)

      // Servicing rows alone cannot carry an application.
      const servicingOnly = await setAllocations(owner, appId, [
        {
          recipient_type: 'advisor',
          advisor_id: advisorBProfileId,
          allocation_role: 'servicing',
          commission_bps: 0,
          production_credit_bps: 0,
        },
      ])
      expect(errMsg(servicingOnly.error)).toMatch(/CRM_PP:invalid_allocations/)
    }, 60_000)

    it('replacing allocations supersedes the previous set instead of rewriting it', async () => {
      // #24
      const appId = await newLifeApp()
      const replaced = await setAllocations(
        owner,
        appId,
        [
          {
            recipient_type: 'advisor',
            advisor_id: advisorBProfileId,
            allocation_role: 'writing',
            commission_bps: 10000,
            production_credit_bps: 10000,
            contract_level_snapshot: '90%',
          },
        ],
        'writing agent corrected',
      )
      expect(errMsg(replaced.error)).toBe('')

      const all = await admin
        .from('policy_agent_allocations')
        .select('advisor_id,effective_from,effective_to,change_reason,contract_level_snapshot')
        .eq('application_id', appId)
      expect(all.data ?? []).toHaveLength(2)

      const closed = (all.data ?? []).filter((r) => r.effective_to !== null)
      const current = (all.data ?? []).filter((r) => r.effective_to === null)
      expect(closed).toHaveLength(1)
      expect(current).toHaveLength(1)
      expect(closed[0].advisor_id).toBe(advisorAProfileId)
      expect(closed[0].change_reason).toBe('writing agent corrected')
      expect(current[0].advisor_id).toBe(advisorBProfileId)
      expect(current[0].contract_level_snapshot).toBe('90%')
    })

    it('post-submit allocation changes are owner-only and need a reason', async () => {
      // #25
      const appId = await newLifeApp()
      const submitted = await transition(owner, appId, 'submitted')
      expect(errMsg(submitted.error)).toBe('')

      const advisorAttempt = await setAllocations(
        advisorA,
        appId,
        writingFull(advisorAProfileId),
        'advisor tries',
      )
      expect(errMsg(advisorAttempt.error)).toMatch(/CRM_PP:not_authorized/)

      const noReason = await setAllocations(owner, appId, writingFull(advisorBProfileId))
      expect(errMsg(noReason.error)).toMatch(/CRM_PP:missing_required_fields/)

      const ok = await setAllocations(
        owner,
        appId,
        writingFull(advisorBProfileId),
        'writing agent reassigned after submission',
      )
      expect(errMsg(ok.error)).toBe('')
    }, 60_000)
  })

  // ===========================================================================
  // Application number lifecycle
  // ===========================================================================

  describe('application number', () => {
    it('stays NULL through submission and is then assigned once', async () => {
      // #26 #27
      const appId = await newLifeApp()

      const early = await owner.rpc('set_policy_application_number', {
        p_application_id: appId,
        p_application_number: 'TOO-EARLY',
      })
      expect(errMsg(early.error)).toMatch(/CRM_PP:invalid_payload/)

      const submitted = await transition(owner, appId, 'submitted')
      expect(errMsg(submitted.error)).toBe('')

      // #26 — carriers have not issued anything yet.
      const beforeSet = await appRow(appId, 'application_number,application_number_normalized')
      expect(beforeSet.application_number).toBeNull()
      expect(beforeSet.application_number_normalized).toBeNull()

      // #27 — controlled NULL -> value, available to the assigned advisor too.
      const number = uniq('apn').toUpperCase()
      const assigned = await advisorA.rpc('set_policy_application_number', {
        p_application_id: appId,
        p_application_number: `  ${number}  `,
      })
      expect(errMsg(assigned.error)).toBe('')
      expect(assigned.data?.application_number).toBe(number)

      const afterSet = await appRow(appId, 'application_number,application_number_normalized')
      expect(afterSet.application_number).toBe(number)
      expect(afterSet.application_number_normalized).toBe(number.toLowerCase())

      const blank = await owner.rpc('set_policy_application_number', {
        p_application_id: appId,
        p_application_number: '   ',
      })
      expect(errMsg(blank.error)).toMatch(/CRM_PP:missing_required_fields/)
    }, 60_000)

    it('rejects a duplicate number per carrier case-insensitively', async () => {
      // #28
      const first = await newLifeApp()
      expect(errMsg((await transition(owner, first, 'submitted')).error)).toBe('')
      const number = `PP Dup ${randomUUID().slice(0, 6)}`
      const set = await owner.rpc('set_policy_application_number', {
        p_application_id: first,
        p_application_number: number,
      })
      expect(errMsg(set.error)).toBe('')

      const second = await newLifeApp()
      expect(errMsg((await transition(owner, second, 'submitted')).error)).toBe('')
      const collide = await owner.rpc('set_policy_application_number', {
        p_application_id: second,
        p_application_number: `  ${number.toUpperCase().replace(/ /g, '   ')}  `,
      })
      expect(errMsg(collide.error)).toMatch(/CRM_PP:duplicate_application_number/)

      // Uniqueness is scoped per carrier: the alternate carrier may reuse it.
      const other = await newLifeApp({
        carrier_id: carrierAltId,
        product_id: productAltId,
      })
      expect(errMsg((await transition(owner, other, 'submitted')).error)).toBe('')
      const reused = await owner.rpc('set_policy_application_number', {
        p_application_id: other,
        p_application_number: number.toLowerCase(),
      })
      expect(errMsg(reused.error)).toBe('')

      // The same guard applies at creation time.
      const atCreate = await createApp(owner, lifePayload({ application_number: number }))
      expect(errMsg(atCreate.error)).toMatch(/CRM_PP:duplicate_application_number/)
    }, 90_000)

    it('advisors cannot replace an established number; owner corrections are audited', async () => {
      // #29 #30
      const appId = await newLifeApp()
      expect(errMsg((await transition(owner, appId, 'submitted')).error)).toBe('')
      const original = uniq('apn-orig').toUpperCase()
      expect(
        errMsg(
          (
            await owner.rpc('set_policy_application_number', {
              p_application_id: appId,
              p_application_number: original,
            })
          ).error,
        ),
      ).toBe('')

      // #29
      const advisorReplace = await advisorA.rpc('set_policy_application_number', {
        p_application_id: appId,
        p_application_number: uniq('apn-adv').toUpperCase(),
      })
      expect(errMsg(advisorReplace.error)).toMatch(/CRM_PP:identifier_locked/)

      const advisorCorrect = await advisorA.rpc('correct_policy_application_number', {
        p_application_id: appId,
        p_application_number: uniq('apn-adv2').toUpperCase(),
        p_reason: 'advisor tries to correct',
      })
      expect(errMsg(advisorCorrect.error)).toMatch(/CRM_PP:not_authorized/)

      const ownerReset = await owner.rpc('set_policy_application_number', {
        p_application_id: appId,
        p_application_number: uniq('apn-owner').toUpperCase(),
      })
      expect(errMsg(ownerReset.error)).toMatch(/CRM_PP:identifier_locked/)

      // #30
      const corrected = uniq('apn-fixed').toUpperCase()
      const noReason = await owner.rpc('correct_policy_application_number', {
        p_application_id: appId,
        p_application_number: corrected,
        p_reason: '   ',
      })
      expect(errMsg(noReason.error)).toMatch(/CRM_PP:missing_required_fields/)

      const fixed = await owner.rpc('correct_policy_application_number', {
        p_application_id: appId,
        p_application_number: corrected,
        p_reason: 'carrier transposed two digits',
      })
      expect(errMsg(fixed.error)).toBe('')
      expect(fixed.data?.previous_application_number).toBe(original)

      const row = await appRow(appId, 'application_number,application_number_normalized')
      expect(row.application_number).toBe(corrected)
      expect(row.application_number_normalized).toBe(corrected.toLowerCase())

      const audit = await admin
        .from('audit_logs')
        .select('actor_user_id,action,entity_table,entity_id,before,after')
        .eq('entity_table', 'policy_applications')
        .eq('entity_id', appId)
        .eq('action', 'correct_policy_application_number')
      expect(errMsg(audit.error)).toBe('')
      expect(audit.data ?? []).toHaveLength(1)
      const entry = audit.data![0]
      expect(entry.actor_user_id).toBe(ownerId)
      expect((entry.before as Record<string, unknown>).application_number).toBe(original)
      expect((entry.after as Record<string, unknown>).application_number).toBe(corrected)
      expect((entry.after as Record<string, unknown>).reason).toBe(
        'carrier transposed two digits',
      )
    }, 90_000)

    it('the correction audit row is owner-readable, advisor-invisible and not an activity', async () => {
      // #30 — audit_logs is the security log, not a user-facing timeline.
      const appId = await newLifeApp()
      expect(errMsg((await transition(owner, appId, 'submitted')).error)).toBe('')
      const original = uniq('apn-audit').toUpperCase()
      expect(
        errMsg(
          (
            await owner.rpc('set_policy_application_number', {
              p_application_id: appId,
              p_application_number: original,
            })
          ).error,
        ),
      ).toBe('')

      const corrected = uniq('apn-audit-fixed').toUpperCase()
      const reason = 'carrier re-issued the application number'
      const fixed = await owner.rpc('correct_policy_application_number', {
        p_application_id: appId,
        p_application_number: corrected,
        p_reason: reason,
      })
      expect(errMsg(fixed.error)).toBe('')

      // The owner reads the audit row through their own client, not the
      // service role: audit_logs is SELECT-able by owners under RLS.
      const ownerAudit = await owner
        .from('audit_logs')
        .select('actor_user_id,action,entity_table,entity_id,before,after')
        .eq('entity_table', 'policy_applications')
        .eq('entity_id', appId)
        .eq('action', 'correct_policy_application_number')
      expect(errMsg(ownerAudit.error)).toBe('')
      expect(ownerAudit.data ?? []).toHaveLength(1)

      const entry = ownerAudit.data![0]
      expect(entry.actor_user_id).toBe(ownerId)
      expect(entry.action).toBe('correct_policy_application_number')
      expect(entry.entity_table).toBe('policy_applications')
      expect(entry.entity_id).toBe(appId)

      const before = entry.before as Record<string, unknown>
      const after = entry.after as Record<string, unknown>
      expect(before.application_number).toBe(original)
      expect(before.application_number_normalized).toBe(original.toLowerCase())
      expect(after.application_number).toBe(corrected)
      expect(after.application_number_normalized).toBe(corrected.toLowerCase())
      expect(after.reason).toBe(reason)

      // Advisors have no window onto the security log. The SELECT grant exists
      // but the RLS policy is owner-only, so this is an empty set, not an error.
      const advisorAudit = await advisorA
        .from('audit_logs')
        .select('id')
        .eq('entity_id', appId)
      expect(errMsg(advisorAudit.error)).toBe('')
      expect(advisorAudit.data ?? []).toHaveLength(0)

      // A correction is not a timeline event: no Activities row is produced.
      expect(
        sqlQuery(
          `SELECT count(*) FROM public.activities
             WHERE metadata::text LIKE '%${appId}%'
                OR title LIKE '%${corrected}%'
                OR body LIKE '%${corrected}%'`,
        ),
      ).toBe('0')

      // audit_logs carries no authenticated write grant of any kind, so the
      // trail can only ever grow through SECURITY DEFINER RPCs.
      expect(
        sqlQuery(`SELECT
          has_table_privilege('authenticated','public.audit_logs','SELECT')::text || ',' ||
          has_table_privilege('authenticated','public.audit_logs','INSERT')::text || ',' ||
          has_table_privilege('authenticated','public.audit_logs','UPDATE')::text || ',' ||
          has_table_privilege('authenticated','public.audit_logs','DELETE')::text`),
      ).toBe('true,false,false,false')

      // Atomicity is structural rather than observable from here: the RPC wraps
      // the UPDATE and crm_write_audit in a single BEGIN/EXCEPTION block and
      // re-raises, so a failed audit write rolls the correction back with it.
      // There is no supported way to make crm_write_audit fail mid-RPC without
      // altering the schema, so this is asserted by construction.
      const row = await appRow(appId, 'application_number,application_number_normalized')
      expect(row.application_number).toBe(corrected)
      expect(row.application_number_normalized).toBe(corrected.toLowerCase())
    }, 90_000)
  })

  // ===========================================================================
  // Stage machine
  // ===========================================================================

  describe('stage machine', () => {
    it('walks the sanctioned ladder and records every hop', async () => {
      // #31
      const appId = await newLifeApp()
      const ladder: Array<[string, TransitionOpts]> = [
        ['pre_submitted', {}],
        ['submitted', {}],
        ['in_underwriting', {}],
        ['approved', { disposition: 'approved_as_applied' }],
        ['issued', { fields: { policy_number: uniq('pn-ladder').toUpperCase() } }],
        // Delivery lands on not_started at issue, so the last hop has to carry
        // the settled outcome with it.
        ['in_force', { delivery: 'complete' }],
      ]
      for (const [stage, opts] of ladder) {
        const res = await transition(owner, appId, stage, opts)
        expect(errMsg(res.error), `to ${stage}`).toBe('')
        expect(res.data?.to_stage, `to ${stage}`).toBe(stage)
      }

      const history = await admin
        .from('policy_application_stage_history')
        .select('from_stage,to_stage')
        .eq('application_id', appId)
        .order('changed_at', { ascending: true })
      expect((history.data ?? []).map((r) => r.to_stage)).toEqual([
        'draft',
        'pre_submitted',
        'submitted',
        'in_underwriting',
        'approved',
        'issued',
        'in_force',
      ])
      expect(history.data![0].from_stage).toBeNull()
    }, 90_000)

    it('refuses unsanctioned edges and gates the backward moves', async () => {
      // #31
      const draftApp = await newLifeApp()
      for (const stage of ['incomplete', 'approved', 'issued', 'in_force', 'draft']) {
        const res = await transition(owner, draftApp, stage)
        expect(errMsg(res.error), `draft -> ${stage}`).toMatch(/CRM_PP:invalid_transition/)
      }
      const bogus = await transition(owner, draftApp, 'not_a_stage')
      expect(errMsg(bogus.error)).toMatch(/CRM_PP:invalid_transition/)

      const backApp = await newLifeApp()
      expect(errMsg((await transition(owner, backApp, 'submitted')).error)).toBe('')
      expect(errMsg((await transition(owner, backApp, 'in_underwriting')).error)).toBe('')

      const noReason = await transition(owner, backApp, 'submitted')
      expect(errMsg(noReason.error)).toMatch(/CRM_PP:missing_required_fields/)
      const withReason = await transition(owner, backApp, 'submitted', {
        reason: 'carrier lost the paperwork',
      })
      expect(errMsg(withReason.error)).toBe('')

      // approved -> in_underwriting is the one owner-only backward edge.
      expect(errMsg((await transition(owner, backApp, 'in_underwriting')).error)).toBe('')
      expect(
        errMsg(
          (await transition(owner, backApp, 'approved', { disposition: 'approved_as_applied' }))
            .error,
        ),
      ).toBe('')
      const advisorReopen = await transition(advisorA, backApp, 'in_underwriting', {
        reason: 'advisor reopens',
      })
      expect(errMsg(advisorReopen.error)).toMatch(/CRM_PP:not_authorized/)
      const ownerReopen = await transition(owner, backApp, 'in_underwriting', {
        reason: 'owner reopens for an amendment',
      })
      expect(errMsg(ownerReopen.error)).toBe('')
    }, 90_000)

    it('holds the stage / disposition invariants', async () => {
      // #32
      const appId = await newLifeApp()
      expect(errMsg((await transition(owner, appId, 'submitted')).error)).toBe('')
      expect(errMsg((await transition(owner, appId, 'in_underwriting')).error)).toBe('')

      const submittedRow = await appRow(appId, 'underwriting_disposition')
      expect(submittedRow.underwriting_disposition).toBe('pending')

      const declinedWithApproval = await transition(owner, appId, 'declined', {
        disposition: 'approved_as_applied',
      })
      expect(errMsg(declinedWithApproval.error)).toMatch(/CRM_PP:invalid_disposition/)

      const approvedWithDecline = await transition(owner, appId, 'approved', {
        disposition: 'declined',
      })
      expect(errMsg(approvedWithDecline.error)).toMatch(/CRM_PP:invalid_disposition/)

      const postponedWithPending = await transition(owner, appId, 'postponed', {
        disposition: 'pending',
      })
      expect(errMsg(postponedWithPending.error)).toMatch(/CRM_PP:invalid_disposition/)

      // declined implies the declined disposition and is terminal.
      const declined = await transition(owner, appId, 'declined')
      expect(errMsg(declined.error)).toBe('')
      expect(declined.data?.underwriting_disposition).toBe('declined')
      const declinedRow = await appRow(appId, 'production_stage,underwriting_disposition')
      expect(declinedRow.production_stage).toBe('declined')
      expect(declinedRow.underwriting_disposition).toBe('declined')

      const reopen = await transition(owner, appId, 'in_underwriting', {
        reason: 'carrier changed its mind',
      })
      expect(errMsg(reopen.error)).toMatch(/CRM_PP:invalid_transition/)
    }, 90_000)

    it('only allows pre_issue or not_required delivery before issue', async () => {
      // #33
      const appId = await newLifeApp()
      const draftRow = await appRow(appId, 'delivery_status')
      expect(draftRow.delivery_status).toBe('pre_issue')

      const tooEarly = await transition(owner, appId, 'submitted', { delivery: 'with_client' })
      expect(errMsg(tooEarly.error)).toMatch(/CRM_PP:invalid_delivery_status/)

      const optOut = await transition(owner, appId, 'submitted', { delivery: 'not_required' })
      expect(errMsg(optOut.error)).toBe('')
      expect(optOut.data?.delivery_status).toBe('not_required')

      expect(errMsg((await transition(owner, appId, 'in_underwriting')).error)).toBe('')
      expect(
        errMsg(
          (await transition(owner, appId, 'approved', { disposition: 'approved_as_applied' }))
            .error,
        ),
      ).toBe('')

      const policyNumber = uniq('pn-delivery').toUpperCase()
      const preIssueAtIssue = await transition(owner, appId, 'issued', {
        delivery: 'pre_issue',
        fields: { policy_number: policyNumber },
      })
      expect(errMsg(preIssueAtIssue.error)).toMatch(/CRM_PP:invalid_delivery_status/)

      const issued = await transition(owner, appId, 'issued', {
        delivery: 'with_agent',
        fields: { policy_number: policyNumber },
      })
      expect(errMsg(issued.error)).toBe('')
      expect(issued.data?.delivery_status).toBe('with_agent')
    }, 90_000)
  })

  // ===========================================================================
  // Issue and in-force
  // ===========================================================================

  describe('issue and in-force', () => {
    let issuedAppId = ''
    let issuedPolicyId = ''
    let issuedPolicyNumber = ''
    let inForceAppId = ''
    let inForcePolicyId = ''

    beforeAll(async () => {
      issuedAppId = await newLifeApp({ face_amount_cents: 50000000, opportunity_id: opportunityA })
      issuedPolicyNumber = uniq('pn-issued').toUpperCase()
      issuedPolicyId = await advanceToIssued(issuedAppId, issuedPolicyNumber)

      inForceAppId = await newLifeApp()
      inForcePolicyId = await advanceToIssued(inForceAppId, uniq('pn-inforce').toUpperCase())
    }, 120_000)

    it('issue creates exactly one linked policy atomically', async () => {
      // #34
      const app = await appRow(
        issuedAppId,
        'production_stage,underwriting_disposition,delivery_status,issue_date,policy_number',
      )
      expect(app.production_stage).toBe('issued')
      expect(app.underwriting_disposition).toBe('approved_as_applied')
      // not_required is never a default: issue always lands on not_started.
      expect(app.delivery_status).toBe('not_started')
      expect(app.issue_date).not.toBeNull()
      expect(app.policy_number).toBe(issuedPolicyNumber)

      const linked = await admin
        .from('policies')
        .select(
          'id,household_id,opportunity_id,policy_number,status,coverage_amount,premium,payment_frequency,insured_member_id,policy_owner_member_id,servicing_advisor_id,details,effective_date',
        )
        .eq('source_application_id', issuedAppId)
      expect(errMsg(linked.error)).toBe('')
      expect(linked.data ?? []).toHaveLength(1)

      const policy = linked.data![0]
      expect(policy.id).toBe(issuedPolicyId)
      expect(policy.household_id).toBe(householdA)
      expect(policy.opportunity_id).toBe(opportunityA)
      expect(policy.policy_number).toBe(issuedPolicyNumber)
      expect(policy.status).toBe('issued')
      expect(Number(policy.coverage_amount)).toBe(500000)
      expect(Number(policy.premium)).toBe(2400)
      expect(policy.payment_frequency).toBe('annual')
      expect(policy.insured_member_id).toBe(memberA1)
      expect(policy.policy_owner_member_id).toBe(memberA1)
      expect(policy.servicing_advisor_id).toBe(advisorAProfileId)
      expect(policy.effective_date).toBe(app.issue_date)
      expect((policy.details as Record<string, unknown>).application_id).toBe(issuedAppId)
    })

    it('a duplicate carrier policy number is rejected', async () => {
      // #35
      const appId = await newLifeApp()
      await advanceToApproved(appId)
      const duplicate = await transition(owner, appId, 'issued', {
        fields: { policy_number: issuedPolicyNumber },
      })
      expect(errMsg(duplicate.error)).toMatch(/CRM_PP:duplicate_policy_number/)

      // Nothing partial survived the failed issue: the application is still at
      // approved and no policy row ever pointed at it.
      const row = await appRow(appId, 'production_stage')
      expect(row.production_stage).toBe('approved')
      expect(await linkedPolicyRows(appId)).toHaveLength(0)

      const missingNumber = await transition(owner, appId, 'issued')
      expect(errMsg(missingNumber.error)).toMatch(/CRM_PP:missing_required_fields/)
    }, 90_000)

    it('a second policy cannot be attached to the same application', async () => {
      // #36
      const ownerAttempt = await owner.from('policies').insert({
        household_id: householdA,
        carrier: `${PREFIX} Rogue`,
        policy_type: 'life_term',
        policy_number: uniq('pn-rogue').toUpperCase(),
        status: 'issued',
        source_application_id: issuedAppId,
      })
      expect(errMsg(ownerAttempt.error)).toMatch(/CRM_PP:not_authorized/)

      // Even bypassing the client guard, the partial unique index holds.
      const serviceAttempt = await admin.from('policies').insert({
        household_id: householdA,
        carrier: `${PREFIX} Rogue Service`,
        policy_type: 'life_term',
        policy_number: uniq('pn-rogue2').toUpperCase(),
        status: 'issued',
        source_application_id: issuedAppId,
      })
      expect(errMsg(serviceAttempt.error)).toMatch(
        /duplicate key value|policies_source_application_unique_idx/,
      )

      const linked = await admin
        .from('policies')
        .select('id')
        .eq('source_application_id', issuedAppId)
      expect(linked.data ?? []).toHaveLength(1)
    })

    it('rejects an opportunity from another household', async () => {
      // #37
      const cross = await createApp(owner, lifePayload({ opportunity_id: opportunityB }))
      expect(errMsg(cross.error)).toMatch(/CRM_PP:household_mismatch/)

      // Migration 046 adds policy_applications_live_opportunity_unique_idx:
      // one live application per opportunity. issuedAppId already occupies
      // opportunityA, so the same-household attach uses a second household-A
      // opportunity. Production mismatch rules are unchanged.
      const opportunityASame = await seedOpportunity(householdA, 'Opp A same-hh')
      const sameHousehold = await newLifeApp({ opportunity_id: opportunityASame })
      const row = await appRow(sameHousehold, 'opportunity_id')
      expect(row.opportunity_id).toBe(opportunityASame)

      const relink = await owner.rpc('update_policy_application', {
        p_id: sameHousehold,
        p_payload: { opportunity_id: opportunityB },
      })
      expect(errMsg(relink.error)).toMatch(/CRM_PP:household_mismatch/)
    })

    it('protected columns on a linked policy cannot be mutated directly', async () => {
      // #38
      for (const [label, patch] of [
        ['policy_number', { policy_number: uniq('pn-hack').toUpperCase() }],
        ['status', { status: 'lapsed' }],
        ['carrier', { carrier: `${PREFIX} Hacked Carrier` }],
        ['household', { household_id: householdB }],
        ['unlink', { source_application_id: null }],
        ['relink', { source_application_id: inForceAppId }],
      ] as const) {
        const res = await owner.from('policies').update(patch).eq('id', issuedPolicyId)
        expect(errMsg(res.error), label).toMatch(/CRM_PP:not_authorized/)
      }

      // Soft delete has its own code: a linked policy is production history.
      const softDelete = await owner
        .from('policies')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', issuedPolicyId)
      expect(errMsg(softDelete.error)).toMatch(/CRM_PP:delete_not_allowed/)

      // A second policy on the same application is refused at the client guard
      // before uniqueness ever comes into play.
      const secondLink = await owner.from('policies').insert({
        household_id: householdA,
        carrier: `${PREFIX} Second Link`,
        policy_type: 'life_term',
        policy_number: uniq('pn-second').toUpperCase(),
        status: 'issued',
        source_application_id: issuedAppId,
      })
      expect(errMsg(secondLink.error)).toMatch(/CRM_PP:not_authorized/)

      // Authenticated lacks DELETE privilege on policies (024 grants SELECT/INSERT/UPDATE
      // only). Trigger would raise CRM_PP:delete_not_allowed if DELETE were granted.
      const hardDelete = await owner.from('policies').delete().eq('id', issuedPolicyId)
      expect(errMsg(hardDelete.error)).toMatch(
        /CRM_PP:delete_not_allowed|permission denied for table policies/,
      )

      const still = await admin
        .from('policies')
        .select('policy_number,status,household_id,source_application_id,deleted_at')
        .eq('id', issuedPolicyId)
        .single()
      expect(still.data!.policy_number).toBe(issuedPolicyNumber)
      expect(still.data!.status).toBe('issued')
      expect(still.data!.household_id).toBe(householdA)
      expect(still.data!.source_application_id).toBe(issuedAppId)
      expect(still.data!.deleted_at).toBeNull()

      // Unlinked policies keep their pre-existing authenticated write path:
      // insert, then edit the very columns that are frozen on a linked row.
      const unlinked = await owner
        .from('policies')
        .insert(legacyPolicy({ carrier: `${PREFIX} Manual Carrier ${randomUUID().slice(0, 8)}` }))
        .select('id')
        .single()
      expect(errMsg(unlinked.error)).toBe('')
      const legacyEdit = await owner
        .from('policies')
        .update({
          status: 'issued',
          carrier: `${PREFIX} Manual Carrier Renamed`,
          policy_number: uniq('pn-manual-renamed').toUpperCase(),
        })
        .eq('id', unlinked.data!.id)
      expect(errMsg(legacyEdit.error)).toBe('')
    }, 60_000)

    it('the in-force transition updates the application and the policy together', async () => {
      // #39
      const premature = await transition(owner, inForceAppId, 'in_force')
      expect(errMsg(premature.error)).toMatch(/CRM_PP:invalid_delivery_status/)

      const delivered = await setDeliveryComplete(owner, inForceAppId)
      expect(errMsg(delivered.error)).toBe('')

      const res = await transition(owner, inForceAppId, 'in_force')
      expect(errMsg(res.error)).toBe('')
      expect(res.data?.to_stage).toBe('in_force')
      expect(res.data?.policy_id).toBe(inForcePolicyId)
      expect(res.data?.delivery_status).toBe('complete')

      const app = await appRow(
        inForceAppId,
        'production_stage,in_force_date,issue_date,delivery_status',
      )
      expect(app.production_stage).toBe('in_force')
      expect(app.in_force_date).not.toBeNull()
      expect(app.delivery_status).toBe('complete')

      // The policy is found only through the link column.
      const policy = await linkedPolicy(inForceAppId, 'id,status,effective_date')
      expect(policy.id).toBe(inForcePolicyId)
      expect(policy.status).toBe('in_force')
      expect(policy.effective_date).toBe(app.issue_date)
    }, 60_000)

    it('issue and in-force cannot be reversed', async () => {
      // #31 #40
      for (const stage of ['issued', 'approved', 'in_underwriting', 'submitted']) {
        const res = await transition(owner, inForceAppId, stage, { reason: 'undo' })
        expect(errMsg(res.error), `in_force -> ${stage}`).toMatch(/CRM_PP:invalid_transition/)
      }
      for (const stage of ['approved', 'in_underwriting', 'submitted', 'draft']) {
        const res = await transition(owner, issuedAppId, stage, { reason: 'undo' })
        expect(errMsg(res.error), `issued -> ${stage}`).toMatch(/CRM_PP:invalid_transition/)
      }

      // issued -> not_taken stays available; in_force has no exit at all.
      const stillInForce = await appRow(inForceAppId, 'production_stage')
      expect(stillInForce.production_stage).toBe('in_force')
      const stillIssued = await appRow(issuedAppId, 'production_stage')
      expect(stillIssued.production_stage).toBe('issued')
    }, 60_000)
  })

  // ===========================================================================
  // One policy per application, permanently
  // ===========================================================================

  describe('source_application link uniqueness', () => {
    it('holds unconditionally, including across a soft delete of the policy', async () => {
      const appId = await newLifeApp()
      const policyId = await advanceToIssued(appId, uniq('pn-link').toUpperCase())

      // The link is resolved only through policies.source_application_id.
      const linked = await linkedPolicy(appId, 'id,deleted_at,status')
      expect(linked.id).toBe(policyId)
      expect(linked.deleted_at).toBeNull()

      // Authenticated may not retire production history...
      const authSoftDelete = await owner
        .from('policies')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', policyId)
      expect(errMsg(authSoftDelete.error)).toMatch(/CRM_PP:delete_not_allowed/)

      // ...nor attach a second policy to the application.
      const authSecond = await owner.from('policies').insert({
        household_id: householdA,
        carrier: `${PREFIX} Rogue Link`,
        policy_type: 'life_term',
        policy_number: uniq('pn-link-rogue').toUpperCase(),
        status: 'issued',
        source_application_id: appId,
      })
      expect(errMsg(authSecond.error)).toMatch(/CRM_PP:not_authorized/)

      // Service role bypasses the client guard and lands on the index instead.
      const serviceSecond = await admin.from('policies').insert({
        household_id: householdA,
        carrier: `${PREFIX} Rogue Link Service`,
        policy_type: 'life_term',
        policy_number: uniq('pn-link-rogue2').toUpperCase(),
        status: 'issued',
        source_application_id: appId,
      })
      expect(errMsg(serviceSecond.error)).toMatch(
        /CRM_PP:duplicate_link|duplicate key value|policies_source_application_unique_idx/,
      )

      // Service-role maintenance may soft delete the policy...
      const serviceSoftDelete = await admin
        .from('policies')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', policyId)
      expect(errMsg(serviceSoftDelete.error)).toBe('')

      // ...and the application still cannot be issued a replacement: the
      // uniqueness has no deleted_at predicate, so the slot stays taken.
      const reIssueDirect = await admin.from('policies').insert({
        household_id: householdA,
        carrier: `${PREFIX} Replacement`,
        policy_type: 'life_term',
        policy_number: uniq('pn-link-replacement').toUpperCase(),
        status: 'issued',
        source_application_id: appId,
      })
      expect(errMsg(reIssueDirect.error)).toMatch(
        /CRM_PP:duplicate_link|duplicate key value|policies_source_application_unique_idx/,
      )

      // The state machine has no second issue edge either.
      const reIssueRpc = await transition(owner, appId, 'issued', {
        fields: { policy_number: uniq('pn-link-again').toUpperCase() },
      })
      expect(errMsg(reIssueRpc.error)).toMatch(/CRM_PP:invalid_transition/)

      const rows = await linkedPolicyRows(appId)
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe(policyId)
      expect(rows[0].deleted_at).not.toBeNull()
    }, 120_000)
  })

  // ===========================================================================
  // Carrier-scoped policy numbers
  // ===========================================================================

  describe('policy number uniqueness per carrier id', () => {
    it('collides case-insensitively per carrier and survives a carrier rename', async () => {
      const scopedCarrierId = await createCarrier('numscope')
      const scopedProductId = await createProduct(scopedCarrierId, 'numscope', 'life_term')
      const number = uniq('pn-scope').toUpperCase()

      const first = await newLifeApp({
        carrier_id: scopedCarrierId,
        product_id: scopedProductId,
      })
      const firstPolicyId = await advanceToIssued(first, number)

      // 1. Same carrier, same number in a different case.
      const second = await newLifeApp({
        carrier_id: scopedCarrierId,
        product_id: scopedProductId,
      })
      await advanceToApproved(second)
      const collide = await transition(owner, second, 'issued', {
        fields: { policy_number: number.toLowerCase() },
      })
      expect(errMsg(collide.error)).toMatch(/CRM_PP:duplicate_policy_number/)

      // 2. A different carrier may reuse the number.
      const otherCarrier = await newLifeApp({
        carrier_id: carrierAltId,
        product_id: productAltId,
      })
      const otherPolicyId = await advanceToIssued(otherCarrier, number)
      expect(otherPolicyId).not.toBe(firstPolicyId)

      // 3. Uniqueness is keyed on carrier_id, so renaming the carrier does not
      //    hand the number back out. The already-issued policy row keeps the
      //    old carrier text, which is exactly why the text can never be the key.
      const renamedName = `${PREFIX} Renamed Carrier ${randomUUID().slice(0, 8)}`
      const renamed = await owner.rpc('update_carrier', {
        p_id: scopedCarrierId,
        p_name: renamedName,
      })
      expect(errMsg(renamed.error)).toBe('')

      const afterRename = await transition(owner, second, 'issued', {
        fields: { policy_number: number },
      })
      expect(errMsg(afterRename.error)).toMatch(/CRM_PP:duplicate_policy_number/)

      const stillApproved = await appRow(second, 'production_stage')
      expect(stillApproved.production_stage).toBe('approved')
      expect(await linkedPolicyRows(second)).toHaveLength(0)

      // A fresh number under the renamed carrier still issues normally.
      const freshNumber = uniq('pn-scope-fresh').toUpperCase()
      const issuedAfterRename = await transition(owner, second, 'issued', {
        fields: { policy_number: freshNumber },
      })
      expect(errMsg(issuedAfterRename.error)).toBe('')
      const secondPolicy = await linkedPolicy(second, 'id,carrier,policy_number')
      expect(secondPolicy.carrier).toBe(renamedName)
      expect(secondPolicy.policy_number).toBe(freshNumber)
    }, 180_000)

    it('unlinked legacy policies keep the carrier-text uniqueness path', async () => {
      const carrierText = `${PREFIX} Legacy Carrier ${randomUUID().slice(0, 8)}`
      const number = uniq('pn-legacy-dup').toUpperCase()

      const first = await owner
        .from('policies')
        .insert(legacyPolicy({ carrier: carrierText, policy_number: number }))
        .select('id,source_application_id')
        .single()
      expect(errMsg(first.error)).toBe('')
      expect(first.data!.source_application_id).toBeNull()

      const duplicate = await owner
        .from('policies')
        .insert(legacyPolicy({ carrier: carrierText, policy_number: number }))
      expect(errMsg(duplicate.error)).toMatch(
        /duplicate key value|policies_carrier_number_unique_idx/,
      )

      // Legacy uniqueness is a (carrier text, number) pair, so a different
      // carrier text carries the same number without complaint.
      const otherText = await owner
        .from('policies')
        .insert(legacyPolicy({ carrier: `${carrierText} Renamed`, policy_number: number }))
        .select('id')
        .single()
      expect(errMsg(otherText.error)).toBe('')
    }, 60_000)

    it('concurrent issuance of the same number lets exactly one application through', async () => {
      const raceCarrierId = await createCarrier('race')
      const raceProductId = await createProduct(raceCarrierId, 'race', 'life_term')
      const number = uniq('pn-race').toUpperCase()

      const appOne = await newLifeApp({ carrier_id: raceCarrierId, product_id: raceProductId })
      const appTwo = await newLifeApp({ carrier_id: raceCarrierId, product_id: raceProductId })
      await advanceToApproved(appOne)
      await advanceToApproved(appTwo)

      // Both issues race the same carrier-scoped unique indexes; the loser is
      // translated out of a raw 23505 into the CRM_PP contract.
      const results = await Promise.all([
        transition(owner, appOne, 'issued', { fields: { policy_number: number } }),
        transition(owner, appTwo, 'issued', { fields: { policy_number: number } }),
      ])
      const winners = results.filter((r) => errMsg(r.error) === '')
      const losers = results.filter((r) => errMsg(r.error) !== '')
      expect(winners).toHaveLength(1)
      expect(losers).toHaveLength(1)
      expect(errMsg(losers[0].error)).toMatch(/CRM_PP:duplicate_policy_number/)

      const linked = await admin
        .from('policies')
        .select('id,source_application_id')
        .in('source_application_id', [appOne, appTwo])
      expect(errMsg(linked.error)).toBe('')
      expect(linked.data ?? []).toHaveLength(1)

      const stages = await admin
        .from('policy_applications')
        .select('id,production_stage')
        .in('id', [appOne, appTwo])
      expect(
        (stages.data ?? []).filter((r) => r.production_stage === 'issued'),
      ).toHaveLength(1)
      expect(
        (stages.data ?? []).filter((r) => r.production_stage === 'approved'),
      ).toHaveLength(1)
    }, 180_000)
  })

  // ===========================================================================
  // Delivery gate into in force
  // ===========================================================================

  describe('delivery gate into in force', () => {
    /** Every status that leaves delivery unsettled. */
    const UNSETTLED = [
      'pre_issue',
      'not_started',
      'with_agent',
      'with_client',
      'requirements_pending',
    ] as const

    it('life business only goes in force once delivery is complete', async () => {
      const appId = await newLifeApp()
      await advanceToIssued(appId, uniq('pn-life-gate').toUpperCase())
      expect((await appRow(appId, 'delivery_status')).delivery_status).toBe('not_started')

      for (const delivery of UNSETTLED) {
        const res = await transition(owner, appId, 'in_force', { delivery })
        expect(errMsg(res.error), `life in_force with ${delivery}`).toMatch(
          /CRM_PP:invalid_delivery_status/,
        )
      }

      // The stored not_started is rejected on its own too: in_force never
      // coerces the delivery status it finds on the row.
      const asStored = await transition(owner, appId, 'in_force')
      expect(errMsg(asStored.error)).toMatch(/CRM_PP:invalid_delivery_status/)

      // Delivery is worked at the issued stage through update_policy_application.
      const delivered = await setDeliveryComplete(owner, appId)
      expect(errMsg(delivered.error)).toBe('')
      expect((await appRow(appId, 'delivery_status')).delivery_status).toBe('complete')

      const inForce = await transition(owner, appId, 'in_force')
      expect(errMsg(inForce.error)).toBe('')
      expect(inForce.data?.delivery_status).toBe('complete')
      expect((await linkedPolicy(appId, 'status')).status).toBe('in_force')
    }, 120_000)

    it('waiving life delivery is owner-only and always needs a reason', async () => {
      const appId = await newLifeApp({ product_id: productPermId, product_line: 'life_permanent' })
      await advanceToIssued(appId, uniq('pn-life-waive').toUpperCase())

      const noReason = await transition(owner, appId, 'in_force', { delivery: 'not_required' })
      expect(errMsg(noReason.error)).toMatch(/CRM_PP:missing_required_fields/)

      const advisorWaiver = await transition(advisorA, appId, 'in_force', {
        delivery: 'not_required',
        reason: 'advisor waives life delivery',
      })
      expect(errMsg(advisorWaiver.error)).toMatch(/CRM_PP:not_authorized/)

      const ownerWaiver = await transition(owner, appId, 'in_force', {
        delivery: 'not_required',
        reason: 'carrier delivered the contract electronically',
      })
      expect(errMsg(ownerWaiver.error)).toBe('')
      expect(ownerWaiver.data?.delivery_status).toBe('not_required')

      const app = await appRow(appId, 'production_stage,delivery_status')
      expect(app.production_stage).toBe('in_force')
      expect(app.delivery_status).toBe('not_required')
    }, 120_000)

    it('FIA rejects unsettled delivery but lets an advisor waive it with a reason', async () => {
      const appId = await newFiaApp()
      await advanceToIssued(appId, uniq('pn-fia-gate').toUpperCase())
      // not_required is never automatic, not even on a line with no delivery
      // obligation.
      expect((await appRow(appId, 'delivery_status')).delivery_status).toBe('not_started')

      for (const delivery of UNSETTLED) {
        const res = await transition(owner, appId, 'in_force', { delivery })
        expect(errMsg(res.error), `fia in_force with ${delivery}`).toMatch(
          /CRM_PP:invalid_delivery_status/,
        )
      }

      const noReason = await transition(advisorA, appId, 'in_force', {
        delivery: 'not_required',
      })
      expect(errMsg(noReason.error)).toMatch(/CRM_PP:missing_required_fields/)

      const advisorWaiver = await transition(advisorA, appId, 'in_force', {
        delivery: 'not_required',
        reason: 'annuity contract has no delivery requirement',
      })
      expect(errMsg(advisorWaiver.error)).toBe('')
      expect(advisorWaiver.data?.delivery_status).toBe('not_required')
    }, 120_000)

    it('a delivered FIA reaches in force through complete', async () => {
      const appId = await newFiaApp()
      const policyId = await advanceToInForce(appId, uniq('pn-fia-delivered').toUpperCase())

      const app = await appRow(appId, 'production_stage,delivery_status')
      expect(app.production_stage).toBe('in_force')
      expect(app.delivery_status).toBe('complete')
      const policy = await linkedPolicy(appId, 'id,status')
      expect(policy.id).toBe(policyId)
      expect(policy.status).toBe('in_force')
    }, 120_000)
  })

  // ===========================================================================
  // Soft delete and append-only history
  // ===========================================================================

  describe('soft delete and history immutability', () => {
    it('the owner may soft delete draft and pre_submitted applications', async () => {
      // #41
      const draftApp = await newLifeApp()
      const draftDelete = await owner.rpc('soft_delete_policy_application', {
        p_application_id: draftApp,
      })
      expect(errMsg(draftDelete.error)).toBe('')
      expect(draftDelete.data?.deleted).toBe(true)
      expect((await appRow(draftApp, 'deleted_at')).deleted_at).not.toBeNull()

      const preSubmitted = await newLifeApp()
      expect(errMsg((await transition(owner, preSubmitted, 'pre_submitted')).error)).toBe('')
      const preDelete = await owner.rpc('soft_delete_policy_application', {
        p_application_id: preSubmitted,
      })
      expect(errMsg(preDelete.error)).toBe('')

      const replay = await owner.rpc('soft_delete_policy_application', {
        p_application_id: preSubmitted,
      })
      expect(errMsg(replay.error)).toMatch(/CRM_PP:not_found/)
    }, 60_000)

    it('advisors never soft delete, and submitted production is never deletable', async () => {
      // #42
      const advisorApp = await newLifeApp()
      const advisorAttempt = await advisorA.rpc('soft_delete_policy_application', {
        p_application_id: advisorApp,
      })
      expect(errMsg(advisorAttempt.error)).toMatch(/CRM_PP:not_authorized/)
      expect((await appRow(advisorApp, 'deleted_at')).deleted_at).toBeNull()

      const submittedApp = await newLifeApp()
      expect(errMsg((await transition(owner, submittedApp, 'submitted')).error)).toBe('')
      const submittedAttempt = await owner.rpc('soft_delete_policy_application', {
        p_application_id: submittedApp,
      })
      expect(errMsg(submittedAttempt.error)).toMatch(/CRM_PP:delete_not_allowed/)

      const issuedApp = await newLifeApp()
      await advanceToIssued(issuedApp, uniq('pn-nodelete').toUpperCase())
      const issuedAttempt = await owner.rpc('soft_delete_policy_application', {
        p_application_id: issuedApp,
      })
      expect(errMsg(issuedAttempt.error)).toMatch(/CRM_PP:delete_not_allowed/)

      // deleted_at is not reachable through the generic update RPC either.
      const sneaky = await owner.rpc('update_policy_application', {
        p_id: submittedApp,
        p_payload: { deleted_at: new Date().toISOString() },
      })
      expect(errMsg(sneaky.error)).toMatch(/CRM_PP:invalid_payload/)
    }, 90_000)

    it('stage history is append-only for every principal', async () => {
      // #43
      const appId = await newLifeApp()
      expect(errMsg((await transition(owner, appId, 'submitted')).error)).toBe('')

      expect(
        sqlQuery(
          `SELECT has_table_privilege('authenticated','public.policy_application_stage_history','UPDATE')::text
             || ',' ||
             has_table_privilege('authenticated','public.policy_application_stage_history','DELETE')::text`,
        ),
      ).toBe('false,false')

      for (const [label, client] of [
        ['owner', owner],
        ['advisorA', advisorA],
      ] as const) {
        const upd = await client
          .from('policy_application_stage_history')
          .update({ reason: 'rewritten' })
          .eq('application_id', appId)
        expect(errMsg(upd.error), `${label} history update`).toMatch(/permission denied/)
        const del = await client
          .from('policy_application_stage_history')
          .delete()
          .eq('application_id', appId)
        expect(errMsg(del.error), `${label} history delete`).toMatch(/permission denied/)
      }

      // The trigger is unconditional: even service_role cannot rewrite history.
      const serviceUpdate = await admin
        .from('policy_application_stage_history')
        .update({ reason: 'rewritten by service role' })
        .eq('application_id', appId)
      expect(errMsg(serviceUpdate.error)).toMatch(/CRM_PP:not_authorized/)

      const rows = await admin
        .from('policy_application_stage_history')
        .select('reason,to_stage')
        .eq('application_id', appId)
      expect(rows.data ?? []).toHaveLength(2)
      expect((rows.data ?? []).every((r) => r.reason !== 'rewritten by service role')).toBe(true)
    }, 60_000)
  })

  // ===========================================================================
  // Regression smoke
  // ===========================================================================

  describe('regression smoke', () => {
    it('households, members, opportunities and unrelated policies still read normally', async () => {
      // #44
      const ownerHouseholds = await owner
        .from('households')
        .select('id,display_name,assigned_advisor_id')
        .in('id', [householdA, householdB])
      expect(errMsg(ownerHouseholds.error)).toBe('')
      expect(ownerHouseholds.data ?? []).toHaveLength(2)

      const advisorHouseholds = await advisorA
        .from('households')
        .select('id')
        .in('id', [householdA, householdB])
      expect(errMsg(advisorHouseholds.error)).toBe('')
      expect((advisorHouseholds.data ?? []).map((r) => r.id)).toEqual([householdA])

      const advisorOpportunities = await advisorA
        .from('opportunities')
        .select('id,title')
        .in('id', [opportunityA, opportunityB])
      expect(errMsg(advisorOpportunities.error)).toBe('')
      expect((advisorOpportunities.data ?? []).map((r) => r.id)).toEqual([opportunityA])

      const members = await advisorA
        .from('household_members')
        .select('id')
        .eq('household_id', householdA)
      expect(errMsg(members.error)).toBe('')
      expect((members.data ?? []).length).toBeGreaterThanOrEqual(2)

      const notes = await advisorA
        .from('notes')
        .insert({
          household_id: householdA,
          author_user_id: advisorAUserId,
          body: `${PREFIX} smoke note`,
          visibility: 'internal',
        })
        .select('id')
        .single()
      expect(errMsg(notes.error)).toBe('')
      await admin.from('notes').delete().eq('id', notes.data!.id)
    }, 60_000)
  })
})
