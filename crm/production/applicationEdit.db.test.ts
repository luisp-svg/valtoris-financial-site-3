/**
 * Local Supabase tests for P1B-2C application edit wrappers.
 * Skips when local Supabase is not running. Cleans up prefixed rows.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  correctPolicyApplicationNumber,
  setPolicyApplicationAllocations,
  setPolicyApplicationNumber,
  setPolicyApplicationParticipants,
  submitProductionApplication,
  transitionPolicyApplicationStage,
  updatePolicyApplication,
} from './applicationApi'
import { createCarrier, createInsuranceProduct } from './catalogApi'
import { defaultWritingAllocations as writing } from './applicationView'

const PASS = 'LocalQaPassP1B2C!'
const PREFIX = 'p1b2c'
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

describe.skipIf(!localEnv)('P1B-2C application edit (local DB)', () => {
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
      full_name: role === 'owner' ? 'P1B2C Owner' : 'P1B2C Advisor',
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
        .update({ is_active: true, slug: `${PREFIX}-adv`, display_name: 'P1B2C Advisor', deleted_at: null })
        .eq('id', advisorProfileId)
    } else {
      const inserted = await admin
        .from('advisor_profiles')
        .insert({
          user_id: advisorUserId,
          slug: `${PREFIX}-adv`,
          display_name: 'P1B2C Advisor',
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

    const carrier = await createCarrier(owner, {
      code: `${PREFIX}-${randomUUID().slice(0, 8)}`,
      name: `${PREFIX} Carrier ${randomUUID().slice(0, 8)}`,
    })
    if (!carrier.ok) throw new Error(carrier.message)
    carrierId = carrier.record.id
    const life = await createInsuranceProduct(owner, {
      carrierId,
      name: `${PREFIX} Term`,
      productLine: 'life_term',
    })
    if (!life.ok) throw new Error(life.message)
    lifeProductId = life.record.id
  }, 120_000)

  afterAll(async () => {
    try {
      if (createdAppIds.length) {
        const list = createdAppIds.map((id) => `'${id}'`).join(',')
        sqlQuery(`DELETE FROM public.audit_logs WHERE entity_id IN (${list})`)
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
      targetStage: 'draft' as const,
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
      allocations: writing(advisorProfileId),
    }
  }

  it('owner and advisor can edit draft; anonymous and direct writes are denied', async () => {
    const created = await submitProductionApplication(owner, lifeCreate())
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdAppIds.push(created.applicationId)

    const ownerUpdate = await updatePolicyApplication(owner, created.applicationId, {
      submitted_premium_cents: 130000,
    })
    expect(ownerUpdate.ok).toBe(true)

    const advisorUpdate = await updatePolicyApplication(advisor, created.applicationId, {
      next_follow_up_date: '2026-09-01',
    })
    expect(advisorUpdate.ok).toBe(true)

    const anonUpdate = await updatePolicyApplication(anon, created.applicationId, { state: 'CA' })
    expect(anonUpdate.ok).toBe(false)

    const direct = await owner.from('policy_applications').update({ state: 'CA' }).eq('id', created.applicationId)
    expect(direct.error?.message || '').toMatch(/permission denied/)
  }, 60_000)

  it('replaces participants and allocations and denies invalid totals', async () => {
    const created = await submitProductionApplication(owner, lifeCreate())
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdAppIds.push(created.applicationId)

    const replaced = await setPolicyApplicationParticipants(owner, created.applicationId, [
      { household_member_id: memberId, role: 'primary_client' },
      { household_member_id: memberId, role: 'insured' },
      { household_member_id: memberId, role: 'owner' },
    ])
    expect(replaced.ok).toBe(true)

    const okAlloc = await setPolicyApplicationAllocations(owner, created.applicationId, writing(advisorProfileId))
    expect(okAlloc.ok).toBe(true)

    const badAlloc = await setPolicyApplicationAllocations(owner, created.applicationId, [
      {
        recipient_type: 'advisor',
        advisor_id: advisorProfileId,
        allocation_role: 'writing',
        commission_bps: 1,
        production_credit_bps: 10000,
      },
    ])
    expect(badAlloc.ok).toBe(false)
  }, 60_000)

  it('walks draft -> submitted -> in_underwriting, denies a direct jump, and locks catalog after submit', async () => {
    const created = await submitProductionApplication(owner, lifeCreate())
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdAppIds.push(created.applicationId)

    const submitted = await transitionPolicyApplicationStage(owner, {
      applicationId: created.applicationId,
      toStage: 'submitted',
      reason: 'Initial production entry — recorded as submitted.',
    })
    expect(submitted.ok).toBe(true)

    const locked = await updatePolicyApplication(owner, created.applicationId, { state: 'CA' })
    expect(locked.ok).toBe(false)

    const underwriting = await transitionPolicyApplicationStage(owner, {
      applicationId: created.applicationId,
      toStage: 'in_underwriting',
      reason: 'Initial production entry — catch-up to in underwriting.',
    })
    expect(underwriting.ok).toBe(true)

    const jump = await submitProductionApplication(owner, lifeCreate())
    expect(jump.ok).toBe(true)
    if (!jump.ok) return
    createdAppIds.push(jump.applicationId)
    const illegal = await transitionPolicyApplicationStage(owner, {
      applicationId: jump.applicationId,
      toStage: 'in_underwriting',
      reason: 'illegal jump',
    })
    expect(illegal.ok).toBe(false)
  }, 60_000)

  it('sets and corrects application number with audit evidence after submission', async () => {
    const created = await submitProductionApplication(owner, {
      ...lifeCreate(),
      targetStage: 'submitted',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdAppIds.push(created.applicationId)

    const setNumber = await setPolicyApplicationNumber(owner, created.applicationId, `${PREFIX}-APP-1`)
    expect(setNumber.ok).toBe(true)

    const advisorCorrect = await correctPolicyApplicationNumber(
      advisor,
      created.applicationId,
      `${PREFIX}-APP-2`,
      'Advisor should not correct.',
    )
    expect(advisorCorrect.ok).toBe(false)

    const corrected = await correctPolicyApplicationNumber(
      owner,
      created.applicationId,
      `${PREFIX}-APP-2`,
      'Carrier reissued the application number.',
    )
    expect(corrected.ok).toBe(true)
    const audit = sqlQuery(
      `SELECT count(*) FROM public.audit_logs WHERE entity_id = '${created.applicationId}' AND action = 'correct_policy_application_number'`,
    )
    expect(Number(audit)).toBeGreaterThan(0)
  }, 60_000)
})
