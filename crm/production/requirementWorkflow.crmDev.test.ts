/**
 * CRM-dev Phase 2B live QA through the browser requirement API wrappers.
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates isolated m2bqa rows and deletes them in afterAll.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createPolicyApplicationRequirement,
  fetchApplicationRequirementHistory,
  fetchApplicationRequirements,
  softDeletePolicyApplicationRequirement,
  transitionPolicyApplicationRequirementStatus,
  updatePolicyApplicationRequirement,
} from './requirementApi'
import { requirementCodesForProductLine } from './requirementCatalog'
import { previewCommonRequirements } from './requirementView'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'm2bqa'

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

describe.skipIf(!env)('Phase 2B CRM-dev requirement workflow (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as NonNullable<typeof env>
  const runId = randomUUID().slice(0, 8)
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorAProfileId = ''
  let householdId = ''
  let memberId = ''
  let lifeId = ''
  let fiaId = ''
  const created = {
    households: [] as string[],
    applications: [] as string[],
    auditLogs: [] as string[],
  }

  async function signIn(email: string, password: string): Promise<SupabaseClient> {
    const client = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
    return client
  }

  async function cleanupQa() {
    const apps = created.applications
    if (apps.length) {
      const { data: reqs } = await admin
        .from('policy_application_requirements')
        .select('id, application_id, requirement_code, status')
        .in('application_id', apps)
      expect((reqs ?? []).every((row) => apps.includes(row.application_id as string))).toBe(true)
      await admin.from('policy_application_requirement_history').delete().in('application_id', apps)
      await admin.from('policy_application_requirements').delete().in('application_id', apps)
      await admin.from('policy_writing_commission_events').delete().in('application_id', apps)
      await admin.from('policy_writing_commission_accounts').delete().in('application_id', apps)
      await admin.from('policy_application_expected_compensations').delete().in('application_id', apps)
      await admin.from('policies').delete().in('source_application_id', apps)
      await admin.from('policy_applications').delete().in('id', apps)
    }
    if (created.households.length) {
      await admin.from('audit_logs').delete().in('entity_id', created.households)
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
      expect(reqLeft ?? []).toEqual([])
      expect(histLeft ?? []).toEqual([])
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
    advisorA = await signIn('advisor.a@valtoris.test', cfg.advisorAPass)
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
    if (!life || !fia) throw new Error('CRM-dev catalog missing Life or FIA product for m2bqa')

    const clientRes = await owner.rpc('create_canonical_client', {
      p_payload: {
        first_name: 'M2bqa',
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
      if (res.error || !id) throw new Error(`create_policy_application failed: ${res.error?.message}`)
      created.applications.push(id)
      return id
    }

    lifeId = await newApp({
      household_id: householdId,
      carrier_id: life.carrier_id,
      product_id: life.id,
      product_line: life.product_line,
      state: 'TX',
      submitted_premium_cents: 240000,
      premium_mode: 'annual',
      participants: lifeParticipants,
      allocations,
    })
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
    for (const id of [lifeId, fiaId]) {
      const submit = await owner.rpc('transition_policy_application_stage', {
        p_application_id: id,
        p_to_stage: 'submitted',
        p_disposition: null,
        p_delivery_status: null,
        p_reason: null,
        p_fields: { submission_date: '2026-08-01' },
      })
      if (submit.error) throw new Error(`submit failed: ${submit.error.message}`)
    }
  }, 120_000)

  afterAll(async () => {
    if (!admin) return
    await cleanupQa()
  }, 120_000)

  it('LIFE: empty list, catalog constraints, schedule/due/complete/reopen/waive/cancel/delete', async () => {
    expect(await fetchApplicationRequirements(advisorA, lifeId)).toEqual([])
    expect(requirementCodesForProductLine('life_term')).not.toContain('suitability')
    expect(requirementCodesForProductLine('life_term')).toContain('paramed_exam')

    const missingLabel = await createPolicyApplicationRequirement(advisorA, {
      applicationId: lifeId,
      code: 'other',
    })
    expect(missingLabel.ok).toBe(false)

    const universal = await createPolicyApplicationRequirement(advisorA, {
      applicationId: lifeId,
      code: 'signature',
    })
    expect(universal.ok).toBe(true)
    const lifeOnly = await createPolicyApplicationRequirement(advisorA, {
      applicationId: lifeId,
      code: 'paramed_exam',
    })
    expect(lifeOnly.ok).toBe(true)
    const fiaOnLife = await createPolicyApplicationRequirement(advisorA, {
      applicationId: lifeId,
      code: 'funds',
    })
    expect(fiaOnLife.ok).toBe(false)
    const other = await createPolicyApplicationRequirement(advisorA, {
      applicationId: lifeId,
      code: 'other',
      customLabel: 'Carrier illustration reprint',
    })
    expect(other.ok).toBe(true)

    const id = universal.ok ? universal.data.id : ''
    const scheduled = await transitionPolicyApplicationRequirementStatus(advisorA, {
      id,
      toStatus: 'scheduled',
      scheduledFor: '2026-09-15',
    })
    expect(scheduled.ok).toBe(true)
    const due = await updatePolicyApplicationRequirement(advisorA, id, { due_date: '2026-09-20' })
    expect(due.ok).toBe(true)
    if (due.ok) expect(due.data.status).toBe('scheduled')

    const opened = await transitionPolicyApplicationRequirementStatus(advisorA, {
      id,
      toStatus: 'open',
    })
    expect(opened.ok).toBe(true)
    const complete = await transitionPolicyApplicationRequirementStatus(advisorA, {
      id,
      toStatus: 'complete',
    })
    expect(complete.ok).toBe(true)
    const reopenMissing = await transitionPolicyApplicationRequirementStatus(advisorA, {
      id,
      toStatus: 'open',
    })
    expect(reopenMissing.ok).toBe(false)
    const reopen = await transitionPolicyApplicationRequirementStatus(advisorA, {
      id,
      toStatus: 'open',
      reason: 'm2bqa carrier asked again',
    })
    expect(reopen.ok).toBe(true)

    const waiveId = lifeOnly.ok ? lifeOnly.data.id : ''
    expect(
      (await transitionPolicyApplicationRequirementStatus(advisorA, { id: waiveId, toStatus: 'waived' }))
        .ok,
    ).toBe(true)
    const cancelId = other.ok ? other.data.id : ''
    expect(
      (await transitionPolicyApplicationRequirementStatus(advisorA, { id: cancelId, toStatus: 'cancelled' }))
        .ok,
    ).toBe(true)

    const advisorDelete = await softDeletePolicyApplicationRequirement(advisorA, id)
    expect(advisorDelete.ok).toBe(false)
    const ownerDelete = await softDeletePolicyApplicationRequirement(owner, id)
    expect(ownerDelete.ok).toBe(true)

    const visible = await fetchApplicationRequirements(advisorA, lifeId)
    expect(visible.some((row) => row.id === id)).toBe(false)
    const hist = await fetchApplicationRequirementHistory(owner, lifeId)
    expect(hist.some((row) => row.reason === 'm2bqa carrier asked again')).toBe(true)
    expect(hist.every((row) => !('changed_by_user_id' in row))).toBe(true)

    const common = previewCommonRequirements('life_term', visible)
    expect(common.skipped).toContain('paramed_exam')
    expect(common.toAdd).toContain('signature')
  })

  it('FIA: universal + FIA-only codes, Life-only blocked, schedule/complete/waive/cancel', async () => {
    expect(requirementCodesForProductLine('fia')).not.toContain('paramed_exam')
    const universal = await createPolicyApplicationRequirement(advisorA, {
      applicationId: fiaId,
      code: 'delivery',
    })
    expect(universal.ok).toBe(true)
    const fiaOnly = await createPolicyApplicationRequirement(advisorA, {
      applicationId: fiaId,
      code: 'suitability',
    })
    expect(fiaOnly.ok).toBe(true)
    const lifeOnFia = await createPolicyApplicationRequirement(advisorA, {
      applicationId: fiaId,
      code: 'aps',
    })
    expect(lifeOnFia.ok).toBe(false)
    const funds = await createPolicyApplicationRequirement(advisorA, {
      applicationId: fiaId,
      code: 'funds',
      scheduledFor: '2026-10-01',
    })
    expect(funds.ok).toBe(true)
    if (funds.ok) expect(funds.data.status).toBe('scheduled')
    const complete = await transitionPolicyApplicationRequirementStatus(advisorA, {
      id: fiaOnly.ok ? fiaOnly.data.id : '',
      toStatus: 'complete',
    })
    expect(complete.ok).toBe(true)
    const waive = await transitionPolicyApplicationRequirementStatus(advisorA, {
      id: universal.ok ? universal.data.id : '',
      toStatus: 'waived',
    })
    expect(waive.ok).toBe(true)
    const cancel = await transitionPolicyApplicationRequirementStatus(advisorA, {
      id: funds.ok ? funds.data.id : '',
      toStatus: 'open',
    })
    expect(cancel.ok).toBe(true)
    expect(
      (
        await transitionPolicyApplicationRequirementStatus(advisorA, {
          id: funds.ok ? funds.data.id : '',
          toStatus: 'cancelled',
        })
      ).ok,
    ).toBe(true)
  })
})
