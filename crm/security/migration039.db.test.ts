/**
 * Local Supabase integration for Migration 039 review/post hardening.
 * Skips when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass039!'
const PREFIX = 'm039rh'

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

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>
}

function cents(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 039 commission import review/post hardening (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient

  let ownerId = ''
  let advisorAUserId = ''
  let advisorBUserId = ''
  let advisorAProfileId = ''
  let advisorBProfileId = ''
  let householdA = ''
  let memberA1 = ''
  let carrierId = ''
  let carrierName = ''
  let productTermId = ''

  const created = {
    households: [] as string[],
    applications: [] as string[],
    carriers: [] as string[],
    schedules: [] as string[],
    batches: [] as string[],
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

  async function issuedApp(
    over: Record<string, unknown> = {},
    policyNumber?: string,
  ): Promise<{ appId: string; policyNumber: string }> {
    const createdApp = await createApp(owner, lifePayload(productTermId, over))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await submit(owner, appId)).error)).toBe('')
    expect(errMsg((await transition(owner, appId, 'in_underwriting')).error)).toBe('')
    expect(
      errMsg(
        (await transition(owner, appId, 'approved', { disposition: 'approved_as_applied' })).error,
      ),
    ).toBe('')
    const pn = (policyNumber ?? uniq('pn')).toUpperCase()
    expect(
      errMsg((await transition(owner, appId, 'issued', { fields: { policy_number: pn } })).error),
    ).toBe('')
    return { appId, policyNumber: pn }
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

  async function createBatch(
    over: Record<string, unknown> = {},
    client: SupabaseClient = owner,
  ) {
    const file = String(over.p_source_file ?? uniq('file') + '.pdf')
    const sha = String(over.p_file_sha256 ?? sha256(file + randomUUID()))
    const res = await client.rpc('create_commission_import_batch', {
      p_source_type: String(over.p_source_type ?? 'experior_paid_report'),
      p_source_file: file,
      p_file_sha256: sha,
      p_statement_identifier: String(over.p_statement_identifier ?? `experior:A42353:${uniq('st')}`),
      p_fs_code: over.p_fs_code ?? 'A42353',
      p_statement_date: over.p_statement_date ?? '2026-08-13',
      p_source_created_at: over.p_source_created_at ?? '2026-08-13T15:57:28Z',
      p_payee_name: over.p_payee_name ?? 'Luis & Jazmin Perez',
    })
    const batch = asRecord(asRecord(res.data).batch)
    if (typeof batch.id === 'string') created.batches.push(batch.id)
    return res
  }

  function commissionRow(over: Record<string, unknown> = {}) {
    return {
      source_section: 'insurance',
      source_page: 3,
      source_row_ordinal: 1,
      transaction_date: '2026-08-05',
      source_company: carrierName,
      source_product: 'FlexLife II (B)',
      source_policy_number: uniq('pol'),
      source_writing_associate: 'Jazmin & Luis Perez',
      source_client: 'Pat Client',
      agent_entered_premium_cents: 0,
      company_calculated_premium_cents: 10083,
      source_gross_rate: 115,
      source_factor_rate: 80,
      source_net_rate: 92,
      source_type: 'Commission',
      source_transaction_type: '100% Advance',
      source_income_cents: 267,
      source_is_chargeback_visual: false,
      ...over,
    }
  }

  async function stage(batchId: string, rows: Record<string, unknown>[], client = owner) {
    return client.rpc('stage_commission_import_rows', {
      p_batch_id: batchId,
      p_rows: rows,
    })
  }

  function importRow(id: string): Record<string, string> {
    const raw = sqlQuery(
      `SELECT review_status || '|' || coalesce(source_type, '') || '|' ||
              coalesce(source_section, '') || '|' ||
              coalesce(posted_commission_event_id::text, '') || '|' ||
              coalesce(source_row_key, '')
         FROM public.commission_import_rows WHERE id = '${id}'`,
    )
    const [status, sourceType, section, posted, key] = raw.split('|')
    return { status, sourceType, section, posted, key }
  }

  async function reviewReady(
    rowId: string,
    appId: string,
    allocId: string,
    reason: string,
    eventType = 'paid',
    client: SupabaseClient = owner,
  ) {
    return client.rpc('review_commission_import_row', {
      p_row_id: rowId,
      p_reason: reason,
      p_review_status: 'ready_to_post',
      p_resolved_application_id: appId,
      p_resolved_allocation_id: allocId,
      p_resolved_event_type: eventType,
    })
  }

  function forceReady(
    rowId: string,
    appId: string,
    allocId: string,
    advisorId = advisorAProfileId,
  ) {
    try {
      sqlQuery(
        'ALTER TABLE public.commission_import_rows DISABLE TRIGGER commission_import_rows_immutability',
      )
      sqlQuery(
        `UPDATE public.commission_import_rows
            SET review_status = 'ready_to_post',
                resolved_application_id = '${appId}',
                resolved_allocation_id = '${allocId}',
                resolved_advisor_id = '${advisorId}',
                resolved_event_type = 'paid'
          WHERE id = '${rowId}'`,
      )
    } finally {
      sqlQuery(
        'ALTER TABLE public.commission_import_rows ENABLE TRIGGER commission_import_rows_immutability',
      )
    }
  }

  function eventCount(appId: string): string {
    return sqlQuery(
      `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
    )
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}-owner@valtoris.test`, 'M039 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}-adv-a@valtoris.test`, 'M039 Advisor A', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}-adv-b@valtoris.test`, 'M039 Advisor B', 'advisor')
    advisorAProfileId = await ensureAdvisorProfile(advisorAUserId, `${PREFIX}-adv-a`)
    advisorBProfileId = await ensureAdvisorProfile(advisorBUserId, `${PREFIX}-adv-b`)
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
      last_name: 'Client',
      relationship: 'primary',
      is_primary_contact: true,
      date_of_birth: '1980-01-15',
    })
    if (memberError) throw memberError

    carrierName = `${PREFIX} National Life Group ${randomUUID().slice(0, 8)}`
    const carrier = await owner.rpc('create_carrier', {
      p_code: uniq('c'),
      p_name: carrierName,
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

    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorAProfileId,
      p_contract_level: 'ED',
    })
    await owner.rpc('set_advisor_contract_level', {
      p_advisor_id: advisorBProfileId,
      p_contract_level: 'SFA',
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
    if (created.batches.length) {
      const batches = created.batches.map((id) => `'${id}'`).join(',')
      sqlQuery(`DELETE FROM public.commission_import_rows WHERE batch_id IN (${batches})`)
      sqlQuery(`DELETE FROM public.commission_import_batches WHERE id IN (${batches})`)
    }
    sqlQuery(
      `DELETE FROM public.commission_import_carrier_aliases WHERE source_label_normalized LIKE '${PREFIX.toLowerCase()}%'`,
    )
    if (created.applications.length) {
      const apps = created.applications.map((id) => `'${id}'`).join(',')
      sqlQuery(
        `DELETE FROM public.policy_writing_commission_events
          WHERE application_id IN (${apps}) AND event_type = 'reversal'`,
      )
      sqlQuery(`DELETE FROM public.policy_writing_commission_events WHERE application_id IN (${apps})`)
      sqlQuery(
        `DELETE FROM public.policy_writing_commission_accounts WHERE application_id IN (${apps})`,
      )
      sqlQuery(
        `DELETE FROM public.policy_application_expected_compensations WHERE application_id IN (${apps})`,
      )
      sqlQuery(`DELETE FROM public.policies WHERE source_application_id IN (${apps})`)
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

  it('A: override cannot review to ready_to_post; forced-ready override cannot post', async () => {
    const { appId, policyNumber } = await issuedApp()
    const allocId = writingAlloc(appId)
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({
        source_type: 'Override',
        source_writing_associate: 'Jazmin & Luis Perez',
        source_split_rate: 25,
        source_gross_rate: 45,
        source_income_cents: 5095,
        source_policy_number: policyNumber,
      }),
    ])
    expect(errMsg(staged.error)).toBe('')
    const rowId = (asRecord(staged.data).row_ids as string[])[0]
    expect(importRow(rowId).status).toBe('review_split_attribution')
    expect(importRow(rowId).sourceType.toLowerCase()).toBe('override')

    const reviewed = await reviewReady(rowId, appId, allocId, 'promote override')
    expect(errMsg(reviewed.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(importRow(rowId).status).toBe('review_split_attribution')
    expect(eventCount(appId)).toBe('0')

    forceReady(rowId, appId, allocId)
    expect(importRow(rowId).status).toBe('ready_to_post')
    const posted = await owner.rpc('post_commission_import_row', {
      p_row_id: rowId,
      p_reason: 'forced ready override must still fail',
    })
    expect(errMsg(posted.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(importRow(rowId).posted).toBe('')
    expect(eventCount(appId)).toBe('0')
  })

  it('B: additional_commissions cannot review to ready; post stays rejected', async () => {
    const { appId, policyNumber } = await issuedApp()
    const allocId = writingAlloc(appId)
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      {
        source_section: 'additional_commissions',
        source_row_ordinal: 1,
        source_type: 'Escrow Transfer',
        source_income_cents: 22293,
        source_is_chargeback_visual: false,
        source_policy_number: policyNumber,
      },
    ])
    expect(errMsg(staged.error)).toBe('')
    const rowId = (asRecord(staged.data).row_ids as string[])[0]
    expect(importRow(rowId).section).toBe('additional_commissions')
    expect(importRow(rowId).status).toBe('ignored_nonpolicy')

    const reviewed = await reviewReady(rowId, appId, allocId, 'promote additional')
    expect(errMsg(reviewed.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(importRow(rowId).status).toBe('ignored_nonpolicy')

    const posted = await owner.rpc('post_commission_import_row', {
      p_row_id: rowId,
      p_reason: 'additional must not post',
    })
    expect(errMsg(posted.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(eventCount(appId)).toBe('0')
  })

  it('C: ignored_nonwriting and ignored_nonpolicy cannot review to ready_to_post', async () => {
    const { appId, policyNumber } = await issuedApp()
    const allocId = writingAlloc(appId)
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({
        source_type: 'Override',
        source_writing_associate: 'Ruth Hernandez',
        source_gross_rate: 25,
        source_income_cents: 3893,
        source_policy_number: policyNumber,
        source_row_ordinal: 1,
      }),
      {
        source_section: 'additional_commissions',
        source_row_ordinal: 1,
        source_type: 'Subscription Debt',
        source_income_cents: -9201,
        source_is_chargeback_visual: true,
      },
    ])
    expect(errMsg(staged.error)).toBe('')
    const [ignoredWritingId, ignoredPolicyId] = asRecord(staged.data).row_ids as string[]
    expect(importRow(ignoredWritingId).status).toBe('ignored_nonwriting')
    expect(importRow(ignoredPolicyId).status).toBe('ignored_nonpolicy')

    const writingReady = await reviewReady(
      ignoredWritingId,
      appId,
      allocId,
      'promote ignored writing',
    )
    expect(errMsg(writingReady.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(importRow(ignoredWritingId).status).toBe('ignored_nonwriting')

    const policyReady = await reviewReady(
      ignoredPolicyId,
      appId,
      allocId,
      'promote ignored policy',
    )
    expect(errMsg(policyReady.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(importRow(ignoredPolicyId).status).toBe('ignored_nonpolicy')
    expect(eventCount(appId)).toBe('0')
  })

  it('D: duplicate cannot review to ready_to_post and cannot post', async () => {
    const { appId, policyNumber } = await issuedApp()
    const allocId = writingAlloc(appId)
    const sixFacts = {
      source_section: 'insurance_paid_over_12_months',
      source_row_ordinal: 1,
      payment_number: '6 / 13',
      source_policy_number: policyNumber,
      transaction_date: '2026-07-11',
      source_income_cents: 810,
      source_transaction_type: null,
    }

    const first = await createBatch()
    const batchA = asRecord(asRecord(first.data).batch).id as string
    const stagedA = await stage(batchA, [commissionRow(sixFacts)])
    expect(errMsg(stagedA.error)).toBe('')
    const firstId = (asRecord(stagedA.data).row_ids as string[])[0]
    expect(importRow(firstId).status).toBe('ready_to_post')

    const later = await createBatch({
      p_file_sha256: sha256('dup-file-' + uniq('bytes')),
      p_source_file: 'paid-dup.pdf',
    })
    const batchB = asRecord(asRecord(later.data).batch).id as string
    const stagedB = await stage(batchB, [commissionRow({ ...sixFacts, source_row_ordinal: 1 })])
    expect(errMsg(stagedB.error)).toBe('')
    const dupId = (asRecord(stagedB.data).row_ids as string[])[0]
    expect(importRow(dupId).status).toBe('duplicate')

    const reviewed = await reviewReady(dupId, appId, allocId, 'promote duplicate')
    expect(errMsg(reviewed.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(importRow(dupId).status).toBe('duplicate')

    const posted = await owner.rpc('post_commission_import_row', {
      p_row_id: dupId,
      p_reason: 'duplicate must not post',
    })
    expect(errMsg(posted.error)).toMatch(/CRM_PP:invalid_payload/)
    expect(eventCount(appId)).toBe('0')
  })

  it('E: review_duplicate_candidate can resolve distinct, become ready, and post once', async () => {
    const { appId, policyNumber } = await issuedApp()
    const allocId = writingAlloc(appId)
    const ordinaryFacts = {
      source_policy_number: policyNumber,
      transaction_date: '2026-08-05',
      source_income_cents: 267,
      source_row_ordinal: 1,
    }

    const first = await createBatch()
    const batchA = asRecord(asRecord(first.data).batch).id as string
    const stagedA = await stage(batchA, [commissionRow(ordinaryFacts)])
    expect(errMsg(stagedA.error)).toBe('')
    const firstId = (asRecord(stagedA.data).row_ids as string[])[0]
    expect(importRow(firstId).status).toBe('ready_to_post')
    const firstPost = await owner.rpc('post_commission_import_row', {
      p_row_id: firstId,
      p_reason: 'post first ordinary writing',
    })
    expect(errMsg(firstPost.error)).toBe('')
    const firstEventId = asRecord(asRecord(firstPost.data).event).id as string

    const later = await createBatch({
      p_file_sha256: sha256('distinct-file-' + uniq('bytes')),
      p_source_file: 'paid-distinct.pdf',
    })
    const batchB = asRecord(asRecord(later.data).batch).id as string
    const stagedB = await stage(batchB, [
      commissionRow({ ...ordinaryFacts, source_row_ordinal: 2 }),
    ])
    expect(errMsg(stagedB.error)).toBe('')
    const candidateId = (asRecord(stagedB.data).row_ids as string[])[0]
    expect(importRow(candidateId).status).toBe('review_duplicate_candidate')

    const resolved = await reviewReady(
      candidateId,
      appId,
      allocId,
      'owner confirms distinct later cash',
    )
    expect(errMsg(resolved.error)).toBe('')
    expect(importRow(candidateId).status).toBe('ready_to_post')

    const posted = await owner.rpc('post_commission_import_row', {
      p_row_id: candidateId,
      p_reason: 'owner-approved distinct candidate',
    })
    expect(errMsg(posted.error)).toBe('')
    const laterEvent = asRecord(asRecord(posted.data).event)
    expect(laterEvent.id).not.toBe(firstEventId)
    expect(laterEvent.idempotency_key).toBe(`036:${batchB}:${importRow(candidateId).key}`)
    expect(eventCount(appId)).toBe('2')

    const retry = await owner.rpc('post_commission_import_row', {
      p_row_id: candidateId,
      p_reason: 'owner-approved distinct candidate',
    })
    expect(errMsg(retry.error)).toBe('')
    expect(asRecord(retry.data).duplicate).toBe(true)
    expect(asRecord(asRecord(retry.data).event).id).toBe(laterEvent.id)
    expect(eventCount(appId)).toBe('2')
  })

  it('F: normal paid/chargeback still review and post; advisor denied; no extra 035 or upline', async () => {
    const { appId, policyNumber } = await issuedApp()
    const allocId = writingAlloc(appId)
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({
        source_policy_number: policyNumber,
        source_income_cents: 267,
        source_row_ordinal: 1,
      }),
      commissionRow({
        source_policy_number: policyNumber,
        source_income_cents: -390,
        source_is_chargeback_visual: true,
        transaction_date: '2026-07-07',
        source_row_ordinal: 2,
      }),
    ])
    expect(errMsg(staged.error)).toBe('')
    const [paidId, chargeId] = asRecord(staged.data).row_ids as string[]
    expect(importRow(paidId).status).toBe('ready_to_post')
    expect(importRow(chargeId).status).toBe('ready_to_post')

    const advReview = await reviewReady(paidId, appId, allocId, 'advisor promote', 'paid', advisorA)
    expect(errMsg(advReview.error)).toMatch(/CRM_PP:not_authorized/)
    const advPost = await advisorA.rpc('post_commission_import_row', {
      p_row_id: paidId,
      p_reason: 'advisor post',
    })
    expect(errMsg(advPost.error)).toMatch(/CRM_PP:not_authorized/)
    expect(eventCount(appId)).toBe('0')

    const paid = await owner.rpc('post_commission_import_row', {
      p_row_id: paidId,
      p_reason: 'post normal paid writing',
    })
    expect(errMsg(paid.error)).toBe('')
    const paidEvent = asRecord(asRecord(paid.data).event)
    expect(paidEvent.event_type).toBe('paid')
    expect(cents(paidEvent.amount_cents)).toBe(267)
    expect(paidEvent.idempotency_key).toBe(`036:${batchId}:${importRow(paidId).key}`)

    const retry = await owner.rpc('post_commission_import_row', {
      p_row_id: paidId,
      p_reason: 'post normal paid writing',
    })
    expect(errMsg(retry.error)).toBe('')
    expect(asRecord(retry.data).duplicate).toBe(true)
    expect(asRecord(asRecord(retry.data).event).id).toBe(paidEvent.id)
    expect(eventCount(appId)).toBe('1')

    const charge = await owner.rpc('post_commission_import_row', {
      p_row_id: chargeId,
      p_reason: 'post normal chargeback writing',
    })
    expect(errMsg(charge.error)).toBe('')
    expect(cents(asRecord(asRecord(charge.data).event).amount_cents)).toBe(-390)
    expect(asRecord(asRecord(charge.data).event).event_type).toBe('chargeback')
    expect(eventCount(appId)).toBe('2')

    expect(
      sqlQuery(
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('commission_import_batches', 'commission_import_rows')
            AND column_name IN ('upline_id', 'generational_rate', 'override_rate')`,
      ),
    ).toBe('0')
  })
})
