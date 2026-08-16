/**
 * Local Supabase integration for Migration 037 client/production workflow
 * extensions: stages, beneficiaries, and quick_add_contact DOB.
 *
 * Skips automatically when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass037!'
const PREFIX = 'm037pp'

const RELATIONSHIP_PIPELINE_ID = '22222222-2222-2222-2222-222222222201'
const RELATIONSHIP_STAGE_ID = '33333333-3333-3333-3333-333333333001'

const EXISTING_STAGES = [
  'draft',
  'pre_submitted',
  'submitted',
  'in_underwriting',
  'approved',
  'declined',
  'postponed',
  'withdrawn',
  'incomplete',
  'not_taken',
  'issued',
  'in_force',
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

function compositeRow(data: unknown): Record<string, unknown> {
  return (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 037 client production workflow extensions (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorB: SupabaseClient
  let anon: SupabaseClient

  let ownerId = ''
  let advisorAUserId = ''
  let advisorAProfileId = ''
  let advisorBProfileId = ''

  let householdA = ''
  let householdB = ''
  let memberA1 = ''
  let memberA2 = ''
  let memberB1 = ''

  let carrierId = ''
  let productTermId = ''

  const created = {
    households: [] as string[],
    applications: [] as string[],
    carriers: [] as string[],
    members: [] as string[],
    leads: [] as string[],
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
    opts: { reason?: string | null; fields?: Record<string, unknown> } = {},
  ) {
    return client.rpc('transition_policy_application_stage', {
      p_application_id: applicationId,
      p_to_stage: toStage,
      p_disposition: null,
      p_delivery_status: null,
      p_reason: opts.reason ?? null,
      p_fields: opts.fields ?? {},
    })
  }

  async function setBeneficiaries(
    client: SupabaseClient,
    applicationId: string,
    beneficiaries: unknown[],
    reason: string | null = null,
  ) {
    return client.rpc('set_policy_application_beneficiaries', {
      p_application_id: applicationId,
      p_beneficiaries: beneficiaries,
      p_reason: reason,
    })
  }

  function quickPayload(overrides: Record<string, unknown> = {}) {
    const suffix = randomUUID().slice(0, 8)
    const phoneTail = String(Math.floor(1000 + Math.random() * 8999))
    return {
      first_name: 'Ora',
      last_name: 'Quick',
      email: `${PREFIX}.${suffix}@example.com`,
      phone: `415555${phoneTail}`,
      contact_category: 'potential_client',
      ...overrides,
    }
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    ownerId = await ensureUser(`${PREFIX}.owner@example.com`, 'M037 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}.advA@example.com`, 'M037 AdvA', 'advisor')
    const advisorBUserId = await ensureUser(`${PREFIX}.advB@example.com`, 'M037 AdvB', 'advisor')
    await ensureAdvisorProfile(ownerId, `${PREFIX}-owner`)
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

    const carrier = await owner.rpc('create_carrier', {
      p_code: uniq('c-main'),
      p_name: `${PREFIX} Carrier ${randomUUID().slice(0, 8)}`,
    })
    expect(errMsg(carrier.error)).toBe('')
    carrierId = compositeRow(carrier.data).id as string
    created.carriers.push(carrierId)

    const product = await owner.rpc('create_insurance_product', {
      p_carrier_id: carrierId,
      p_name: `${PREFIX} Term ${randomUUID().slice(0, 8)}`,
      p_product_line: 'life_term',
    })
    expect(errMsg(product.error)).toBe('')
    productTermId = compositeRow(product.data).id as string
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

  describe('stages', () => {
    it('keeps every existing stage and adds only the three 037 values', () => {
      const labels = sqlQuery(
        `SELECT enumlabel FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'policy_application_stage'
         ORDER BY e.enumsortorder`,
      ).split('\n')
      for (const stage of EXISTING_STAGES) {
        expect(labels, stage).toContain(stage)
      }
      expect(labels).toContain('paramed')
      expect(labels).toContain('sent_to_draft')
      expect(labels).toContain('premium_drafted')
      expect(labels).not.toContain('closed')
      expect(labels).not.toContain('pending')
      expect(labels).not.toContain('eligible')
      expect(labels).not.toContain('released')
      expect(labels).not.toContain('commission_released')
    })

    it('keeps draft as application draft and accepts the new operational stages', async () => {
      const draft = await newLifeApp()
      const row = await admin
        .from('policy_applications')
        .select('production_stage,underwriting_disposition')
        .eq('id', draft)
        .single()
      expect(row.data?.production_stage).toBe('draft')
      expect(row.data?.underwriting_disposition).toBe('pending')

      expect(errMsg((await transition(owner, draft, 'submitted')).error)).toBe('')
      expect(errMsg((await transition(owner, draft, 'paramed')).error)).toBe('')
      const afterParamed = await admin
        .from('policy_applications')
        .select('production_stage,underwriting_disposition')
        .eq('id', draft)
        .single()
      expect(afterParamed.data?.production_stage).toBe('paramed')
      expect(afterParamed.data?.underwriting_disposition).toBe('pending')
    })

    it('allows the documented non-linear transitions and rejects the rest', async () => {
      const skipUw = await newLifeApp()
      expect(errMsg((await transition(owner, skipUw, 'submitted')).error)).toBe('')
      expect(errMsg((await transition(owner, skipUw, 'approved')).error)).toBe('')
      expect(errMsg((await transition(owner, skipUw, 'sent_to_draft')).error)).toBe('')
      expect(errMsg((await transition(owner, skipUw, 'premium_drafted')).error)).toBe('')

      const drafted = await admin
        .from('policy_applications')
        .select('production_stage')
        .eq('id', skipUw)
        .single()
      expect(drafted.data?.production_stage).toBe('premium_drafted')

      expect(errMsg((await transition(owner, skipUw, 'in_force')).error)).toMatch(
        /CRM_PP:invalid_transition/,
      )
      expect(errMsg((await transition(owner, skipUw, 'draft')).error)).toMatch(
        /CRM_PP:invalid_transition/,
      )

      const paramedPath = await newLifeApp()
      expect(errMsg((await transition(owner, paramedPath, 'submitted')).error)).toBe('')
      expect(errMsg((await transition(owner, paramedPath, 'paramed')).error)).toBe('')
      expect(errMsg((await transition(owner, paramedPath, 'in_underwriting')).error)).toBe('')
      expect(errMsg((await transition(owner, paramedPath, 'approved')).error)).toBe('')
      expect(errMsg((await transition(owner, paramedPath, 'issued')).error)).toMatch(
        /CRM_PP:missing_required_fields/,
      )
      expect(
        errMsg(
          (
            await transition(owner, paramedPath, 'issued', {
              fields: { policy_number: uniq('pn') },
            })
          ).error,
        ),
      ).toBe('')

      const draftJump = await newLifeApp()
      expect(errMsg((await transition(owner, draftJump, 'paramed')).error)).toMatch(
        /CRM_PP:invalid_transition/,
      )
      expect(errMsg((await transition(owner, draftJump, 'sent_to_draft')).error)).toMatch(
        /CRM_PP:invalid_transition/,
      )
      expect(errMsg((await transition(owner, draftJump, 'premium_drafted')).error)).toMatch(
        /CRM_PP:invalid_transition/,
      )
      expect(errMsg((await transition(owner, draftJump, 'commission_released')).error)).toMatch(
        /CRM_PP:invalid_transition/,
      )
    })

    it('preserves owner-only approved → in_underwriting', async () => {
      const appId = await newLifeApp()
      expect(errMsg((await transition(owner, appId, 'submitted')).error)).toBe('')
      expect(errMsg((await transition(owner, appId, 'approved')).error)).toBe('')
      expect(errMsg((await transition(advisorA, appId, 'in_underwriting')).error)).toMatch(
        /CRM_PP:not_authorized/,
      )
      expect(
        errMsg((await transition(owner, appId, 'in_underwriting', { reason: 'owner rewind' })).error),
      ).toBe('')
    })
  })

  describe('beneficiaries', () => {
    it('accepts primary, contingent, 50/50, and independent group totals', async () => {
      const appId = await newLifeApp()
      const primary = await setBeneficiaries(owner, appId, [
        {
          beneficiary_name: 'Ada Alpha',
          beneficiary_type: 'primary',
          percentage_bps: 10000,
          household_member_id: memberA1,
          relationship: 'spouse',
        },
      ])
      expect(errMsg(primary.error)).toBe('')
      expect(primary.data?.beneficiary_count).toBe(1)

      const split = await setBeneficiaries(owner, appId, [
        { beneficiary_name: 'Ada Alpha', beneficiary_type: 'primary', percentage_bps: 5000 },
        { beneficiary_name: 'Alan Alpha', beneficiary_type: 'primary', percentage_bps: 5000 },
        {
          beneficiary_name: 'Contingent Trust',
          beneficiary_type: 'contingent',
          percentage_bps: 10000,
        },
      ])
      expect(errMsg(split.error)).toBe('')
      expect(split.data?.beneficiary_count).toBe(3)

      const live = await owner
        .from('policy_application_beneficiaries')
        .select('beneficiary_type,percentage_bps,deleted_at')
        .eq('application_id', appId)
        .is('deleted_at', null)
      expect(errMsg(live.error)).toBe('')
      const rows = live.data ?? []
      expect(rows).toHaveLength(3)
      expect(
        rows
          .filter((r) => r.beneficiary_type === 'primary')
          .reduce((sum, r) => sum + Number(r.percentage_bps), 0),
      ).toBe(10000)
      expect(
        rows
          .filter((r) => r.beneficiary_type === 'contingent')
          .reduce((sum, r) => sum + Number(r.percentage_bps), 0),
      ).toBe(10000)
    })

    it('rejects >100%, negative, and zero percentages', async () => {
      const appId = await newLifeApp()
      expect(
        errMsg(
          (
            await setBeneficiaries(owner, appId, [
              { beneficiary_name: 'Over', beneficiary_type: 'primary', percentage_bps: 6000 },
              { beneficiary_name: 'Over 2', beneficiary_type: 'primary', percentage_bps: 5000 },
            ])
          ).error,
        ),
      ).toMatch(/CRM_PP:invalid_beneficiaries/)
      expect(
        errMsg(
          (
            await setBeneficiaries(owner, appId, [
              { beneficiary_name: 'Zero', beneficiary_type: 'primary', percentage_bps: 0 },
            ])
          ).error,
        ),
      ).toMatch(/CRM_PP:invalid_beneficiaries/)
      expect(
        errMsg(
          (
            await setBeneficiaries(owner, appId, [
              { beneficiary_name: 'Neg', beneficiary_type: 'primary', percentage_bps: -100 },
            ])
          ).error,
        ),
      ).toMatch(/CRM_PP:invalid_beneficiaries/)
    })

    it('binds rows to the application, allows same-household members, and rejects cross-household members', async () => {
      const appId = await newLifeApp()
      const ok = await setBeneficiaries(owner, appId, [
        {
          beneficiary_name: 'Alan Alpha',
          beneficiary_type: 'primary',
          percentage_bps: 10000,
          household_member_id: memberA2,
        },
      ])
      expect(errMsg(ok.error)).toBe('')

      const cross = await setBeneficiaries(owner, appId, [
        {
          beneficiary_name: 'Bea Bravo',
          beneficiary_type: 'primary',
          percentage_bps: 10000,
          household_member_id: memberB1,
        },
      ])
      expect(errMsg(cross.error)).toMatch(/CRM_PP:household_mismatch/)

      const spoof = await owner.rpc('set_policy_application_beneficiaries', {
        p_application_id: appId,
        p_beneficiaries: [
          {
            application_id: randomUUID(),
            beneficiary_name: 'Spoof',
            beneficiary_type: 'primary',
            percentage_bps: 10000,
          },
        ],
      })
      expect(errMsg(spoof.error)).toMatch(/CRM_PP:invalid_beneficiaries/)
    })

    it('lets the assigned advisor read and mutate pre-submit, and blocks unauthorized raw writes', async () => {
      const appId = await newLifeApp()
      const advisorSet = await setBeneficiaries(advisorA, appId, [
        { beneficiary_name: 'Advisor Primary', beneficiary_type: 'primary', percentage_bps: 2500 },
      ])
      expect(errMsg(advisorSet.error)).toBe('')

      const advisorRead = await advisorA
        .from('policy_application_beneficiaries')
        .select('id')
        .eq('application_id', appId)
        .is('deleted_at', null)
      expect(errMsg(advisorRead.error)).toBe('')
      expect(advisorRead.data ?? []).toHaveLength(1)

      const otherAdvisor = await advisorB
        .from('policy_application_beneficiaries')
        .select('id')
        .eq('application_id', appId)
      expect(otherAdvisor.data ?? []).toEqual([])

      const raw = await advisorA.from('policy_application_beneficiaries').insert({
        application_id: appId,
        beneficiary_name: 'Raw',
        beneficiary_type: 'primary',
        percentage_bps: 1000,
      })
      expect(errMsg(raw.error)).toMatch(/permission denied|42501|not_authorized/i)

      const anonRaw = await anon.from('policy_application_beneficiaries').select('id')
      expect(anonRaw.data ?? []).toEqual([])

      expect(errMsg((await transition(owner, appId, 'submitted')).error)).toBe('')
      expect(
        errMsg(
          (
            await setBeneficiaries(
              advisorA,
              appId,
              [{ beneficiary_name: 'After submit', beneficiary_type: 'primary', percentage_bps: 10000 }],
              'advisor after submit',
            )
          ).error,
        ),
      ).toMatch(/CRM_PP:not_authorized/)
    })

    it('does not require beneficiaries to submit and does not change writing allocations', async () => {
      const appId = await newLifeApp()
      const before = await admin
        .from('policy_agent_allocations')
        .select('commission_bps,production_credit_bps,allocation_role')
        .eq('application_id', appId)
        .is('effective_to', null)
      expect(before.data).toHaveLength(1)

      await setBeneficiaries(owner, appId, [
        { beneficiary_name: 'Keep splits', beneficiary_type: 'primary', percentage_bps: 4000 },
      ])
      expect(errMsg((await transition(owner, appId, 'submitted')).error)).toBe('')

      const emptyApp = await newLifeApp()
      expect(errMsg((await transition(owner, emptyApp, 'submitted')).error)).toBe('')

      const after = await admin
        .from('policy_agent_allocations')
        .select('commission_bps,production_credit_bps,allocation_role')
        .eq('application_id', appId)
        .is('effective_to', null)
      expect(after.data).toEqual(before.data)

      const cols = sqlQuery(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'policy_application_beneficiaries'
         ORDER BY column_name`,
      )
      expect(cols).not.toMatch(/ssn|social_security|bank|routing|date_of_birth/i)
    })
  })

  describe('quick_add_contact DOB', () => {
    it('stays compatible without DOB and stores a valid DOB on household_members.date_of_birth', async () => {
      const without = await owner.rpc('quick_add_contact', {
        p_payload: quickPayload(),
        p_mode: 'create',
      })
      expect(errMsg(without.error)).toBe('')
      expect(without.data?.ok).toBe(true)
      created.households.push(without.data.household_id)
      created.members.push(without.data.member_id)
      created.leads.push(without.data.lead_id)
      const blank = await admin
        .from('household_members')
        .select('date_of_birth')
        .eq('id', without.data.member_id)
        .single()
      expect(blank.data?.date_of_birth).toBeNull()

      const withDob = await owner.rpc('quick_add_contact', {
        p_payload: quickPayload({ date_of_birth: '1984-06-15' }),
        p_mode: 'create',
      })
      expect(errMsg(withDob.error)).toBe('')
      expect(withDob.data?.ok).toBe(true)
      created.households.push(withDob.data.household_id)
      created.members.push(withDob.data.member_id)
      created.leads.push(withDob.data.lead_id)
      const stored = await admin
        .from('household_members')
        .select('date_of_birth')
        .eq('id', withDob.data.member_id)
        .single()
      expect(stored.data?.date_of_birth).toBe('1984-06-15')

      const future = await owner.rpc('quick_add_contact', {
        p_payload: quickPayload({ date_of_birth: '2999-01-01' }),
        p_mode: 'create',
      })
      expect(errMsg(future.error)).toMatch(/QUICK_ADD:invalid_date_of_birth/)

      const dobCols = sqlQuery(
        `SELECT table_name || '.' || column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'date_of_birth'
         ORDER BY 1`,
      )
      expect(dobCols).toBe('household_members.date_of_birth')
    })
  })

  describe('compensation unchanged', () => {
    it('leaves 033–036 objects in place and adds no commission-release stage', () => {
      const tables = sqlQuery(
        `SELECT tablename FROM pg_tables
         WHERE schemaname = 'public'
           AND tablename IN (
             'product_compensation_schedules',
             'policy_application_expected_compensations',
             'policy_writing_commission_events',
             'commission_import_batches',
             'commission_import_rows'
           )
         ORDER BY 1`,
      ).split('\n')
      expect(tables).toContain('product_compensation_schedules')
      expect(tables).toContain('policy_application_expected_compensations')
      expect(tables).toContain('policy_writing_commission_events')
      expect(tables).toContain('commission_import_batches')
      expect(tables).toContain('commission_import_rows')

      const stages = sqlQuery(
        `SELECT enumlabel FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'policy_application_stage'`,
      )
      expect(stages).not.toMatch(/commission_released|eligible|released/)
    })
  })
})
