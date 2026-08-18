/**
 * Local Supabase integration for Migration 041 Pending review RPC.
 * Skips when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass041!'
const PREFIX = 'm041pr'

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
    return { API_URL: env.API_URL, ANON_KEY: env.ANON_KEY, SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY }
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

describe.skipIf(!localEnv)('migration 041 commission pending review (local DB)', () => {
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
    paidBatches: [] as string[],
  }

  let numberSeq = 0
  function uniq(label: string): string {
    numberSeq += 1
    return `${PREFIX}-${label}-${randomUUID().slice(0, 8)}-${numberSeq}`
  }

  async function ensureUser(email: string, fullName: string, role: 'owner' | 'advisor'): Promise<string> {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) throw list.error
    const existing = (list.data?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
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
    sqlQuery(`UPDATE public.profiles SET role = '${role}', is_active = true, deleted_at = NULL WHERE id = '${userId}'`)
    return userId
  }

  async function ensureAdvisorProfile(userId: string, slug: string): Promise<string> {
    const { data: existing } = await admin.from('advisor_profiles').select('id').eq('user_id', userId).maybeSingle()
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

  function splitWriting() {
    return [
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
    ]
  }

  function lifePayload(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      household_id: householdA,
      carrier_id: carrierId,
      product_id: productTermId,
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

  async function createApp(payload: Record<string, unknown>) {
    const res = await owner.rpc('create_policy_application', { p_payload: payload })
    const id = res.data?.application_id
    if (typeof id === 'string') created.applications.push(id)
    return res
  }

  async function issuedApp(over: Record<string, unknown> = {}, policyNumber?: string) {
    const createdApp = await createApp(lifePayload(over))
    const appId = createdApp.data.application_id as string
    expect(errMsg((await owner.rpc('transition_policy_application_stage', {
      p_application_id: appId, p_to_stage: 'submitted', p_disposition: null, p_delivery_status: null, p_reason: null,
      p_fields: { submission_date: '2026-04-01' },
    })).error)).toBe('')
    expect(errMsg((await owner.rpc('transition_policy_application_stage', {
      p_application_id: appId, p_to_stage: 'in_underwriting', p_disposition: null, p_delivery_status: null, p_reason: null, p_fields: {},
    })).error)).toBe('')
    expect(errMsg((await owner.rpc('transition_policy_application_stage', {
      p_application_id: appId, p_to_stage: 'approved', p_disposition: 'approved_as_applied', p_delivery_status: null, p_reason: null, p_fields: {},
    })).error)).toBe('')
    const pn = (policyNumber ?? uniq('pn')).toUpperCase()
    expect(errMsg((await owner.rpc('transition_policy_application_stage', {
      p_application_id: appId, p_to_stage: 'issued', p_disposition: null, p_delivery_status: null, p_reason: null,
      p_fields: { policy_number: pn },
    })).error)).toBe('')
    return { appId, policyNumber: pn }
  }

  function writingAlloc(appId: string, advisorId = advisorAProfileId): string {
    return sqlQuery(
      `SELECT id FROM public.policy_agent_allocations
        WHERE application_id = '${appId}' AND advisor_id = '${advisorId}'
          AND allocation_role = 'writing' AND recipient_type = 'advisor' AND effective_to IS NULL`,
    )
  }

  async function createBatch(over: Record<string, unknown> = {}, client: SupabaseClient = owner) {
    const file = String(over.p_source_file ?? uniq('file') + '.csv')
    const sha = String(over.p_file_sha256 ?? sha256(file + randomUUID()))
    const res = await client.rpc('create_commission_pending_import_batch', {
      p_source_type: 'experior_pending_report',
      p_source_file: file,
      p_file_sha256: sha,
      p_statement_identifier: String(over.p_statement_identifier ?? `experior-pending:${uniq('st')}`),
      p_fs_code: over.p_fs_code ?? 'A42353',
      p_statement_date: over.p_statement_date ?? '2026-08-17',
      p_source_created_at: over.p_source_created_at ?? '2026-08-17T15:57:28Z',
      p_payee_name: over.p_payee_name ?? 'Jared Writer',
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
      source_writing_associate: 'Jared Writer',
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
    return client.rpc('stage_commission_pending_import_rows', { p_batch_id: batchId, p_rows: rows })
  }

  function rowId(batchId: string, ordinal = 1): string {
    return sqlQuery(
      `SELECT id FROM public.commission_pending_import_rows WHERE batch_id = '${batchId}' AND source_row_ordinal = ${ordinal}`,
    )
  }

  function pending(id: string): Record<string, string> {
    const raw = sqlQuery(
      `SELECT pending_review_status || '|' || coalesce(pending_review_reason, '') || '|' ||
              source_income_cents::text || '|' || coalesce(source_type, '') || '|' ||
              coalesce(source_row_key, '') || '|' || coalesce(resolved_application_id::text, '') || '|' ||
              coalesce(resolved_allocation_id::text, '') || '|' || coalesce(resolved_advisor_id::text, '') || '|' ||
              coalesce(reviewed_by_user_id::text, '') || '|' || coalesce(reviewed_at::text, '')
         FROM public.commission_pending_import_rows WHERE id = '${id}'`,
    )
    const [status, reason, income, sourceType, key, appId, allocId, advisorId, reviewedBy, reviewedAt] = raw.split('|')
    return { status, reason, income, sourceType, key, appId, allocId, advisorId, reviewedBy, reviewedAt }
  }

  async function review(
    rowIdValue: string,
    action: 'accept' | 'confirm_duplicate' | 'confirm_distinct',
    over: Record<string, unknown> = {},
    client: SupabaseClient = owner,
  ) {
    return client.rpc('review_commission_pending_import_row', {
      p_row_id: rowIdValue,
      p_action: action,
      p_reason: over.p_reason ?? 'Owner resolved Pending attribution.',
      p_resolved_application_id: over.p_resolved_application_id ?? null,
      p_resolved_allocation_id: over.p_resolved_allocation_id ?? null,
    })
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    ownerId = await ensureUser(`${PREFIX}-owner@valtoris.test`, 'M041 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}-adv-a@valtoris.test`, 'M041 Jared', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}-adv-b@valtoris.test`, 'M041 Jazmin', 'advisor')
    advisorAProfileId = await ensureAdvisorProfile(advisorAUserId, `${PREFIX}-jared`)
    advisorBProfileId = await ensureAdvisorProfile(advisorBUserId, `${PREFIX}-jazmin`)
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
    const carrier = await owner.rpc('create_carrier', { p_code: uniq('c'), p_name: carrierName })
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

    await owner.rpc('set_advisor_contract_level', { p_advisor_id: advisorAProfileId, p_contract_level: 'ED' })
    await owner.rpc('set_advisor_contract_level', { p_advisor_id: advisorBProfileId, p_contract_level: 'SFA' })
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
      sqlQuery(`DELETE FROM public.commission_pending_import_batches WHERE id IN (${batches})`)
    }
    if (created.paidBatches.length) {
      const paid = created.paidBatches.map((id) => `'${id}'`).join(',')
      sqlQuery(`DELETE FROM public.commission_import_rows WHERE batch_id IN (${paid})`)
      sqlQuery(`DELETE FROM public.commission_import_batches WHERE id IN (${paid})`)
    }
    if (created.applications.length) {
      const apps = created.applications.map((id) => `'${id}'`).join(',')
      sqlQuery(`DELETE FROM public.policy_writing_commission_events WHERE application_id IN (${apps})`)
      sqlQuery(`DELETE FROM public.policy_writing_commission_accounts WHERE application_id IN (${apps})`)
      sqlQuery(`DELETE FROM public.policy_application_expected_compensations WHERE application_id IN (${apps})`)
      sqlQuery(`DELETE FROM public.policies WHERE source_application_id IN (${apps})`)
      sqlQuery(`DELETE FROM public.policy_applications WHERE id IN (${apps})`)
    }
    if (created.schedules.length) {
      sqlQuery(`DELETE FROM public.product_compensation_schedules WHERE id IN (${created.schedules.map((id) => `'${id}'`).join(',')})`)
    }
    if (created.households.length) {
      sqlQuery(`DELETE FROM public.households WHERE id IN (${created.households.map((id) => `'${id}'`).join(',')})`)
    }
    if (created.carriers.length) {
      sqlQuery(`DELETE FROM public.insurance_products WHERE carrier_id IN (${created.carriers.map((id) => `'${id}'`).join(',')})`)
      sqlQuery(`DELETE FROM public.carriers WHERE id IN (${created.carriers.map((id) => `'${id}'`).join(',')})`)
    }
  }, 120000)

  it('exists as a function-only 041 RPC with DML still revoked', () => {
    expect(sqlQuery(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='review_commission_pending_import_row'`)).toBe('1')
    expect(sqlQuery(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'commission_pending%' AND table_name NOT IN ('commission_pending_import_batches','commission_pending_import_rows')`)).toBe('0')
    expect(sqlQuery(`SELECT has_table_privilege('authenticated','public.commission_pending_import_rows','UPDATE')`)).toBe('f')
  })

  it('lets the owner resolve policy, advisor, and split rows without auto-splitting Income', async () => {
    const policyApp = await issuedApp()
    const policyBatch = await createBatch()
    const policyBatchId = asRecord(asRecord(policyBatch.data).batch).id as string
    await stage(policyBatchId, [commissionRow({ source_policy_number: uniq('missing') })])
    const policyRowId = rowId(policyBatchId)
    expect(pending(policyRowId).status).toBe('review_policy_match')
    const policyAlloc = writingAlloc(policyApp.appId)
    expect(errMsg((await review(policyRowId, 'accept', {
      p_resolved_application_id: policyApp.appId,
      p_resolved_allocation_id: policyAlloc,
    })).error)).toBe('')
    const afterPolicy = pending(policyRowId)
    expect(afterPolicy.status).toBe('accepted_pending')
    expect(afterPolicy.appId).toBe(policyApp.appId)
    expect(afterPolicy.allocId).toBe(policyAlloc)
    expect(afterPolicy.advisorId).toBe(advisorAProfileId)
    expect(afterPolicy.income).toBe('335512')
    expect(afterPolicy.reviewedBy).toBe(ownerId)
    expect(afterPolicy.reviewedAt.length).toBeGreaterThan(0)

    const advisorApp = await issuedApp()
    const advisorBatch = await createBatch()
    const advisorBatchId = asRecord(asRecord(advisorBatch.data).batch).id as string
    await stage(advisorBatchId, [commissionRow({
      source_policy_number: advisorApp.policyNumber,
      source_writing_associate: 'Unknown Writer',
    })])
    const advisorRowId = rowId(advisorBatchId)
    expect(pending(advisorRowId).status).toBe('review_advisor_match')
    expect(errMsg((await review(advisorRowId, 'accept', {
      p_resolved_application_id: advisorApp.appId,
      p_resolved_allocation_id: writingAlloc(advisorApp.appId),
    })).error)).toBe('')
    expect(pending(advisorRowId).status).toBe('accepted_pending')

    const splitApp = await issuedApp({ allocations: splitWriting() })
    const splitBatch = await createBatch()
    const splitBatchId = asRecord(asRecord(splitBatch.data).batch).id as string
    await stage(splitBatchId, [commissionRow({ source_policy_number: splitApp.policyNumber })])
    const splitRowId = rowId(splitBatchId)
    expect(pending(splitRowId).status).toBe('review_split_attribution')
    const jaredAlloc = writingAlloc(splitApp.appId, advisorAProfileId)
    const jazminAlloc = writingAlloc(splitApp.appId, advisorBProfileId)
    expect(errMsg((await review(splitRowId, 'accept', {
      p_resolved_application_id: splitApp.appId,
      p_resolved_allocation_id: jaredAlloc,
    })).error)).toBe('')
    const splitAfter = pending(splitRowId)
    expect(splitAfter.status).toBe('accepted_pending')
    expect(splitAfter.allocId).toBe(jaredAlloc)
    expect(splitAfter.advisorId).toBe(advisorAProfileId)
    expect(splitAfter.income).toBe('335512')
    expect(sqlQuery(
      `SELECT count(*) FROM public.commission_pending_import_rows
        WHERE batch_id = '${splitBatchId}' AND resolved_allocation_id = '${jazminAlloc}'`,
    )).toBe('0')
    expect(sqlQuery(
      `SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${splitApp.appId}'`,
    )).toBe('0')
  })

  it('rejects ended, wrong-pair, Override, additional, ignored, invalid, and terminal duplicate', async () => {
    const app = await issuedApp()
    const alloc = writingAlloc(app.appId)
    const other = await issuedApp()
    const otherAlloc = writingAlloc(other.appId)

    const batch = await createBatch()
    const batchId = asRecord(asRecord(batch.data).batch).id as string
    await stage(batchId, [
      commissionRow({ source_row_ordinal: 1, source_policy_number: uniq('miss1') }),
      commissionRow({ source_row_ordinal: 2, source_type: 'Override', source_policy_number: app.policyNumber }),
      commissionRow({ source_row_ordinal: 3, source_section: 'additional_commissions', source_policy_number: app.policyNumber }),
      commissionRow({ source_row_ordinal: 4, source_income_cents: 0, source_policy_number: app.policyNumber }),
    ])
    const reviewId = rowId(batchId, 1)
    const overrideId = rowId(batchId, 2)
    const additionalId = rowId(batchId, 3)
    const invalidId = rowId(batchId, 4)
    expect(pending(overrideId).status).toBe('ignored_nonwriting')
    expect(pending(additionalId).status).toBe('ignored_nonpolicy')
    expect(pending(invalidId).status).toBe('invalid_amount')

    sqlQuery(`UPDATE public.policy_agent_allocations SET effective_to = now() WHERE id = '${alloc}'`)
    expect(errMsg((await review(reviewId, 'accept', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    })).error)).toMatch(/invalid_payload/)
    sqlQuery(`UPDATE public.policy_agent_allocations SET effective_to = NULL WHERE id = '${alloc}'`)

    expect(errMsg((await review(reviewId, 'accept', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: otherAlloc,
    })).error)).toMatch(/invalid_payload/)

    expect(errMsg((await review(overrideId, 'accept', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    })).error)).toMatch(/invalid_payload/)
    expect(errMsg((await review(additionalId, 'accept', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    })).error)).toMatch(/invalid_payload/)
    expect(errMsg((await review(invalidId, 'accept', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    })).error)).toMatch(/invalid_payload/)

    const first = await createBatch()
    const firstId = asRecord(asRecord(first.data).batch).id as string
    await stage(firstId, [commissionRow({
      source_policy_number: app.policyNumber,
      payment_number: 'PAY-041',
      source_income_cents: 1046,
    })])
    const firstRow = rowId(firstId)
    expect(['accepted_pending', 'review_advisor_match', 'review_split_attribution']).toContain(pending(firstRow).status)
    const second = await createBatch()
    const secondId = asRecord(asRecord(second.data).batch).id as string
    await stage(secondId, [commissionRow({
      source_policy_number: app.policyNumber,
      payment_number: 'PAY-041',
      source_income_cents: 1046,
    })])
    const dupId = rowId(secondId)
    expect(pending(dupId).status).toBe('duplicate')
    expect(errMsg((await review(dupId, 'accept', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    })).error)).toMatch(/invalid_payload/)
    expect(errMsg((await review(dupId, 'confirm_distinct', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    })).error)).toMatch(/invalid_payload/)
  })

  it('confirms duplicate candidates and requires a live allocation for distinct', async () => {
    const app = await issuedApp()
    const alloc = writingAlloc(app.appId)
    const shared = {
      source_policy_number: uniq('cand'),
      source_income_cents: 3952,
      source_writing_associate: 'Unknown Writer',
    }
    const first = await createBatch()
    const firstId = asRecord(asRecord(first.data).batch).id as string
    await stage(firstId, [commissionRow(shared)])
    const second = await createBatch()
    const secondId = asRecord(asRecord(second.data).batch).id as string
    await stage(secondId, [commissionRow(shared)])
    const candidateId = rowId(secondId)
    expect(pending(candidateId).status).toBe('review_duplicate_candidate')

    expect(errMsg((await review(candidateId, 'confirm_distinct')).error)).toMatch(/invalid_payload/)
    expect(pending(candidateId).status).toBe('review_duplicate_candidate')

    const third = await createBatch()
    const thirdId = asRecord(asRecord(third.data).batch).id as string
    await stage(thirdId, [commissionRow({ ...shared, source_client: 'Other' })])
    const distinctId = rowId(thirdId)
    expect(pending(distinctId).status).toBe('review_duplicate_candidate')
    expect(errMsg((await review(distinctId, 'confirm_distinct', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    })).error)).toBe('')
    const distinctAfter = pending(distinctId)
    expect(distinctAfter.status).toBe('accepted_pending')
    expect(distinctAfter.income).toBe('3952')
    expect(distinctAfter.advisorId).toBe(advisorAProfileId)

    expect(errMsg((await review(candidateId, 'confirm_duplicate')).error)).toBe('')
    expect(pending(candidateId).status).toBe('duplicate')
    expect(pending(candidateId).income).toBe('3952')
  })

  it('is owner-only, preserves source facts, and does not write 035 or 036', async () => {
    const app = await issuedApp()
    const alloc = writingAlloc(app.appId)
    const batch = await createBatch()
    const batchId = asRecord(asRecord(batch.data).batch).id as string
    const sourceRow = commissionRow({ source_policy_number: uniq('sec') })
    await stage(batchId, [sourceRow])
    const id = rowId(batchId)
    const before = pending(id)
    expect(before.status).toBe('review_policy_match')

    expect(errMsg((await review(id, 'accept', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    }, advisorA)).error)).toMatch(/not_authorized/)
    const advisorSelect = await advisorA.from('commission_pending_import_rows').select('id').eq('id', id)
    expect((advisorSelect.data ?? []).length).toBe(0)

    expect(errMsg((await review(id, 'accept', {
      p_resolved_application_id: app.appId,
      p_resolved_allocation_id: alloc,
    })).error)).toBe('')
    const after = pending(id)
    expect(after.status).toBe('accepted_pending')
    expect(after.income).toBe(before.income)
    expect(after.sourceType).toBe('Commission')
    expect(after.key).toBe(before.key)

    let mutated = false
    try {
      sqlQuery(`UPDATE public.commission_pending_import_rows SET source_income_cents = 1 WHERE id = '${id}'`)
    } catch {
      mutated = true
    }
    expect(mutated).toBe(true)
    expect(pending(id).income).toBe(before.income)

    const paid = await owner.rpc('create_commission_import_batch', {
      p_source_type: 'experior_paid_report',
      p_source_file: uniq('paid') + '.csv',
      p_file_sha256: sha256(uniq('paid-sha')),
      p_statement_identifier: uniq('paid-st'),
    })
    expect(errMsg(paid.error)).toBe('')
    const paidBatchId = asRecord(asRecord(paid.data).batch).id as string
    created.paidBatches.push(paidBatchId)
    expect(sqlQuery(`SELECT count(*) FROM public.commission_import_rows WHERE batch_id = '${paidBatchId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.policy_writing_commission_events WHERE application_id = '${app.appId}'`)).toBe('0')
    expect(sqlQuery(`SELECT count(*) FROM public.policy_writing_commission_accounts WHERE application_id = '${app.appId}'`)).toBe('0')
  })
})
