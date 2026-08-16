/**
 * Local Supabase integration for Migration 035 writing-advisor actual
 * commission ledger. Skips when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass035!'
const PREFIX = 'm035cl'

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

function sqlQueryAllowError(sql: string): { ok: boolean; out: string } {
  try {
    return { ok: true, out: sqlQuery(sql) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, out: message }
  }
}

function compositeRow(data: unknown): Record<string, unknown> {
  return (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>
}

function cents(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 035 writing-advisor actual commission ledger (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorB: SupabaseClient

  let ownerId = ''
  let advisorAUserId = ''
  let advisorBUserId = ''
  let advisorAProfileId = ''
  let advisorBProfileId = ''
  let householdA = ''
  let memberA1 = ''
  let carrierId = ''
  let productTermId = ''
  let productNoCardId = ''

  const created = {
    households: [] as string[],
    applications: [] as string[],
    carriers: [] as string[],
    schedules: [] as string[],
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
      sqlQuery(
        `UPDATE public.advisor_profiles SET contract_level = NULL WHERE id = '${existing.id}'`,
      )
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

  function writingFull(advisorProfileId: string, commissionBps = 10000) {
    return [
      {
        recipient_type: 'advisor',
        advisor_id: advisorProfileId,
        allocation_role: 'writing',
        commission_bps: commissionBps,
        production_credit_bps: commissionBps,
      },
    ]
  }

  function splitWriting(bpsA: number, bpsB: number) {
    return [
      {
        recipient_type: 'advisor',
        advisor_id: advisorAProfileId,
        allocation_role: 'writing',
        commission_bps: bpsA,
        production_credit_bps: bpsA,
      },
      {
        recipient_type: 'advisor',
        advisor_id: advisorBProfileId,
        allocation_role: 'writing',
        commission_bps: bpsB,
        production_credit_bps: bpsB,
      },
    ]
  }

  function lifePayload(
    productId: string,
    over: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      household_id: householdA,
      carrier_id: carrierId,
      product_id: productId,
      product_line: 'life_term',
      state: 'TX',
      submitted_premium_cents: 10000,
      premium_mode: 'monthly',
      participants: [
        { household_member_id: memberA1, role: 'primary_client' },
        { household_member_id: memberA1, role: 'insured' },
        { household_member_id: memberA1, role: 'owner' },
      ],
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

  async function submit(
    client: SupabaseClient,
    applicationId: string,
    submissionDate = '2026-04-01',
  ) {
    return client.rpc('transition_policy_application_stage', {
      p_application_id: applicationId,
      p_to_stage: 'submitted',
      p_disposition: null,
      p_delivery_status: null,
      p_reason: null,
      p_fields: { submission_date: submissionDate },
    })
  }

  async function transition(
    client: SupabaseClient,
    applicationId: string,
    toStage: string,
    opts: {
      disposition?: string | null
      delivery?: string | null
      reason?: string | null
      fields?: Record<string, unknown>
    } = {},
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

  async function advanceToIssued(applicationId: string): Promise<void> {
    expect(errMsg((await transition(owner, applicationId, 'in_underwriting')).error)).toBe('')
    expect(
      errMsg(
        (await transition(owner, applicationId, 'approved', { disposition: 'approved_as_applied' }))
          .error,
      ),
    ).toBe('')
    expect(
      errMsg(
        (
          await transition(owner, applicationId, 'issued', {
            fields: { policy_number: uniq('pn').toUpperCase() },
          })
        ).error,
      ),
    ).toBe('')
  }

  async function issuedApp(over: Record<string, unknown> = {}): Promise<string> {
    const createdApp = await createApp(owner, lifePayload(productTermId, over))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    await advanceToIssued(appId)
    return appId
  }

  function writingAlloc(appId: string, advisorId = advisorAProfileId): string {
    return sqlQuery(
      `SELECT id FROM public.policy_agent_allocations
        WHERE application_id = '${appId}'
          AND advisor_id = '${advisorId}'
          AND allocation_role = 'writing'
          AND recipient_type = 'advisor'
          AND effective_to IS NULL`,
    )
  }

  function liveExpected(appId: string, advisorId = advisorAProfileId): string {
    return sqlQuery(
      `SELECT id || ',' || coalesce(expected_compensation_cents::text, 'null') || ',' || calculation_status
         FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}'
          AND advisor_id = '${advisorId}'
          AND superseded_at IS NULL`,
    )
  }

  async function record(
    args: Record<string, unknown>,
    client: SupabaseClient = owner,
  ) {
    return client.rpc('record_policy_writing_commission_event', args)
  }

  async function snapshot(client: SupabaseClient, applicationId: string) {
    return client.rpc('pp_writing_commission_snapshot', {
      p_application_id: applicationId,
    })
  }

  function eventOf(res: { data: unknown }): Record<string, unknown> {
    return asRecord(asRecord(res.data).event)
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}-owner@valtoris.test`, 'M035 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}-adv-a@valtoris.test`, 'M035 Advisor A', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}-adv-b@valtoris.test`, 'M035 Advisor B', 'advisor')
    advisorAProfileId = await ensureAdvisorProfile(advisorAUserId, `${PREFIX}-adv-a`)
    advisorBProfileId = await ensureAdvisorProfile(advisorBUserId, `${PREFIX}-adv-b`)
    owner = await signIn(`${PREFIX}-owner@valtoris.test`)
    advisorA = await signIn(`${PREFIX}-adv-a@valtoris.test`)
    advisorB = await signIn(`${PREFIX}-adv-b@valtoris.test`)

    householdA = randomUUID()
    const { error: hhError } = await admin.from('households').insert({
      id: householdA,
      display_name: `${PREFIX} Household A`,
      status: 'client',
      lead_source: 'family_report_card',
      relationship_pipeline_id: RELATIONSHIP_PIPELINE_ID,
      relationship_stage_id: RELATIONSHIP_STAGE_ID,
      assigned_advisor_id: advisorAProfileId,
      assigned_at: new Date().toISOString(),
      assigned_by_user_id: ownerId,
      assignment_reason: 'manual',
      created_by_user_id: ownerId,
    })
    if (hhError) throw hhError
    created.households.push(householdA)
    await admin.from('advisor_assignments').insert({
      household_id: householdA,
      advisor_id: advisorAProfileId,
      assignment_role: 'primary',
      reason: 'manual',
      assigned_by_user_id: ownerId,
    })
    memberA1 = randomUUID()
    const { error: memberError } = await admin.from('household_members').insert({
      id: memberA1,
      household_id: householdA,
      first_name: 'Pat',
      last_name: 'Client',
      relationship: 'primary',
      is_primary_contact: true,
      date_of_birth: '1980-01-15',
    })
    if (memberError) throw memberError

    const carrier = await owner.rpc('create_carrier', {
      p_code: uniq('c'),
      p_name: `${PREFIX} Carrier ${randomUUID().slice(0, 8)}`,
    })
    if (carrier.error) throw carrier.error
    carrierId = compositeRow(carrier.data).id as string
    created.carriers.push(carrierId)

    async function createProduct(name: string, line: string): Promise<string> {
      const product = await owner.rpc('create_insurance_product', {
        p_carrier_id: carrierId,
        p_name: `${PREFIX} ${name} ${randomUUID().slice(0, 8)}`,
        p_product_line: line,
      })
      if (product.error) throw product.error
      return compositeRow(product.data).id as string
    }

    productTermId = await createProduct('Term', 'life_term')
    productNoCardId = await createProduct('NoCard', 'life_term')

    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'SFA',
    })
    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorBProfileId,
      p_contract_level: 'FA',
    })

    const card = await owner.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: null,
      p_age_max: 75,
      p_fa_rate: 0.4,
      p_sfa_rate: 0.5,
      p_sm_rate: 0.6,
      p_ed_rate: 0.7,
      p_effective_from: '2026-03-24',
    })
    expect(errMsg(card.error)).toBe('')
    created.schedules.push(compositeRow(card.data).id as string)
  }, 180000)

  afterAll(async () => {
    if (created.applications.length) {
      const apps = created.applications.map((id) => `'${id}'`).join(',')
      sqlQuery(
        `DELETE FROM public.policy_writing_commission_events
          WHERE application_id IN (${apps}) AND event_type = 'reversal'`,
      )
      sqlQuery(
        `DELETE FROM public.policy_writing_commission_events
          WHERE application_id IN (${apps}) AND attributed_from_event_id IS NOT NULL`,
      )
      sqlQuery(`DELETE FROM public.policy_writing_commission_events WHERE application_id IN (${apps})`)
      sqlQuery(
        `DELETE FROM public.policy_writing_commission_accounts WHERE application_id IN (${apps})`,
      )
      sqlQuery(
        `DELETE FROM public.policy_application_expected_compensations WHERE application_id IN (${apps})`,
      )
      sqlQuery(`DELETE FROM public.policies WHERE source_application_id IN (${apps})`)
      sqlQuery(
        `DELETE FROM public.audit_logs WHERE entity_table IN (
           'policy_applications',
           'policy_writing_commission_events',
           'policy_writing_commission_accounts'
         ) AND entity_id IN (${apps})`,
      )
      sqlQuery(`DELETE FROM public.policy_applications WHERE id IN (${apps})`)
    }
    if (created.schedules.length) {
      sqlQuery(
        `DELETE FROM public.product_compensation_schedules WHERE id IN (${created.schedules
          .map((id) => `'${id}'`)
          .join(',')})`,
      )
    }
    if (created.households.length) {
      sqlQuery(
        `DELETE FROM public.households WHERE id IN (${created.households
          .map((id) => `'${id}'`)
          .join(',')})`,
      )
    }
    if (created.carriers.length) {
      sqlQuery(
        `DELETE FROM public.insurance_products WHERE carrier_id IN (${created.carriers
          .map((id) => `'${id}'`)
          .join(',')})`,
      )
      sqlQuery(
        `DELETE FROM public.carriers WHERE id IN (${created.carriers.map((id) => `'${id}'`).join(',')})`,
      )
    }
  }, 180000)

  it('does not create commission accounts at submit and rejects normal pre-issue paid posting', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_accounts WHERE application_id = '${appId}'`,
      ),
    ).toBe('0')
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_accounts WHERE application_id = '${appId}'`,
      ),
    ).toBe('0')

    const alloc = writingAlloc(appId)
    const denied = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'too early',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('pre'),
    })
    expect(errMsg(denied.error)).toMatch(/CRM_PP:invalid_transition/)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('0')
  })

  it('accepts issued posting, creates one writing account, and pins expected cents server-side', async () => {
    const appId = await issuedApp()
    const alloc = writingAlloc(appId)
    const [expectedId, expectedCents] = liveExpected(appId).split(',')
    expect(expectedCents).toBe('60000')

    const first = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'carrier paid first year',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('pay'),
    })
    expect(errMsg(first.error)).toBe('')
    expect(asRecord(first.data).duplicate).toBe(false)
    expect(cents(eventOf(first).amount_cents)).toBe(60000)
    expect(eventOf(first).event_type).toBe('paid')
    expect(asRecord(first.data).audit_id).toBeTruthy()

    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_accounts WHERE allocation_id = '${alloc}'`,
      ),
    ).toBe('1')
    expect(
      sqlQuery(
        `SELECT expected_compensation_id || ',' || expected_cents_pinned
           FROM public.policy_writing_commission_accounts WHERE allocation_id = '${alloc}'`,
      ),
    ).toBe(`${expectedId},60000`)

    const second = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 1,
      p_reason: 'second posting same allocation',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('pay2'),
    })
    expect(errMsg(second.error)).toBe('')
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_accounts WHERE allocation_id = '${alloc}'`,
      ),
    ).toBe('1')

    const ownerSnap = await snapshot(owner, appId)
    expect(errMsg(ownerSnap.error)).toBe('')
    const totals = asRecord(ownerSnap.data.totals)
    expect(cents(totals.expected_cents)).toBe(60000)
    expect(cents(totals.gross_paid_cents)).toBe(60001)
    expect(cents(totals.variance_cents)).toBe(1)
    expect(cents(totals.remaining_expected_cents)).toBe(-1)
    expect(ownerSnap.data.viewer).toBe('owner')
  })

  it('rejects house and servicing allocations and mismatched allocation/application/advisor relationships', async () => {
    const houseApp = await issuedApp({
      allocations: [
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
      ],
    })
    const houseAlloc = sqlQuery(
      `SELECT id FROM public.policy_agent_allocations
        WHERE application_id = '${houseApp}' AND recipient_type = 'house' AND effective_to IS NULL`,
    )
    const houseDenied = await record({
      p_application_id: houseApp,
      p_event_type: 'paid',
      p_amount_cents: 18000,
      p_reason: 'house should not get a writing account',
      p_allocation_id: houseAlloc,
      p_idempotency_key: uniq('house'),
    })
    expect(errMsg(houseDenied.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_accounts WHERE allocation_id = '${houseAlloc}'`,
      ),
    ).toBe('0')

    const servicingApp = await issuedApp({
      allocations: [
        ...writingFull(advisorAProfileId),
        {
          recipient_type: 'advisor',
          advisor_id: advisorBProfileId,
          allocation_role: 'servicing',
          commission_bps: 0,
          production_credit_bps: 0,
        },
      ],
    })
    const servicingAlloc = sqlQuery(
      `SELECT id FROM public.policy_agent_allocations
        WHERE application_id = '${servicingApp}' AND allocation_role = 'servicing' AND effective_to IS NULL`,
    )
    const servicingDenied = await record({
      p_application_id: servicingApp,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'servicing should not get a writing account',
      p_allocation_id: servicingAlloc,
      p_idempotency_key: uniq('serv'),
    })
    expect(errMsg(servicingDenied.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_accounts WHERE allocation_id = '${servicingAlloc}'`,
      ),
    ).toBe('0')

    const app1 = await issuedApp()
    const app2 = await issuedApp()
    const alloc2 = writingAlloc(app2)
    const crossed = await record({
      p_application_id: app1,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'wrong application for allocation',
      p_allocation_id: alloc2,
      p_idempotency_key: uniq('cross'),
    })
    expect(errMsg(crossed.error)).toMatch(/CRM_PP:invalid_payload/)

    const expected2 = liveExpected(app2).split(',')[0]
    const wrongPin = await record({
      p_application_id: app1,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'wrong expected snapshot',
      p_allocation_id: writingAlloc(app1),
      p_expected_compensation_id: expected2,
      p_idempotency_key: uniq('pin'),
    })
    expect(errMsg(wrongPin.error)).toMatch(/CRM_PP:invalid_payload/)
  })

  it('keeps unresolved expected NULL, including variance and remaining', async () => {
    const createdApp = await createApp(owner, lifePayload(productNoCardId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    await advanceToIssued(appId)
    const [, expectedCents, status] = liveExpected(appId).split(',')
    expect(status).toBe('unavailable')
    expect(expectedCents).toBe('null')

    const paid = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 1000,
      p_reason: 'actual without resolved expected',
      p_allocation_id: writingAlloc(appId),
      p_idempotency_key: uniq('unres'),
    })
    expect(errMsg(paid.error)).toBe('')
    expect(
      sqlQuery(
        `SELECT coalesce(expected_cents_pinned::text, 'null')
           FROM public.policy_writing_commission_accounts WHERE application_id = '${appId}'`,
      ),
    ).toBe('null')

    const ownerSnap = await snapshot(owner, appId)
    const totals = asRecord(ownerSnap.data.totals)
    expect(totals.expected_cents).toBeNull()
    expect(totals.variance_cents).toBeNull()
    expect(totals.remaining_expected_cents).toBeNull()
    expect(cents(totals.net_actual_cents)).toBe(1000)
  })

  it('reconciles paid, chargeback, recovery, adjustments, two pays, and variance', async () => {
    const exact = await issuedApp()
    const allocExact = writingAlloc(exact)
    expect(
      errMsg(
        (
          await record({
            p_application_id: exact,
            p_event_type: 'paid',
            p_amount_cents: 60000,
            p_reason: 'paid matches expected',
            p_allocation_id: allocExact,
            p_idempotency_key: uniq('eq'),
          })
        ).error,
      ),
    ).toBe('')
    let totals = asRecord((await snapshot(owner, exact)).data.totals)
    expect(cents(totals.gross_paid_cents)).toBe(60000)
    expect(cents(totals.net_actual_cents)).toBe(60000)
    expect(cents(totals.variance_cents)).toBe(0)
    expect(cents(totals.remaining_expected_cents)).toBe(0)

    const short = await issuedApp()
    expect(
      errMsg(
        (
          await record({
            p_application_id: short,
            p_event_type: 'paid',
            p_amount_cents: 57000,
            p_reason: 'paid under expected',
            p_allocation_id: writingAlloc(short),
            p_idempotency_key: uniq('short'),
          })
        ).error,
      ),
    ).toBe('')
    totals = asRecord((await snapshot(owner, short)).data.totals)
    expect(cents(totals.variance_cents)).toBe(-3000)
    expect(cents(totals.remaining_expected_cents)).toBe(3000)

    const charged = await issuedApp()
    const allocC = writingAlloc(charged)
    expect(
      errMsg(
        (
          await record({
            p_application_id: charged,
            p_event_type: 'paid',
            p_amount_cents: 60000,
            p_reason: 'gross paid',
            p_allocation_id: allocC,
            p_idempotency_key: uniq('c1'),
          })
        ).error,
      ),
    ).toBe('')
    const chargeback = await record({
      p_application_id: charged,
      p_event_type: 'chargeback',
      p_amount_cents: -30000,
      p_reason: 'carrier chargeback',
      p_allocation_id: allocC,
      p_idempotency_key: uniq('c2'),
    })
    expect(errMsg(chargeback.error)).toBe('')
    expect(eventOf(chargeback).reversed_event_id).toBeNull()
    expect(eventOf(chargeback).event_type).toBe('chargeback')
    totals = asRecord((await snapshot(owner, charged)).data.totals)
    expect(cents(totals.gross_paid_cents)).toBe(60000)
    expect(cents(totals.chargeback_cents)).toBe(-30000)
    expect(cents(totals.net_actual_cents)).toBe(30000)

    const recovered = await record({
      p_application_id: charged,
      p_event_type: 'recovery',
      p_amount_cents: 30000,
      p_reason: 'carrier recovered chargeback',
      p_allocation_id: allocC,
      p_idempotency_key: uniq('c3'),
    })
    expect(errMsg(recovered.error)).toBe('')
    totals = asRecord((await snapshot(owner, charged)).data.totals)
    expect(cents(totals.recovery_cents)).toBe(30000)
    expect(cents(totals.net_actual_cents)).toBe(60000)

    const twoPays = await issuedApp()
    const allocT = writingAlloc(twoPays)
    expect(
      errMsg(
        (
          await record({
            p_application_id: twoPays,
            p_event_type: 'paid',
            p_amount_cents: 30000,
            p_reason: 'first half',
            p_allocation_id: allocT,
            p_idempotency_key: uniq('t1'),
          })
        ).error,
      ),
    ).toBe('')
    expect(
      errMsg(
        (
          await record({
            p_application_id: twoPays,
            p_event_type: 'paid',
            p_amount_cents: 30000,
            p_reason: 'second half',
            p_allocation_id: allocT,
            p_idempotency_key: uniq('t2'),
          })
        ).error,
      ),
    ).toBe('')
    totals = asRecord((await snapshot(owner, twoPays)).data.totals)
    expect(cents(totals.gross_paid_cents)).toBe(60000)
    expect(cents(totals.net_actual_cents)).toBe(60000)

    const adjusted = await issuedApp()
    const allocA = writingAlloc(adjusted)
    expect(
      errMsg(
        (
          await record({
            p_application_id: adjusted,
            p_event_type: 'paid',
            p_amount_cents: 60000,
            p_reason: 'base paid',
            p_allocation_id: allocA,
            p_idempotency_key: uniq('a0'),
          })
        ).error,
      ),
    ).toBe('')
    expect(
      errMsg(
        (
          await record({
            p_application_id: adjusted,
            p_event_type: 'adjustment',
            p_amount_cents: 2500,
            p_reason: 'independently sourced positive correction',
            p_allocation_id: allocA,
            p_idempotency_key: uniq('a1'),
          })
        ).error,
      ),
    ).toBe('')
    expect(
      errMsg(
        (
          await record({
            p_application_id: adjusted,
            p_event_type: 'adjustment',
            p_amount_cents: -1500,
            p_reason: 'independently sourced negative correction',
            p_allocation_id: allocA,
            p_idempotency_key: uniq('a2'),
          })
        ).error,
      ),
    ).toBe('')
    totals = asRecord((await snapshot(owner, adjusted)).data.totals)
    expect(cents(totals.adjustment_cents)).toBe(1000)
    expect(cents(totals.net_actual_cents)).toBe(61000)
  })

  it('reverses exactly once, rejects spoofed reversal amounts, and does not double-count', async () => {
    const appId = await issuedApp()
    const alloc = writingAlloc(appId)
    const paid = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'to reverse',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('revsrc'),
    })
    expect(errMsg(paid.error)).toBe('')
    const paidId = eventOf(paid).id as string
    const originalAmount = sqlQuery(
      `SELECT amount_cents FROM public.policy_writing_commission_events WHERE id = '${paidId}'`,
    )

    const reversed = await owner.rpc('reverse_policy_writing_commission_event', {
      p_event_id: paidId,
      p_reason: 'posted to wrong advisor',
    })
    expect(errMsg(reversed.error)).toBe('')
    expect(cents(eventOf(reversed).amount_cents)).toBe(-60000)
    expect(eventOf(reversed).reversed_event_id).toBe(paidId)
    expect(asRecord(reversed.data).audit_id).toBeTruthy()

    expect(
      sqlQuery(
        `SELECT amount_cents FROM public.policy_writing_commission_events WHERE id = '${paidId}'`,
      ),
    ).toBe(originalAmount)

    const dup = await owner.rpc('reverse_policy_writing_commission_event', {
      p_event_id: paidId,
      p_reason: 'retry reverse',
    })
    expect(errMsg(dup.error)).toBe('')
    expect(asRecord(dup.data).duplicate).toBe(true)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events
          WHERE reversed_event_id = '${paidId}' AND event_type = 'reversal'`,
      ),
    ).toBe('1')

    const reverseId = eventOf(reversed).id as string
    const reverseAgain = await owner.rpc('reverse_policy_writing_commission_event', {
      p_event_id: reverseId,
      p_reason: 'cannot reverse a reversal',
    })
    expect(errMsg(reverseAgain.error)).toMatch(/CRM_PP:invalid_payload/)

    const secondPaid = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 1000,
      p_reason: 'second posting for spoof probe',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('revsrc2'),
    })
    expect(errMsg(secondPaid.error)).toBe('')
    const secondId = eventOf(secondPaid).id as string
    const accountId = sqlQuery(
      `SELECT account_id FROM public.policy_writing_commission_events WHERE id = '${secondId}'`,
    )
    const spoof = sqlQueryAllowError(
      `INSERT INTO public.policy_writing_commission_events (
         account_id, application_id, allocation_id, advisor_id,
         event_type, amount_cents, reversed_event_id, attribution_status,
         idempotency_key, reason
       ) VALUES (
         '${accountId}', '${appId}', '${alloc}', '${advisorAProfileId}',
         'reversal', -1, '${secondId}', 'attributed',
         '${uniq('spoof')}', 'spoofed amount'
       )`,
    )
    expect(spoof.ok).toBe(false)

    const totals = asRecord((await snapshot(owner, appId)).data.totals)
    expect(cents(totals.gross_paid_cents)).toBe(1000)
    expect(cents(totals.net_actual_cents)).toBe(1000)
    expect(cents(totals.variance_cents)).toBe(-59000)
  })

  it('rejects zero-value events and reversal as a record event_type', async () => {
    const appId = await issuedApp()
    const alloc = writingAlloc(appId)
    const zero = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 0,
      p_reason: 'zero not allowed',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('zero'),
    })
    expect(errMsg(zero.error)).toMatch(/CRM_PP:invalid_payload/)

    const zeroAdj = await record({
      p_application_id: appId,
      p_event_type: 'adjustment',
      p_amount_cents: 0,
      p_reason: 'zero adjustment',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('zeroa'),
    })
    expect(errMsg(zeroAdj.error)).toMatch(/CRM_PP:invalid_payload/)

    const asReversal = await record({
      p_application_id: appId,
      p_event_type: 'reversal',
      p_amount_cents: -60000,
      p_reason: 'must use reverse RPC',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('asrev'),
    })
    expect(errMsg(asReversal.error)).toMatch(/CRM_PP:invalid_payload/)
  })

  it('retries the same idempotency key without duplicating the posting', async () => {
    const appId = await issuedApp()
    const key = uniq('idemp')
    const args = {
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'retry me',
      p_allocation_id: writingAlloc(appId),
      p_idempotency_key: key,
      p_carrier_id: carrierId,
      p_carrier_transaction_id: 'TXN-035-1',
      p_statement_identifier: 'STMT-035-1',
    }
    const first = await record(args)
    expect(errMsg(first.error)).toBe('')
    expect(asRecord(first.data).duplicate).toBe(false)
    const retry = await record(args)
    expect(errMsg(retry.error)).toBe('')
    expect(asRecord(retry.data).duplicate).toBe(true)
    expect(eventOf(retry).id).toBe(eventOf(first).id)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('1')

    const carrierDup = await record({
      ...args,
      p_idempotency_key: uniq('idemp2'),
      p_reason: 'same carrier triple',
    })
    expect(errMsg(carrierDup.error)).toMatch(/CRM_PP:idempotency_conflict/)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('1')
    expect(
      sqlQuery(
        `SELECT amount_cents FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('60000')
  })

  it('isolates split writers, hides unattributed money from advisors, and does not auto-split', async () => {
    const appId = await issuedApp({ allocations: splitWriting(7500, 2500) })
    const allocA = writingAlloc(appId, advisorAProfileId)
    const allocB = writingAlloc(appId, advisorBProfileId)
    expect(liveExpected(appId, advisorAProfileId).split(',')[1]).toBe('45000')
    expect(liveExpected(appId, advisorBProfileId).split(',')[1]).toBe('12000')

    expect(
      errMsg(
        (
          await record({
            p_application_id: appId,
            p_event_type: 'paid',
            p_amount_cents: 45000,
            p_reason: 'Jared paid',
            p_allocation_id: allocA,
            p_idempotency_key: uniq('ja'),
          })
        ).error,
      ),
    ).toBe('')
    expect(
      errMsg(
        (
          await record({
            p_application_id: appId,
            p_event_type: 'paid',
            p_amount_cents: 12000,
            p_reason: 'Jazmin paid',
            p_allocation_id: allocB,
            p_idempotency_key: uniq('jz'),
          })
        ).error,
      ),
    ).toBe('')

    const ownerSnap = await snapshot(owner, appId)
    expect(ownerSnap.data.viewer).toBe('owner')
    expect(cents(asRecord(ownerSnap.data.totals).net_actual_cents)).toBe(57000)
    expect((ownerSnap.data.accounts as unknown[]).length).toBe(2)

    const aSnap = await snapshot(advisorA, appId)
    expect(errMsg(aSnap.error)).toBe('')
    expect(aSnap.data.viewer).toBe('advisor')
    expect(cents(asRecord(aSnap.data.totals).net_actual_cents)).toBe(45000)
    expect(cents(asRecord(aSnap.data.totals).expected_cents)).toBe(45000)
    expect(aSnap.data.unattributed_events).toEqual([])
    expect((aSnap.data.accounts as unknown[]).length).toBe(1)
    expect(
      asRecord(asRecord((aSnap.data.accounts as unknown[])[0]).account).advisor_id,
    ).toBe(advisorAProfileId)

    const bSnap = await snapshot(advisorB, appId)
    expect(errMsg(bSnap.error)).toBe('')
    expect(cents(asRecord(bSnap.data.totals).net_actual_cents)).toBe(12000)
    expect(cents(asRecord(bSnap.data.totals).expected_cents)).toBe(12000)
    expect(
      asRecord(asRecord((bSnap.data.accounts as unknown[])[0]).account).advisor_id,
    ).toBe(advisorBProfileId)

    const aRows = await advisorA
      .from('policy_writing_commission_events')
      .select('id, amount_cents, advisor_id')
      .eq('application_id', appId)
    expect(errMsg(aRows.error)).toBe('')
    expect(aRows.data).toHaveLength(1)
    expect(aRows.data![0].advisor_id).toBe(advisorAProfileId)

    const unattributedApp = await issuedApp({ allocations: splitWriting(7500, 2500) })
    const unattr = await record({
      p_application_id: unattributedApp,
      p_event_type: 'paid',
      p_amount_cents: 57000,
      p_reason: 'carrier paid policy-level, writer unknown',
      p_carrier_id: carrierId,
      p_raw_description: 'policy-level commission',
      p_idempotency_key: uniq('unattr'),
    })
    expect(errMsg(unattr.error)).toBe('')
    expect(eventOf(unattr).advisor_id).toBeNull()
    expect(eventOf(unattr).allocation_id).toBeNull()
    expect(eventOf(unattr).account_id).toBeNull()
    expect(eventOf(unattr).attribution_status).toBe('review_required')
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_accounts WHERE application_id = '${unattributedApp}'`,
      ),
    ).toBe('0')
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events
          WHERE application_id = '${unattributedApp}' AND attribution_status = 'attributed'`,
      ),
    ).toBe('0')

    const ownerUn = await snapshot(owner, unattributedApp)
    expect((ownerUn.data.unattributed_events as unknown[]).length).toBe(1)
    expect(cents(asRecord(ownerUn.data.totals).net_actual_cents)).toBe(57000)

    const aUn = await snapshot(advisorA, unattributedApp)
    expect(aUn.data.unattributed_events).toEqual([])
    expect(cents(asRecord(aUn.data.totals).net_actual_cents)).toBe(0)
    const aUnRows = await advisorA
      .from('policy_writing_commission_events')
      .select('id')
      .eq('application_id', unattributedApp)
    expect(aUnRows.data ?? []).toHaveLength(0)

    const bUn = await snapshot(advisorB, unattributedApp)
    expect(bUn.data.unattributed_events).toEqual([])
    expect((bUn.data.accounts as unknown[]).length).toBe(0)
  })

  it('lets the owner attribute unattributed money without mutating the original row', async () => {
    const appId = await issuedApp({ allocations: splitWriting(7500, 2500) })
    const unattr = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 57000,
      p_reason: 'policy-level until attributed',
      p_carrier_id: carrierId,
      p_statement_identifier: uniq('stmt'),
      p_carrier_transaction_id: uniq('txn'),
      p_idempotency_key: uniq('ua'),
    })
    const sourceId = eventOf(unattr).id as string
    const attributed = await owner.rpc('attribute_unattributed_commission_event', {
      p_event_id: sourceId,
      p_reason: 'writers identified from statement notes',
      p_idempotency_key: uniq('attr'),
      p_attributions: [
        { allocation_id: writingAlloc(appId, advisorAProfileId), amount_cents: 45000 },
        { allocation_id: writingAlloc(appId, advisorBProfileId), amount_cents: 12000 },
      ],
    })
    expect(errMsg(attributed.error)).toBe('')
    expect(asRecord(attributed.data).audit_id).toBeTruthy()
    expect(
      sqlQuery(
        `SELECT advisor_id IS NULL AND allocation_id IS NULL AND account_id IS NULL
           FROM public.policy_writing_commission_events WHERE id = '${sourceId}'`,
      ),
    ).toBe('t')

    const ownerSnap = await snapshot(owner, appId)
    expect(cents(asRecord(ownerSnap.data.totals).net_actual_cents)).toBe(57000)
    expect(cents(asRecord((await snapshot(advisorA, appId)).data.totals).net_actual_cents)).toBe(
      45000,
    )
    expect(cents(asRecord((await snapshot(advisorB, appId)).data.totals).net_actual_cents)).toBe(
      12000,
    )
  })

  it('blocks advisor mutations, owner table DML, and keeps expected/rate-card rows unchanged', async () => {
    const appId = await issuedApp()
    const alloc = writingAlloc(appId)
    const expectedFingerprint = sqlQuery(
      `SELECT string_agg(id::text || ':' || coalesce(expected_compensation_cents::text, 'n') || ':' || calculation_status, ',' ORDER BY id)
         FROM public.policy_application_expected_compensations WHERE application_id = '${appId}'`,
    )
    const scheduleFingerprint = sqlQuery(
      `SELECT string_agg(id::text || ':' || fa_rate::text || ':' || sfa_rate::text, ',' ORDER BY id)
         FROM public.product_compensation_schedules WHERE id IN (${created.schedules
           .map((id) => `'${id}'`)
           .join(',')})`,
    )

    const advisorInsert = await record(
      {
        p_application_id: appId,
        p_event_type: 'paid',
        p_amount_cents: 60000,
        p_reason: 'advisor cannot post',
        p_allocation_id: alloc,
        p_idempotency_key: uniq('advins'),
      },
      advisorA,
    )
    expect(errMsg(advisorInsert.error)).toMatch(/CRM_PP:not_authorized|not_authorized/)

    const paid = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'owner posts for dml probe',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('dml'),
    })
    expect(errMsg(paid.error)).toBe('')
    const eventId = eventOf(paid).id as string
    const accountId = asRecord(paid.data).account_id as string

    const ins = await advisorA.from('policy_writing_commission_events').insert({
      application_id: appId,
      event_type: 'paid',
      amount_cents: 1,
      attribution_status: 'attributed',
      idempotency_key: uniq('raw'),
      reason: 'raw insert',
      account_id: accountId,
      allocation_id: alloc,
      advisor_id: advisorAProfileId,
    })
    expect(errMsg(ins.error)).toMatch(/permission denied|not_authorized/)

    const upd = await advisorA
      .from('policy_writing_commission_events')
      .update({ amount_cents: 1 })
      .eq('id', eventId)
    expect(errMsg(upd.error)).toMatch(/permission denied|not_authorized/)
    const del = await advisorA.from('policy_writing_commission_events').delete().eq('id', eventId)
    expect(errMsg(del.error)).toMatch(/permission denied|not_authorized/)

    const ownerUpd = await owner
      .from('policy_writing_commission_events')
      .update({ amount_cents: 1 })
      .eq('id', eventId)
    expect(errMsg(ownerUpd.error)).toMatch(/permission denied|not_authorized/)
    const ownerDel = await owner.from('policy_writing_commission_events').delete().eq('id', eventId)
    expect(errMsg(ownerDel.error)).toMatch(/permission denied|not_authorized|delete_not_allowed/)

    expect(
      sqlQuery(
        `SELECT string_agg(id::text || ':' || coalesce(expected_compensation_cents::text, 'n') || ':' || calculation_status, ',' ORDER BY id)
           FROM public.policy_application_expected_compensations WHERE application_id = '${appId}'`,
      ),
    ).toBe(expectedFingerprint)
    expect(
      sqlQuery(
        `SELECT string_agg(id::text || ':' || fa_rate::text || ':' || sfa_rate::text, ',' ORDER BY id)
           FROM public.product_compensation_schedules WHERE id IN (${created.schedules
             .map((id) => `'${id}'`)
             .join(',')})`,
      ),
    ).toBe(scheduleFingerprint)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.audit_logs
          WHERE entity_table = 'policy_writing_commission_events' AND entity_id = '${eventId}'`,
      ),
    ).not.toBe('0')
  })

  it('allows an explicit owner pre-issue exception with reason and audit', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    const key = uniq('exc')
    const args = {
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'carrier advanced commission before issue',
      p_allocation_id: writingAlloc(appId),
      p_idempotency_key: key,
    }
    const exception = await owner.rpc('record_policy_writing_commission_event_pre_issue', args)
    expect(errMsg(exception.error)).toBe('')
    expect(asRecord(exception.data).audit_id).toBeTruthy()
    expect(cents(eventOf(exception).amount_cents)).toBe(60000)

    const retry = await owner.rpc('record_policy_writing_commission_event_pre_issue', args)
    expect(errMsg(retry.error)).toBe('')
    expect(asRecord(retry.data).duplicate).toBe(true)
    expect(eventOf(retry).id).toBe(eventOf(exception).id)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('1')

    const conflict = await owner.rpc('record_policy_writing_commission_event_pre_issue', {
      ...args,
      p_amount_cents: 1000,
      p_reason: 'different amount same key',
    })
    expect(errMsg(conflict.error)).toMatch(/CRM_PP:idempotency_conflict/)
    expect(
      sqlQuery(
        `SELECT amount_cents FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('60000')
  })

  it('enforces caller-supplied request idempotency and fails closed on conflicts', async () => {
    const appId = await issuedApp()
    const alloc = writingAlloc(appId)
    const missing = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'missing key',
      p_allocation_id: alloc,
    })
    expect(errMsg(missing.error)).toMatch(
      /CRM_PP:missing_required_fields|Could not find the function|idempotency/,
    )

    const blank = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'blank key',
      p_allocation_id: alloc,
      p_idempotency_key: '   ',
    })
    expect(errMsg(blank.error)).toMatch(/CRM_PP:missing_required_fields/)

    const paidKey = uniq('paid')
    const first = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'first year',
      p_allocation_id: alloc,
      p_idempotency_key: paidKey,
    })
    expect(errMsg(first.error)).toBe('')
    const firstId = eventOf(first).id as string
    const retry = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 60000,
      p_reason: 'retry wording can differ',
      p_allocation_id: alloc,
      p_idempotency_key: paidKey,
    })
    expect(errMsg(retry.error)).toBe('')
    expect(asRecord(retry.data).duplicate).toBe(true)
    expect(eventOf(retry).id).toBe(firstId)
    expect(
      sqlQuery(
        `SELECT count(*) || ',' || coalesce(sum(amount_cents), 0)
           FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('1,60000')

    const conflict = await record({
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 57000,
      p_reason: 'same key different amount',
      p_allocation_id: alloc,
      p_idempotency_key: paidKey,
    })
    expect(errMsg(conflict.error)).toMatch(/CRM_PP:idempotency_conflict/)
    expect(
      sqlQuery(
        `SELECT id || ',' || amount_cents FROM public.policy_writing_commission_events WHERE id = '${firstId}'`,
      ),
    ).toBe(`${firstId},60000`)

    const twoPays = await issuedApp()
    const allocTwo = writingAlloc(twoPays)
    expect(
      errMsg(
        (
          await record({
            p_application_id: twoPays,
            p_event_type: 'paid',
            p_amount_cents: 30000,
            p_reason: 'first 300',
            p_allocation_id: allocTwo,
            p_idempotency_key: uniq('p300a'),
          })
        ).error,
      ),
    ).toBe('')
    expect(
      errMsg(
        (
          await record({
            p_application_id: twoPays,
            p_event_type: 'paid',
            p_amount_cents: 30000,
            p_reason: 'second 300',
            p_allocation_id: allocTwo,
            p_idempotency_key: uniq('p300b'),
          })
        ).error,
      ),
    ).toBe('')
    const twoTotals = asRecord((await snapshot(owner, twoPays)).data.totals)
    expect(cents(twoTotals.gross_paid_cents)).toBe(60000)
    expect(cents(twoTotals.net_actual_cents)).toBe(60000)

    const reversed = await owner.rpc('reverse_policy_writing_commission_event', {
      p_event_id: firstId,
      p_reason: 'posted twice by mistake',
    })
    expect(errMsg(reversed.error)).toBe('')
    const reverseId = eventOf(reversed).id as string
    const reverseRetry = await owner.rpc('reverse_policy_writing_commission_event', {
      p_event_id: firstId,
      p_reason: 'retry reverse after lost response',
    })
    expect(errMsg(reverseRetry.error)).toBe('')
    expect(asRecord(reverseRetry.data).duplicate).toBe(true)
    expect(eventOf(reverseRetry).id).toBe(reverseId)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events
          WHERE reversed_event_id = '${firstId}' AND event_type = 'reversal'`,
      ),
    ).toBe('1')
    const afterReverse = asRecord((await snapshot(owner, appId)).data.totals)
    expect(cents(afterReverse.net_actual_cents)).toBe(0)

    const splitApp = await issuedApp({ allocations: splitWriting(7500, 2500) })
    const unattr = await record({
      p_application_id: splitApp,
      p_event_type: 'paid',
      p_amount_cents: 57000,
      p_reason: 'policy-level until attributed',
      p_carrier_id: carrierId,
      p_statement_identifier: uniq('stmtA'),
      p_carrier_transaction_id: uniq('txnA'),
      p_idempotency_key: uniq('ua2'),
    })
    expect(errMsg(unattr.error)).toBe('')
    const sourceId = eventOf(unattr).id as string
    const attrKey = uniq('attr2')
    const attrPayload = {
      p_event_id: sourceId,
      p_reason: 'writers identified',
      p_idempotency_key: attrKey,
      p_attributions: [
        { allocation_id: writingAlloc(splitApp, advisorAProfileId), amount_cents: 45000 },
        { allocation_id: writingAlloc(splitApp, advisorBProfileId), amount_cents: 12000 },
      ],
    }
    const attributed = await owner.rpc('attribute_unattributed_commission_event', attrPayload)
    expect(errMsg(attributed.error)).toBe('')
    const afterAttrCount = sqlQuery(
      `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${splitApp}'`,
    )
    expect(afterAttrCount).toBe('4')
    const attrRetry = await owner.rpc('attribute_unattributed_commission_event', attrPayload)
    expect(errMsg(attrRetry.error)).toBe('')
    expect(asRecord(attrRetry.data).duplicate).toBe(true)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${splitApp}'`,
      ),
    ).toBe(afterAttrCount)
    expect(cents(asRecord((await snapshot(owner, splitApp)).data.totals).net_actual_cents)).toBe(
      57000,
    )

    const attrConflict = await owner.rpc('attribute_unattributed_commission_event', {
      ...attrPayload,
      p_reason: 'different split same operation key',
      p_attributions: [
        { allocation_id: writingAlloc(splitApp, advisorAProfileId), amount_cents: 57000 },
      ],
    })
    expect(errMsg(attrConflict.error)).toMatch(/CRM_PP:idempotency_conflict/)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${splitApp}'`,
      ),
    ).toBe(afterAttrCount)

    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events
          WHERE application_id IN ('${appId}', '${twoPays}', '${splitApp}')
            AND (idempotency_key IS NULL OR btrim(idempotency_key) = '')`,
      ),
    ).toBe('0')
  })

  it('has integer-cent columns, no upline fields, and no pending/eligible/released event types', async () => {
    expect(
      sqlQuery(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'policy_writing_commission_events'
            AND column_name = 'amount_cents'`,
      ),
    ).toBe('bigint')
    expect(
      sqlQuery(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'policy_writing_commission_accounts'
            AND column_name = 'expected_cents_pinned'`,
      ),
    ).toBe('bigint')
    expect(
      sqlQuery(
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'policy_writing_commission_accounts'
            AND column_name = 'attribution_status'`,
      ),
    ).toBe('0')
    expect(
      sqlQuery(
        `SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'policy_writing_commission_events'
            AND column_name = 'idempotency_key'`,
      ),
    ).toBe('NO')
    expect(
      sqlQuery(
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('policy_writing_commission_accounts', 'policy_writing_commission_events')
            AND column_name ~* 'upline|generational|hierarchy|override|recruiter|spread'`,
      ),
    ).toBe('0')
    const typeCheck = sqlQuery(
      `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'policy_writing_comm_evt_type_check'`,
    )
    expect(typeCheck).toContain('paid')
    expect(typeCheck).toContain('chargeback')
    expect(typeCheck).not.toContain('pending')
    expect(typeCheck).not.toContain('eligible')
    expect(typeCheck).not.toContain('released')
    expect(
      sqlQuery(
        `SELECT relrowsecurity::text || ',' || relforcerowsecurity::text
           FROM pg_class WHERE relname = 'policy_writing_commission_events'`,
      ),
    ).toMatch(/^(t|true),(t|true)$/)
  })
})
