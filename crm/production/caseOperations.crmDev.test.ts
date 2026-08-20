/**
 * CRM-dev Phase 2 Case Operations live QA.
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates isolated p2ops rows and deletes them in afterAll.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { saveCaseOperations } from './applicationApi'
import { buildCaseOperationsPayload, caseOperationsEligibility } from './caseOperationsView'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'p2ops'

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
} | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const ownerPass = process.env.DEV_OWNER_PASSWORD || ''
  const advisorAPass = process.env.DEV_ADVISOR_A_PASSWORD || ''
  if (!url || !anon || !service || !ownerPass || !advisorAPass) return null
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  if (host !== REQUIRED_HOST) return null
  if (/prod|production/i.test(host)) return null
  return { url, anon, service, ownerPass, advisorAPass }
}

const env = crmDevReady()

describe.skipIf(!env)('Phase 2 CRM-dev Case Operations (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as NonNullable<typeof env>
  const runId = randomUUID().slice(0, 8)
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorAProfileId = ''
  let householdId = ''
  let memberId = ''
  let lifeDraftId = ''
  let fiaId = ''
  let lifeIssuedId = ''
  let declinedId = ''
  const created = {
    households: [] as string[],
    applications: [] as string[],
  }

  async function signIn(email: string, password: string): Promise<SupabaseClient> {
    const client = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
    return client
  }

  async function appRow(id: string, cols: string): Promise<Record<string, unknown>> {
    const { data, error } = await admin.from('policy_applications').select(cols).eq('id', id).single()
    if (error || !data) throw new Error(`app row missing: ${error?.message}`)
    return data as unknown as Record<string, unknown>
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

  async function cleanupQa() {
    const apps = created.applications
    if (apps.length) {
      await admin.from('policy_application_requirement_history').delete().in('application_id', apps)
      await admin.from('policy_application_requirements').delete().in('application_id', apps)
      await admin.from('policy_writing_commission_events').delete().in('application_id', apps)
      await admin.from('policy_writing_commission_accounts').delete().in('application_id', apps)
      await admin.from('policy_application_expected_compensations').delete().in('application_id', apps)
      await admin.from('policies').delete().in('source_application_id', apps)
      await admin.from('policy_agent_allocations').delete().in('application_id', apps)
      await admin.from('policy_application_participants').delete().in('application_id', apps)
      await admin.from('policy_application_stage_history').delete().in('application_id', apps)
      await admin.from('policy_applications').delete().in('id', apps)
    }
    if (created.households.length) {
      await admin.from('audit_logs').delete().in('entity_id', created.households)
      await admin.from('notes').delete().in('household_id', created.households)
      await admin.from('household_members').delete().in('household_id', created.households)
      await admin.from('advisor_assignments').delete().in('household_id', created.households)
      await admin.from('households').delete().in('id', created.households)
    }
    if (apps.length) {
      const { data: left } = await admin.from('policy_applications').select('id').in('id', apps)
      expect(left ?? []).toEqual([])
    }
    if (created.households.length) {
      const { data: hhLeft } = await admin.from('households').select('id').in('id', created.households)
      expect(hhLeft ?? []).toEqual([])
    }
  }

  beforeAll(async () => {
    admin = createClient(cfg.url, cfg.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    owner = await signIn('owner.dev@valtoris.test', cfg.ownerPass)
    const advisorA = await signIn('advisor.a@valtoris.test', cfg.advisorAPass)
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
    const fia = (products ?? []).find((p) => p.product_line === 'fia')
    if (!life || !fia) throw new Error('CRM-dev catalog missing Life or FIA product for p2ops')

    const clientRes = await owner.rpc('create_canonical_client', {
      p_payload: {
        first_name: 'P2ops',
        last_name: `${PREFIX} ${runId}`,
        assigned_advisor_id: advisorAProfileId,
      },
    })
    if (clientRes.error || !clientRes.data?.household_id) {
      throw new Error(`create_canonical_client failed: ${clientRes.error?.message}`)
    }
    householdId = clientRes.data.household_id as string
    memberId = clientRes.data.member_id as string
    created.households.push(householdId)

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
      if (res.error || !id) throw new Error(`create_policy_application failed: ${res.error?.message}`)
      created.applications.push(id)
      return id
    }

    const lifePayload = {
      household_id: householdId,
      carrier_id: life.carrier_id,
      product_id: life.id,
      product_line: life.product_line,
      state: 'TX',
      submitted_premium_cents: 240000,
      premium_mode: 'annual',
      participants: lifeParticipants,
      allocations,
    }
    lifeDraftId = await newApp(lifePayload)
    lifeIssuedId = await newApp({ ...lifePayload })
    declinedId = await newApp({ ...lifePayload })
    fiaId = await newApp({
      household_id: householdId,
      carrier_id: fia.carrier_id,
      product_id: fia.id,
      product_line: 'fia',
      state: 'TX',
      annuity_deposit_cents: 25000000,
      participants: fiaParticipants,
      allocations,
    })

    const submitFia = await transition(fiaId, 'submitted', { fields: { submission_date: '2026-08-01' } })
    if (submitFia.error) throw new Error(`fia submit failed: ${submitFia.error.message}`)

    for (const id of [lifeIssuedId, declinedId]) {
      const submitted = await transition(id, 'submitted', { fields: { submission_date: '2026-08-01' } })
      if (submitted.error) throw new Error(`submit failed: ${submitted.error.message}`)
      const uw = await transition(id, 'in_underwriting')
      if (uw.error) throw new Error(`underwriting failed: ${uw.error.message}`)
    }
    const approved = await transition(lifeIssuedId, 'approved', { disposition: 'approved_as_applied' })
    if (approved.error) throw new Error(`approved failed: ${approved.error.message}`)
    const issued = await transition(lifeIssuedId, 'issued', {
      fields: { policy_number: `P2OPS-${runId}` },
    })
    if (issued.error) throw new Error(`issued failed: ${issued.error.message}`)
    const declined = await transition(declinedId, 'declined')
    if (declined.error) throw new Error(`declined failed: ${declined.error.message}`)
  }, 180_000)

  afterAll(async () => {
    if (!admin) return
    await cleanupQa()
  }, 120_000)

  it('sets, updates, and clears follow-up and notes without changing stage or money', async () => {
    const before = await appRow(
      lifeDraftId,
      'production_stage,policy_number,submitted_premium_cents,face_amount_cents,next_follow_up_date,notes,is_replacement',
    )
    const notesBefore = await admin.from('notes').select('id').eq('household_id', householdId)
    const expectedBefore = await admin
      .from('policy_application_expected_compensations')
      .select('id, amount_cents, superseded_at')
      .eq('application_id', lifeDraftId)
    const tasksBefore = await admin.from('tasks').select('id').eq('household_id', householdId)
    const activitiesBefore = await admin.from('activities').select('id').eq('household_id', householdId)

    const setFollow = await saveCaseOperations(owner, lifeDraftId, { next_follow_up_date: '2026-09-01' })
    expect(setFollow.ok).toBe(true)
    const updateFollow = await saveCaseOperations(owner, lifeDraftId, { next_follow_up_date: '2026-09-15' })
    expect(updateFollow.ok).toBe(true)
    const clearFollow = await saveCaseOperations(owner, lifeDraftId, { next_follow_up_date: null })
    expect(clearFollow.ok).toBe(true)
    const setNotes = await saveCaseOperations(owner, lifeDraftId, { notes: `${PREFIX} call carrier ${runId}` })
    expect(setNotes.ok).toBe(true)
    const updateNotes = await saveCaseOperations(owner, lifeDraftId, { notes: `${PREFIX} follow-up done ${runId}` })
    expect(updateNotes.ok).toBe(true)
    const clearNotes = await saveCaseOperations(owner, lifeDraftId, { notes: null })
    expect(clearNotes.ok).toBe(true)

    const after = await appRow(
      lifeDraftId,
      'production_stage,policy_number,submitted_premium_cents,face_amount_cents,next_follow_up_date,notes,is_replacement',
    )
    expect(after.production_stage).toBe(before.production_stage)
    expect(after.policy_number).toBe(before.policy_number)
    expect(after.submitted_premium_cents).toBe(before.submitted_premium_cents)
    expect(after.face_amount_cents).toBe(before.face_amount_cents)
    expect(after.next_follow_up_date).toBeNull()
    expect(after.notes).toBeNull()

    const notesAfter = await admin.from('notes').select('id').eq('household_id', householdId)
    expect((notesAfter.data ?? []).length).toBe((notesBefore.data ?? []).length)
    const expectedAfter = await admin
      .from('policy_application_expected_compensations')
      .select('id, amount_cents, superseded_at')
      .eq('application_id', lifeDraftId)
    expect(expectedAfter.data).toEqual(expectedBefore.data)
    const tasksAfter = await admin.from('tasks').select('id').eq('household_id', householdId)
    const activitiesAfter = await admin.from('activities').select('id').eq('household_id', householdId)
    expect((tasksAfter.data ?? []).length).toBe((tasksBefore.data ?? []).length)
    expect((activitiesAfter.data ?? []).length).toBe((activitiesBefore.data ?? []).length)
  }, 90_000)

  it('updates Life replacement and FIA replacement/exchange, and rejects delivery before issued', async () => {
    const lifeElig = caseOperationsEligibility({
      role: 'owner',
      stage: 'draft',
      productLine: 'life_term',
      deliveryStatus: 'pre_issue',
      deletedAt: null,
    })
    expect(lifeElig.exchange).toBe(false)
    const flagPayload = buildCaseOperationsPayload({
      eligibility: lifeElig,
      original: {
        nextFollowUpDate: '',
        notes: '',
        isReplacement: false,
        isExchangeOrTransfer: false,
        deliveryStatus: 'pre_issue',
      },
      draft: {
        nextFollowUpDate: '',
        notes: '',
        isReplacement: true,
        isExchangeOrTransfer: true,
        deliveryStatus: 'complete',
      },
    })
    expect(flagPayload.ok).toBe(true)
    if (flagPayload.ok) expect(flagPayload.payload).toEqual({ is_replacement: true })

    const lifeFlag = await saveCaseOperations(owner, lifeDraftId, { is_replacement: true })
    expect(lifeFlag.ok).toBe(true)
    const lifeRow = await appRow(lifeDraftId, 'is_replacement,is_exchange_or_transfer,production_stage')
    expect(lifeRow.is_replacement).toBe(true)
    expect(lifeRow.production_stage).toBe('draft')

    const fiaFlag = await saveCaseOperations(owner, fiaId, {
      is_replacement: true,
      is_exchange_or_transfer: true,
    })
    expect(fiaFlag.ok).toBe(true)
    const fiaRow = await appRow(fiaId, 'is_replacement,is_exchange_or_transfer,production_stage')
    expect(fiaRow.is_replacement).toBe(true)
    expect(fiaRow.is_exchange_or_transfer).toBe(true)
    expect(fiaRow.production_stage).toBe('submitted')

    const tooEarly = await saveCaseOperations(owner, lifeDraftId, { delivery_status: 'with_agent' })
    expect(tooEarly.ok).toBe(false)
    const stillDraft = await appRow(lifeDraftId, 'delivery_status,production_stage')
    expect(stillDraft.delivery_status).toBe('pre_issue')
    expect(stillDraft.production_stage).toBe('draft')
  }, 90_000)

  it('updates issued delivery progress and keeps not_required off this path', async () => {
    const issuedBefore = await appRow(
      lifeIssuedId,
      'production_stage,delivery_status,policy_number,submitted_premium_cents',
    )
    expect(issuedBefore.production_stage).toBe('issued')

    const moved = await saveCaseOperations(owner, lifeIssuedId, { delivery_status: 'with_client' })
    expect(moved.ok).toBe(true)
    const complete = await saveCaseOperations(owner, lifeIssuedId, { delivery_status: 'complete' })
    expect(complete.ok).toBe(true)
    const notRequired = await owner.rpc('update_policy_application', {
      p_id: lifeIssuedId,
      p_payload: { delivery_status: 'not_required' },
    })
    expect(notRequired.error?.message ?? '').toMatch(/invalid_delivery_status/)

    const issuedAfter = await appRow(
      lifeIssuedId,
      'production_stage,delivery_status,policy_number,submitted_premium_cents,in_force_date',
    )
    expect(issuedAfter.production_stage).toBe('issued')
    expect(issuedAfter.delivery_status).toBe('complete')
    expect(issuedAfter.policy_number).toBe(issuedBefore.policy_number)
    expect(issuedAfter.submitted_premium_cents).toBe(issuedBefore.submitted_premium_cents)
    expect(issuedAfter.in_force_date).toBeNull()
  }, 90_000)

  it('allows notes and follow-up on declined and rejects flags', async () => {
    const declinedElig = caseOperationsEligibility({
      role: 'owner',
      stage: 'declined',
      productLine: 'life_term',
      deliveryStatus: 'pre_issue',
      deletedAt: null,
    })
    expect(declinedElig).toEqual({
      followUp: true,
      notes: true,
      replacement: false,
      exchange: false,
      delivery: false,
    })

    const note = await saveCaseOperations(owner, declinedId, {
      notes: `${PREFIX} declined follow ${runId}`,
      next_follow_up_date: '2026-10-01',
    })
    expect(note.ok).toBe(true)
    const flag = await saveCaseOperations(owner, declinedId, { is_replacement: true })
    expect(flag.ok).toBe(false)
    const row = await appRow(
      declinedId,
      'production_stage,notes,next_follow_up_date,is_replacement,submitted_premium_cents',
    )
    expect(row.production_stage).toBe('declined')
    expect(row.notes).toBe(`${PREFIX} declined follow ${runId}`)
    expect(String(row.next_follow_up_date).slice(0, 10)).toBe('2026-10-01')
    expect(row.is_replacement).toBe(false)
  }, 90_000)
})
