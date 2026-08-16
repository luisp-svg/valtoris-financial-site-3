/**
 * Local Supabase integration for Migration 036 commission import
 * reconciliation. Skips when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass036!'
const PREFIX = 'm036ci'

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

describe.skipIf(!localEnv)('migration 036 commission import reconciliation (local DB)', () => {
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
  let productNoCardId = ''

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

  async function issuedApp(
    over: Record<string, unknown> = {},
    policyNumber?: string,
    productId = productTermId,
  ): Promise<{ appId: string; policyNumber: string }> {
    const createdApp = await createApp(owner, lifePayload(productId, over))
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
      `SELECT review_status || '|' || coalesce(review_reason, '') || '|' ||
              coalesce(resolved_event_type, '') || '|' ||
              coalesce(source_income_cents::text, '') || '|' ||
              coalesce(posted_commission_event_id::text, '') || '|' ||
              coalesce(source_row_key, '') || '|' ||
              coalesce(transaction_fingerprint, '')
         FROM public.commission_import_rows WHERE id = '${id}'`,
    )
    const [status, reason, eventType, income, posted, key, fingerprint] = raw.split('|')
    return { status, reason, eventType, income, posted, key, fingerprint }
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}-owner@valtoris.test`, 'M036 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}-adv-a@valtoris.test`, 'M036 Advisor A', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}-adv-b@valtoris.test`, 'M036 Advisor B', 'advisor')
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

  it('1-5: batch file identity, duplicate SHA, and 6/13 vs 7/13 stay separate', async () => {
    const missing = await owner.rpc('create_commission_import_batch', {
      p_source_type: 'experior_paid_report',
      p_source_file: uniq('f') + '.pdf',
      p_file_sha256: 'not-a-hash',
      p_statement_identifier: uniq('st'),
    })
    expect(errMsg(missing.error)).toMatch(/CRM_PP:invalid_payload/)

    const sha = sha256('same-bytes-' + uniq('bytes'))
    const first = await createBatch({ p_file_sha256: sha, p_source_file: 'report.pdf' })
    expect(errMsg(first.error)).toBe('')
    expect(asRecord(first.data).duplicate).toBe(false)
    const firstId = asRecord(asRecord(first.data).batch).id as string

    const second = await createBatch({ p_file_sha256: sha, p_source_file: 'report.pdf' })
    expect(errMsg(second.error)).toBe('')
    expect(asRecord(second.data).duplicate).toBe(true)
    expect(asRecord(second.data).original_batch_id).toBe(firstId)
    expect(asRecord(asRecord(second.data).batch).import_status).toBe('duplicate_file')

    const stagedOnDup = await stage(asRecord(asRecord(second.data).batch).id as string, [
      commissionRow(),
    ])
    expect(errMsg(stagedOnDup.error)).toMatch(/CRM_PP:invalid_payload/)

    const { policyNumber } = await issuedApp()
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const six = commissionRow({
      source_section: 'insurance_paid_over_12_months',
      source_row_ordinal: 1,
      payment_number: '6 / 13',
      source_policy_number: policyNumber,
      transaction_date: '2026-07-11',
      source_income_cents: 810,
      source_transaction_type: null,
    })
    const seven = commissionRow({
      source_section: 'insurance_paid_over_12_months',
      source_row_ordinal: 2,
      payment_number: '7 / 13',
      source_policy_number: policyNumber,
      transaction_date: '2026-08-11',
      source_income_cents: 810,
      source_transaction_type: null,
    })
    const staged = await stage(batchId, [six, seven, seven])
    expect(errMsg(staged.error)).toBe('')
    expect(asRecord(staged.data).created).toBe(2)
    expect(asRecord(staged.data).same_batch_existing).toBe(1)
    const keys = sqlQuery(
      `SELECT count(DISTINCT source_row_key)::text FROM public.commission_import_rows WHERE batch_id = '${batchId}'`,
    )
    expect(keys).toBe('2')
    const fps = sqlQuery(
      `SELECT count(DISTINCT transaction_fingerprint)::text FROM public.commission_import_rows WHERE batch_id = '${batchId}'`,
    )
    expect(fps).toBe('2')
  })

  it('6-8: source facts immutable; advisor cannot SELECT; owner can', async () => {
    const { policyNumber } = await issuedApp()
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [commissionRow({ source_policy_number: policyNumber })])
    const rowId = (asRecord(staged.data).row_ids as string[])[0]

    const advSelect = await advisorA.from('commission_import_rows').select('id')
    expect(errMsg(advSelect.error)).toBe('')
    expect((advSelect.data || []).length).toBe(0)
    const advBatch = await advisorA.from('commission_import_batches').select('id')
    expect((advBatch.data || []).length).toBe(0)

    const ownerRows = await owner.from('commission_import_rows').select('id').eq('id', rowId)
    expect((ownerRows.data || []).length).toBe(1)

    const rawUpdate = await owner
      .from('commission_import_rows')
      .update({ source_income_cents: 1 })
      .eq('id', rowId)
    expect(errMsg(rawUpdate.error)).toMatch(/not_authorized|permission|42501|CRM_PP/i)

    const advStage = await stage(batchId, [commissionRow()], advisorA)
    expect(errMsg(advStage.error)).toMatch(/CRM_PP:not_authorized/)
  })

  it('9-14: ignored and review statuses cannot post', async () => {
    const { policyNumber } = await issuedApp()
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
      commissionRow({
        source_policy_number: uniq('missing'),
        source_client: 'Pat Client',
        source_row_ordinal: 2,
      }),
      commissionRow({
        source_policy_number: policyNumber,
        source_writing_associate: 'Juliana Fisher',
        source_row_ordinal: 3,
      }),
      commissionRow({
        source_type: 'Override',
        source_writing_associate: 'Jazmin & Luis Perez',
        source_split_rate: 25,
        source_gross_rate: 45,
        source_income_cents: 5095,
        source_policy_number: policyNumber,
        source_row_ordinal: 4,
      }),
      commissionRow({
        source_income_cents: 0,
        source_policy_number: policyNumber,
        source_row_ordinal: 5,
      }),
    ])
    expect(errMsg(staged.error)).toBe('')
    const ids = asRecord(staged.data).row_ids as string[]
    const statuses = ids.map((id) => importRow(id).status)
    expect(statuses[0]).toBe('ignored_nonwriting')
    expect(statuses[1]).toBe('ignored_nonpolicy')
    expect(statuses[2]).toBe('review_policy_match')
    expect(statuses[3]).toBe('review_advisor_match')
    expect(statuses[4]).toBe('review_split_attribution')
    expect(statuses[5]).toBe('invalid_amount')

    for (const id of ids) {
      const posted = await owner.rpc('post_commission_import_row', {
        p_row_id: id,
        p_reason: 'should fail',
      })
      expect(errMsg(posted.error)).toMatch(/CRM_PP:invalid_payload/)
    }
  })

  it('15-24: ready writing posts once; chargeback keeps sign; posted row cannot reassign', async () => {
    const { appId, policyNumber } = await issuedApp()
    const expectedBefore = sqlQuery(
      `SELECT coalesce(expected_compensation_cents::text, 'null')
         FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )

    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({
        source_policy_number: policyNumber,
        source_income_cents: 267,
        source_transaction_type: '75% Advance',
        company_calculated_premium_cents: 10083,
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
    expect(importRow(paidId).eventType).toBe('paid')
    expect(importRow(chargeId).status).toBe('ready_to_post')
    expect(importRow(chargeId).eventType).toBe('chargeback')

    const paid = await owner.rpc('post_commission_import_row', {
      p_row_id: paidId,
      p_reason: 'post sarah writing',
    })
    expect(errMsg(paid.error)).toBe('')
    const paidEvent = asRecord(asRecord(paid.data).event)
    expect(paidEvent.event_type).toBe('paid')
    expect(cents(paidEvent.amount_cents)).toBe(267)
    expect(paidEvent.idempotency_key).toBe(`036:${batchId}:${importRow(paidId).key}`)
    expect(paidEvent.carrier_transaction_id == null || paidEvent.carrier_transaction_id === '').toBe(
      true,
    )
    expect(importRow(paidId).posted).toBe(paidEvent.id)
    expect(importRow(paidId).fingerprint).not.toBe(String(paidEvent.carrier_transaction_id ?? ''))

    const retry = await owner.rpc('post_commission_import_row', {
      p_row_id: paidId,
      p_reason: 'post sarah writing',
    })
    expect(errMsg(retry.error)).toBe('')
    expect(asRecord(retry.data).duplicate).toBe(true)
    expect(asRecord(asRecord(retry.data).event).id).toBe(paidEvent.id)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('1')

    const charge = await owner.rpc('post_commission_import_row', {
      p_row_id: chargeId,
      p_reason: 'post pink chargeback',
    })
    expect(errMsg(charge.error)).toBe('')
    expect(cents(asRecord(asRecord(charge.data).event).amount_cents)).toBe(-390)
    expect(asRecord(asRecord(charge.data).event).event_type).toBe('chargeback')

    const expectedAfter = sqlQuery(
      `SELECT coalesce(expected_compensation_cents::text, 'null')
         FROM public.policy_application_expected_compensations
        WHERE application_id = '${appId}' AND superseded_at IS NULL`,
    )
    expect(expectedAfter).toBe(expectedBefore)

    const reassign = await owner.rpc('review_commission_import_row', {
      p_row_id: paidId,
      p_reason: 'try reassign',
      p_resolved_allocation_id: writingAlloc(appId),
    })
    expect(errMsg(reassign.error)).toMatch(/CRM_PP:not_authorized/)

    const reversed = await owner.rpc('reverse_policy_writing_commission_event', {
      p_event_id: paidEvent.id,
      p_reason: 'correct import',
      p_idempotency_key: uniq('rev'),
    })
    expect(errMsg(reversed.error)).toBe('')
    expect(importRow(paidId).posted).toBe(paidEvent.id)
  })

  it('25-29: household split, unknown advisor, missing policy, exact match, no fuzzy client', async () => {
    const split = await issuedApp({ allocations: splitWriting(2500, 7500) }, uniq('split').toUpperCase())
    const exact = await issuedApp()
    const other = await issuedApp()

    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({ source_policy_number: split.policyNumber, source_row_ordinal: 1 }),
      commissionRow({
        source_policy_number: exact.policyNumber,
        source_writing_associate: 'Juliana Fisher',
        source_row_ordinal: 2,
      }),
      commissionRow({ source_policy_number: uniq('none'), source_row_ordinal: 3 }),
      commissionRow({ source_policy_number: exact.policyNumber, source_row_ordinal: 4 }),
      commissionRow({
        source_policy_number: uniq('wrong'),
        source_client: 'Pat Client',
        source_row_ordinal: 5,
      }),
    ])
    const ids = asRecord(staged.data).row_ids as string[]
    expect(importRow(ids[0]).status).toBe('review_split_attribution')
    expect(importRow(ids[1]).status).toBe('review_advisor_match')
    expect(importRow(ids[2]).status).toBe('review_policy_match')
    expect(importRow(ids[3]).status).toBe('ready_to_post')
    expect(importRow(ids[4]).status).toBe('review_policy_match')
    expect(other.appId).toBeTruthy()
  })

  it('30-32: paid-over-12 posts with NULL expected; additional commissions never post', async () => {
    const { appId, policyNumber } = await issuedApp({}, uniq('nlg').toUpperCase(), productNoCardId)
    const pinned = sqlQuery(
      `SELECT coalesce(expected_cents_pinned::text, 'null')
         FROM public.policy_writing_commission_accounts WHERE application_id = '${appId}'`,
    )
    expect(pinned).toBe('')

    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({
        source_section: 'insurance_paid_over_12_months',
        source_row_ordinal: 1,
        payment_number: '6 / 13',
        source_policy_number: policyNumber,
        source_income_cents: 810,
        transaction_date: '2026-07-11',
      }),
      {
        source_section: 'additional_commissions',
        source_row_ordinal: 1,
        source_type: 'Escrow Transfer',
        source_income_cents: 22293,
        source_is_chargeback_visual: false,
      },
    ])
    const [installId, escrowId] = asRecord(staged.data).row_ids as string[]
    expect(importRow(installId).status).toBe('ready_to_post')
    expect(importRow(escrowId).status).toBe('ignored_nonpolicy')

    const posted = await owner.rpc('post_commission_import_row', {
      p_row_id: installId,
      p_reason: 'paid over 12 months writing',
    })
    expect(errMsg(posted.error)).toBe('')
    const snap = await owner.rpc('pp_writing_commission_snapshot', {
      p_application_id: appId,
    })
    const totals = asRecord(asRecord(snap.data).totals)
    expect(totals.variance_cents).toBeNull()
    expect(totals.remaining_expected_cents).toBeNull()
    expect(
      sqlQuery(
        `SELECT coalesce(expected_cents_pinned::text, 'null')
           FROM public.policy_writing_commission_accounts WHERE application_id = '${appId}'`,
      ),
    ).toBe('null')

    const escrowPost = await owner.rpc('post_commission_import_row', {
      p_row_id: escrowId,
      p_reason: 'escrow',
    })
    expect(errMsg(escrowPost.error)).toMatch(/CRM_PP:invalid_payload/)
  })

  it('33-40: no pending types, advisor 035 privacy, audit, deterministic key, unsupported type', async () => {
    expect(
      sqlQuery(
        `SELECT count(*) FROM pg_constraint
          WHERE conrelid = 'public.policy_writing_commission_events'::regclass
            AND pg_get_constraintdef(oid) ILIKE '%pending%'`,
      ),
    ).toBe('0')
    expect(
      sqlQuery(
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('commission_import_batches', 'commission_import_rows')
            AND column_name IN ('upline_id', 'generational_rate', 'override_rate')`,
      ),
    ).toBe('0')

    const { appId, policyNumber } = await issuedApp()
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({ source_policy_number: policyNumber, source_income_cents: 267 }),
      commissionRow({
        source_policy_number: policyNumber,
        source_type: 'Bonus',
        source_income_cents: 500,
        source_row_ordinal: 9,
      }),
    ])
    const [readyId, bonusId] = asRecord(staged.data).row_ids as string[]
    expect(importRow(bonusId).status).toBe('review_transaction_type')
    const bonusPost = await owner.rpc('post_commission_import_row', {
      p_row_id: bonusId,
      p_reason: 'bonus',
    })
    expect(errMsg(bonusPost.error)).toMatch(/CRM_PP:invalid_payload/)

    const posted = await owner.rpc('post_commission_import_row', {
      p_row_id: readyId,
      p_reason: 'privacy check post',
    })
    expect(errMsg(posted.error)).toBe('')
    expect(asRecord(posted.data).audit_id).toBeTruthy()
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.audit_logs
          WHERE action = 'post_commission_import_row'
            AND entity_id = '${readyId}'`,
      ),
    ).not.toBe('0')

    const reviewed = await owner.rpc('review_commission_import_row', {
      p_row_id: bonusId,
      p_reason: 'confirm unsupported type',
      p_review_status: 'review_transaction_type',
    })
    expect(errMsg(reviewed.error)).toBe('')
    expect(asRecord(reviewed.data).audit_id).toBeTruthy()

    const advSnap = await advisorA.rpc('pp_writing_commission_snapshot', {
      p_application_id: appId,
    })
    expect(errMsg(advSnap.error)).toBe('')
    expect(asRecord(advSnap.data).viewer).toBe('advisor')
    expect(asRecord(advSnap.data).unattributed_events).toEqual([])

    const eventCount = sqlQuery(
      `SELECT count(*) FROM public.policy_writing_commission_events
        WHERE idempotency_key = '036:${batchId}:${importRow(readyId).key}'`,
    )
    expect(eventCount).toBe('1')
  })

  it('A-J: source identity vs fingerprint; cross-report duplicate review', async () => {
    const { appId, policyNumber } = await issuedApp()
    const allocId = writingAlloc(appId)

    const shaA = sha256('identity-file-a-' + uniq('bytes'))
    const first = await createBatch({
      p_file_sha256: shaA,
      p_source_file: 'paid-a.pdf',
      p_statement_identifier: `experior:A42353:${uniq('st-a')}`,
    })
    const batchA = asRecord(asRecord(first.data).batch).id as string

    const sixFacts = {
      source_section: 'insurance_paid_over_12_months',
      source_row_ordinal: 1,
      payment_number: '6 / 13',
      source_policy_number: policyNumber,
      transaction_date: '2026-07-11',
      source_income_cents: 810,
      source_transaction_type: null,
    }
    const sevenFacts = {
      ...sixFacts,
      source_row_ordinal: 2,
      payment_number: '7 / 13',
      transaction_date: '2026-08-11',
    }
    const ordinaryFacts = {
      source_policy_number: policyNumber,
      transaction_date: '2026-08-05',
      source_income_cents: 267,
      source_row_ordinal: 3,
    }

    const stagedA = await stage(batchA, [
      commissionRow(sixFacts),
      commissionRow(sevenFacts),
      commissionRow(ordinaryFacts),
      commissionRow({ ...ordinaryFacts, source_row_ordinal: 4 }),
    ])
    expect(errMsg(stagedA.error)).toBe('')
    const [sixId, sevenId, ordinaryId, ordinaryTwinId] = asRecord(stagedA.data).row_ids as string[]
    expect(importRow(sixId).status).toBe('ready_to_post')
    expect(importRow(sevenId).status).toBe('ready_to_post')
    expect(importRow(ordinaryId).status).toBe('ready_to_post')
    expect(importRow(ordinaryTwinId).status).toBe('review_duplicate_candidate')
    expect(importRow(sixId).key).not.toBe(importRow(sevenId).key)
    expect(importRow(sixId).fingerprint).not.toBe(importRow(sevenId).fingerprint)
    expect(importRow(ordinaryId).key).not.toBe(importRow(ordinaryTwinId).key)
    expect(importRow(ordinaryId).fingerprint).toBe(importRow(ordinaryTwinId).fingerprint)

    const retrySame = await stage(batchA, [commissionRow(sixFacts)])
    expect(asRecord(retrySame.data).created).toBe(0)
    expect(asRecord(retrySame.data).same_batch_existing).toBe(1)
    expect((asRecord(retrySame.data).row_ids as string[])[0]).toBe(sixId)

    const postedSix = await owner.rpc('post_commission_import_row', {
      p_row_id: sixId,
      p_reason: 'post 6/13 writing',
    })
    expect(errMsg(postedSix.error)).toBe('')
    const sixEvent = asRecord(asRecord(postedSix.data).event)
    expect(sixEvent.idempotency_key).toBe(`036:${batchA}:${importRow(sixId).key}`)
    expect(sixEvent.carrier_transaction_id == null || sixEvent.carrier_transaction_id === '').toBe(
      true,
    )
    expect(String(sixEvent.carrier_transaction_id ?? '')).not.toBe(importRow(sixId).fingerprint)

    const postedSeven = await owner.rpc('post_commission_import_row', {
      p_row_id: sevenId,
      p_reason: 'post 7/13 writing',
    })
    expect(errMsg(postedSeven.error)).toBe('')
    expect(asRecord(asRecord(postedSeven.data).event).id).not.toBe(sixEvent.id)

    const postedOrdinary = await owner.rpc('post_commission_import_row', {
      p_row_id: ordinaryId,
      p_reason: 'post first ordinary writing',
    })
    expect(errMsg(postedOrdinary.error)).toBe('')
    const ordinaryEventId = asRecord(asRecord(postedOrdinary.data).event).id as string

    const twinPostBlocked = await owner.rpc('post_commission_import_row', {
      p_row_id: ordinaryTwinId,
      p_reason: 'should require owner review',
    })
    expect(errMsg(twinPostBlocked.error)).toMatch(/CRM_PP:invalid_payload/)

    const laterFile = await createBatch({
      p_file_sha256: sha256('identity-file-b-' + uniq('bytes')),
      p_source_file: 'paid-b.pdf',
      p_statement_identifier: `experior:A42353:${uniq('st-b')}`,
    })
    const batchB = asRecord(asRecord(laterFile.data).batch).id as string
    const stagedB = await stage(batchB, [
      commissionRow({ ...sixFacts, source_row_ordinal: 1 }),
      commissionRow({ ...ordinaryFacts, source_row_ordinal: 2 }),
    ])
    expect(errMsg(stagedB.error)).toBe('')
    const [laterSixId, laterOrdinaryId] = asRecord(stagedB.data).row_ids as string[]
    expect(importRow(laterSixId).status).toBe('duplicate')
    expect(importRow(laterOrdinaryId).status).toBe('review_duplicate_candidate')
    expect(importRow(laterSixId).key).not.toBe(importRow(sixId).key)
    expect(importRow(laterSixId).fingerprint).toBe(importRow(sixId).fingerprint)
    expect(importRow(laterOrdinaryId).fingerprint).toBe(importRow(ordinaryId).fingerprint)

    const laterSixPost = await owner.rpc('post_commission_import_row', {
      p_row_id: laterSixId,
      p_reason: 'must not auto-post repeated 6/13',
    })
    expect(errMsg(laterSixPost.error)).toMatch(/CRM_PP:invalid_payload/)
    const laterOrdinaryPost = await owner.rpc('post_commission_import_row', {
      p_row_id: laterOrdinaryId,
      p_reason: 'must not auto-post ambiguous fingerprint',
    })
    expect(errMsg(laterOrdinaryPost.error)).toMatch(/CRM_PP:invalid_payload/)

    const ownerResolve = await owner.rpc('review_commission_import_row', {
      p_row_id: laterOrdinaryId,
      p_reason: 'owner confirms distinct later cash',
      p_review_status: 'ready_to_post',
      p_resolved_application_id: appId,
      p_resolved_allocation_id: allocId,
      p_resolved_event_type: 'paid',
    })
    expect(errMsg(ownerResolve.error)).toBe('')
    const ownerPosted = await owner.rpc('post_commission_import_row', {
      p_row_id: laterOrdinaryId,
      p_reason: 'owner-approved later ordinary row',
    })
    expect(errMsg(ownerPosted.error)).toBe('')
    expect(asRecord(asRecord(ownerPosted.data).event).id).not.toBe(ordinaryEventId)
    expect(asRecord(asRecord(ownerPosted.data).event).idempotency_key).toBe(
      `036:${batchB}:${importRow(laterOrdinaryId).key}`,
    )
    expect(asRecord(asRecord(ownerPosted.data).event).idempotency_key).not.toBe(
      importRow(laterOrdinaryId).fingerprint,
    )

    const retryPosted = await owner.rpc('post_commission_import_row', {
      p_row_id: sixId,
      p_reason: 'post 6/13 writing',
    })
    expect(errMsg(retryPosted.error)).toBe('')
    expect(asRecord(retryPosted.data).duplicate).toBe(true)
    expect(asRecord(asRecord(retryPosted.data).event).id).toBe(sixEvent.id)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events
          WHERE application_id = '${appId}'
            AND idempotency_key = '036:${batchA}:${importRow(sixId).key}'`,
      ),
    ).toBe('1')
    expect(
      sqlQuery(
        `SELECT count(*) FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'commission_import_rows_live_key_uidx'`,
      ),
    ).toBe('0')
  })
})
