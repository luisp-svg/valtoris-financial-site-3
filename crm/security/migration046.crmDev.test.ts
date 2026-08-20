/**
 * Live CRM-dev integration for Migration 046 Opportunity → Case conversion.
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates isolated m046qa rows and deletes them in afterAll.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'm046qa'

const LIFE_VERTICAL = '11111111-1111-1111-1111-111111111101'
const PC_VERTICAL = '11111111-1111-1111-1111-111111111102'
const RETIREMENT_VERTICAL = '11111111-1111-1111-1111-111111111103'
const WILLS_VERTICAL = '11111111-1111-1111-1111-111111111104'
const LIFE_PIPELINE = '22222222-2222-2222-2222-222222222211'
const PC_PIPELINE = '22222222-2222-2222-2222-222222222212'
const RETIREMENT_PIPELINE = '22222222-2222-2222-2222-222222222213'
const WILLS_PIPELINE = '22222222-2222-2222-2222-222222222214'
const LIFE_IDENTIFIED = '33333333-3333-3333-3333-333333333101'
const LIFE_APP_STARTED = '33333333-3333-3333-3333-333333333104'
const LIFE_SUBMITTED = '33333333-3333-3333-3333-333333333105'
const LIFE_PLACED = '33333333-3333-3333-3333-333333333108'
const LIFE_LOST = '33333333-3333-3333-3333-333333333110'
const RETIREMENT_IDENTIFIED = '33333333-3333-3333-3333-333333333301'
const PC_IDENTIFIED = '33333333-3333-3333-3333-333333333201'
const WILLS_IDENTIFIED = '33333333-3333-3333-3333-333333333401'

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

describe.skipIf(!env)('migration 046 CRM-dev opportunity case conversion (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as NonNullable<typeof env>
  const runId = randomUUID().slice(0, 8)

  let admin: SupabaseClient
  let anon: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorB: SupabaseClient
  let advisorAProfileId = ''
  let householdId = ''
  let memberId = ''
  let foreignHouseholdId = ''
  let foreignMemberId = ''
  let lifeProduct: CatalogRow
  let fiaProduct: CatalogRow

  const created = {
    households: [] as string[],
    members: [] as string[],
    opportunities: [] as string[],
    applications: [] as string[],
    auditLogs: [] as string[],
  }

  async function signIn(email: string, password: string): Promise<SupabaseClient> {
    const client = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
    return client
  }

  function lifeParticipants(member: string) {
    return [
      { household_member_id: member, role: 'primary_client' },
      { household_member_id: member, role: 'insured' },
      { household_member_id: member, role: 'owner' },
    ]
  }

  function fiaParticipants(member: string) {
    return [
      { household_member_id: member, role: 'primary_client' },
      { household_member_id: member, role: 'annuitant' },
      { household_member_id: member, role: 'owner' },
    ]
  }

  function allocations(advisorId: string) {
    return [
      {
        recipient_type: 'advisor',
        advisor_id: advisorId,
        allocation_role: 'writing',
        commission_bps: 10000,
        production_credit_bps: 10000,
      },
    ]
  }

  async function seedOpportunity(over: Record<string, unknown>): Promise<string> {
    const nowIso = new Date().toISOString()
    const payload = {
      title: `${PREFIX} ${runId} ${String(over.title ?? 'opp')}`,
      household_id: householdId,
      service_vertical_id: LIFE_VERTICAL,
      pipeline_id: LIFE_PIPELINE,
      stage_id: LIFE_IDENTIFIED,
      assigned_advisor_id: advisorAProfileId,
      status: 'open',
      need_identified: true,
      stage_entered_at: nowIso,
      ...over,
    }
    const { data, error } = await admin.from('opportunities').insert(payload).select('id').single()
    if (error || !data?.id) throw new Error(`opportunity insert failed: ${errMsg(error)}`)
    created.opportunities.push(data.id as string)
    return data.id as string
  }

  async function convert(
    client: SupabaseClient,
    opportunityId: string,
    payload: Record<string, unknown>,
  ) {
    const res = await client.rpc('convert_opportunity_to_policy_application', {
      p_opportunity_id: opportunityId,
      p_payload: payload,
    })
    const id = res.data?.application_id as string | undefined
    if (typeof id === 'string' && !created.applications.includes(id)) created.applications.push(id)
    const auditId = res.data?.audit_id as string | undefined
    if (typeof auditId === 'string') created.auditLogs.push(auditId)
    return res
  }

  function lifePayload(over: Record<string, unknown> = {}) {
    return {
      carrier_id: lifeProduct.carrier_id,
      product_id: lifeProduct.id,
      product_line: lifeProduct.product_line,
      state: 'TX',
      participants: lifeParticipants(memberId),
      allocations: allocations(advisorAProfileId),
      ...over,
    }
  }

  function fiaPayload(over: Record<string, unknown> = {}) {
    return {
      carrier_id: fiaProduct.carrier_id,
      product_id: fiaProduct.id,
      product_line: 'fia',
      state: 'TX',
      participants: fiaParticipants(memberId),
      allocations: allocations(advisorAProfileId),
      ...over,
    }
  }

  async function cleanupQa(label: string) {
    const apps = created.applications
    const opps = created.opportunities
    if (apps.length) {
      await admin.from('policy_application_requirement_history').delete().in('application_id', apps)
      await admin.from('policy_application_requirements').delete().in('application_id', apps)
      await admin.from('policy_writing_commission_events').delete().in('application_id', apps)
      await admin.from('policy_writing_commission_accounts').delete().in('application_id', apps)
      await admin.from('policy_application_expected_compensations').delete().in('application_id', apps)
      await admin.from('policy_application_stage_history').delete().in('application_id', apps)
      await admin.from('policy_application_participants').delete().in('application_id', apps)
      await admin.from('policy_agent_allocations').delete().in('application_id', apps)
      await admin.from('policies').delete().in('source_application_id', apps)
      await admin.from('policy_applications').delete().in('id', apps)
    }
    if (created.auditLogs.length) {
      await admin.from('audit_logs').delete().in('id', created.auditLogs)
    }
    if (opps.length) {
      await admin.from('audit_logs').delete().in('entity_id', opps)
      await admin.from('activities').delete().in('opportunity_id', opps)
      await admin.from('opportunities').delete().in('id', opps)
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

    const leftover = {
      apps: apps.length
        ? ((await admin.from('policy_applications').select('id').in('id', apps)).data ?? [])
        : [],
      opps: opps.length
        ? ((await admin.from('opportunities').select('id').in('id', opps)).data ?? [])
        : [],
      households: created.households.length
        ? ((await admin.from('households').select('id').in('id', created.households)).data ?? [])
        : [],
    }
    expect(leftover.apps, `${label} application leftovers`).toEqual([])
    expect(leftover.opps, `${label} opportunity leftovers`).toEqual([])
    expect(leftover.households, `${label} household leftovers`).toEqual([])
  }

  beforeAll(async () => {
    admin = createClient(cfg.url, cfg.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(cfg.url, cfg.anon, {
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
    const fia = (products ?? []).find((p) => p.product_line === 'fia')
    if (!life || !fia) {
      throw new Error('CRM-dev catalog missing an active Life product or FIA product for m046qa')
    }
    lifeProduct = life as CatalogRow
    fiaProduct = fia as CatalogRow

    const clientRes = await owner.rpc('create_canonical_client', {
      p_payload: {
        first_name: 'M046qa',
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

    const foreignRes = await owner.rpc('create_canonical_client', {
      p_payload: {
        first_name: 'M046qaF',
        last_name: `${PREFIX} ${runId} F`,
        assigned_advisor_id: advisorAProfileId,
      },
    })
    if (foreignRes.error || !foreignRes.data?.household_id) {
      throw new Error(`foreign household failed: ${errMsg(foreignRes.error)}`)
    }
    foreignHouseholdId = foreignRes.data.household_id as string
    foreignMemberId = foreignRes.data.member_id as string
    created.households.push(foreignHouseholdId)
    created.members.push(foreignMemberId)
    if (foreignRes.data.audit_id) created.auditLogs.push(foreignRes.data.audit_id as string)
  }, 120_000)

  afterAll(async () => {
    if (!admin) return
    await cleanupQa('afterAll')
  }, 120_000)

  it('rejects anon and keeps the conversion RPC authenticated-only', async () => {
    const oppId = await seedOpportunity({ title: 'anon' })
    const res = await anon.rpc('convert_opportunity_to_policy_application', {
      p_opportunity_id: oppId,
      p_payload: lifePayload(),
    })
    expect(res.error).toBeTruthy()
  })

  it('A/D/Q/R/S/T/U/V/W/Y: owner converts eligible Life Opportunity to a draft with audit and no commissions', async () => {
    const oppId = await seedOpportunity({ title: 'owner-life' })
    const before = await admin.from('opportunities').select('status, closed_at, stage_id').eq('id', oppId).single()
    const res = await convert(owner, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('')
    expect(res.data?.ok).toBe(true)
    expect(res.data?.created).toBe(true)
    expect(res.data?.application_id).toBeTruthy()
    expect(res.data?.household_id).toBe(householdId)

    const appId = res.data.application_id as string
    const { data: app } = await admin
      .from('policy_applications')
      .select(
        'production_stage, submission_date, issue_date, in_force_date, household_id, opportunity_id, writing_receivable_expected',
      )
      .eq('id', appId)
      .single()
    expect(app?.production_stage).toBe('draft')
    expect(app?.submission_date).toBeNull()
    expect(app?.issue_date).toBeNull()
    expect(app?.in_force_date).toBeNull()
    expect(app?.household_id).toBe(householdId)
    expect(app?.opportunity_id).toBe(oppId)
    expect(app?.writing_receivable_expected).toBe(true)

    const { data: parts } = await admin
      .from('policy_application_participants')
      .select('id')
      .eq('application_id', appId)
      .is('effective_to', null)
    const { data: allocs } = await admin
      .from('policy_agent_allocations')
      .select('id')
      .eq('application_id', appId)
      .is('effective_to', null)
    expect((parts ?? []).length).toBeGreaterThanOrEqual(3)
    expect((allocs ?? []).length).toBeGreaterThanOrEqual(1)

    const { count: expectedCount } = await admin
      .from('policy_application_expected_compensations')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', appId)
    const { count: paidCount } = await admin
      .from('policy_writing_commission_events')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', appId)
    expect(expectedCount ?? 0).toBe(0)
    expect(paidCount ?? 0).toBe(0)

    const { data: history } = await admin
      .from('policy_application_stage_history')
      .select('from_stage, to_stage, reason')
      .eq('application_id', appId)
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from_stage: null, to_stage: 'draft', reason: 'created' }),
      ]),
    )

    const { data: audit } = await admin
      .from('audit_logs')
      .select('action, after')
      .eq('id', res.data.audit_id as string)
      .maybeSingle()
    expect(audit?.action).toBe('convert_opportunity_to_policy_application')
    expect((audit?.after as { opportunity_id?: string })?.opportunity_id).toBe(oppId)

    const after = await admin.from('opportunities').select('status, closed_at, stage_id').eq('id', oppId).single()
    expect(after.data?.status).toBe('open')
    expect(after.data?.closed_at).toBeNull()
    expect(after.data?.stage_id).toBe(LIFE_APP_STARTED)
    expect(before.data?.stage_id).toBe(LIFE_IDENTIFIED)
  })

  it('B: advisor converts an authorized Opportunity', async () => {
    const oppId = await seedOpportunity({ title: 'advisor-life' })
    const res = await convert(advisorA, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('')
    expect(res.data?.created).toBe(true)
  })

  it('C: unauthorized advisor is rejected', async () => {
    const oppId = await seedOpportunity({ title: 'unauth' })
    const res = await convert(advisorB, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('not_found')
  })

  it('E: Retirement + valid FIA creates a draft', async () => {
    const oppId = await seedOpportunity({
      title: 'ret-fia',
      service_vertical_id: RETIREMENT_VERTICAL,
      pipeline_id: RETIREMENT_PIPELINE,
      stage_id: RETIREMENT_IDENTIFIED,
    })
    const res = await convert(owner, oppId, fiaPayload())
    expect(ppCode(res.error)).toBe('')
    expect(res.data?.created).toBe(true)
    const { data: app } = await admin
      .from('policy_applications')
      .select('production_stage, product_line')
      .eq('id', res.data.application_id as string)
      .single()
    expect(app?.production_stage).toBe('draft')
    expect(app?.product_line).toBe('fia')
  })

  it('F: Retirement + non-FIA is rejected', async () => {
    const oppId = await seedOpportunity({
      title: 'ret-life',
      service_vertical_id: RETIREMENT_VERTICAL,
      pipeline_id: RETIREMENT_PIPELINE,
      stage_id: RETIREMENT_IDENTIFIED,
    })
    const res = await convert(owner, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('invalid_payload')
  })

  it('G: P&C is rejected', async () => {
    const oppId = await seedOpportunity({
      title: 'pc',
      service_vertical_id: PC_VERTICAL,
      pipeline_id: PC_PIPELINE,
      stage_id: PC_IDENTIFIED,
    })
    const res = await convert(owner, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('invalid_transition')
  })

  it('H: wills/trusts is rejected', async () => {
    const oppId = await seedOpportunity({
      title: 'wills',
      service_vertical_id: WILLS_VERTICAL,
      pipeline_id: WILLS_PIPELINE,
      stage_id: WILLS_IDENTIFIED,
    })
    const res = await convert(owner, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('invalid_transition')
  })

  it('I: lost is rejected', async () => {
    const oppId = await seedOpportunity({
      title: 'lost',
      status: 'lost',
      stage_id: LIFE_LOST,
      closed_at: new Date().toISOString(),
    })
    const res = await convert(owner, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('invalid_transition')
  })

  it('J: won conversion is allowed without reopening or changing closed_at', async () => {
    const closedAt = '2026-01-15T12:00:00.000Z'
    const oppId = await seedOpportunity({
      title: 'won',
      status: 'won',
      stage_id: LIFE_PLACED,
      closed_at: closedAt,
    })
    const res = await convert(owner, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('')
    expect(res.data?.created).toBe(true)
    const after = await admin
      .from('opportunities')
      .select('status, closed_at, stage_id')
      .eq('id', oppId)
      .single()
    expect(after.data?.status).toBe('won')
    expect(String(after.data?.closed_at)).toContain('2026-01-15')
    expect(after.data?.stage_id).toBe(LIFE_PLACED)
  })

  it('K: household cannot be substituted', async () => {
    const oppId = await seedOpportunity({ title: 'hh-sub' })
    const res = await convert(owner, oppId, lifePayload({ household_id: foreignHouseholdId }))
    expect(ppCode(res.error)).toBe('household_mismatch')
  })

  it('L: participant from another household is rejected', async () => {
    const oppId = await seedOpportunity({ title: 'foreign-member' })
    const res = await convert(
      owner,
      oppId,
      lifePayload({
        participants: lifeParticipants(foreignMemberId),
      }),
    )
    expect(ppCode(res.error)).toBe('household_mismatch')
  })

  it('M: invalid carrier/product is rejected', async () => {
    const oppId = await seedOpportunity({ title: 'bad-catalog' })
    const res = await convert(
      owner,
      oppId,
      lifePayload({ carrier_id: randomUUID(), product_id: randomUUID() }),
    )
    expect(['not_found', 'invalid_payload', 'catalog_inactive']).toContain(ppCode(res.error))
  })

  it('N: invalid writing allocation is rejected', async () => {
    const oppId = await seedOpportunity({ title: 'bad-alloc' })
    const res = await convert(
      owner,
      oppId,
      lifePayload({
        allocations: [
          {
            recipient_type: 'advisor',
            advisor_id: advisorAProfileId,
            allocation_role: 'writing',
            commission_bps: 5000,
            production_credit_bps: 5000,
          },
        ],
      }),
    )
    expect(ppCode(res.error)).toBe('invalid_allocations')
  })

  it('O/P: retry returns the same application with created=false and duplicate live create is blocked', async () => {
    const oppId = await seedOpportunity({ title: 'retry' })
    const first = await convert(owner, oppId, lifePayload())
    expect(first.data?.created).toBe(true)
    const appId = first.data.application_id as string
    const second = await convert(owner, oppId, lifePayload())
    expect(ppCode(second.error)).toBe('')
    expect(second.data?.created).toBe(false)
    expect(second.data?.application_id).toBe(appId)

    const [left, right] = await Promise.all([
      convert(owner, oppId, lifePayload()),
      convert(owner, oppId, lifePayload()),
    ])
    expect(ppCode(left.error)).toBe('')
    expect(ppCode(right.error)).toBe('')
    expect(left.data?.application_id).toBe(appId)
    expect(right.data?.application_id).toBe(appId)
    expect(left.data?.created).toBe(false)
    expect(right.data?.created).toBe(false)

    const direct = await owner.rpc('create_policy_application', {
      p_payload: {
        household_id: householdId,
        opportunity_id: oppId,
        ...lifePayload(),
      },
    })
    expect(direct.error).toBeTruthy()
  })

  it('X: does not move Submitted back to Application Started', async () => {
    const oppId = await seedOpportunity({
      title: 'already-submitted',
      stage_id: LIFE_SUBMITTED,
    })
    const res = await convert(owner, oppId, lifePayload())
    expect(ppCode(res.error)).toBe('')
    const after = await admin.from('opportunities').select('stage_id, status').eq('id', oppId).single()
    expect(after.data?.stage_id).toBe(LIFE_SUBMITTED)
    expect(after.data?.status).toBe('open')
  })
})
