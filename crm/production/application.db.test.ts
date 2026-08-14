/**
 * Local Supabase tests for P1B-2B application entry wrappers.
 * Skips when local Supabase is not running. Cleans up prefixed rows.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createPolicyApplication,
  setPolicyApplicationAllocations,
  setPolicyApplicationParticipants,
  submitProductionApplication,
  transitionPolicyApplicationStage,
} from './applicationApi'
import { defaultWritingAllocations } from './applicationView'
import { createCarrier, createInsuranceProduct } from './catalogApi'

const PASS = 'LocalQaPassP1B2B!'
const PREFIX = 'p1b2b'
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

function sqlQuery(sql: string): string {
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  return execSync(
    `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c ${JSON.stringify(oneLine)}`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim()
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('P1B-2B application entry (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisor: SupabaseClient
  let anon: SupabaseClient
  let ownerId = ''
  let advisorProfileId = ''
  let householdId = ''
  let memberId = ''
  let carrierId = ''
  let lifeProductId = ''
  let fiaProductId = ''
  const createdAppIds: string[] = []

  async function ensureUser(email: string, role: 'owner' | 'advisor'): Promise<string> {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) throw list.error
    const existing = (list.data?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    let userId: string
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password: PASS,
        email_confirm: true,
      })
      if (error) throw error
      userId = existing.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASS,
        email_confirm: true,
      })
      if (error) throw error
      userId = data.user.id
    }
    await admin.from('profiles').upsert({
      id: userId,
      email,
      full_name: role === 'owner' ? 'P1B2B Owner' : 'P1B2B Advisor',
      role,
      is_active: true,
      deleted_at: null,
    })
    sqlQuery(
      `UPDATE public.profiles SET role = '${role}', is_active = true, deleted_at = NULL WHERE id = '${userId}'`,
    )
    return userId
  }

  async function signIn(email: string): Promise<SupabaseClient> {
    const client = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await client.auth.signInWithPassword({ email, password: PASS })
    if (error) throw error
    return client
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}.owner@example.com`, 'owner')
    const advisorUserId = await ensureUser(`${PREFIX}.advisor@example.com`, 'advisor')
    const { data: existingAdv } = await admin
      .from('advisor_profiles')
      .select('id')
      .eq('user_id', advisorUserId)
      .maybeSingle()
    if (existingAdv?.id) {
      advisorProfileId = existingAdv.id
      await admin
        .from('advisor_profiles')
        .update({ is_active: true, slug: `${PREFIX}-adv`, display_name: 'P1B2B Advisor', deleted_at: null })
        .eq('id', advisorProfileId)
    } else {
      const inserted = await admin
        .from('advisor_profiles')
        .insert({
          user_id: advisorUserId,
          slug: `${PREFIX}-adv`,
          display_name: 'P1B2B Advisor',
          is_active: true,
        })
        .select('id')
        .single()
      if (inserted.error) throw inserted.error
      advisorProfileId = inserted.data.id
    }
    owner = await signIn(`${PREFIX}.owner@example.com`)
    advisor = await signIn(`${PREFIX}.advisor@example.com`)

    householdId = randomUUID()
    const hh = await admin.from('households').insert({
      id: householdId,
      display_name: `${PREFIX} Household`,
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
    if (hh.error) throw hh.error
    await admin.from('advisor_assignments').insert({
      household_id: householdId,
      advisor_id: advisorProfileId,
      assignment_role: 'primary',
      reason: 'manual',
      assigned_by_user_id: ownerId,
    })
    memberId = randomUUID()
    const mem = await admin.from('household_members').insert({
      id: memberId,
      household_id: householdId,
      first_name: 'Pat',
      last_name: PREFIX,
      relationship: 'primary',
      is_primary_contact: true,
    })
    if (mem.error) throw mem.error

    const carrier = await createCarrier(owner, { code: `${PREFIX}-${randomUUID().slice(0, 8)}`, name: `${PREFIX} Carrier` })
    if (!carrier.ok) throw new Error(carrier.message)
    carrierId = carrier.record.id
    const life = await createInsuranceProduct(owner, {
      carrierId,
      name: `${PREFIX} Term`,
      productLine: 'life_term',
    })
    if (!life.ok) throw new Error(life.message)
    lifeProductId = life.record.id
    const fia = await createInsuranceProduct(owner, {
      carrierId,
      name: `${PREFIX} FIA`,
      productLine: 'fia',
    })
    if (!fia.ok) throw new Error(fia.message)
    fiaProductId = fia.record.id
  }, 120_000)

  afterAll(async () => {
    try {
      if (createdAppIds.length) {
        const list = createdAppIds.map((id) => `'${id}'`).join(',')
        sqlQuery(`DELETE FROM public.policy_application_stage_history WHERE application_id IN (${list})`)
        sqlQuery(`DELETE FROM public.policy_application_participants WHERE application_id IN (${list})`)
        sqlQuery(`DELETE FROM public.policy_agent_allocations WHERE application_id IN (${list})`)
        sqlQuery(`DELETE FROM public.policy_applications WHERE id IN (${list})`)
      }
      if (carrierId) {
        sqlQuery(`DELETE FROM public.insurance_products WHERE carrier_id = '${carrierId}'`)
        sqlQuery(`DELETE FROM public.carriers WHERE id = '${carrierId}'`)
      }
      if (householdId) {
        sqlQuery(`DELETE FROM public.advisor_assignments WHERE household_id = '${householdId}'`)
        sqlQuery(`DELETE FROM public.household_members WHERE household_id = '${householdId}'`)
        sqlQuery(`DELETE FROM public.households WHERE id = '${householdId}'`)
      }
    } catch {
      /* local docker may be unavailable at teardown */
    }
  }, 60_000)

  function lifeCreate() {
    return {
      householdId,
      carrierId,
      productId: lifeProductId,
      productLine: 'life_term' as const,
      state: 'TX',
      targetStage: 'in_underwriting' as const,
      premiumMode: 'annual',
      plannedPremium: '1200',
      faceAmount: '',
      initialDeposit: '',
      applicationNumber: '',
      submissionDate: '',
      participants: [
        { household_member_id: memberId, role: 'primary_client' as const },
        { household_member_id: memberId, role: 'insured' as const },
        { household_member_id: memberId, role: 'owner' as const },
      ],
      allocations: defaultWritingAllocations(advisorProfileId),
    }
  }

  it('owner and advisor can create; anonymous and direct writes are denied', async () => {
    const ownerResult = await submitProductionApplication(owner, {
      ...lifeCreate(),
      targetStage: 'draft',
    })
    expect(ownerResult.ok).toBe(true)
    if (ownerResult.ok) createdAppIds.push(ownerResult.applicationId)

    const advisorResult = await submitProductionApplication(advisor, {
      ...lifeCreate(),
      targetStage: 'draft',
    })
    expect(advisorResult.ok).toBe(true)
    if (advisorResult.ok) createdAppIds.push(advisorResult.applicationId)

    const anonResult = await createPolicyApplication(anon, {
      household_id: householdId,
      carrier_id: carrierId,
      product_id: lifeProductId,
      product_line: 'life_term',
      state: 'TX',
    })
    expect(anonResult.ok).toBe(false)

    const direct = await owner.from('policy_applications').insert({
      household_id: householdId,
      carrier_id: carrierId,
      product_id: lifeProductId,
      product_line: 'life_term',
      state: 'TX',
    })
    expect(direct.error?.message || '').toMatch(/permission denied/)
  }, 60_000)

  it('Life requires insured/owner/primary; FIA requires annuitant and not insured; allocations total 10000', async () => {
    const created = await createPolicyApplication(owner, {
      household_id: householdId,
      carrier_id: carrierId,
      product_id: lifeProductId,
      product_line: 'life_term',
      state: 'TX',
      submitted_premium_cents: 120000,
      premium_mode: 'annual',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdAppIds.push(created.data.applicationId)

    const missingInsured = await setPolicyApplicationParticipants(owner, created.data.applicationId, [
      { household_member_id: memberId, role: 'primary_client' },
      { household_member_id: memberId, role: 'owner' },
    ])
    expect(missingInsured.ok).toBe(true)
    const badAlloc = await setPolicyApplicationAllocations(owner, created.data.applicationId, [
      {
        recipient_type: 'advisor',
        advisor_id: advisorProfileId,
        allocation_role: 'writing',
        commission_bps: 1,
        production_credit_bps: 10000,
      },
    ])
    expect(badAlloc.ok).toBe(false)

    const fia = await submitProductionApplication(owner, {
      householdId,
      carrierId,
      productId: fiaProductId,
      productLine: 'fia',
      state: 'TX',
      targetStage: 'draft',
      premiumMode: '',
      plannedPremium: '',
      faceAmount: '',
      initialDeposit: '25000',
      applicationNumber: '',
      submissionDate: '',
      participants: [
        { household_member_id: memberId, role: 'primary_client' },
        { household_member_id: memberId, role: 'annuitant' },
        { household_member_id: memberId, role: 'owner' },
      ],
      allocations: defaultWritingAllocations(advisorProfileId),
    })
    expect(fia.ok).toBe(true)
    if (fia.ok) {
      createdAppIds.push(fia.applicationId)
      const rows = await owner
        .from('policy_application_participants')
        .select('role')
        .eq('application_id', fia.applicationId)
        .is('effective_to', null)
      expect((rows.data ?? []).some((row) => row.role === 'insured')).toBe(false)
      expect((rows.data ?? []).some((row) => row.role === 'annuitant')).toBe(true)
    }
  }, 60_000)

  it('walks draft -> submitted -> in_underwriting and denies a direct jump', async () => {
    const created = await submitProductionApplication(owner, lifeCreate())
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdAppIds.push(created.applicationId)
    const { data } = await owner
      .from('policy_applications')
      .select('production_stage')
      .eq('id', created.applicationId)
      .maybeSingle()
    expect(data?.production_stage).toBe('in_underwriting')
    const history = await owner
      .from('policy_application_stage_history')
      .select('from_stage, to_stage, reason')
      .eq('application_id', created.applicationId)
      .order('changed_at', { ascending: true })
    const hops = (history.data ?? []).map((row) => `${row.from_stage ?? 'null'}->${row.to_stage}`)
    expect(hops).toEqual(['null->draft', 'draft->submitted', 'submitted->in_underwriting'])

    const jump = await createPolicyApplication(owner, {
      household_id: householdId,
      carrier_id: carrierId,
      product_id: lifeProductId,
      product_line: 'life_term',
      state: 'TX',
      submitted_premium_cents: 120000,
      premium_mode: 'annual',
    })
    expect(jump.ok).toBe(true)
    if (!jump.ok) return
    createdAppIds.push(jump.data.applicationId)
    await setPolicyApplicationParticipants(owner, jump.data.applicationId, lifeCreate().participants)
    await setPolicyApplicationAllocations(owner, jump.data.applicationId, lifeCreate().allocations)
    const illegal = await transitionPolicyApplicationStage(owner, {
      applicationId: jump.data.applicationId,
      toStage: 'in_underwriting',
      reason: 'illegal jump',
    })
    expect(illegal.ok).toBe(false)
  }, 60_000)
})
