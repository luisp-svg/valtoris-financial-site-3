/**
 * Live CRM-dev integration for Migration 045 post-placement policy lifecycle.
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates isolated m045qa rows and deletes them in afterAll.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'm045qa'
const ANCHOR = '2024-01-15'
const ANNIVERSARY = '2025-01-15'
const INSIDE_12 = '2025-01-14'
const AFTER_12 = '2025-02-01'

function loadDotEnv(): void {
  let raw = ''
  try {
    raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    if (process.env[m[1]]) continue
    let value = m[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[m[1]] = value
  }
}

loadDotEnv()

function crmDevReady(): {
  url: string
  anon: string
  service: string
  ownerPass: string
  advisorAPass: string
  advisorBPass: string
} | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const ownerPass = process.env.DEV_OWNER_PASSWORD || ''
  const advisorAPass = process.env.DEV_ADVISOR_A_PASSWORD || ''
  const advisorBPass = process.env.DEV_ADVISOR_B_PASSWORD || ''
  if (!url || !anon || !service || !ownerPass || !advisorAPass || !advisorBPass) return null
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  if (host !== REQUIRED_HOST) return null
  if (/prod|production/i.test(host)) return null
  return { url, anon, service, ownerPass, advisorAPass, advisorBPass }
}

const env = crmDevReady()

function errMsg(error: { message?: string } | null | undefined): string {
  return error?.message ?? ''
}

function ppCode(error: { message?: string } | null | undefined): string {
  const msg = errMsg(error)
  const m = msg.match(/CRM_PP:([a-z0-9_]+)/i)
  return m ? m[1] : msg
}

type CatalogRow = { id: string; carrier_id: string; product_line: string }

describe.skipIf(!env)('migration 045 CRM-dev post-placement lifecycle (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as NonNullable<typeof env>
  const runId = randomUUID().slice(0, 8)

  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorB: SupabaseClient
  let advisorAProfileId = ''
  let householdId = ''
  let memberId = ''
  let lifeProduct: CatalogRow

  const created = {
    households: [] as string[],
    members: [] as string[],
    applications: [] as string[],
    policies: [] as string[],
    auditLogs: [] as string[],
  }

  const apps: Record<string, string> = {}
  let qaInventory: Record<string, number> | null = null

  let taskCount = 0
  let activityCount = 0
  const expectedByApp: Record<string, number> = {}
  const commissionByApp: Record<string, number> = {}

  async function signIn(email: string, password: string): Promise<SupabaseClient> {
    const client = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
    return client
  }

  async function countExact(table: string, column: string, value: string): Promise<number> {
    const { count, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, value)
    if (error) throw new Error(`count ${table} failed: ${error.message}`)
    return count ?? 0
  }

  async function newLifeApp(): Promise<string> {
    const res = await owner.rpc('create_policy_application', {
      p_payload: {
        household_id: householdId,
        carrier_id: lifeProduct.carrier_id,
        product_id: lifeProduct.id,
        product_line: lifeProduct.product_line,
        state: 'TX',
        submitted_premium_cents: 240000,
        face_amount_cents: 50000000,
        premium_mode: 'annual',
        participants: [
          { household_member_id: memberId, role: 'primary_client' },
          { household_member_id: memberId, role: 'insured' },
          { household_member_id: memberId, role: 'owner' },
        ],
        allocations: [
          {
            recipient_type: 'advisor',
            advisor_id: advisorAProfileId,
            allocation_role: 'writing',
            commission_bps: 10000,
            production_credit_bps: 10000,
            contract_level_snapshot: '100%',
          },
        ],
      },
    })
    const id = res.data?.application_id as string | undefined
    if (res.error || !id) throw new Error(`create_policy_application failed: ${errMsg(res.error)}`)
    created.applications.push(id)
    return id
  }

  async function transition(
    applicationId: string,
    toStage: string,
    opts: {
      disposition?: string | null
      delivery?: string | null
      reason?: string | null
      fields?: Record<string, unknown>
    } = {},
  ) {
    return owner.rpc('transition_policy_application_stage', {
      p_application_id: applicationId,
      p_to_stage: toStage,
      p_disposition: opts.disposition ?? null,
      p_delivery_status: opts.delivery ?? null,
      p_reason: opts.reason ?? null,
      p_fields: opts.fields ?? {},
    })
  }

  async function submit(applicationId: string, submissionDate = ANCHOR) {
    const res = await transition(applicationId, 'submitted', {
      fields: { submission_date: submissionDate },
    })
    if (res.error) throw new Error(`submit failed: ${errMsg(res.error)}`)
  }

  async function placeInForce(
    applicationId: string,
    policyNumber: string,
    dates: { issue: string; inForce: string } | 'omit',
  ) {
    await submit(applicationId)
    const approved = await transition(applicationId, 'approved', {
      disposition: 'approved_as_applied',
    })
    if (approved.error) throw new Error(`approved failed: ${errMsg(approved.error)}`)
    const issuedFields: Record<string, unknown> = {
      historical_entry: true,
      policy_number: policyNumber,
    }
    if (dates !== 'omit') issuedFields.issue_date = dates.issue
    const issued = await transition(applicationId, 'issued', { fields: issuedFields })
    if (issued.error) throw new Error(`issued failed: ${errMsg(issued.error)}`)
    const inForceFields: Record<string, unknown> = { historical_entry: true }
    if (dates !== 'omit') inForceFields.in_force_date = dates.inForce
    const inForce = await transition(applicationId, 'in_force', {
      delivery: 'complete',
      fields: inForceFields,
    })
    if (inForce.error) throw new Error(`in_force failed: ${errMsg(inForce.error)}`)
    const { data, error } = await admin
      .from('policies')
      .select('id')
      .eq('source_application_id', applicationId)
      .maybeSingle()
    if (error || !data?.id) throw new Error(`linked policy missing for ${applicationId}`)
    created.policies.push(data.id as string)
    return data.id as string
  }

  async function recordOutcome(
    applicationId: string,
    status: string,
    reason: string | null,
    terminatedOn: string | null,
    client: SupabaseClient = owner,
  ) {
    return client.rpc('record_policy_post_placement_outcome', {
      p_application_id: applicationId,
      p_status: status,
      p_reason: reason,
      p_terminated_on: terminatedOn,
    })
  }

  async function appRow(applicationId: string) {
    const { data, error } = await admin
      .from('policy_applications')
      .select(
        'id, production_stage, delivery_status, issue_date, in_force_date, policy_number, household_id, writing_receivable_expected, submitted_premium_cents, face_amount_cents',
      )
      .eq('id', applicationId)
      .single()
    if (error || !data) throw new Error(`app row failed: ${error?.message}`)
    return data
  }

  async function policyRow(applicationId: string) {
    const { data, error } = await admin
      .from('policies')
      .select(
        'id, status, terminated_on, termination_reason, policy_number, carrier, household_id, source_application_id, effective_date',
      )
      .eq('source_application_id', applicationId)
      .maybeSingle()
    if (error) throw new Error(`policy row failed: ${error.message}`)
    return data
  }

  async function cleanupQa(label: string) {
    const appsIds = created.applications
    if (appsIds.length) {
      await admin.from('policy_writing_commission_events').delete().in('application_id', appsIds)
      await admin.from('policy_writing_commission_accounts').delete().in('application_id', appsIds)
      await admin.from('policy_application_expected_compensations').delete().in('application_id', appsIds)
      await admin.from('policy_application_requirement_history').delete().in('application_id', appsIds)
      await admin.from('policy_application_requirements').delete().in('application_id', appsIds)
      await admin.from('policies').delete().in('source_application_id', appsIds)
      await admin.from('policy_applications').delete().in('id', appsIds)
    }
    if (created.auditLogs.length) {
      await admin.from('audit_logs').delete().in('id', created.auditLogs)
    }
    if (created.policies.length) {
      await admin.from('audit_logs').delete().in('entity_id', created.policies)
    }
    if (created.households.length) {
      await admin.from('audit_logs').delete().in('entity_id', created.households)
      await admin.from('notes').delete().in('household_id', created.households)
      await admin.from('tasks').delete().in('household_id', created.households)
      await admin.from('activities').delete().in('household_id', created.households)
      await admin.from('household_members').delete().in('household_id', created.households)
      await admin.from('advisor_assignments').delete().in('household_id', created.households)
      await admin.from('households').delete().in('id', created.households)
    }

    if (appsIds.length) {
      const { data: appLeft } = await admin.from('policy_applications').select('id').in('id', appsIds)
      const { data: polLeft } = await admin
        .from('policies')
        .select('id')
        .in('source_application_id', appsIds)
      expect(appLeft ?? [], `${label} application leftovers`).toEqual([])
      expect(polLeft ?? [], `${label} policy leftovers`).toEqual([])
    }
    if (created.households.length) {
      const { data: hhLeft } = await admin
        .from('households')
        .select('id')
        .in('id', created.households)
      expect(hhLeft ?? [], `${label} household leftovers`).toEqual([])
    }
  }

  beforeAll(async () => {
    admin = createClient(cfg.url, cfg.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    owner = await signIn('owner.dev@valtoris.test', cfg.ownerPass)
    advisorA = await signIn('advisor.a@valtoris.test', cfg.advisorAPass)
    advisorB = await signIn('advisor.b@valtoris.test', cfg.advisorBPass)

    const advAUser = await advisorA.auth.getUser()
    const { data: advProfile, error: advErr } = await admin
      .from('advisor_profiles')
      .select('id')
      .eq('user_id', advAUser.data.user?.id ?? '')
      .is('deleted_at', null)
      .eq('is_active', true)
      .maybeSingle()
    if (advErr || !advProfile?.id) throw new Error(`advisor A profile missing: ${advErr?.message}`)
    advisorAProfileId = advProfile.id as string

    const { data: products, error: prodErr } = await admin
      .from('insurance_products')
      .select('id, carrier_id, product_line')
      .is('deleted_at', null)
      .eq('is_active', true)
    if (prodErr) throw prodErr
    const life = (products ?? []).find((p) =>
      ['life_term', 'life_permanent'].includes(p.product_line as string),
    )
    if (!life) throw new Error('CRM-dev catalog missing an active Life product for m045qa')
    lifeProduct = life as CatalogRow

    const clientRes = await owner.rpc('create_canonical_client', {
      p_payload: {
        first_name: 'M045qa',
        last_name: `${PREFIX} ${runId}`,
        assigned_advisor_id: advisorAProfileId,
      },
    })
    if (clientRes.error || !clientRes.data?.household_id) {
      throw new Error(`create_canonical_client failed: ${errMsg(clientRes.error)}`)
    }
    householdId = clientRes.data.household_id as string
    memberId = clientRes.data.member_id as string
    created.households.push(householdId)
    created.members.push(memberId)
    if (clientRes.data.audit_id) created.auditLogs.push(clientRes.data.audit_id as string)

    const dated = { issue: ANCHOR, inForce: ANCHOR }
    apps.cancelOk = await newLifeApp()
    await placeInForce(apps.cancelOk, `M045${runId}C1`, dated)
    apps.surrenderOk = await newLifeApp()
    await placeInForce(apps.surrenderOk, `M045${runId}S1`, dated)
    apps.cancelReject = await newLifeApp()
    await placeInForce(apps.cancelReject, `M045${runId}C2`, dated)
    apps.surrenderReject = await newLifeApp()
    await placeInForce(apps.surrenderReject, `M045${runId}S2`, dated)
    apps.nullDate = await newLifeApp()
    await placeInForce(apps.nullDate, `M045${runId}N1`, dated)
    apps.issued = await newLifeApp()
    await submit(apps.issued)
    const issuedApproved = await transition(apps.issued, 'approved', {
      disposition: 'approved_as_applied',
    })
    if (issuedApproved.error) throw new Error(errMsg(issuedApproved.error))
    const issued = await transition(apps.issued, 'issued', {
      fields: { historical_entry: true, policy_number: `M045${runId}I1`, issue_date: ANCHOR },
    })
    if (issued.error) throw new Error(`issued fixture failed: ${errMsg(issued.error)}`)
    apps.withdrawn = await newLifeApp()
    await submit(apps.withdrawn)
    const withdrawn = await transition(apps.withdrawn, 'withdrawn', { reason: 'm045qa withdraw' })
    if (withdrawn.error) throw new Error(`withdrawn fixture failed: ${errMsg(withdrawn.error)}`)
    apps.notTaken = await newLifeApp()
    await submit(apps.notTaken)
    const ntApproved = await transition(apps.notTaken, 'approved', {
      disposition: 'approved_as_applied',
    })
    if (ntApproved.error) throw new Error(errMsg(ntApproved.error))
    const notTaken = await transition(apps.notTaken, 'not_taken', { reason: 'm045qa not taken' })
    if (notTaken.error) throw new Error(`not_taken fixture failed: ${errMsg(notTaken.error)}`)
    apps.declined = await newLifeApp()
    await submit(apps.declined)
    const uw = await transition(apps.declined, 'in_underwriting')
    if (uw.error) throw new Error(errMsg(uw.error))
    const declined = await transition(apps.declined, 'declined', {
      disposition: 'declined',
      reason: 'm045qa declined',
    })
    if (declined.error) throw new Error(`declined fixture failed: ${errMsg(declined.error)}`)
    apps.nullAnchor = await newLifeApp()
    await placeInForce(apps.nullAnchor, `M045${runId}A0`, 'omit')
    apps.regression = await newLifeApp()

    taskCount = await countExact('tasks', 'household_id', householdId)
    activityCount = await countExact('activities', 'household_id', householdId)
    for (const id of created.applications) {
      expectedByApp[id] = await countExact(
        'policy_application_expected_compensations',
        'application_id',
        id,
      )
      commissionByApp[id] = await countExact(
        'policy_writing_commission_events',
        'application_id',
        id,
      )
    }
  }, 180_000)

  afterAll(async () => {
    if (!admin) return
    await cleanupQa('afterAll')
  }, 120_000)

  it('A/C: in_force → canceled with known date inside first 12 months', async () => {
    const beforeApp = await appRow(apps.cancelOk)
    const beforePol = await policyRow(apps.cancelOk)
    const res = await recordOutcome(
      apps.cancelOk,
      'canceled',
      'm045qa canceled inside 12 months',
      INSIDE_12,
    )
    expect(ppCode(res.error)).toBe('')
    expect(res.data?.ok).toBe(true)
    expect(res.data?.status).toBe('canceled')
    expect(res.data?.audit_id).toBeTruthy()
    created.auditLogs.push(res.data.audit_id as string)

    const afterApp = await appRow(apps.cancelOk)
    const afterPol = await policyRow(apps.cancelOk)
    expect(afterApp.production_stage).toBe('in_force')
    expect(afterApp.delivery_status).toBe(beforeApp.delivery_status)
    expect(afterApp.issue_date).toBe(beforeApp.issue_date)
    expect(afterApp.in_force_date).toBe(beforeApp.in_force_date)
    expect(afterApp.policy_number).toBe(beforeApp.policy_number)
    expect(afterApp.household_id).toBe(beforeApp.household_id)
    expect(afterApp.writing_receivable_expected).toBe(beforeApp.writing_receivable_expected)
    expect(afterPol?.status).toBe('canceled')
    expect(String(afterPol?.terminated_on).slice(0, 10)).toBe(INSIDE_12)
    expect(afterPol?.policy_number).toBe(beforePol?.policy_number)
    expect(afterPol?.carrier).toBe(beforePol?.carrier)
    expect(afterPol?.household_id).toBe(beforePol?.household_id)
    expect(afterPol?.source_application_id).toBe(apps.cancelOk)

    const again = await recordOutcome(apps.cancelOk, 'surrendered', 'm045qa reopen', AFTER_12)
    expect(ppCode(again.error)).toBe('invalid_transition')
  })

  it('B/E: in_force → surrendered with known date after 12 months', async () => {
    const res = await recordOutcome(
      apps.surrenderOk,
      'surrendered',
      'm045qa surrendered after 12 months',
      AFTER_12,
    )
    expect(ppCode(res.error)).toBe('')
    expect(res.data?.status).toBe('surrendered')
    created.auditLogs.push(res.data.audit_id as string)
    const afterApp = await appRow(apps.surrenderOk)
    const afterPol = await policyRow(apps.surrenderOk)
    expect(afterApp.production_stage).toBe('in_force')
    expect(afterPol?.status).toBe('surrendered')
    expect(String(afterPol?.terminated_on).slice(0, 10)).toBe(AFTER_12)
  })

  it('D: canceled with known date on/after 12-month anniversary is rejected', async () => {
    const res = await recordOutcome(
      apps.cancelReject,
      'canceled',
      'm045qa canceled too late',
      ANNIVERSARY,
    )
    expect(ppCode(res.error)).toBe('invalid_payload')
    expect((await policyRow(apps.cancelReject))?.status).toBe('in_force')
    expect((await appRow(apps.cancelReject)).production_stage).toBe('in_force')
  })

  it('F: surrendered with known date inside first 12 months is rejected', async () => {
    const res = await recordOutcome(
      apps.surrenderReject,
      'surrendered',
      'm045qa surrendered too early',
      INSIDE_12,
    )
    expect(ppCode(res.error)).toBe('invalid_payload')
    expect((await policyRow(apps.surrenderReject))?.status).toBe('in_force')
  })

  it('G: null terminated_on is allowed with explicit status and reason', async () => {
    const res = await recordOutcome(
      apps.nullDate,
      'surrendered',
      'm045qa historical surrender date unknown',
      null,
    )
    expect(ppCode(res.error)).toBe('')
    created.auditLogs.push(res.data.audit_id as string)
    const afterPol = await policyRow(apps.nullDate)
    expect(afterPol?.status).toBe('surrendered')
    expect(afterPol?.terminated_on).toBeNull()
    expect((await appRow(apps.nullDate)).production_stage).toBe('in_force')
  })

  it('H: missing reason is rejected', async () => {
    const res = await recordOutcome(apps.cancelReject, 'canceled', null, INSIDE_12)
    expect(ppCode(res.error)).toBe('missing_required_fields')
  })

  it('I: issued application is rejected', async () => {
    const res = await recordOutcome(apps.issued, 'canceled', 'm045qa issued', INSIDE_12)
    expect(ppCode(res.error)).toBe('invalid_transition')
    expect((await appRow(apps.issued)).production_stage).toBe('issued')
  })

  it('J: withdrawn / not_taken / declined are rejected', async () => {
    for (const id of [apps.withdrawn, apps.notTaken, apps.declined]) {
      const res = await recordOutcome(id, 'canceled', 'm045qa closed', INSIDE_12)
      expect(ppCode(res.error), id).toBe('invalid_transition')
    }
  })

  it('K: unknown application returns a non-leaking not_found', async () => {
    const res = await recordOutcome(randomUUID(), 'canceled', 'm045qa missing', INSIDE_12)
    expect(ppCode(res.error)).toBe('not_found')
    expect(errMsg(res.error)).not.toMatch(/household|email|policy_number/i)
  })

  it('L/M: advisor and cross-household advisor access are rejected', async () => {
    const assigned = await recordOutcome(
      apps.cancelReject,
      'canceled',
      'm045qa advisor',
      INSIDE_12,
      advisorA,
    )
    expect(ppCode(assigned.error)).toBe('not_authorized')
    const cross = await recordOutcome(
      apps.cancelReject,
      'canceled',
      'm045qa advisor B',
      INSIDE_12,
      advisorB,
    )
    expect(ppCode(cross.error)).toBe('not_authorized')
  })

  it('N: direct authenticated policies UPDATE remains blocked', async () => {
    const policy = await policyRow(apps.cancelReject)
    const ownerDirect = await owner
      .from('policies')
      .update({ status: 'canceled', termination_reason: 'direct' })
      .eq('id', policy?.id)
    expect(errMsg(ownerDirect.error)).toMatch(/CRM_PP:not_authorized/)
    const advisorDirect = await advisorA
      .from('policies')
      .update({ status: 'surrendered' })
      .eq('id', policy?.id)
    expect(errMsg(advisorDirect.error)).toMatch(/CRM_PP:not_authorized/)
    expect((await policyRow(apps.cancelReject))?.status).toBe('in_force')
  })

  it('rejects terminated_on when no placement anchor exists rather than inventing one', async () => {
    const res = await recordOutcome(
      apps.nullAnchor,
      'canceled',
      'm045qa no anchor',
      INSIDE_12,
    )
    expect(ppCode(res.error)).toBe('invalid_payload')
    expect((await policyRow(apps.nullAnchor))?.status).toBe('in_force')
  })

  it('rejects chargeback and other non-lifecycle statuses', async () => {
    const res = await recordOutcome(apps.cancelReject, 'chargeback', 'm045qa chargeback', null)
    expect(ppCode(res.error)).toBe('invalid_payload')
  })

  it('L-regression: issued → in_force still works after 045', async () => {
    await placeInForce(apps.regression, `M045${runId}R1`, { issue: ANCHOR, inForce: ANCHOR })
    const app = await appRow(apps.regression)
    const policy = await policyRow(apps.regression)
    expect(app.production_stage).toBe('in_force')
    expect(policy?.status).toBe('in_force')
    expect(policy?.terminated_on).toBeNull()
  })

  it('R/S/T/U/V: lifecycle RPC does not change expected compensation, commissions, receivable, tasks, or activities', async () => {
    for (const id of created.applications) {
      if (id === apps.regression) continue
      expect(
        await countExact('policy_application_expected_compensations', 'application_id', id),
        id,
      ).toBe(expectedByApp[id])
      expect(
        await countExact('policy_writing_commission_events', 'application_id', id),
        id,
      ).toBe(commissionByApp[id] ?? 0)
    }
    expect(await countExact('tasks', 'household_id', householdId)).toBe(taskCount)
    expect(await countExact('activities', 'household_id', householdId)).toBe(activityCount)
    for (const id of [apps.cancelOk, apps.surrenderOk, apps.nullDate, apps.cancelReject]) {
      const row = await appRow(id)
      expect(row.writing_receivable_expected).toBe(true)
    }
  }, 30_000)

  it('W: audit row is created for a successful outcome', async () => {
    const policy = await policyRow(apps.surrenderOk)
    const { data, error } = await admin
      .from('audit_logs')
      .select('id, action, entity_table, entity_id, before, after, actor_user_id')
      .eq('action', 'record_policy_post_placement_outcome')
      .eq('entity_id', policy?.id)
    expect(errMsg(error)).toBe('')
    expect(data ?? []).not.toHaveLength(0)
    const row = data![0]
    expect(row.entity_table).toBe('policies')
    expect(row.after.status).toBe('surrendered')
    expect(row.after.application_id).toBe(apps.surrenderOk)
    expect(row.before.status).toBe('in_force')
    expect(row.actor_user_id).toBeTruthy()
  })

  it('Q: inventories synthetic QA rows before cleanup', async () => {
    const { count: appCount } = await admin
      .from('policy_applications')
      .select('id', { count: 'exact', head: true })
      .in('id', created.applications)
    const { count: polCount } = await admin
      .from('policies')
      .select('id', { count: 'exact', head: true })
      .in('source_application_id', created.applications)
    const { count: auditCount } = await admin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'record_policy_post_placement_outcome')
      .in('entity_id', created.policies)
    qaInventory = {
      applications: appCount ?? 0,
      policies: polCount ?? 0,
      lifecycleAudits: auditCount ?? 0,
      households: created.households.length,
    }
    expect(qaInventory.applications).toBeGreaterThan(0)
    expect(qaInventory.policies).toBeGreaterThan(0)
    expect(qaInventory.lifecycleAudits).toBeGreaterThan(0)
  }, 30_000)
})
