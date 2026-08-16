/**
 * Local Supabase integration for Migration 034 writing-advisor expected
 * compensation. Skips when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass034!'
const PREFIX = 'm034ec'

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

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 034 writing-advisor expected compensation (local DB)', () => {
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
  let productExactId = ''
  let productNoCardId = ''
  let productFiaId = ''
  let productAgeSensitiveId = ''
  let productAgeFloorId = ''

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

  function fiaPayload(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      household_id: householdA,
      carrier_id: carrierId,
      product_id: productFiaId,
      product_line: 'fia',
      state: 'TX',
      annuity_deposit_cents: 10000000,
      participants: [
        { household_member_id: memberA1, role: 'primary_client' },
        { household_member_id: memberA1, role: 'owner' },
        { household_member_id: memberA1, role: 'annuitant' },
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

  function liveRow(appId: string, extra = ''): string {
    return sqlQuery(
      `SELECT calculation_status || ',' || coalesce(expected_compensation_cents::text, 'null') || ',' || coalesce(review_reason, '') || ',' || coalesce(compensation_base_cents::text, 'null')
         FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND superseded_at IS NULL ${extra}`,
    )
  }

  function liveCount(appId: string): string {
    return sqlQuery(
      `SELECT count(*) FROM public.policy_application_expected_compensations WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
  }

  async function addSchedule(args: Record<string, unknown>) {
    const card = await owner.rpc('create_product_compensation_schedule', args)
    expect(errMsg(card.error)).toBe('')
    created.schedules.push(compositeRow(card.data).id as string)
    return compositeRow(card.data).id as string
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}-owner@valtoris.test`, 'M034 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}-adv-a@valtoris.test`, 'M034 Advisor A', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}-adv-b@valtoris.test`, 'M034 Advisor B', 'advisor')
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
    productExactId = await createProduct('Exact', 'life_term')
    productNoCardId = await createProduct('NoCard', 'life_term')
    productFiaId = await createProduct('FIA', 'fia')
    productAgeSensitiveId = await createProduct('AgeSplit', 'fia')
    productAgeFloorId = await createProduct('AgeFloor', 'fia')

    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'SFA',
    })
    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorBProfileId,
      p_contract_level: 'FA',
    })

    await addSchedule({
      p_product_id: productTermId,
      p_age_min: null,
      p_age_max: 75,
      p_fa_rate: 0.4,
      p_sfa_rate: 0.5,
      p_sm_rate: 0.6,
      p_ed_rate: 0.7,
      p_effective_from: '2026-03-24',
    })
    await addSchedule({
      p_product_id: productExactId,
      p_age_min: null,
      p_age_max: 75,
      p_fa_rate: 0.4,
      p_sfa_rate: 0.544,
      p_sm_rate: 0.6,
      p_ed_rate: 0.7,
      p_effective_from: '2026-03-24',
    })
    await addSchedule({
      p_product_id: productFiaId,
      p_age_min: 0,
      p_age_max: 75,
      p_fa_rate: 0.02,
      p_sfa_rate: 0.03,
      p_sm_rate: 0.04,
      p_ed_rate: 0.05,
      p_effective_from: '2026-06-25',
    })
    await addSchedule({
      p_product_id: productAgeSensitiveId,
      p_age_min: 0,
      p_age_max: 64,
      p_fa_rate: 0.02,
      p_sfa_rate: 0.03,
      p_sm_rate: 0.04,
      p_ed_rate: 0.05,
      p_effective_from: '2026-06-25',
    })
    await addSchedule({
      p_product_id: productAgeSensitiveId,
      p_age_min: 65,
      p_age_max: 75,
      p_fa_rate: 0.01,
      p_sfa_rate: 0.015,
      p_sm_rate: 0.02,
      p_ed_rate: 0.025,
      p_effective_from: '2026-06-25',
    })
    await addSchedule({
      p_product_id: productAgeFloorId,
      p_age_min: 50,
      p_age_max: 75,
      p_fa_rate: 0.02,
      p_sfa_rate: 0.03,
      p_sm_rate: 0.04,
      p_ed_rate: 0.05,
      p_effective_from: '2026-06-25',
    })
  }, 180000)

  afterAll(async () => {
    if (created.applications.length) {
      const apps = created.applications.map((id) => `'${id}'`).join(',')
      sqlQuery(
        `DELETE FROM public.policy_application_expected_compensations WHERE application_id IN (${apps})`,
      )
      sqlQuery(`DELETE FROM public.policies WHERE source_application_id IN (${apps})`)
      sqlQuery(
        `DELETE FROM public.audit_logs WHERE entity_table = 'policy_applications' AND entity_id IN (${apps})`,
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

  it('does not create expected rows in draft', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    expect(errMsg(createdApp.error)).toBe('')
    const appId = createdApp.data.application_id as string
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_application_expected_compensations WHERE application_id = '${appId}'`,
      ),
    ).toBe('0')
    expect(createdApp.data.application.expected_compensation.rows ?? null).toEqual([])
  })

  it('annualizes monthly, quarterly, semi-annual, and annual life premium', async () => {
    const cases: Array<[string, number, number]> = [
      ['monthly', 10000, 120000],
      ['quarterly', 10000, 40000],
      ['semi_annual', 10000, 20000],
      ['annual', 10000, 10000],
    ]
    for (const [mode, premium, base] of cases) {
      const createdApp = await createApp(
        owner,
        lifePayload(productTermId, { premium_mode: mode, submitted_premium_cents: premium }),
      )
      const appId = createdApp.data.application_id as string
      expect(errMsg((await submit(owner, appId)).error)).toBe('')
      const cents = Math.round(base * 0.5)
      expect(liveRow(appId)).toBe(`resolved,${cents},,${base}`)
    }
  })

  it('flags single, other, and NULL premium modes as review_required with NULL cents', async () => {
    for (const mode of ['single', 'other']) {
      const createdApp = await createApp(
        owner,
        lifePayload(productTermId, { premium_mode: mode }),
      )
      const appId = createdApp.data.application_id as string
      expect(errMsg((await submit(owner, appId)).error)).toBe('')
      expect(liveRow(appId)).toBe('review_required,null,premium_mode_not_annualizable,null')
    }

    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    sqlQuery(
      `UPDATE public.policy_applications SET premium_mode = NULL WHERE id = '${appId}'`,
    )
    expect(liveRow(appId)).toBe('review_required,null,premium_mode_not_annualizable,null')
  })

  it('uses FIA annuity_deposit_cents only and flags a missing deposit', async () => {
    const createdApp = await createApp(owner, fiaPayload())
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId, '2026-07-01')).error)).toBe('')
    // 10_000_000 * 0.03 * 100% = 300000
    expect(liveRow(appId)).toBe('resolved,300000,,10000000')

    sqlQuery(
      `UPDATE public.policy_applications SET annuity_deposit_cents = NULL WHERE id = '${appId}'`,
    )
    expect(liveRow(appId)).toBe('review_required,null,missing_compensation_base,null')
  })

  it('produces exact cents for 0.544000 at 100% and 75% and FIA 3% at 50%', async () => {
    const full = await createApp(owner, lifePayload(productExactId))
    const fullId = full.data.application_id as string
    expect(errMsg((await submit(owner, fullId)).error)).toBe('')
    expect(liveRow(fullId)).toBe('resolved,65280,,120000')

    const split = await createApp(
      owner,
      lifePayload(productExactId, {
        allocations: [
          {
            recipient_type: 'advisor',
            advisor_id: advisorAProfileId,
            allocation_role: 'writing',
            commission_bps: 7500,
            production_credit_bps: 7500,
          },
          {
            recipient_type: 'house',
            allocation_role: 'writing',
            commission_bps: 2500,
            production_credit_bps: 2500,
          },
        ],
      }),
    )
    expect(errMsg(split.error)).toBe('')
    const splitId = split.data.application_id as string
    expect(errMsg((await submit(owner, splitId)).error)).toBe('')
    expect(liveRow(splitId)).toBe('resolved,48960,,120000')

    const fia = await createApp(
      owner,
      fiaPayload({
        allocations: [
          {
            recipient_type: 'advisor',
            advisor_id: advisorAProfileId,
            allocation_role: 'writing',
            commission_bps: 5000,
            production_credit_bps: 5000,
          },
          {
            recipient_type: 'house',
            allocation_role: 'writing',
            commission_bps: 5000,
            production_credit_bps: 5000,
          },
        ],
      }),
    )
    expect(errMsg(fia.error)).toBe('')
    const fiaId = fia.data.application_id as string
    expect(errMsg((await submit(owner, fiaId, '2026-07-01')).error)).toBe('')
    expect(liveRow(fiaId)).toBe('resolved,150000,,10000000')
  })

  it('uses each writing advisor rank independently and excludes house and servicing', async () => {
    const splitApp = await createApp(
      owner,
      lifePayload(productTermId, { allocations: splitWriting(7500, 2500) }),
    )
    const splitId = splitApp.data.application_id as string
    expect(errMsg((await submit(owner, splitId)).error)).toBe('')
    expect(
      sqlQuery(
        `SELECT expected_compensation_cents || ',' || writing_contract_level
           FROM public.policy_application_expected_compensations
          WHERE application_id = '${splitId}' AND advisor_id = '${advisorAProfileId}' AND superseded_at IS NULL`,
      ),
    ).toBe('45000,SFA')
    expect(
      sqlQuery(
        `SELECT expected_compensation_cents || ',' || writing_contract_level
           FROM public.policy_application_expected_compensations
          WHERE application_id = '${splitId}' AND advisor_id = '${advisorBProfileId}' AND superseded_at IS NULL`,
      ),
    ).toBe('12000,FA')

    const houseApp = await createApp(
      owner,
      lifePayload(productTermId, {
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
      }),
    )
    const houseId = houseApp.data.application_id as string
    expect(errMsg((await submit(owner, houseId)).error)).toBe('')
    expect(liveCount(houseId)).toBe('1')
    expect(
      sqlQuery(
        `SELECT expected_compensation_cents FROM public.policy_application_expected_compensations
          WHERE application_id = '${houseId}' AND superseded_at IS NULL`,
      ),
    ).toBe('42000')
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_application_expected_compensations e
           JOIN public.policy_agent_allocations al ON al.id = e.allocation_id
          WHERE e.application_id = '${houseId}' AND al.recipient_type = 'house'`,
      ),
    ).toBe('0')

    const servicingApp = await createApp(
      owner,
      lifePayload(productTermId, {
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
      }),
    )
    const servicingId = servicingApp.data.application_id as string
    expect(errMsg((await submit(owner, servicingId)).error)).toBe('')
    expect(liveCount(servicingId)).toBe('1')
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_application_expected_compensations e
           JOIN public.policy_agent_allocations al ON al.id = e.allocation_id
          WHERE e.application_id = '${servicingId}' AND al.allocation_role = 'servicing'`,
      ),
    ).toBe('0')
  })

  it('flags missing writing_contract_level as review_required', async () => {
    const slug = `${PREFIX}-norank-${randomUUID().slice(0, 8)}`
    const userId = await ensureUser(`${slug}@valtoris.test`, 'No Rank', 'advisor')
    const profileId = await ensureAdvisorProfile(userId, slug)
    const createdApp = await createApp(
      owner,
      lifePayload(productTermId, { allocations: writingFull(profileId) }),
    )
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    expect(liveRow(appId)).toBe('review_required,null,missing_writing_contract_level,120000')
  })

  it('marks products with no rate card unavailable without blocking submit', async () => {
    const createdApp = await createApp(owner, lifePayload(productNoCardId))
    const appId = createdApp.data.application_id as string
    const moved = await submit(owner, appId)
    expect(errMsg(moved.error)).toBe('')
    expect(moved.data.to_stage).toBe('submitted')
    expect(liveRow(appId)).toBe('unavailable,null,no_rate_card,120000')
  })

  it('does not select a future card and uses review_required for historical lookup dates', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    const moved = await submit(owner, appId, '2026-03-01')
    expect(errMsg(moved.error)).toBe('')
    expect(moved.data.to_stage).toBe('submitted')
    expect(liveRow(appId)).toBe('review_required,null,no_rate_card_for_lookup_date,120000')
    expect(
      sqlQuery(
        `SELECT coalesce(product_compensation_schedule_id::text, 'null')
           FROM public.policy_application_expected_compensations
          WHERE application_id = '${appId}' AND superseded_at IS NULL`,
      ),
    ).toBe('null')
  })

  it('fails closed on age-sensitive cards and never derives attained age', async () => {
    const dual = await createApp(
      owner,
      fiaPayload({ product_id: productAgeSensitiveId }),
    )
    const dualId = dual.data.application_id as string
    const dualMoved = await submit(owner, dualId, '2026-07-01')
    expect(errMsg(dualMoved.error)).toBe('')
    expect(dualMoved.data.to_stage).toBe('submitted')
    expect(liveRow(dualId)).toBe('review_required,null,age_sensitive_rate_card,10000000')

    const floor = await createApp(owner, fiaPayload({ product_id: productAgeFloorId }))
    const floorId = floor.data.application_id as string
    expect(errMsg((await submit(owner, floorId, '2026-07-01')).error)).toBe('')
    expect(liveRow(floorId)).toBe('review_required,null,age_sensitive_rate_card,10000000')

    const def = sqlQuery(
      `SELECT pg_get_functiondef('public.pp_refresh_application_expected_compensation(uuid,text)'::regprocedure)`,
    )
    expect(def).not.toMatch(/date_part\('year',\s*age\(/i)
    expect(def).not.toMatch(/household_members\.age/)
  })

  it('supersedes on premium correction instead of updating cents in place', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    await submit(owner, appId)
    const firstId = sqlQuery(
      `SELECT id FROM public.policy_application_expected_compensations WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
    expect(errMsg((await owner.rpc('update_policy_application', {
      p_id: appId,
      p_payload: { submitted_premium_cents: 11000 },
    })).error)).toBe('')
    const live = sqlQuery(
      `SELECT expected_compensation_cents || ',' || (id = '${firstId}')::text
         FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
    expect(live).toBe('66000,false')
    expect(
      sqlQuery(
        `SELECT expected_compensation_cents FROM public.policy_application_expected_compensations WHERE id = '${firstId}'`,
      ),
    ).toBe('60000')
    const ownerHist = await owner
      .from('policy_application_expected_compensations')
      .select('id')
      .eq('application_id', appId)
      .not('superseded_at', 'is', null)
    expect(ownerHist.data?.some((row) => row.id === firstId)).toBe(true)
  })

  it('supersedes 75/25 writing allocations to 50/50 and leaves no live row on closed allocations', async () => {
    const createdApp = await createApp(
      owner,
      lifePayload(productTermId, { allocations: splitWriting(7500, 2500) }),
    )
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    const oldAllocs = sqlQuery(
      `SELECT string_agg(id::text, ',' ORDER BY commission_bps DESC)
         FROM public.policy_agent_allocations
        WHERE application_id = '${appId}' AND allocation_role = 'writing' AND effective_to IS NULL`,
    )
    const changed = await owner.rpc('set_policy_application_allocations', {
      p_application_id: appId,
      p_allocations: splitWriting(5000, 5000),
      p_reason: 'equalize split',
    })
    expect(errMsg(changed.error)).toBe('')
    expect(liveCount(appId)).toBe('2')
    const a = sqlQuery(
      `SELECT expected_compensation_cents FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND advisor_id = '${advisorAProfileId}' AND superseded_at IS NULL`,
    )
    const b = sqlQuery(
      `SELECT expected_compensation_cents FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND advisor_id = '${advisorBProfileId}' AND superseded_at IS NULL`,
    )
    expect(a).toBe('30000')
    expect(b).toBe('24000')
    for (const oldId of oldAllocs.split(',')) {
      expect(
        sqlQuery(
          `SELECT count(*) FROM public.policy_application_expected_compensations
            WHERE allocation_id = '${oldId}' AND superseded_at IS NULL`,
        ),
      ).toBe('0')
      expect(
        sqlQuery(
          `SELECT count(*) FROM public.policy_application_expected_compensations
            WHERE allocation_id = '${oldId}' AND superseded_at IS NOT NULL`,
        ),
      ).not.toBe('0')
    }
  })

  it('performs final recalc at issue, freezes ordinary post-issue changes, and preserves withdrawn/declined history', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    const beforeIssue = sqlQuery(
      `SELECT id || ',' || expected_compensation_cents FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
    await advanceToIssued(appId)
    const afterIssue = sqlQuery(
      `SELECT id || ',' || expected_compensation_cents || ',' || coalesce(supersede_reason, '')
         FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
    expect(afterIssue.endsWith(',')).toBe(true)
    expect(afterIssue.split(',')[1]).toBe('60000')
    const issuedLiveId = afterIssue.split(',')[0]
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_application_expected_compensations
          WHERE application_id = '${appId}' AND superseded_at IS NOT NULL AND supersede_reason = 'issued'`,
      ),
    ).toBe('1')
    expect(beforeIssue.split(',')[0]).not.toBe(issuedLiveId)

    expect(
      errMsg(
        (await owner.rpc('update_policy_application', {
          p_id: appId,
          p_payload: { notes: 'post-issue note' },
        })).error,
      ),
    ).toBe('')
    expect(
      sqlQuery(
        `SELECT id FROM public.policy_application_expected_compensations WHERE application_id = '${appId}' AND superseded_at IS NULL`,
      ),
    ).toBe(issuedLiveId)
    const advisorRecalc = await advisorA.rpc(
      'recalculate_policy_application_expected_compensation',
      { p_application_id: appId, p_reason: 'should fail' },
    )
    expect(errMsg(advisorRecalc.error)).toMatch(/CRM_PP:not_authorized/)

    const ownerNoop = await owner.rpc(
      'recalculate_policy_application_expected_compensation',
      { p_application_id: appId, p_reason: 'confirm freeze numbers' },
    )
    expect(errMsg(ownerNoop.error)).toBe('')
    expect(ownerNoop.data.financial_values_changed).toBe(false)
    expect(ownerNoop.data.audit_id).toBeTruthy()
    expect(
      sqlQuery(
        `SELECT (after->>'reason') || ',' || (after->>'financial_values_changed')
           FROM public.audit_logs WHERE id = '${ownerNoop.data.audit_id}'`,
      ),
    ).toBe('confirm freeze numbers,false')
    expect(
      sqlQuery(
        `SELECT id FROM public.policy_application_expected_compensations WHERE application_id = '${appId}' AND superseded_at IS NULL`,
      ),
    ).toBe(issuedLiveId)

    sqlQuery(
      `UPDATE public.policy_applications SET submitted_premium_cents = 99999 WHERE id = '${appId}'`,
    )
    expect(
      sqlQuery(
        `SELECT expected_compensation_cents || ',' || id::text FROM public.policy_application_expected_compensations
          WHERE application_id = '${appId}' AND superseded_at IS NULL`,
      ),
    ).toBe(`60000,${issuedLiveId}`)

    const withdrawnApp = await createApp(owner, lifePayload(productTermId))
    const withdrawnId = withdrawnApp.data.application_id as string
    expect(errMsg((await submit(owner, withdrawnId)).error)).toBe('')
    const withdrawnLive = liveRow(withdrawnId)
    expect(errMsg((await transition(owner, withdrawnId, 'withdrawn')).error)).toBe('')
    expect(liveRow(withdrawnId)).toBe(withdrawnLive)

    const declinedApp = await createApp(owner, lifePayload(productTermId))
    const declinedId = declinedApp.data.application_id as string
    expect(errMsg((await submit(owner, declinedId)).error)).toBe('')
    expect(errMsg((await transition(owner, declinedId, 'in_underwriting')).error)).toBe('')
    const declinedLive = liveRow(declinedId)
    expect(
      errMsg((await transition(owner, declinedId, 'declined', { disposition: 'declined' })).error),
    ).toBe('')
    expect(liveRow(declinedId)).toBe(declinedLive)
  }, 120000)

  it('still submits when expected compensation is unavailable, historical, unsupported, or age-sensitive', async () => {
    const noCard = await createApp(owner, lifePayload(productNoCardId))
    expect(errMsg((await submit(owner, noCard.data.application_id)).error)).toBe('')
    const historical = await createApp(owner, lifePayload(productTermId))
    expect(errMsg((await submit(owner, historical.data.application_id, '2026-03-01')).error)).toBe('')
    const single = await createApp(owner, lifePayload(productTermId, { premium_mode: 'single' }))
    expect(errMsg((await submit(owner, single.data.application_id)).error)).toBe('')
    const age = await createApp(owner, fiaPayload({ product_id: productAgeSensitiveId }))
    expect(errMsg((await submit(owner, age.data.application_id, '2026-07-01')).error)).toBe('')
  })

  it('lets a split writer read only their expected row without household access', async () => {
    const createdApp = await createApp(
      owner,
      lifePayload(productTermId, { allocations: splitWriting(7500, 2500) }),
    )
    const appId = createdApp.data.application_id as string
    const submitted = await submit(owner, appId)
    expect(errMsg(submitted.error)).toBe('')

    const aRead = await advisorA
      .from('policy_application_expected_compensations')
      .select('advisor_id, expected_compensation_cents, writing_rate, writing_contract_level')
      .eq('application_id', appId)
      .is('superseded_at', null)
    expect(errMsg(aRead.error)).toBe('')
    expect(aRead.data?.length).toBe(1)
    expect(aRead.data?.[0]?.advisor_id).toBe(advisorAProfileId)
    expect(aRead.data?.[0]?.expected_compensation_cents).toBe(45000)

    const bRead = await advisorB
      .from('policy_application_expected_compensations')
      .select('advisor_id, expected_compensation_cents, writing_rate, writing_contract_level')
      .eq('application_id', appId)
      .is('superseded_at', null)
    expect(errMsg(bRead.error)).toBe('')
    expect(bRead.data?.length).toBe(1)
    expect(bRead.data?.[0]?.advisor_id).toBe(advisorBProfileId)
    expect(bRead.data?.[0]?.expected_compensation_cents).toBe(12000)

    const bHousehold = await advisorB.from('households').select('id').eq('id', householdA)
    expect(bHousehold.data?.length).toBe(0)
    const bApps = await advisorB.from('policy_applications').select('id').eq('id', appId)
    expect(bApps.data?.length).toBe(0)
    const bUpdate = await advisorB.rpc('update_policy_application', {
      p_id: appId,
      p_payload: { notes: 'should not work' },
    })
    expect(errMsg(bUpdate.error)).toMatch(/CRM_PP:not_found/)
    const bGrid = await advisorB.from('product_compensation_schedules').select('id')
    expect(bGrid.data?.length).toBe(0)

    const ownerRead = await owner
      .from('policy_application_expected_compensations')
      .select('advisor_id')
      .eq('application_id', appId)
      .is('superseded_at', null)
    expect(ownerRead.data?.length).toBe(2)

    expect(submitted.data.application.expected_compensation.viewer).toBe('owner')
    expect(submitted.data.application.expected_compensation.rows).toHaveLength(2)
    expect(submitted.data.application.expected_compensation.resolved_total_cents).toBe(57000)

    const aSnap = await advisorA.rpc('update_policy_application', {
      p_id: appId,
      p_payload: { notes: 'advisor snapshot' },
    })
    expect(errMsg(aSnap.error)).toBe('')
    expect(aSnap.data.application.expected_compensation.viewer).toBe('advisor')
    expect(aSnap.data.application.expected_compensation.row.expected_compensation_cents).toBe(45000)
    expect(aSnap.data.application.expected_compensation.rows).toBeUndefined()
  })

  it('blocks direct DML and enforces unresolved NULL cents, resolved snapshot shape, and one live row per allocation', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    await submit(owner, appId)
    const ids = sqlQuery(
      `SELECT e.id || ',' || e.allocation_id
         FROM public.policy_application_expected_compensations e
        WHERE e.application_id = '${appId}' AND e.superseded_at IS NULL`,
    )
    const [rowId, allocationId] = ids.split(',')

    const ins = await owner.from('policy_application_expected_compensations').insert({
      application_id: appId,
      allocation_id: allocationId,
      advisor_id: advisorAProfileId,
      calculation_status: 'resolved',
    })
    expect(errMsg(ins.error)).toMatch(/permission denied|not_authorized/)
    const upd = await owner
      .from('policy_application_expected_compensations')
      .update({ expected_compensation_cents: 1 })
      .eq('id', rowId)
    expect(errMsg(upd.error)).toMatch(/permission denied|not_authorized/)
    const del = await owner.from('policy_application_expected_compensations').delete().eq('id', rowId)
    expect(errMsg(del.error)).toMatch(/permission denied|not_authorized/)

    const zeroCents = sqlQueryAllowError(
      `INSERT INTO public.policy_application_expected_compensations (
         application_id, allocation_id, advisor_id, calculation_status, review_reason,
         expected_compensation_cents, superseded_at, supersede_reason
       ) VALUES (
         '${appId}', '${allocationId}', '${advisorAProfileId}', 'review_required',
         'premium_mode_not_annualizable', 0, now(), 'constraint probe'
       )`,
    )
    expect(zeroCents.ok).toBe(false)

    const draft = await createApp(owner, lifePayload(productTermId))
    const draftId = draft.data.application_id as string
    const draftAlloc = sqlQuery(
      `SELECT id FROM public.policy_agent_allocations WHERE application_id = '${draftId}' AND effective_to IS NULL LIMIT 1`,
    )
    const resolvedBare = sqlQueryAllowError(
      `INSERT INTO public.policy_application_expected_compensations (
         application_id, allocation_id, advisor_id, calculation_status, expected_compensation_cents
       ) VALUES (
         '${draftId}', '${draftAlloc}', '${advisorAProfileId}', 'resolved', 1
       )`,
    )
    expect(resolvedBare.ok).toBe(false)

    const dupLive = sqlQueryAllowError(
      `INSERT INTO public.policy_application_expected_compensations (
         application_id, allocation_id, advisor_id, calculation_status, review_reason
       ) VALUES (
         '${appId}', '${allocationId}', '${advisorAProfileId}', 'review_required', 'premium_mode_not_annualizable'
       )`,
    )
    expect(dupLive.ok).toBe(false)
  })
})
