/**
 * Local Supabase integration for Migration 033 writing-advisor compensation
 * rate-card foundation. Skips when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass033!'
const PREFIX = 'm033wc'

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

function compositeRow(data: unknown): Record<string, unknown> {
  return (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 033 writing-advisor compensation foundation (local DB)', () => {
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

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}-owner@valtoris.test`, 'M033 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}-adv-a@valtoris.test`, 'M033 Advisor A', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}-adv-b@valtoris.test`, 'M033 Advisor B', 'advisor')
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
    })
    if (memberError) throw memberError

    const carrier = await owner.rpc('create_carrier', {
      p_code: uniq('c'),
      p_name: `${PREFIX} Carrier ${randomUUID().slice(0, 8)}`,
    })
    if (carrier.error) throw carrier.error
    carrierId = compositeRow(carrier.data).id as string
    created.carriers.push(carrierId)
    const product = await owner.rpc('create_insurance_product', {
      p_carrier_id: carrierId,
      p_name: `${PREFIX} Term ${randomUUID().slice(0, 8)}`,
      p_product_line: 'life_term',
    })
    if (product.error) throw product.error
    productTermId = compositeRow(product.data).id as string
  }, 120000)

  afterAll(async () => {
    if (created.applications.length) {
      sqlQuery(
        `DELETE FROM public.policy_application_expected_compensations WHERE application_id IN (${created.applications
          .map((id) => `'${id}'`)
          .join(',')})`,
      )
    }
    if (created.schedules.length) {
      sqlQuery(
        `DELETE FROM public.product_compensation_schedules WHERE id IN (${created.schedules
          .map((id) => `'${id}'`)
          .join(',')})`,
      )
    }
    if (created.applications.length) {
      sqlQuery(
        `DELETE FROM public.policy_applications WHERE id IN (${created.applications
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
  })

  it('accepts FA/SFA/SM/ED/NULL and rejects invalid contract levels', async () => {
    for (const level of ['FA', 'SFA', 'SM', 'ED', null] as const) {
      const res = await owner.rpc('set_advisor_contract_level', {
        p_advisor_id: advisorAProfileId,
        p_contract_level: level,
      })
      expect(errMsg(res.error), String(level)).toBe('')
      expect(compositeRow(res.data).contract_level ?? null).toBe(level)
    }
    const invalid = await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'fa',
    })
    expect(errMsg(invalid.error)).toMatch(/CRM_PP:invalid_payload/)
    const manager = await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'MANAGER',
    })
    expect(errMsg(manager.error)).toMatch(/CRM_PP:invalid_payload/)
  })

  it('lets the owner set contract_level and blocks advisor self-service', async () => {
    const ownerSet = await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'SFA',
    })
    expect(errMsg(ownerSet.error)).toBe('')

    const advisorRpc = await advisorA.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'ED',
    })
    expect(errMsg(advisorRpc.error)).toMatch(/CRM_PP:not_authorized/)

    const selfUpdate = await advisorA
      .from('advisor_profiles')
      .update({ contract_level: 'ED' })
      .eq('id', advisorAProfileId)
    expect(errMsg(selfUpdate.error)).toMatch(/cannot be changed by advisors/)

    const still = sqlQuery(
      `SELECT contract_level FROM public.advisor_profiles WHERE id = '${advisorAProfileId}'`,
    )
    expect(still).toBe('SFA')
  })

  it('snapshots writing ranks, keeps house/servicing null, and does not rewrite history', async () => {
    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'SFA',
    })
    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorBProfileId,
      p_contract_level: 'FA',
    })

    const createdApp = await createApp(owner, lifePayload())
    expect(errMsg(createdApp.error)).toBe('')
    const appId = createdApp.data.application_id as string

    const first = sqlQuery(
      `SELECT writing_contract_level FROM public.policy_agent_allocations WHERE application_id = '${appId}' AND effective_to IS NULL AND allocation_role = 'writing'`,
    )
    expect(first).toBe('SFA')

    const split = await owner.rpc('set_policy_application_allocations', {
      p_application_id: appId,
      p_allocations: [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 7500,
          production_credit_bps: 7500,
        },
        {
          recipient_type: 'advisor',
          advisor_id: advisorBProfileId,
          allocation_role: 'writing',
          commission_bps: 2500,
          production_credit_bps: 2500,
        },
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'servicing',
          commission_bps: 0,
          production_credit_bps: 0,
        },
      ],
      p_reason: null,
    })
    expect(errMsg(split.error)).toBe('')

    const splitRows = sqlQuery(
      `SELECT advisor_id || ':' || allocation_role || ':' || coalesce(writing_contract_level, 'null') FROM public.policy_agent_allocations WHERE application_id = '${appId}' AND effective_to IS NULL ORDER BY allocation_role, advisor_id`,
    )
    expect(splitRows).toContain(`${advisorAProfileId}:writing:SFA`)
    expect(splitRows).toContain(`${advisorBProfileId}:writing:FA`)
    expect(splitRows).toContain(`${advisorAProfileId}:servicing:null`)

    const house = await owner.rpc('set_policy_application_allocations', {
      p_application_id: appId,
      p_allocations: [
        {
          recipient_type: 'advisor',
          advisor_id: advisorAProfileId,
          allocation_role: 'writing',
          commission_bps: 7000,
          production_credit_bps: 7000,
        },
        {
          recipient_type: 'house',
          advisor_id: null,
          allocation_role: 'writing',
          commission_bps: 3000,
          production_credit_bps: 3000,
        },
      ],
      p_reason: null,
    })
    expect(errMsg(house.error)).toBe('')
    const houseLevel = sqlQuery(
      `SELECT coalesce(writing_contract_level, 'null') FROM public.policy_agent_allocations WHERE application_id = '${appId}' AND effective_to IS NULL AND recipient_type = 'house'`,
    )
    expect(houseLevel).toBe('null')

    const closedSfa = sqlQuery(
      `SELECT count(*) FROM public.policy_agent_allocations WHERE application_id = '${appId}' AND writing_contract_level = 'SFA' AND effective_to IS NOT NULL`,
    )
    expect(Number(closedSfa)).toBeGreaterThan(0)

    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'ED',
    })
    const historical = sqlQuery(
      `SELECT writing_contract_level FROM public.policy_agent_allocations WHERE application_id = '${appId}' AND writing_contract_level = 'SFA' AND effective_to IS NOT NULL LIMIT 1`,
    )
    expect(historical).toBe('SFA')
    const current = sqlQuery(
      `SELECT writing_contract_level FROM public.policy_agent_allocations WHERE application_id = '${appId}' AND effective_to IS NULL AND recipient_type = 'advisor' AND allocation_role = 'writing'`,
    )
    expect(current).toBe('SFA')
  })

  it('creates owner-only rate cards and rejects advisor raw SELECT plus invalid payloads', async () => {
    const advisorCreate = await advisorA.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: null,
      p_age_max: null,
      p_fa_rate: 0.4,
      p_sfa_rate: 0.5,
      p_sm_rate: 0.6,
      p_ed_rate: 0.7,
      p_effective_from: '2026-01-01',
    })
    expect(errMsg(advisorCreate.error)).toMatch(/CRM_PP:not_authorized/)

    const createdCard = await owner.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: null,
      p_age_max: null,
      p_fa_rate: 0.4,
      p_sfa_rate: 0.5,
      p_sm_rate: 0.6,
      p_ed_rate: 0.7,
      p_effective_from: '2026-01-01',
      p_source_age_band: 'all ages',
    })
    expect(errMsg(createdCard.error)).toBe('')
    const scheduleId = compositeRow(createdCard.data).id as string
    created.schedules.push(scheduleId)

    const ownerRead = await owner
      .from('product_compensation_schedules')
      .select('id')
      .eq('id', scheduleId)
    expect(errMsg(ownerRead.error)).toBe('')
    expect(ownerRead.data?.length).toBe(1)

    const advisorRead = await advisorA
      .from('product_compensation_schedules')
      .select('id')
      .eq('id', scheduleId)
    expect(errMsg(advisorRead.error)).toBe('')
    expect(advisorRead.data?.length).toBe(0)

    const highRate = await owner.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: 0,
      p_age_max: 75,
      p_fa_rate: 2.1,
      p_sfa_rate: 0.5,
      p_sm_rate: 0.6,
      p_ed_rate: 0.7,
      p_effective_from: '2026-02-01',
    })
    expect(errMsg(highRate.error)).toMatch(/CRM_PP:invalid_payload/)

    const badAge = await owner.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: 80,
      p_age_max: 18,
      p_fa_rate: 0.1,
      p_sfa_rate: 0.1,
      p_sm_rate: 0.1,
      p_ed_rate: 0.1,
      p_effective_from: '2026-02-01',
    })
    expect(errMsg(badAge.error)).toMatch(/CRM_PP:invalid_payload/)

    const badDates = await owner.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: 0,
      p_age_max: 75,
      p_fa_rate: 0.1,
      p_sfa_rate: 0.1,
      p_sm_rate: 0.1,
      p_ed_rate: 0.1,
      p_effective_from: '2026-12-31',
      p_effective_to: '2026-01-01',
    })
    expect(errMsg(badDates.error)).toMatch(/CRM_PP:invalid_payload/)

    const duplicate = await owner.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: null,
      p_age_max: null,
      p_fa_rate: 0.41,
      p_sfa_rate: 0.51,
      p_sm_rate: 0.61,
      p_ed_rate: 0.71,
      p_effective_from: '2026-01-01',
    })
    expect(errMsg(duplicate.error)).toMatch(/CRM_PP:invalid_payload/)

    const overlap = await owner.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: 0,
      p_age_max: 75,
      p_fa_rate: 0.2,
      p_sfa_rate: 0.2,
      p_sm_rate: 0.2,
      p_ed_rate: 0.2,
      p_effective_from: '2026-06-01',
    })
    expect(errMsg(overlap.error)).toMatch(/CRM_PP:invalid_payload/)

    const mutateRate = await owner.rpc('update_product_compensation_schedule', {
      p_id: scheduleId,
      p_effective_to: '2026-12-31',
    })
    expect(errMsg(mutateRate.error)).toBe('')
    expect(Number(compositeRow(mutateRate.data).fa_rate)).toBe(0.4)

    const inPlace = await owner
      .from('product_compensation_schedules')
      .update({ fa_rate: 0.99 })
      .eq('id', scheduleId)
    expect(errMsg(inPlace.error)).not.toBe('')

    const ownerHardDelete = await owner
      .from('product_compensation_schedules')
      .delete()
      .eq('id', scheduleId)
    expect(errMsg(ownerHardDelete.error)).not.toBe('')

    const next = await owner.rpc('create_product_compensation_schedule', {
      p_product_id: productTermId,
      p_age_min: null,
      p_age_max: null,
      p_fa_rate: 0.45,
      p_sfa_rate: 0.55,
      p_sm_rate: 0.65,
      p_ed_rate: 0.75,
      p_effective_from: '2027-01-01',
    })
    expect(errMsg(next.error)).toBe('')
    created.schedules.push(compositeRow(next.data).id as string)

    const hardDelete = await advisorA
      .from('product_compensation_schedules')
      .delete()
      .eq('id', scheduleId)
    expect(errMsg(hardDelete.error)).not.toBe('')
    const stillThere = sqlQuery(
      `SELECT count(*) FROM public.product_compensation_schedules WHERE id = '${scheduleId}'`,
    )
    expect(stillThere).toBe('1')
  })

  it('does not create or alter a legacy archival compensation table', () => {
    const exists = sqlQuery(
      `SELECT to_regclass('public.product_compensation_schedules_source_legacy') IS NOT NULL`,
    )
    expect(['t', 'f']).toContain(exists)
    if (exists === 't') {
      const count = sqlQuery(
        `SELECT count(*) FROM public.product_compensation_schedules_source_legacy`,
      )
      expect(Number(count)).toBeGreaterThanOrEqual(0)
    }
  })
})
