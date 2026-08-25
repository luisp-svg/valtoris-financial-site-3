/**
 * Live CRM-dev functional QA for Intake Phase 2 (assign + create Opportunity).
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates one isolated p2qa Student Loan Intake graph, assigns Advisor A via
 * assign_household, creates one sales Opportunity through createOpportunity,
 * then deletes the exact IDs. Skips when owner credentials or CRM-dev env are missing.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry'
import { findMatchCandidates } from '../../server/ingest/familyReportCard/findCandidates'
import { ingestPublicReportCard } from '../../server/ingest/familyReportCard/ingestFamilyReportCard'
import {
  fullConsentSnapshotFixture,
  validStudentLoanAnswersFixture,
} from '../../server/ingest/familyReportCard/testFixtures'
import { normalizeEmail, normalizePhone } from '../households/normalizeContact'
import { fetchHouseholdWorkspace } from '../households/householdsApi'
import {
  createOpportunity,
  fetchCurrentAdvisorProfileId,
  fetchOpportunityAdvisorOptions,
  fetchOpportunityPipelineOptions,
  fetchOpportunityServiceVerticalOptions,
  fetchOpportunityStageOptionsForPipelines,
  fetchOpportunities,
  pickDefaultPipeline,
  pickDefaultStage,
} from '../opportunities/opportunitiesApi'
import {
  STUDENT_LOANS_PIPELINE_ID,
  STUDENT_LOANS_VERTICAL_ID,
} from '../security/migration047Contract'
import { assignIntakeHousehold } from './intakeAssignment'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'p2qa'

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

function crmDevReady(): { url: string; anon: string; service: string; ownerPassword: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const ownerPassword = process.env.DEV_OWNER_PASSWORD || ''
  if (!url || !anon || !service || !ownerPassword) return null
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  if (host !== REQUIRED_HOST) return null
  if (/prod|production/i.test(host)) return null
  return { url, anon, service, ownerPassword }
}

const env = crmDevReady()

describe.skipIf(!env)('intake Phase 2 CRM-dev functional QA (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as { url: string; anon: string; service: string; ownerPassword: string }
  let admin: SupabaseClient
  let owner: SupabaseClient
  const runId = randomUUID()
  const submissionId = randomUUID()
  const email = `${PREFIX}.${runId.slice(0, 8)}@example.test`
  const phone = `555${runId.replace(/\D/g, '').slice(0, 7).padEnd(7, '8')}`
  const normalizedEmail = normalizeEmail(email)
  const normalizedPhone = normalizePhone(phone)
  const created = {
    households: [] as string[],
    members: [] as string[],
    leads: [] as string[],
    assessments: [] as string[],
    tasks: [] as string[],
    activities: [] as string[],
    opportunities: [] as string[],
  }
  let sheetsWriteCount = 0

  async function cleanupExactGraph(): Promise<void> {
    if (!admin) return
    if (created.opportunities.length) {
      await admin.from('advisor_assignments').delete().in('opportunity_id', created.opportunities)
      await admin.from('activities').delete().in('opportunity_id', created.opportunities)
      await admin.from('opportunities').delete().in('id', created.opportunities)
    }
    if (created.activities.length) {
      await admin.from('activities').delete().in('id', created.activities)
    }
    if (created.tasks.length) await admin.from('tasks').delete().in('id', created.tasks)
    if (created.assessments.length) {
      await admin.from('activities').delete().in('assessment_id', created.assessments)
      await admin.from('assessments').delete().in('id', created.assessments)
    }
    if (created.leads.length) {
      await admin.from('duplicate_reviews').delete().in('incoming_lead_id', created.leads)
      await admin.from('activities').delete().in('lead_id', created.leads)
      await admin.from('tasks').delete().in('lead_id', created.leads)
      await admin.from('leads').delete().in('id', created.leads)
    }
    if (created.members.length) {
      await admin.from('household_members').delete().in('id', created.members)
    }
    if (created.households.length) {
      await admin.from('advisor_assignments').delete().in('household_id', created.households)
      await admin.from('duplicate_reviews').delete().in('provisional_household_id', created.households)
      await admin.from('duplicate_reviews').delete().in('candidate_household_id', created.households)
      await admin.from('activities').delete().in('household_id', created.households)
      await admin.from('tasks').delete().in('household_id', created.households)
      await admin.from('notes').delete().in('household_id', created.households)
      await admin.from('household_members').delete().in('household_id', created.households)
      await admin.from('leads').delete().in('household_id', created.households)
      await admin.from('assessments').delete().in('household_id', created.households)
      await admin.from('opportunities').delete().in('household_id', created.households)
      await admin.from('households').delete().in('id', created.households)
    }
  }

  beforeAll(async () => {
    admin = createClient(cfg.url, cfg.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    owner = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await owner.auth.signInWithPassword({
      email: 'owner.dev@valtoris.test',
      password: cfg.ownerPassword,
    })
    if (error) throw new Error(`owner sign-in failed: ${error.message}`)
    // PostgREST rejects JWTs whose iat is slightly ahead of the API clock.
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }, 60_000)

  afterAll(async () => {
    await cleanupExactGraph()
  }, 60_000)

  it('assigns a synthetic Student Loan Intake and creates one Pipeline Opportunity without archiving', async () => {
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)

    const candidates = await findMatchCandidates(admin, {
      normalizedEmail,
      normalizedPhone,
    })
    expect(candidates).toEqual([])
    const { data: emailLeads } = await admin
      .from('leads')
      .select('id')
      .eq('normalized_email', normalizedEmail)
    expect(emailLeads ?? []).toEqual([])
    const { data: phoneLeads } = await admin
      .from('leads')
      .select('id')
      .eq('normalized_phone', normalizedPhone)
    expect(phoneLeads ?? []).toEqual([])

    const { data: advisorA, error: advisorErr } = await admin
      .from('advisor_profiles')
      .select('id, display_name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .eq('display_name', 'Advisor A')
      .maybeSingle()
    if (advisorErr) throw new Error(`advisor lookup failed: ${advisorErr.message}`)
    expect(advisorA?.id).toBeTruthy()
    if (!advisorA?.id) return

    const ingest = await ingestPublicReportCard(
      {
        assessmentType: 'student_loan',
        assessmentVersion: 1,
        sourcePage: '/student-loan-assessment',
        consent: fullConsentSnapshotFixture(),
        submittedAt: '2026-08-24T20:00:00.000Z',
        submissionId,
        answers: validStudentLoanAnswersFixture({
          contact: {
            firstName: 'P2qa',
            lastName: `Qa${runId.slice(0, 4)}`,
            email,
            phone,
          },
        }),
      },
      {
        admin,
        sheetsWriter: async () => {
          sheetsWriteCount += 1
          return { status: 'succeeded' as const }
        },
      },
    )
    expect(ingest.ok).toBe(true)
    if (!ingest.ok) {
      throw new Error(`student loan ingest failed: ${JSON.stringify(ingest)}`)
    }

    const { data: lead } = await admin
      .from('leads')
      .select('id, household_id, deleted_at, status, lead_type, assigned_advisor_id')
      .eq('public_ingest_idempotency_key', submissionId)
      .maybeSingle()
    expect(lead?.id).toBeTruthy()
    expect(lead?.household_id).toBeTruthy()
    expect(lead?.lead_type).toBe('Student Loan Report Card')
    expect(lead?.deleted_at).toBeNull()
    if (!lead?.id || !lead.household_id) return

    created.leads.push(lead.id)
    created.households.push(lead.household_id)

    const { data: members } = await admin
      .from('household_members')
      .select('id')
      .eq('household_id', lead.household_id)
    for (const row of members ?? []) created.members.push(row.id as string)
    const { data: assessments } = await admin
      .from('assessments')
      .select('id')
      .eq('lead_id', lead.id)
    for (const row of assessments ?? []) created.assessments.push(row.id as string)
    const { data: tasks } = await admin.from('tasks').select('id').eq('lead_id', lead.id)
    for (const row of tasks ?? []) created.tasks.push(row.id as string)

    const { count: opportunitiesBefore } = await admin
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', lead.household_id)
    expect(opportunitiesBefore ?? 0).toBe(0)
    expect(sheetsWriteCount).toBeGreaterThanOrEqual(0)

    const assigned = await assignIntakeHousehold(owner, {
      householdId: lead.household_id,
      advisorId: advisorA.id,
    })
    expect(assigned.ok).toBe(true)
    if (!assigned.ok) return

    const { data: householdAfter } = await admin
      .from('households')
      .select('id, assigned_advisor_id, deleted_at')
      .eq('id', lead.household_id)
      .maybeSingle()
    expect(householdAfter?.assigned_advisor_id).toBe(advisorA.id)
    expect(householdAfter?.deleted_at).toBeNull()

    const { data: leadAfterAssign } = await admin
      .from('leads')
      .select('id, assigned_advisor_id, deleted_at, status')
      .eq('id', lead.id)
      .maybeSingle()
    expect(leadAfterAssign?.assigned_advisor_id).toBe(advisorA.id)
    expect(leadAfterAssign?.deleted_at).toBeNull()
    expect(leadAfterAssign?.status).not.toBe('converted')

    const { count: opportunitiesAfterAssign } = await admin
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', lead.household_id)
    expect(opportunitiesAfterAssign ?? 0).toBe(0)

    const [verticals, pipelines, advisors, actorAdvisorId] = await Promise.all([
      fetchOpportunityServiceVerticalOptions(owner),
      fetchOpportunityPipelineOptions(owner),
      fetchOpportunityAdvisorOptions(owner),
      fetchCurrentAdvisorProfileId(owner, (await owner.auth.getUser()).data.user?.id ?? ''),
    ])
    const studentVertical = verticals.find((row) => row.id === STUDENT_LOANS_VERTICAL_ID)
    expect(studentVertical?.code).toBe('student_loans')
    const studentPipelines = pipelines.filter((row) => row.service_vertical_id === STUDENT_LOANS_VERTICAL_ID)
    const pipeline = pickDefaultPipeline(studentPipelines)
    expect(pipeline?.id).toBe(STUDENT_LOANS_PIPELINE_ID)
    const stages = await fetchOpportunityStageOptionsForPipelines(owner, [pipeline!.id])
    const stage = pickDefaultStage(stages.filter((row) => row.pipeline_id === pipeline!.id))
    expect(stage?.code).toBe('identified')
    expect(advisors.some((row) => row.id === advisorA.id)).toBe(true)

    const householdName = `P2qa Qa${runId.slice(0, 4)}`
    const createdOpp = await createOpportunity(
      owner,
      {
        title: `Student Loans — ${householdName}`,
        household_id: lead.household_id,
        pipeline_id: pipeline!.id,
        stage_id: stage!.id,
        service_vertical_id: STUDENT_LOANS_VERTICAL_ID,
        assigned_advisor_id: advisorA.id,
      },
      {
        pipelines: studentPipelines,
        stages,
        advisors,
        actorAdvisorId,
        role: 'owner',
      },
    )
    created.opportunities.push(createdOpp.id)
    expect(createdOpp.status).toBe('open')
    expect(createdOpp.household_id).toBe(lead.household_id)
    expect(createdOpp.service_vertical_id).toBe(STUDENT_LOANS_VERTICAL_ID)
    expect(createdOpp.pipeline_id).toBe(STUDENT_LOANS_PIPELINE_ID)
    expect(createdOpp.stage?.code).toBe('identified')
    expect(createdOpp.assigned_advisor_id).toBe(advisorA.id)
    expect(createdOpp.source_lead_id).toBeNull()

    const { data: allOpps } = await admin
      .from('opportunities')
      .select('id, status, deleted_at')
      .eq('household_id', lead.household_id)
    expect(allOpps).toHaveLength(1)
    expect(allOpps?.[0]?.status).toBe('open')
    expect(allOpps?.[0]?.deleted_at).toBeNull()

    const pipelineRows = await fetchOpportunities(owner, { status: 'open' })
    expect(pipelineRows.some((row) => row.id === createdOpp.id)).toBe(true)

    const workspace = await fetchHouseholdWorkspace(owner, lead.household_id)
    expect(workspace?.openOpportunities.some((row) => row.id === createdOpp.id)).toBe(true)

    const { data: leadStillActive } = await admin
      .from('leads')
      .select('id, deleted_at')
      .eq('id', lead.id)
      .maybeSingle()
    expect(leadStillActive?.deleted_at).toBeNull()

    const { count: cases } = await admin
      .from('policy_applications')
      .select('id', { count: 'exact', head: true })
      .eq('opportunity_id', createdOpp.id)
    expect(cases ?? 0).toBe(0)

    const { data: assignmentActivities } = await admin
      .from('activities')
      .select('id, title')
      .eq('household_id', lead.household_id)
      .eq('title', 'Household assigned')
    for (const row of assignmentActivities ?? []) created.activities.push(row.id as string)
    expect((assignmentActivities ?? []).length).toBeGreaterThanOrEqual(1)

    console.log('[p2qa] created', {
      submissionId,
      email: normalizedEmail,
      phone: normalizedPhone,
      advisorId: advisorA.id,
      opportunityId: createdOpp.id,
      ...created,
    })

    await cleanupExactGraph()
    created.activities = []
    created.tasks = []
    created.assessments = []
    created.members = []
    created.leads = []
    created.households = []
    created.opportunities = []

    const { data: leadLeft } = await admin.from('leads').select('id').eq('id', lead.id)
    const { data: hhLeft } = await admin.from('households').select('id').eq('id', lead.household_id)
    const { data: oppLeft } = await admin.from('opportunities').select('id').eq('id', createdOpp.id)
    const { data: emailLeft } = await admin
      .from('leads')
      .select('id')
      .eq('normalized_email', normalizedEmail)
    const { data: phoneLeft } = await admin
      .from('leads')
      .select('id')
      .eq('normalized_phone', normalizedPhone)
    expect(leadLeft ?? []).toEqual([])
    expect(hhLeft ?? []).toEqual([])
    expect(oppLeft ?? []).toEqual([])
    expect(emailLeft ?? []).toEqual([])
    expect(phoneLeft ?? []).toEqual([])
  }, 90_000)
})
