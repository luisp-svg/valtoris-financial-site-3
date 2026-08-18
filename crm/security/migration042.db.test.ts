/**
 * Local Supabase integration for Migration 042 writing-receivable eligibility.
 * Skips when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass042!'
const PREFIX = 'm042wre'

const RELATIONSHIP_PIPELINE_ID = '22222222-2222-2222-2222-222222222201'
const RELATIONSHIP_STAGE_ID = '33333333-3333-3333-3333-333333333001'
const HISTORICAL_REASON = 'historical in-force book; writing commission previously paid'

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

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 042 writing-receivable eligibility (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient

  let ownerId = ''
  let advisorAUserId = ''
  let advisorAProfileId = ''
  let householdA = ''
  let memberA1 = ''
  let carrierId = ''
  let productTermId = ''
  let productLateCardId = ''

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
      face_amount_cents: 10000000,
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

  function liveCount(appId: string): string {
    return sqlQuery(
      `SELECT count(*) FROM public.policy_application_expected_compensations WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
  }

  function liveStatus(appId: string): string {
    return sqlQuery(
      `SELECT coalesce(string_agg(calculation_status || ':' || coalesce(expected_compensation_cents::text, 'n') || ':' || coalesce(review_reason, ''), ','), '')
         FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
  }

  function fingerprint(appId: string): string {
    return sqlQuery(
      `SELECT production_stage || '|' || coalesce(face_amount_cents::text, 'n') || '|' || coalesce(submitted_premium_cents::text, 'n') || '|' || coalesce(policy_number, '') || '|' || writing_receivable_expected::text
         FROM public.policy_applications WHERE id = '${appId}'`,
    )
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}-owner@valtoris.test`, 'M042 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}-adv-a@valtoris.test`, 'M042 Advisor A', 'advisor')
    advisorAProfileId = await ensureAdvisorProfile(advisorAUserId, `${PREFIX}-adv-a`)
    owner = await signIn(`${PREFIX}-owner@valtoris.test`)
    advisorA = await signIn(`${PREFIX}-adv-a@valtoris.test`)

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
      last_name: 'Alpha',
      relationship: 'primary',
      is_primary_contact: true,
    })
    if (memberError) throw memberError

    const carrier = await owner.rpc('create_carrier', {
      p_code: uniq('c-main'),
      p_name: `${PREFIX} Carrier ${randomUUID().slice(0, 8)}`,
    })
    expect(errMsg(carrier.error)).toBe('')
    carrierId = compositeRow(carrier.data).id as string
    created.carriers.push(carrierId)

    const term = await owner.rpc('create_insurance_product', {
      p_carrier_id: carrierId,
      p_name: `${PREFIX} Term ${randomUUID().slice(0, 8)}`,
      p_product_line: 'life_term',
    })
    expect(errMsg(term.error)).toBe('')
    productTermId = compositeRow(term.data).id as string
    const late = await owner.rpc('create_insurance_product', {
      p_carrier_id: carrierId,
      p_name: `${PREFIX} Late ${randomUUID().slice(0, 8)}`,
      p_product_line: 'life_term',
    })
    expect(errMsg(late.error)).toBe('')
    productLateCardId = compositeRow(late.data).id as string

    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'SFA',
    })

    for (const productId of [productTermId, productLateCardId]) {
      const card = await owner.rpc('create_product_compensation_schedule', {
        p_product_id: productId,
        p_age_min: null,
        p_age_max: 75,
        p_fa_rate: 0.4,
        p_sfa_rate: 0.5,
        p_sm_rate: 0.6,
        p_ed_rate: 0.7,
        p_effective_from: productId === productLateCardId ? '2026-06-25' : '2026-03-24',
      })
      expect(errMsg(card.error)).toBe('')
      created.schedules.push(compositeRow(card.data).id as string)
    }
  }, 180_000)

  afterAll(async () => {
    if (!created.applications.length && !created.households.length) return
    if (created.applications.length) {
      const apps = created.applications.map((id) => `'${id}'`).join(',')
      sqlQuery(`DELETE FROM public.policy_writing_commission_events WHERE application_id IN (${apps})`)
      sqlQuery(`DELETE FROM public.policy_writing_commission_accounts WHERE application_id IN (${apps})`)
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
  }, 120_000)

  it('defaults current applications to writing receivable expected', async () => {
    expect(
      sqlQuery(
        `SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='policy_applications' AND column_name='writing_receivable_expected'`,
      ),
    ).toMatch(/true/)
    const createdApp = await createApp(owner, lifePayload(productTermId))
    expect(errMsg(createdApp.error)).toBe('')
    const appId = createdApp.data.application_id as string
    expect(
      sqlQuery(
        `SELECT writing_receivable_expected::text FROM public.policy_applications WHERE id = '${appId}'`,
      ),
    ).toBe('true')
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    expect(liveCount(appId)).toBe('1')
    expect(liveStatus(appId)).toMatch(/^resolved:/)
  })

  it('creates no live Expected when the owner marks no current writing receivable', async () => {
    const createdApp = await createApp(
      owner,
      lifePayload(productTermId, { writing_receivable_expected: false }),
    )
    expect(errMsg(createdApp.error)).toBe('')
    const appId = createdApp.data.application_id as string
    expect(
      sqlQuery(
        `SELECT writing_receivable_expected::text FROM public.policy_applications WHERE id = '${appId}'`,
      ),
    ).toBe('false')
    expect(errMsg((await submit(owner, appId, '2026-04-01')).error)).toBe('')
    expect(liveCount(appId)).toBe('0')
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_application_expected_compensations WHERE application_id = '${appId}'`,
      ),
    ).toBe('0')
  })

  it('supersedes a live review_required snapshot when the owner excludes the application', async () => {
    const createdApp = await createApp(owner, lifePayload(productLateCardId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId, '2026-06-16')).error)).toBe('')
    expect(liveStatus(appId)).toBe('review_required:n:no_rate_card_for_lookup_date')
    const beforeId = sqlQuery(
      `SELECT id FROM public.policy_application_expected_compensations WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
    const set = await owner.rpc('set_policy_application_writing_receivable_expected', {
      p_application_id: appId,
      p_writing_receivable_expected: false,
      p_reason: HISTORICAL_REASON,
    })
    expect(errMsg(set.error)).toBe('')
    expect(asRecord(set.data).changed).toBe(true)
    expect(liveCount(appId)).toBe('0')
    expect(
      sqlQuery(
        `SELECT superseded_at IS NOT NULL AND calculation_status = 'review_required'
           FROM public.policy_application_expected_compensations WHERE id = '${beforeId}'`,
      ),
    ).toBe('t')
  })

  it('supersedes a resolved snapshot including a Luna-style in-card expected amount', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId, '2026-06-26')).error)).toBe('')
    const live = liveStatus(appId)
    expect(live.startsWith('resolved:')).toBe(true)
    const cents = live.split(':')[1]
    expect(Number(cents)).toBeGreaterThan(0)
    const beforeId = sqlQuery(
      `SELECT id FROM public.policy_application_expected_compensations WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
    expect(
      errMsg(
        (
          await owner.rpc('set_policy_application_writing_receivable_expected', {
            p_application_id: appId,
            p_writing_receivable_expected: false,
            p_reason: HISTORICAL_REASON,
          })
        ).error,
      ),
    ).toBe('')
    expect(liveCount(appId)).toBe('0')
    expect(
      sqlQuery(
        `SELECT expected_compensation_cents::text || ',' || (superseded_at IS NOT NULL)
           FROM public.policy_application_expected_compensations WHERE id = '${beforeId}'`,
      ),
    ).toBe(`${cents},true`)
  })

  it('keeps Sarah/Bryon-style date review when the application remains eligible', async () => {
    const createdApp = await createApp(owner, lifePayload(productLateCardId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId, '2026-06-16')).error)).toBe('')
    expect(liveStatus(appId)).toBe('review_required:n:no_rate_card_for_lookup_date')
    expect(
      sqlQuery(
        `SELECT writing_receivable_expected::text FROM public.policy_applications WHERE id = '${appId}'`,
      ),
    ).toBe('true')
  })

  it('blocks advisors from changing eligibility and allows the owner RPC', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    const advisorDenied = await advisorA.rpc('set_policy_application_writing_receivable_expected', {
      p_application_id: appId,
      p_writing_receivable_expected: false,
      p_reason: HISTORICAL_REASON,
    })
    expect(errMsg(advisorDenied.error)).toMatch(/CRM_PP:not_authorized|not_authorized/)
    expect(liveCount(appId)).toBe('1')
    const ownerSet = await owner.rpc('set_policy_application_writing_receivable_expected', {
      p_application_id: appId,
      p_writing_receivable_expected: false,
      p_reason: HISTORICAL_REASON,
    })
    expect(errMsg(ownerSet.error)).toBe('')
    expect(asRecord(ownerSet.data).audit_id).toBeTruthy()
    expect(liveCount(appId)).toBe('0')
    const tableUpdate = await advisorA
      .from('policy_applications')
      .update({ writing_receivable_expected: true })
      .eq('id', appId)
    expect(errMsg(tableUpdate.error)).toMatch(/permission denied|not_authorized/)
  })

  it('does not change stage, face, premium, or 035 facts when eligibility is cleared', async () => {
    const createdApp = await createApp(owner, lifePayload(productTermId))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    await advanceToIssued(appId)
    const alloc = sqlQuery(
      `SELECT id FROM public.policy_agent_allocations
        WHERE application_id = '${appId}' AND allocation_role = 'writing' AND effective_to IS NULL`,
    )
    const paid = await owner.rpc('record_policy_writing_commission_event', {
      p_application_id: appId,
      p_event_type: 'paid',
      p_amount_cents: 1200,
      p_reason: '042 isolation paid',
      p_allocation_id: alloc,
      p_idempotency_key: uniq('paid'),
    })
    expect(errMsg(paid.error)).toBe('')
    const eventId = asRecord(asRecord(paid.data).event).id as string
    const pendingBefore = sqlQuery(
      `SELECT count(*) FROM public.commission_pending_import_rows WHERE resolved_application_id = '${appId}'`,
    )
    const eventsBefore = sqlQuery(
      `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
    )
    const before = fingerprint(appId)
    const bps = sqlQuery(
      `SELECT commission_bps || ',' || production_credit_bps FROM public.policy_agent_allocations
        WHERE application_id = '${appId}' AND allocation_role = 'writing' AND effective_to IS NULL`,
    )
    expect(
      errMsg(
        (
          await owner.rpc('set_policy_application_writing_receivable_expected', {
            p_application_id: appId,
            p_writing_receivable_expected: false,
            p_reason: HISTORICAL_REASON,
          })
        ).error,
      ),
    ).toBe('')
    const after = fingerprint(appId)
    expect(after.replace(/true$/, 'false')).toBe(before.replace(/true$/, 'false'))
    expect(after.endsWith('false')).toBe(true)
    expect(
      sqlQuery(
        `SELECT commission_bps || ',' || production_credit_bps FROM public.policy_agent_allocations
          WHERE application_id = '${appId}' AND allocation_role = 'writing' AND effective_to IS NULL`,
      ),
    ).toBe(bps)
    expect(
      sqlQuery(
        `SELECT amount_cents::text || ',' || event_type
           FROM public.policy_writing_commission_events WHERE id = '${eventId}'`,
      ),
    ).toBe('1200,paid')
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe(eventsBefore)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.commission_pending_import_rows WHERE resolved_application_id = '${appId}'`,
      ),
    ).toBe(pendingBefore)
    expect(liveCount(appId)).toBe('0')
  })

  it('does not treat historical_entry as no-current-receivable', async () => {
    const createdApp = await createApp(
      owner,
      lifePayload(productTermId, { historical_entry: true }),
    )
    expect(errMsg(createdApp.error)).toBe('')
    const appId = createdApp.data.application_id as string
    expect(
      sqlQuery(
        `SELECT writing_receivable_expected::text FROM public.policy_applications WHERE id = '${appId}'`,
      ),
    ).toBe('true')
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    expect(liveCount(appId)).toBe('1')
    expect(liveStatus(appId)).toMatch(/^resolved:/)
  })

  it('lets future historical-book create preserve no-current-receivable without a date heuristic', async () => {
    const createdApp = await createApp(
      owner,
      lifePayload(productTermId, {
        historical_entry: true,
        writing_receivable_expected: false,
      }),
    )
    expect(errMsg(createdApp.error)).toBe('')
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId, '2019-03-08')).error)).toBe('')
    expect(liveCount(appId)).toBe('0')
    const eligibleOld = await createApp(owner, lifePayload(productTermId))
    const oldId = eligibleOld.data.application_id as string
    expect(errMsg((await submit(owner, oldId, '2019-03-08')).error)).toBe('')
    expect(liveStatus(oldId)).toBe('review_required:n:no_rate_card_for_lookup_date')
    const advisorCreate = await createApp(
      advisorA,
      lifePayload(productTermId, { writing_receivable_expected: false }),
    )
    expect(errMsg(advisorCreate.error)).toMatch(/CRM_PP:not_authorized|not_authorized/)
  })
})
