/**
 * Local Supabase integration for Migration 040 Experior Pending staging.
 * Skips when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass040!'
const PREFIX = 'm040pi'

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

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 040 commission pending import (local DB)', () => {
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

  async function submit(client: SupabaseClient, applicationId: string, submissionDate = '2026-04-01') {
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
    const file = String(over.p_source_file ?? uniq('file') + '.csv')
    const sha = String(over.p_file_sha256 ?? sha256(file + randomUUID()))
    const res = await client.rpc('create_commission_pending_import_batch', {
      p_source_type: String(over.p_source_type ?? 'experior_pending_report'),
      p_source_file: file,
      p_file_sha256: sha,
      p_statement_identifier: String(over.p_statement_identifier ?? `experior-pending:${uniq('st')}`),
      p_fs_code: over.p_fs_code ?? 'A42353',
      p_statement_date: over.p_statement_date ?? '2026-08-17',
      p_source_created_at: over.p_source_created_at ?? '2026-08-17T15:57:28Z',
      p_payee_name: over.p_payee_name ?? 'Jacqueline Juarez',
      p_statement_amount_cents: over.p_statement_amount_cents ?? 337105,
      p_escrow_cents: over.p_escrow_cents ?? 3405,
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
      transaction_date: '2026-08-17',
      source_company: carrierName,
      source_product: 'Symetra Life',
      source_policy_number: uniq('pol'),
      source_writing_associate: 'Jacqueline Juarez',
      source_client: 'Pat Client',
      agent_entered_premium_cents: 0,
      company_calculated_premium_cents: 100000,
      source_gross_rate: 115,
      source_factor_rate: 80,
      source_net_rate: 92,
      source_type: 'Commission',
      source_transaction_type: null,
      source_income_cents: 335512,
      source_is_chargeback_visual: false,
      ...over,
    }
  }

  async function stage(batchId: string, rows: Record<string, unknown>[], client = owner) {
    return client.rpc('stage_commission_pending_import_rows', {
      p_batch_id: batchId,
      p_rows: rows,
    })
  }

  function pendingRow(id: string): Record<string, string> {
    const raw = sqlQuery(
      `SELECT pending_review_status || '|' || coalesce(pending_review_reason, '') || '|' ||
              coalesce(source_income_cents::text, '') || '|' ||
              coalesce(source_type, '') || '|' ||
              coalesce(source_section, '') || '|' ||
              coalesce(source_row_key, '') || '|' ||
              coalesce(transaction_fingerprint, '') || '|' ||
              coalesce(resolved_application_id::text, '') || '|' ||
              coalesce(resolved_allocation_id::text, '')
         FROM public.commission_pending_import_rows WHERE id = '${id}'`,
    )
    const [status, reason, income, sourceType, section, key, fingerprint, appId, allocId] =
      raw.split('|')
    return { status, reason, income, sourceType, section, key, fingerprint, appId, allocId }
  }

  function forceAccepted(rowId: string, appId: string, allocId: string, advisorId = advisorAProfileId) {
    try {
      sqlQuery(
        'ALTER TABLE public.commission_pending_import_rows DISABLE TRIGGER commission_pending_import_rows_immutability',
      )
      sqlQuery(
        `UPDATE public.commission_pending_import_rows
            SET pending_review_status = 'accepted_pending',
                resolved_application_id = '${appId}',
                resolved_allocation_id = '${allocId}',
                resolved_advisor_id = '${advisorId}'
          WHERE id = '${rowId}'`,
      )
    } finally {
      sqlQuery(
        'ALTER TABLE public.commission_pending_import_rows ENABLE TRIGGER commission_pending_import_rows_immutability',
      )
    }
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}-owner@valtoris.test`, 'M040 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}-adv-a@valtoris.test`, 'M040 Advisor A', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}-adv-b@valtoris.test`, 'M040 Advisor B', 'advisor')
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

    carrierName = `${PREFIX} Symetra ${randomUUID().slice(0, 8)}`
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
      sqlQuery(`DELETE FROM public.commission_pending_import_rows WHERE batch_id IN (${batches})`)
      sqlQuery(
        `DELETE FROM public.commission_pending_import_batches WHERE import_status = 'duplicate_file' AND id IN (${batches})`,
      )
      sqlQuery(`DELETE FROM public.commission_pending_import_batches WHERE id IN (${batches})`)
    }
    if (created.applications.length) {
      const apps = created.applications.map((id) => `'${id}'`).join(',')
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

  it('schema: pending tables only; 034/035/036 paid identity unchanged', () => {
    expect(
      sqlQuery(
        `SELECT relname || ':' || relrowsecurity::text || ':' || relforcerowsecurity::text
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND relname IN ('commission_pending_import_batches','commission_pending_import_rows')
          ORDER BY 1`,
      ),
    ).toBe(
      'commission_pending_import_batches:true:true\ncommission_pending_import_rows:true:true',
    )
    expect(
      sqlQuery(
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'commission_pending_import_rows'
            AND column_name = 'posted_commission_event_id'`,
      ),
    ).toBe('0')
    expect(
      sqlQuery(
        `SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'policy_application_expected_compensations'
            AND column_name ILIKE '%pending%'`,
      ),
    ).toBe('0')
    expect(
      sqlQuery(
        `SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid = 'public.policy_writing_commission_events'::regclass
            AND pg_get_constraintdef(oid) ILIKE '%event_type%'`,
      ),
    ).not.toMatch(/pending/i)
    expect(
      sqlQuery(
        `SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid = 'public.commission_import_batches'::regclass
            AND conname LIKE '%source_type%'`,
      ),
    ).toContain('experior_paid_report')
    expect(
      sqlQuery(
        `SELECT pg_get_constraintdef(oid) FROM pg_constraint
          WHERE conrelid = 'public.commission_import_batches'::regclass
            AND conname LIKE '%source_type%'`,
      ),
    ).not.toContain('experior_pending_report')
    expect(
      sqlQuery(
        `SELECT count(*) FROM pg_proc
          WHERE proname IN (
            'review_commission_pending_import_row',
            'post_commission_pending_import_row',
            'post_commission_pending_import_row'
          )`,
      ),
    ).toBe('0')
  })

  it('creates a pending batch, preserves metadata, and rejects duplicate SHA staging', async () => {
    const missing = await owner.rpc('create_commission_pending_import_batch', {
      p_source_type: 'experior_pending_report',
      p_source_file: uniq('f') + '.csv',
      p_file_sha256: 'not-a-hash',
      p_statement_identifier: uniq('st'),
    })
    expect(errMsg(missing.error)).toMatch(/CRM_PP:invalid_payload/)

    const paidSource = await owner.rpc('create_commission_pending_import_batch', {
      p_source_type: 'experior_paid_report',
      p_source_file: uniq('f') + '.csv',
      p_file_sha256: sha256(uniq('sha')),
      p_statement_identifier: uniq('st'),
    })
    expect(errMsg(paidSource.error)).toMatch(/CRM_PP:invalid_payload/)

    const sha = sha256('pending-bytes-' + uniq('bytes'))
    const first = await createBatch({
      p_file_sha256: sha,
      p_source_file: 'pending.csv',
      p_statement_amount_cents: 337105,
      p_escrow_cents: 3405,
      p_payee_name: 'Jacqueline Juarez',
    })
    expect(errMsg(first.error)).toBe('')
    expect(asRecord(first.data).duplicate).toBe(false)
    const batch = asRecord(asRecord(first.data).batch)
    expect(Number(batch.statement_amount_cents)).toBe(337105)
    expect(Number(batch.escrow_cents)).toBe(3405)
    expect(batch.source_type).toBe('experior_pending_report')
    expect(batch.import_status).toBe('open')

    const second = await createBatch({ p_file_sha256: sha, p_source_file: 'pending.csv' })
    expect(errMsg(second.error)).toBe('')
    expect(asRecord(second.data).duplicate).toBe(true)
    expect(asRecord(second.data).original_batch_id).toBe(batch.id)
    expect(asRecord(asRecord(second.data).batch).import_status).toBe('duplicate_file')

    const stagedOnDup = await stage(asRecord(asRecord(second.data).batch).id as string, [
      commissionRow(),
    ])
    expect(errMsg(stagedOnDup.error)).toMatch(/CRM_PP:invalid_payload/)
  })

  it('classifies Jacqueline Commission, Yadira Override, additional, zero, and review cases', async () => {
    const { appId, policyNumber } = await issuedApp()
    const splitApp = await issuedApp({ allocations: splitWriting(5000, 5000) })
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({
        source_policy_number: policyNumber,
        source_income_cents: 335512,
        source_gross_rate: 999,
        source_row_ordinal: 1,
      }),
      commissionRow({
        source_type: 'Override',
        source_writing_associate: 'Yadira Romero',
        source_income_cents: 1046,
        source_row_ordinal: 2,
      }),
      commissionRow({
        source_type: 'Override',
        source_writing_associate: 'Yadira Romero',
        source_income_cents: 3952,
        source_row_ordinal: 3,
      }),
      {
        source_section: 'additional_commissions',
        source_row_ordinal: 1,
        source_type: 'Commission',
        source_income_cents: 100,
      },
      commissionRow({
        source_income_cents: 0,
        source_policy_number: policyNumber,
        source_row_ordinal: 4,
      }),
      commissionRow({
        source_policy_number: uniq('missing'),
        source_row_ordinal: 5,
      }),
      commissionRow({
        source_policy_number: policyNumber,
        source_writing_associate: 'Unknown Writer',
        source_row_ordinal: 6,
      }),
      commissionRow({
        source_policy_number: splitApp.policyNumber,
        source_row_ordinal: 7,
      }),
    ])
    expect(errMsg(staged.error)).toBe('')
    const ids = asRecord(staged.data).row_ids as string[]
    const rows = ids.map((id) => pendingRow(id))
    expect(rows[0].status).toBe('accepted_pending')
    expect(rows[0].income).toBe('335512')
    expect(rows[0].appId).toBe(appId)
    expect(rows[1].status).toBe('ignored_nonwriting')
    expect(rows[1].reason).toBe('override_nonwriting')
    expect(rows[2].status).toBe('ignored_nonwriting')
    expect(rows[3].status).toBe('ignored_nonpolicy')
    expect(rows[4].status).toBe('invalid_amount')
    expect(rows[5].status).toBe('review_policy_match')
    expect(rows[6].status).toBe('review_advisor_match')
    expect(rows[7].status).toBe('review_split_attribution')

    const counts = asRecord(
      asRecord(
        (await owner.from('commission_pending_import_batches').select('*').eq('id', batchId).single())
          .data as Record<string, unknown>,
      ),
    )
    expect(Number(counts.statement_amount_cents)).toBe(337105)
    expect(Number(counts.escrow_cents)).toBe(3405)
    expect(Number(counts.accepted_count)).toBe(1)
    expect(Number(counts.ignored_count)).toBe(3)
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${appId}'`,
      ),
    ).toBe('0')
  })

  it('duplicate payment identity is duplicate; ambiguous fingerprint is review_duplicate_candidate', async () => {
    const { policyNumber } = await issuedApp()
    const facts = {
      source_policy_number: policyNumber,
      source_income_cents: 335512,
      transaction_date: '2026-08-05',
      payment_number: '1 / 12',
    }
    const first = await createBatch({ p_file_sha256: sha256('dup-a-' + uniq('a')) })
    const batchA = asRecord(asRecord(first.data).batch).id as string
    const stagedA = await stage(batchA, [commissionRow({ ...facts, source_row_ordinal: 1 })])
    expect(errMsg(stagedA.error)).toBe('')
    expect(pendingRow((asRecord(stagedA.data).row_ids as string[])[0]).status).toBe('accepted_pending')

    const later = await createBatch({ p_file_sha256: sha256('dup-b-' + uniq('b')) })
    const batchB = asRecord(asRecord(later.data).batch).id as string
    const stagedB = await stage(batchB, [commissionRow({ ...facts, source_row_ordinal: 1 })])
    expect(errMsg(stagedB.error)).toBe('')
    expect(pendingRow((asRecord(stagedB.data).row_ids as string[])[0]).status).toBe('duplicate')

    const ordinary = {
      source_policy_number: policyNumber,
      source_income_cents: 10000,
      transaction_date: '2026-08-06',
      payment_number: null,
    }
    const firstOrdinary = await createBatch({ p_file_sha256: sha256('ord-a-' + uniq('a')) })
    const batchC = asRecord(asRecord(firstOrdinary.data).batch).id as string
    const stagedC = await stage(batchC, [commissionRow({ ...ordinary, source_row_ordinal: 1 })])
    expect(pendingRow((asRecord(stagedC.data).row_ids as string[])[0]).status).toBe('accepted_pending')

    const laterOrdinary = await createBatch({ p_file_sha256: sha256('ord-b-' + uniq('b')) })
    const batchD = asRecord(asRecord(laterOrdinary.data).batch).id as string
    const stagedD = await stage(batchD, [commissionRow({ ...ordinary, source_row_ordinal: 1 })])
    expect(pendingRow((asRecord(stagedD.data).row_ids as string[])[0]).status).toBe(
      'review_duplicate_candidate',
    )
  })

  it('owner can create/stage; advisor is denied; authenticated DML is blocked', async () => {
    const { policyNumber } = await issuedApp()
    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [commissionRow({ source_policy_number: policyNumber })])
    const rowId = (asRecord(staged.data).row_ids as string[])[0]

    const advSelect = await advisorA.from('commission_pending_import_rows').select('id')
    expect(errMsg(advSelect.error)).toBe('')
    expect((advSelect.data || []).length).toBe(0)
    const advBatch = await advisorA.from('commission_pending_import_batches').select('id')
    expect((advBatch.data || []).length).toBe(0)

    const ownerRows = await owner.from('commission_pending_import_rows').select('id').eq('id', rowId)
    expect((ownerRows.data || []).length).toBe(1)

    const rawUpdate = await owner
      .from('commission_pending_import_rows')
      .update({ source_income_cents: 1 })
      .eq('id', rowId)
    expect(errMsg(rawUpdate.error)).toMatch(/not_authorized|permission|42501|CRM_PP/i)

    const rawInsert = await owner.from('commission_pending_import_batches').insert({
      source_type: 'experior_pending_report',
      source_file: 'x.csv',
      file_sha256: sha256(uniq('x')),
      statement_identifier: uniq('st'),
    })
    expect(errMsg(rawInsert.error)).toMatch(/not_authorized|permission|42501|CRM_PP/i)

    const advStage = await stage(batchId, [commissionRow()], advisorA)
    expect(errMsg(advStage.error)).toMatch(/CRM_PP:not_authorized/)
    const advCreate = await createBatch({}, advisorA)
    expect(errMsg(advCreate.error)).toMatch(/CRM_PP:not_authorized/)
  })

  it('server-side hardening: Override/ignored/duplicate/wrong/ended allocation cannot become accepted_pending', async () => {
    const { appId, policyNumber } = await issuedApp()
    const other = await issuedApp()
    const allocId = writingAlloc(appId)
    const otherAlloc = writingAlloc(other.appId)

    const open = await createBatch()
    const batchId = asRecord(asRecord(open.data).batch).id as string
    const staged = await stage(batchId, [
      commissionRow({
        source_type: 'Override',
        source_writing_associate: 'Yadira Romero',
        source_income_cents: 1046,
        source_row_ordinal: 1,
      }),
      {
        source_section: 'additional_commissions',
        source_row_ordinal: 1,
        source_type: 'Commission',
        source_income_cents: 100,
      },
      commissionRow({
        source_policy_number: policyNumber,
        payment_number: '9 / 12',
        source_row_ordinal: 2,
      }),
    ])
    expect(errMsg(staged.error)).toBe('')
    const [overrideId, additionalId, firstDupId] = asRecord(staged.data).row_ids as string[]
    expect(pendingRow(overrideId).status).toBe('ignored_nonwriting')
    expect(pendingRow(additionalId).status).toBe('ignored_nonpolicy')
    expect(pendingRow(firstDupId).status).toBe('accepted_pending')

    const later = await createBatch({ p_file_sha256: sha256('hard-b-' + uniq('b')) })
    const batchB = asRecord(asRecord(later.data).batch).id as string
    const stagedB = await stage(batchB, [
      commissionRow({
        source_policy_number: policyNumber,
        payment_number: '9 / 12',
        source_row_ordinal: 1,
      }),
    ])
    const duplicateId = (asRecord(stagedB.data).row_ids as string[])[0]
    expect(pendingRow(duplicateId).status).toBe('duplicate')

    for (const rowId of [overrideId, additionalId, duplicateId]) {
      let failed = false
      try {
        forceAccepted(rowId, appId, allocId)
      } catch {
        failed = true
      }
      expect(failed).toBe(true)
      expect(pendingRow(rowId).status).not.toBe('accepted_pending')
    }

    let wrongPair = false
    try {
      sqlQuery(
        'ALTER TABLE public.commission_pending_import_rows DISABLE TRIGGER commission_pending_import_rows_immutability',
      )
      sqlQuery(
        `UPDATE public.commission_pending_import_rows
            SET pending_review_status = 'accepted_pending',
                resolved_application_id = '${appId}',
                resolved_allocation_id = '${otherAlloc}',
                resolved_advisor_id = '${advisorAProfileId}'
          WHERE id = '${firstDupId}'`,
      )
    } catch {
      wrongPair = true
    } finally {
      sqlQuery(
        'ALTER TABLE public.commission_pending_import_rows ENABLE TRIGGER commission_pending_import_rows_immutability',
      )
    }
    expect(wrongPair).toBe(true)

    sqlQuery(
      `UPDATE public.policy_agent_allocations SET effective_to = now() WHERE id = '${allocId}'`,
    )
    let ended = false
    try {
      sqlQuery(
        `INSERT INTO public.commission_pending_import_rows (
           batch_id, source_section, source_row_ordinal, source_row_key, transaction_fingerprint,
           source_type, source_income_cents, pending_review_status,
           resolved_carrier_id, resolved_application_id, resolved_allocation_id, resolved_advisor_id
         ) VALUES (
           '${batchId}', 'insurance', 99, '${sha256('ended-key-' + uniq('k'))}',
           '${sha256('ended-fp-' + uniq('f'))}', 'Commission', 100,
           'accepted_pending', '${carrierId}', '${appId}', '${allocId}', '${advisorAProfileId}'
         )`,
      )
    } catch {
      ended = true
    }
    expect(ended).toBe(true)
    sqlQuery(
      `UPDATE public.policy_agent_allocations SET effective_to = NULL WHERE id = '${allocId}'`,
    )
  })

  it('does not mix pending staging into 036 paid batches or write 035', async () => {
    const paid = await owner.rpc('create_commission_import_batch', {
      p_source_type: 'experior_paid_report',
      p_source_file: uniq('paid') + '.csv',
      p_file_sha256: sha256(uniq('paid-sha')),
      p_statement_identifier: uniq('paid-st'),
    })
    expect(errMsg(paid.error)).toBe('')
    const paidBatchId = asRecord(asRecord(paid.data).batch).id as string
    expect(
      sqlQuery(
        `SELECT count(*) FROM public.commission_pending_import_batches WHERE id = '${paidBatchId}'`,
      ),
    ).toBe('0')
    expect(
      sqlQuery(
        `SELECT source_type FROM public.commission_import_batches WHERE id = '${paidBatchId}'`,
      ),
    ).toBe('experior_paid_report')
    sqlQuery(`DELETE FROM public.commission_import_batches WHERE id = '${paidBatchId}'`)
  })
})
