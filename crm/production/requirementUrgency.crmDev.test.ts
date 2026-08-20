/**
 * CRM-dev Phase 2C live QA for overdue-requirement visibility.
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates isolated m2cqa rows and deletes them in afterAll.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  applyCaseWorkspaceView,
  caseNeedsAttention,
  formatCaseAttentionLabels,
  caseAttentionFlags,
} from './caseWorkspace'
import { partitionHouseholdCases } from './householdCasesView'
import {
  createPolicyApplicationRequirement,
  fetchOverdueRequirementCountsByApplicationIds,
  fetchRequirementUrgencyByApplicationIds,
  softDeletePolicyApplicationRequirement,
  transitionPolicyApplicationRequirementStatus,
} from './requirementApi'
import {
  applyOverdueRequirementCounts,
  isOpenRequirementOverdue,
  requirementCalendarToday,
} from './requirementView'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'm2cqa'

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

function shiftIsoDay(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const year = dt.getUTCFullYear()
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dt.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describe.skipIf(!env)('Phase 2C CRM-dev overdue requirement visibility (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as NonNullable<typeof env>
  const runId = randomUUID().slice(0, 8)
  const today = requirementCalendarToday()
  const yesterday = shiftIsoDay(today, -1)
  const tomorrow = shiftIsoDay(today, 1)
  const now = new Date(`${today}T15:00:00.000Z`)
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorB: SupabaseClient
  let advisorAProfileId = ''
  let advisorBProfileId = ''
  let householdAId = ''
  let householdBId = ''
  let memberAId = ''
  let memberBId = ''
  let openId = ''
  let closedId = ''
  let siblingId = ''
  let foreignId = ''
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

  async function cleanupQa() {
    const apps = created.applications
    if (apps.length) {
      const { data: reqs } = await admin
        .from('policy_application_requirements')
        .select('id, application_id')
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
    advisorB = await signIn('advisor.b@valtoris.test', cfg.advisorBPass)

    const advAUser = await advisorA.auth.getUser()
    const advBUser = await advisorB.auth.getUser()
    const { data: profiles, error: profileErr } = await admin
      .from('advisor_profiles')
      .select('id, user_id')
      .in('user_id', [advAUser.data.user?.id ?? '', advBUser.data.user?.id ?? ''])
      .is('deleted_at', null)
      .eq('is_active', true)
    if (profileErr) throw profileErr
    advisorAProfileId = (profiles ?? []).find((row) => row.user_id === advAUser.data.user?.id)?.id ?? ''
    advisorBProfileId = (profiles ?? []).find((row) => row.user_id === advBUser.data.user?.id)?.id ?? ''
    if (!advisorAProfileId || !advisorBProfileId) throw new Error('m2cqa advisor profiles missing')

    const { data: products, error: prodErr } = await admin
      .from('insurance_products')
      .select('id, carrier_id, product_line')
      .is('deleted_at', null)
      .eq('is_active', true)
    if (prodErr) throw prodErr
    const life = (products ?? []).find((p) =>
      ['life_term', 'life_permanent'].includes(p.product_line as string),
    )
    if (!life) throw new Error('CRM-dev catalog missing Life product for m2cqa')
    const lifeProduct = life

    async function newHousehold(firstName: string, advisorId: string) {
      const clientRes = await owner.rpc('create_canonical_client', {
        p_payload: {
          first_name: firstName,
          last_name: `${PREFIX} ${runId}`,
          assigned_advisor_id: advisorId,
        },
      })
      if (clientRes.error || !clientRes.data?.household_id) {
        throw new Error(`create_canonical_client failed: ${clientRes.error?.message}`)
      }
      created.households.push(clientRes.data.household_id as string)
      return {
        householdId: clientRes.data.household_id as string,
        memberId: clientRes.data.member_id as string,
      }
    }

    const hhA = await newHousehold('M2cqa', advisorAProfileId)
    const hhB = await newHousehold('M2cqaB', advisorBProfileId)
    householdAId = hhA.householdId
    householdBId = hhB.householdId
    memberAId = hhA.memberId
    memberBId = hhB.memberId

    const allocationsFor = (advisorId: string) => [
      {
        recipient_type: 'advisor',
        advisor_id: advisorId,
        allocation_role: 'writing',
        commission_bps: 10000,
        production_credit_bps: 10000,
        contract_level_snapshot: '100%',
      },
    ]
    const participantsFor = (memberId: string) => [
      { household_member_id: memberId, role: 'primary_client' },
      { household_member_id: memberId, role: 'insured' },
      { household_member_id: memberId, role: 'owner' },
    ]

    async function newApp(
      householdId: string,
      memberId: string,
      advisorId: string,
      followUp: string,
    ): Promise<string> {
      const res = await owner.rpc('create_policy_application', {
        p_payload: {
          household_id: householdId,
          carrier_id: lifeProduct.carrier_id,
          product_id: lifeProduct.id,
          product_line: lifeProduct.product_line,
          state: 'TX',
          submitted_premium_cents: 240000,
          premium_mode: 'annual',
          participants: participantsFor(memberId),
          allocations: allocationsFor(advisorId),
        },
      })
      const id = res.data?.application_id as string | undefined
      if (res.error || !id) throw new Error(`create_policy_application failed: ${res.error?.message}`)
      created.applications.push(id)
      const submit = await owner.rpc('transition_policy_application_stage', {
        p_application_id: id,
        p_to_stage: 'submitted',
        p_disposition: null,
        p_delivery_status: null,
        p_reason: null,
        p_fields: { submission_date: '2026-08-01', next_follow_up_date: followUp },
      })
      if (submit.error) throw new Error(`submit failed: ${submit.error.message}`)
      return id
    }

    openId = await newApp(householdAId, memberAId, advisorAProfileId, yesterday)
    closedId = await newApp(householdAId, memberAId, advisorAProfileId, yesterday)
    siblingId = await newApp(householdAId, memberAId, advisorAProfileId, tomorrow)
    foreignId = await newApp(householdBId, memberBId, advisorBProfileId, tomorrow)

    const withdraw = await owner.rpc('transition_policy_application_stage', {
      p_application_id: closedId,
      p_to_stage: 'withdrawn',
      p_disposition: null,
      p_delivery_status: null,
      p_reason: 'm2cqa closed-case check',
      p_fields: {},
    })
    if (withdraw.error) throw new Error(`withdraw failed: ${withdraw.error.message}`)
  }, 120_000)

  afterAll(async () => {
    if (!admin) return
    await cleanupQa()
  }, 120_000)

  it('applies the overdue rule, Needs Attention, household mapping, and advisor RLS', async () => {
    const openYesterday = await createPolicyApplicationRequirement(advisorA, {
      applicationId: openId,
      code: 'signature',
      dueDate: yesterday,
    })
    expect(openYesterday.ok).toBe(true)
    expect(
      await createPolicyApplicationRequirement(advisorA, {
        applicationId: openId,
        code: 'illustration',
        dueDate: today,
      }),
    ).toMatchObject({ ok: true })
    expect(
      await createPolicyApplicationRequirement(advisorA, {
        applicationId: openId,
        code: 'initial_premium',
        dueDate: tomorrow,
      }),
    ).toMatchObject({ ok: true })
    expect(
      await createPolicyApplicationRequirement(advisorA, {
        applicationId: openId,
        code: 'delivery',
      }),
    ).toMatchObject({ ok: true })

    const scheduledOverdue = await createPolicyApplicationRequirement(advisorA, {
      applicationId: openId,
      code: 'paramed_exam',
      dueDate: yesterday,
      scheduledFor: tomorrow,
    })
    expect(scheduledOverdue.ok).toBe(true)
    if (scheduledOverdue.ok) expect(scheduledOverdue.data.status).toBe('scheduled')
    expect(
      isOpenRequirementOverdue(
        { status: 'scheduled', due_date: yesterday },
        today,
      ),
    ).toBe(true)

    const scheduledFuture = await createPolicyApplicationRequirement(advisorA, {
      applicationId: openId,
      code: 'replacement_form',
      dueDate: tomorrow,
      scheduledFor: tomorrow,
    })
    expect(scheduledFuture.ok).toBe(true)

    const complete = await createPolicyApplicationRequirement(advisorA, {
      applicationId: openId,
      code: 'aps',
      dueDate: yesterday,
    })
    expect(complete.ok).toBe(true)
    expect(
      (
        await transitionPolicyApplicationRequirementStatus(advisorA, {
          id: complete.ok ? complete.data.id : '',
          toStatus: 'complete',
        })
      ).ok,
    ).toBe(true)

    const waived = await createPolicyApplicationRequirement(advisorA, {
      applicationId: siblingId,
      code: 'signature',
      dueDate: yesterday,
    })
    expect(waived.ok).toBe(true)
    expect(
      (
        await transitionPolicyApplicationRequirementStatus(advisorA, {
          id: waived.ok ? waived.data.id : '',
          toStatus: 'waived',
        })
      ).ok,
    ).toBe(true)
    const cancelled = await createPolicyApplicationRequirement(advisorA, {
      applicationId: siblingId,
      code: 'illustration',
      dueDate: yesterday,
    })
    expect(cancelled.ok).toBe(true)
    expect(
      (
        await transitionPolicyApplicationRequirementStatus(advisorA, {
          id: cancelled.ok ? cancelled.data.id : '',
          toStatus: 'cancelled',
        })
      ).ok,
    ).toBe(true)

    const closedOverdue = await createPolicyApplicationRequirement(advisorA, {
      applicationId: closedId,
      code: 'signature',
      dueDate: yesterday,
    })
    expect(closedOverdue.ok).toBe(true)

    const deleted = await createPolicyApplicationRequirement(owner, {
      applicationId: openId,
      code: 'other',
      customLabel: 'm2cqa leftover form',
      dueDate: yesterday,
    })
    expect(deleted.ok).toBe(true)
    expect(
      (await softDeletePolicyApplicationRequirement(owner, deleted.ok ? deleted.data.id : '')).ok,
    ).toBe(true)

    expect(
      await createPolicyApplicationRequirement(advisorB, {
        applicationId: foreignId,
        code: 'signature',
        dueDate: yesterday,
      }),
    ).toMatchObject({ ok: true })

    const urgency = await fetchRequirementUrgencyByApplicationIds(advisorA, [
      openId,
      closedId,
      siblingId,
      foreignId,
    ])
    expect(urgency.every((row) => !('custom_label' in row))).toBe(true)
    expect(urgency.some((row) => row.application_id === foreignId)).toBe(false)

    const counts = await fetchOverdueRequirementCountsByApplicationIds(
      advisorA,
      [openId, closedId, siblingId, foreignId],
      today,
    )
    expect(counts.get(openId)).toBe(2)
    expect(counts.get(closedId)).toBe(1)
    expect(counts.get(siblingId)).toBeUndefined()
    expect(counts.get(foreignId)).toBeUndefined()

    const advisorBCounts = await fetchOverdueRequirementCountsByApplicationIds(
      advisorB,
      [openId, foreignId],
      today,
    )
    expect(advisorBCounts.get(openId)).toBeUndefined()
    expect(advisorBCounts.get(foreignId)).toBe(1)

    const householdApps = [
      {
        id: openId,
        production_stage: 'submitted' as const,
        product_line: 'life_term' as const,
        delivery_status: 'pre_issue' as const,
        submission_date: '2026-08-01',
        deleted_at: null,
        next_follow_up_date: yesterday,
        stage_history: [],
        updated_at: `${today}T00:00:00.000Z`,
        overdue_requirement_count: counts.get(openId) ?? 0,
        household: { id: householdAId, display_name: 'M2cqa' },
        carrier: { id: 'c', name: 'Acme', code: 'A' },
        product: { id: 'p', name: 'Term', product_line: 'life_term' as const },
        participants: [],
        allocations: [],
        linked_policies: [],
        expected_compensations: [],
        household_id: householdAId,
        carrier_id: 'c',
        product_id: 'p',
        state: 'TX',
        application_number: null,
        policy_number: null,
        underwriting_disposition: 'pending' as const,
        submitted_premium_cents: 240000,
        annuity_deposit_cents: null,
        face_amount_cents: null,
        premium_mode: 'annual',
        issue_date: null,
        in_force_date: null,
        writing_receivable_expected: true,
      },
      {
        id: siblingId,
        production_stage: 'submitted' as const,
        product_line: 'life_term' as const,
        delivery_status: 'pre_issue' as const,
        submission_date: '2026-08-01',
        deleted_at: null,
        next_follow_up_date: tomorrow,
        stage_history: [],
        updated_at: `${today}T00:00:00.000Z`,
        overdue_requirement_count: counts.get(siblingId) ?? 0,
        household: { id: householdAId, display_name: 'M2cqa' },
        carrier: { id: 'c', name: 'Acme', code: 'A' },
        product: { id: 'p', name: 'Term', product_line: 'life_term' as const },
        participants: [],
        allocations: [],
        linked_policies: [],
        expected_compensations: [],
        household_id: householdAId,
        carrier_id: 'c',
        product_id: 'p',
        state: 'TX',
        application_number: null,
        policy_number: null,
        underwriting_disposition: 'pending' as const,
        submitted_premium_cents: 240000,
        annuity_deposit_cents: null,
        face_amount_cents: null,
        premium_mode: 'annual',
        issue_date: null,
        in_force_date: null,
        writing_receivable_expected: true,
      },
      {
        id: closedId,
        production_stage: 'withdrawn' as const,
        product_line: 'life_term' as const,
        delivery_status: 'pre_issue' as const,
        submission_date: '2026-08-01',
        deleted_at: null,
        next_follow_up_date: yesterday,
        stage_history: [],
        updated_at: `${today}T00:00:00.000Z`,
        overdue_requirement_count: counts.get(closedId) ?? 0,
        household: { id: householdAId, display_name: 'M2cqa' },
        carrier: { id: 'c', name: 'Acme', code: 'A' },
        product: { id: 'p', name: 'Term', product_line: 'life_term' as const },
        participants: [],
        allocations: [],
        linked_policies: [],
        expected_compensations: [],
        household_id: householdAId,
        carrier_id: 'c',
        product_id: 'p',
        state: 'TX',
        application_number: null,
        policy_number: null,
        underwriting_disposition: 'pending' as const,
        submitted_premium_cents: 240000,
        annuity_deposit_cents: null,
        face_amount_cents: null,
        premium_mode: 'annual',
        issue_date: null,
        in_force_date: null,
        writing_receivable_expected: true,
      },
    ]

    const attached = applyOverdueRequirementCounts(householdApps, counts)
    expect(caseNeedsAttention(attached[0], now)).toBe(true)
    expect(formatCaseAttentionLabels(caseAttentionFlags(attached[0], now), 'life_term')).toEqual([
      'Overdue follow-up',
      '2 overdue requirements',
    ])
    expect(caseNeedsAttention(attached[1], now)).toBe(false)
    expect(caseNeedsAttention(attached[2], now)).toBe(false)
    expect(applyCaseWorkspaceView(attached, 'needs_attention', now).map((row) => row.id)).toEqual([
      openId,
    ])
    expect(applyCaseWorkspaceView(attached, 'open', now).map((row) => row.id).sort()).toEqual(
      [openId, siblingId].sort(),
    )

    const { open, closed } = partitionHouseholdCases(attached, now)
    expect(open.find((row) => row.id === openId)?.attentionLabels).toContain('2 overdue requirements')
    expect(open.find((row) => row.id === siblingId)?.attentionLabels).toEqual([])
    expect(closed.find((row) => row.id === closedId)?.attentionLabels).toEqual([])
    expect(JSON.stringify(open)).not.toMatch(/custom_label|m2cqa leftover form/)
  })
})
