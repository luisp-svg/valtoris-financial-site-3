/**
 * Live CRM-dev integration for Migration 044 policy application requirements.
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates isolated m044qa rows and deletes them in afterAll.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'm044qa'

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

describe.skipIf(!env)('migration 044 CRM-dev requirements (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as NonNullable<typeof env>
  const runId = randomUUID().slice(0, 8)

  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorB: SupabaseClient

  let ownerUserId = ''
  let advisorAUserId = ''
  let advisorAProfileId = ''

  let householdId = ''
  let memberId = ''
  let lifeDraftId = ''
  let lifeId = ''
  let fiaId = ''

  let lifeProduct: CatalogRow
  let fiaProduct: CatalogRow

  const created = {
    households: [] as string[],
    members: [] as string[],
    applications: [] as string[],
    requirements: [] as string[],
    auditLogs: [] as string[],
  }

  let appBoundary: Record<
    string,
    {
      production_stage: string
      delivery_status: string
      updated_at: string
    }
  > = {}
  let taskCount = 0
  let activityCount = 0
  let expectedCompCount = 0
  let commissionEventCount = 0

  async function signIn(email: string, password: string): Promise<SupabaseClient> {
    const client = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
    return client
  }

  async function createReq(
    client: SupabaseClient,
    applicationId: string,
    code: string,
    extra: {
      custom_label?: string | null
      due_date?: string | null
      scheduled_for?: string | null
    } = {},
  ) {
    const res = await client.rpc('create_policy_application_requirement', {
      p_application_id: applicationId,
      p_code: code,
      p_custom_label: extra.custom_label ?? null,
      p_due_date: extra.due_date ?? null,
      p_scheduled_for: extra.scheduled_for ?? null,
    })
    const id = res.data?.requirement?.id as string | undefined
    if (typeof id === 'string') created.requirements.push(id)
    return res
  }

  async function transitionReq(
    client: SupabaseClient,
    id: string,
    toStatus: string,
    extra: { scheduled_for?: string | null; reason?: string | null } = {},
  ) {
    return client.rpc('transition_policy_application_requirement_status', {
      p_id: id,
      p_to_status: toStatus,
      p_scheduled_for: extra.scheduled_for ?? null,
      p_reason: extra.reason ?? null,
    })
  }

  async function countExact(
    table: string,
    column: string,
    value: string,
  ): Promise<number> {
    const { count, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, value)
    if (error) throw error
    return count ?? 0
  }

  async function snapshotApps() {
    const ids = [lifeDraftId, lifeId, fiaId].filter(Boolean)
    const { data, error } = await admin
      .from('policy_applications')
      .select('id, production_stage, delivery_status, updated_at')
      .in('id', ids)
    if (error) throw error
    const next: typeof appBoundary = {}
    for (const row of data ?? []) {
      next[row.id as string] = {
        production_stage: row.production_stage as string,
        delivery_status: row.delivery_status as string,
        updated_at: row.updated_at as string,
      }
    }
    return next
  }

  async function cleanupQa(label: string) {
    const apps = created.applications
    const reqsBefore = apps.length
      ? await admin
          .from('policy_application_requirements')
          .select('id, application_id, requirement_code, status, deleted_at, custom_label')
          .in('application_id', apps)
      : { data: [] as Record<string, unknown>[] }
    const histBefore = apps.length
      ? await admin
          .from('policy_application_requirement_history')
          .select('id, requirement_id, from_status, to_status, reason')
          .in('application_id', apps)
      : { data: [] as Record<string, unknown>[] }

    const leftoverReqs = reqsBefore.data ?? []
    const leftoverHist = histBefore.data ?? []
    if (leftoverReqs.length || leftoverHist.length) {
      // Enumerable QA inventory before deletion.
      expect(leftoverReqs.every((row) => apps.includes(row.application_id as string))).toBe(true)
    }

    if (apps.length) {
      await admin.from('policy_application_requirement_history').delete().in('application_id', apps)
      await admin.from('policy_application_requirements').delete().in('application_id', apps)
      await admin.from('policy_writing_commission_events').delete().in('application_id', apps)
      await admin.from('policy_writing_commission_accounts').delete().in('application_id', apps)
      await admin.from('policy_application_expected_compensations').delete().in('application_id', apps)
      await admin.from('policies').delete().in('source_application_id', apps)
      await admin.from('policy_applications').delete().in('id', apps)
    }
    if (created.auditLogs.length) {
      await admin.from('audit_logs').delete().in('id', created.auditLogs)
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

    if (apps.length) {
      const { data: reqLeft } = await admin
        .from('policy_application_requirements')
        .select('id')
        .in('application_id', apps)
      const { data: histLeft } = await admin
        .from('policy_application_requirement_history')
        .select('id')
        .in('application_id', apps)
      const { data: appLeft } = await admin.from('policy_applications').select('id').in('id', apps)
      expect(reqLeft ?? [], `${label} requirement leftovers`).toEqual([])
      expect(histLeft ?? [], `${label} history leftovers`).toEqual([])
      expect(appLeft ?? [], `${label} application leftovers`).toEqual([])
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

    const ownerUser = await owner.auth.getUser()
    const advAUser = await advisorA.auth.getUser()
    ownerUserId = ownerUser.data.user?.id ?? ''
    advisorAUserId = advAUser.data.user?.id ?? ''
    expect(ownerUserId).toBeTruthy()
    expect(advisorAUserId).toBeTruthy()

    const { data: advProfile, error: advErr } = await admin
      .from('advisor_profiles')
      .select('id')
      .eq('user_id', advisorAUserId)
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
    const fia = (products ?? []).find((p) => p.product_line === 'fia')
    if (!life || !fia) {
      throw new Error('CRM-dev catalog missing an active Life product or FIA product for m044qa')
    }
    lifeProduct = life as CatalogRow
    fiaProduct = fia as CatalogRow

    const clientRes = await owner.rpc('create_canonical_client', {
      p_payload: {
        first_name: 'M044qa',
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

    const lifeParticipants = [
      { household_member_id: memberId, role: 'primary_client' },
      { household_member_id: memberId, role: 'insured' },
      { household_member_id: memberId, role: 'owner' },
    ]
    const fiaParticipants = [
      { household_member_id: memberId, role: 'primary_client' },
      { household_member_id: memberId, role: 'owner' },
      { household_member_id: memberId, role: 'annuitant' },
    ]
    const allocations = [
      {
        recipient_type: 'advisor',
        advisor_id: advisorAProfileId,
        allocation_role: 'writing',
        commission_bps: 10000,
        production_credit_bps: 10000,
        contract_level_snapshot: '100%',
      },
    ]

    async function newApp(payload: Record<string, unknown>): Promise<string> {
      const res = await owner.rpc('create_policy_application', { p_payload: payload })
      const id = res.data?.application_id as string | undefined
      if (res.error || !id) throw new Error(`create_policy_application failed: ${errMsg(res.error)}`)
      created.applications.push(id)
      return id
    }

    lifeDraftId = await newApp({
      household_id: householdId,
      carrier_id: lifeProduct.carrier_id,
      product_id: lifeProduct.id,
      product_line: lifeProduct.product_line,
      state: 'TX',
      submitted_premium_cents: 240000,
      premium_mode: 'annual',
      participants: lifeParticipants,
      allocations,
    })
    lifeId = await newApp({
      household_id: householdId,
      carrier_id: lifeProduct.carrier_id,
      product_id: lifeProduct.id,
      product_line: lifeProduct.product_line,
      state: 'TX',
      submitted_premium_cents: 240000,
      premium_mode: 'annual',
      participants: lifeParticipants,
      allocations,
    })
    fiaId = await newApp({
      household_id: householdId,
      carrier_id: fiaProduct.carrier_id,
      product_id: fiaProduct.id,
      product_line: 'fia',
      state: 'TX',
      annuity_deposit_cents: 25000000,
      participants: fiaParticipants,
      allocations,
    })

    const submitLife = await owner.rpc('transition_policy_application_stage', {
      p_application_id: lifeId,
      p_to_stage: 'submitted',
      p_disposition: null,
      p_delivery_status: null,
      p_reason: null,
      p_fields: { submission_date: '2026-08-01' },
    })
    if (submitLife.error) throw new Error(`life submit failed: ${errMsg(submitLife.error)}`)
    const submitFia = await owner.rpc('transition_policy_application_stage', {
      p_application_id: fiaId,
      p_to_stage: 'submitted',
      p_disposition: null,
      p_delivery_status: null,
      p_reason: null,
      p_fields: { submission_date: '2026-08-01' },
    })
    if (submitFia.error) throw new Error(`fia submit failed: ${errMsg(submitFia.error)}`)

    appBoundary = await snapshotApps()
    taskCount = await countExact('tasks', 'household_id', householdId)
    activityCount = await countExact('activities', 'household_id', householdId)
    expectedCompCount =
      (await countExact('policy_application_expected_compensations', 'application_id', lifeId)) +
      (await countExact('policy_application_expected_compensations', 'application_id', fiaId))
    commissionEventCount =
      (await countExact('policy_writing_commission_events', 'application_id', lifeId)) +
      (await countExact('policy_writing_commission_events', 'application_id', fiaId))
  }, 120_000)

  afterAll(async () => {
    if (!admin) return
    await cleanupQa('afterAll')
  }, 120_000)

  it('ACCESS: owner and assigned advisor can SELECT; cross-household and direct DML are blocked', async () => {
    const createdRow = await createReq(owner, lifeId, 'signature')
    expect(ppCode(createdRow.error)).toBe('')
    const reqId = createdRow.data.requirement.id as string

    const ownerSel = await owner
      .from('policy_application_requirements')
      .select('id, status')
      .eq('id', reqId)
      .maybeSingle()
    expect(errMsg(ownerSel.error)).toBe('')
    expect(ownerSel.data?.id).toBe(reqId)

    const advSel = await advisorA
      .from('policy_application_requirements')
      .select('id, status')
      .eq('id', reqId)
      .maybeSingle()
    expect(errMsg(advSel.error)).toBe('')
    expect(advSel.data?.id).toBe(reqId)

    const cross = await advisorB
      .from('policy_application_requirements')
      .select('id')
      .eq('id', reqId)
      .maybeSingle()
    expect(cross.data).toBeNull()

    const unauthorized = await advisorB.rpc('create_policy_application_requirement', {
      p_application_id: lifeId,
      p_code: 'signature',
      p_custom_label: null,
      p_due_date: null,
      p_scheduled_for: null,
    })
    expect(ppCode(unauthorized.error)).toBe('not_found')

    const missing = await advisorA.rpc('create_policy_application_requirement', {
      p_application_id: randomUUID(),
      p_code: 'signature',
      p_custom_label: null,
      p_due_date: null,
      p_scheduled_for: null,
    })
    expect(ppCode(missing.error)).toBe('not_found')

    const directInsert = await advisorA.from('policy_application_requirements').insert({
      application_id: lifeId,
      requirement_code: 'delivery',
      status: 'open',
      created_by_user_id: advisorAUserId,
      updated_by_user_id: advisorAUserId,
    })
    expect(directInsert.error).toBeTruthy()

    const directUpdate = await advisorA
      .from('policy_application_requirements')
      .update({ due_date: '2026-09-01' })
      .eq('id', reqId)
    expect(directUpdate.error).toBeTruthy()

    const directDelete = await advisorA.from('policy_application_requirements').delete().eq('id', reqId)
    expect(directDelete.error).toBeTruthy()

    const hist = await owner
      .from('policy_application_requirement_history')
      .select('id')
      .eq('requirement_id', reqId)
      .limit(1)
      .maybeSingle()
    expect(hist.data?.id).toBeTruthy()

    const histInsert = await advisorA.from('policy_application_requirement_history').insert({
      requirement_id: reqId,
      application_id: lifeId,
      to_status: 'open',
    })
    expect(histInsert.error).toBeTruthy()
    const histUpdate = await advisorA
      .from('policy_application_requirement_history')
      .update({ reason: 'nope' })
      .eq('requirement_id', reqId)
    expect(histUpdate.error).toBeTruthy()
    const histDelete = await advisorA
      .from('policy_application_requirement_history')
      .delete()
      .eq('requirement_id', reqId)
    expect(histDelete.error).toBeTruthy()
  })

  it('CREATE: product-line legality, other-label rules, and draft parent rejection', async () => {
    const uniLife = await createReq(advisorA, lifeId, 'signature')
    expect(ppCode(uniLife.error)).toBe('')
    expect(uniLife.data.requirement.status).toBe('open')
    expect(uniLife.data.requirement.created_by_user_id).toBe(advisorAUserId)

    const uniFia = await createReq(advisorA, fiaId, 'delivery')
    expect(ppCode(uniFia.error)).toBe('')

    const lifeOnly = await createReq(owner, lifeId, 'aps')
    expect(ppCode(lifeOnly.error)).toBe('')

    const fiaOnly = await createReq(owner, fiaId, 'funds')
    expect(ppCode(fiaOnly.error)).toBe('')

    expect(ppCode((await createReq(owner, fiaId, 'paramed_exam')).error)).toBe(
      'invalid_requirement_code',
    )
    expect(ppCode((await createReq(owner, lifeId, 'suitability')).error)).toBe(
      'invalid_requirement_code',
    )
    expect(ppCode((await createReq(owner, lifeId, 'other')).error)).toBe('invalid_payload')
    expect(ppCode((await createReq(owner, lifeId, 'other', { custom_label: '   ' })).error)).toBe(
      'invalid_payload',
    )
    expect(
      ppCode((await createReq(owner, lifeId, 'other', { custom_label: 'x'.repeat(81) })).error),
    ).toBe('invalid_payload')

    const otherOk = await createReq(owner, lifeId, 'other', { custom_label: ' APS packet copy ' })
    expect(ppCode(otherOk.error)).toBe('')
    expect(otherOk.data.requirement.custom_label).toBe('APS packet copy')

    const draft = await createReq(owner, lifeDraftId, 'signature')
    expect(ppCode(draft.error)).toBe('invalid_payload')

    const scheduledCreate = await createReq(owner, lifeId, 'illustration', {
      scheduled_for: '2026-09-15',
    })
    expect(ppCode(scheduledCreate.error)).toBe('')
    expect(scheduledCreate.data.requirement.status).toBe('scheduled')
    expect(scheduledCreate.data.requirement.scheduled_for).toBe('2026-09-15')
  })

  it('STATUS: approved matrix, scheduled_for, reopen reason, and server timestamps', async () => {
    const createdRow = await createReq(owner, lifeId, 'replacement_form')
    expect(ppCode(createdRow.error)).toBe('')
    const id = createdRow.data.requirement.id as string

    const noSched = await transitionReq(owner, id, 'scheduled')
    expect(ppCode(noSched.error)).toBe('invalid_payload')

    const toSched = await transitionReq(advisorA, id, 'scheduled', { scheduled_for: '2026-10-01' })
    expect(ppCode(toSched.error)).toBe('')
    expect(toSched.data.requirement.status).toBe('scheduled')
    expect(toSched.data.requirement.updated_by_user_id).toBe(advisorAUserId)

    const backOpen = await transitionReq(owner, id, 'open')
    expect(ppCode(backOpen.error)).toBe('')
    expect(backOpen.data.requirement.status).toBe('open')

    const toComplete = await transitionReq(owner, id, 'complete')
    expect(ppCode(toComplete.error)).toBe('')
    expect(toComplete.data.requirement.status).toBe('complete')
    expect(toComplete.data.requirement.completed_at).toBeTruthy()
    expect(toComplete.data.requirement.waived_at).toBeNull()

    expect(ppCode((await transitionReq(owner, id, 'open')).error)).toBe('missing_required_fields')
    const reopenComplete = await transitionReq(owner, id, 'open', {
      reason: 'm044qa reopen after complete',
    })
    expect(ppCode(reopenComplete.error)).toBe('')
    expect(reopenComplete.data.requirement.status).toBe('open')
    expect(reopenComplete.data.requirement.completed_at).toBeNull()
    expect(reopenComplete.data.requirement.waived_at).toBeNull()

    const toWaived = await transitionReq(owner, id, 'waived')
    expect(ppCode(toWaived.error)).toBe('')
    expect(toWaived.data.requirement.waived_at).toBeTruthy()
    expect(toWaived.data.requirement.completed_at).toBeNull()

    expect(ppCode((await transitionReq(owner, id, 'open')).error)).toBe('missing_required_fields')
    const reopenWaived = await transitionReq(owner, id, 'open', {
      reason: 'm044qa reopen after waived',
    })
    expect(ppCode(reopenWaived.error)).toBe('')
    expect(reopenWaived.data.requirement.waived_at).toBeNull()

    const toCancel = await transitionReq(owner, id, 'cancelled')
    expect(ppCode(toCancel.error)).toBe('')
    expect(ppCode((await transitionReq(owner, id, 'open', { reason: 'nope' })).error)).toBe(
      'invalid_requirement_transition',
    )

    const { data: hist } = await admin
      .from('policy_application_requirement_history')
      .select('from_status, to_status, reason, changed_by_user_id')
      .eq('requirement_id', id)
      .order('changed_at', { ascending: true })
    expect(hist?.[0]).toMatchObject({ from_status: null, to_status: 'open' })
    expect(hist?.some((row) => row.reason === 'm044qa reopen after complete')).toBe(true)
    expect(hist?.some((row) => row.reason === 'm044qa reopen after waived')).toBe(true)
  })

  it('AUDIT: created_by / updated_by come from auth.uid() and history is append-only', async () => {
    const row = await createReq(advisorA, fiaId, 'suitability')
    expect(ppCode(row.error)).toBe('')
    const id = row.data.requirement.id as string
    expect(row.data.requirement.created_by_user_id).toBe(advisorAUserId)
    expect(row.data.requirement.updated_by_user_id).toBe(advisorAUserId)

    const updated = await owner.rpc('update_policy_application_requirement', {
      p_id: id,
      p_fields: { due_date: '2026-11-01' },
    })
    expect(ppCode(updated.error)).toBe('')
    expect(updated.data.requirement.due_date).toBe('2026-11-01')
    expect(updated.data.requirement.status).toBe('open')
    expect(updated.data.requirement.updated_by_user_id).toBe(ownerUserId)

    const silentStatus = await owner.rpc('update_policy_application_requirement', {
      p_id: id,
      p_fields: { scheduled_for: '2026-11-02' },
    })
    expect(ppCode(silentStatus.error)).toBe('')
    expect(silentStatus.data.requirement.status).toBe('open')
    expect(silentStatus.data.requirement.scheduled_for).toBe('2026-11-02')
  })

  it('OWNER DELETE: owner soft-deletes; advisor is blocked; advisor SELECT hides deleted rows', async () => {
    const row = await createReq(advisorA, lifeId, 'initial_premium')
    expect(ppCode(row.error)).toBe('')
    const id = row.data.requirement.id as string

    const advDel = await advisorA.rpc('soft_delete_policy_application_requirement', { p_id: id })
    expect(ppCode(advDel.error)).toBe('not_authorized')

    const ownerDel = await owner.rpc('soft_delete_policy_application_requirement', { p_id: id })
    expect(ppCode(ownerDel.error)).toBe('')
    expect(ownerDel.data.requirement.deleted_at).toBeTruthy()
    expect(ownerDel.data.requirement.updated_by_user_id).toBe(ownerUserId)

    const advSel = await advisorA
      .from('policy_application_requirements')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    expect(advSel.data).toBeNull()

    const ownerSel = await owner
      .from('policy_application_requirements')
      .select('id, deleted_at, status')
      .eq('id', id)
      .maybeSingle()
    expect(ownerSel.data?.deleted_at).toBeTruthy()
    expect(ownerSel.data?.status).toBe('open')

    const stillThere = await admin
      .from('policy_application_requirements')
      .select('id, deleted_at')
      .eq('id', id)
      .maybeSingle()
    expect(stillThere.data?.id).toBe(id)
    expect(stillThere.data?.deleted_at).toBeTruthy()

    const { data: delHist } = await admin
      .from('policy_application_requirement_history')
      .select('from_status, to_status, reason')
      .eq('requirement_id', id)
      .eq('reason', 'soft_delete')
      .maybeSingle()
    expect(delHist).toMatchObject({ from_status: 'open', to_status: 'open', reason: 'soft_delete' })
  })

  it('BOUNDARIES: production_stage, delivery_status, tasks, activities, and commissions stay unchanged', async () => {
    const after = await snapshotApps()
    expect(after[lifeId]).toEqual(appBoundary[lifeId])
    expect(after[fiaId]).toEqual(appBoundary[fiaId])
    expect(after[lifeDraftId]).toEqual(appBoundary[lifeDraftId])
    expect(await countExact('tasks', 'household_id', householdId)).toBe(taskCount)
    expect(await countExact('activities', 'household_id', householdId)).toBe(activityCount)
    expect(
      (await countExact('policy_application_expected_compensations', 'application_id', lifeId)) +
        (await countExact('policy_application_expected_compensations', 'application_id', fiaId)),
    ).toBe(expectedCompCount)
    expect(
      (await countExact('policy_writing_commission_events', 'application_id', lifeId)) +
        (await countExact('policy_writing_commission_events', 'application_id', fiaId)),
    ).toBe(commissionEventCount)
  })
})
