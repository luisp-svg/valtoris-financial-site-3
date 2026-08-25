/**
 * Live CRM-dev functional QA for Intake archive (Phase 1B).
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates one isolated m052qa Family Report Card graph, archives it as not_a_fit,
 * proves already_archived on repeat, then deletes the exact IDs. Skips when owner
 * credentials or CRM-dev env are missing.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findMatchCandidates } from '../../server/ingest/familyReportCard/findCandidates'
import { ingestPublicReportCard } from '../../server/ingest/familyReportCard/ingestFamilyReportCard'
import {
  fullConsentSnapshotFixture,
  validFamilyAnswersFixture,
} from '../../server/ingest/familyReportCard/testFixtures'
import { normalizeEmail, normalizePhone } from '../households/normalizeContact'
import { archiveIntakeLead } from './intakeArchive'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'm052qa'

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

describe.skipIf(!env)('intake archive CRM-dev functional QA (cxgiaevervjttbuiramd only)', () => {
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
  }
  let sheetsWriteCount = 0

  async function cleanupExactGraph(): Promise<void> {
    if (!admin) return
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
  }, 60_000)

  afterAll(async () => {
    await cleanupExactGraph()
  }, 60_000)

  it('archives a synthetic Intake via authenticated owner RPC and leaves zero residue', async () => {
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

    const ingest = await ingestPublicReportCard(
      {
        assessmentType: 'family',
        assessmentVersion: 1,
        sourcePage: '/family-report-card',
        consent: fullConsentSnapshotFixture(),
        submittedAt: '2026-08-24T18:00:00.000Z',
        submissionId,
        answers: validFamilyAnswersFixture({
          family: {
            ...validFamilyAnswersFixture().family,
            firstName: 'M052',
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
    if (!ingest.ok) return

    const { data: lead } = await admin
      .from('leads')
      .select('id, household_id, deleted_at, follow_up_task_id, status, lead_type')
      .eq('public_ingest_idempotency_key', submissionId)
      .maybeSingle()
    expect(lead?.id).toBeTruthy()
    expect(lead?.household_id).toBeTruthy()
    if (!lead?.id || !lead.household_id) return

    created.leads.push(lead.id)
    created.households.push(lead.household_id)
    if (typeof lead.follow_up_task_id === 'string') created.tasks.push(lead.follow_up_task_id)

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
    for (const row of tasks ?? []) {
      if (!created.tasks.includes(row.id as string)) created.tasks.push(row.id as string)
    }

    const { count: opportunitiesBefore } = await admin
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', lead.household_id)
    const { data: dupsBefore } = await admin
      .from('duplicate_reviews')
      .select('id, status')
      .eq('incoming_lead_id', lead.id)
    const sheetsBeforeArchive = sheetsWriteCount
    expect(lead.deleted_at).toBeNull()
    expect(lead.status).not.toBe('duplicate_review')

    const { data: activeBefore } = await owner
      .from('leads')
      .select('id')
      .eq('id', lead.id)
      .is('deleted_at', null)
      .maybeSingle()
    expect(activeBefore?.id).toBe(lead.id)

    const result = await archiveIntakeLead(owner, {
      leadId: lead.id,
      reason: 'not_a_fit',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.lead_id).toBe(lead.id)
    expect(result.archived).toBe(true)
    expect(result.reason).toBe('not_a_fit')
    expect(typeof result.follow_up_task_completed).toBe('boolean')

    const { data: archivedLead } = await admin
      .from('leads')
      .select('id, deleted_at, household_id, status')
      .eq('id', lead.id)
      .maybeSingle()
    expect(archivedLead?.id).toBe(lead.id)
    expect(archivedLead?.deleted_at).toBeTruthy()
    expect(archivedLead?.household_id).toBe(lead.household_id)

    const { data: activeAfter } = await owner
      .from('leads')
      .select('id')
      .eq('id', lead.id)
      .is('deleted_at', null)
      .maybeSingle()
    expect(activeAfter).toBeNull()

    const { data: household } = await admin
      .from('households')
      .select('id, deleted_at')
      .eq('id', lead.household_id)
      .maybeSingle()
    expect(household?.id).toBe(lead.household_id)
    expect(household?.deleted_at).toBeNull()

    const { data: membersAfter } = await admin
      .from('household_members')
      .select('id, deleted_at')
      .eq('household_id', lead.household_id)
    expect((membersAfter ?? []).length).toBeGreaterThan(0)
    expect((membersAfter ?? []).every((row) => row.deleted_at == null)).toBe(true)

    if (created.assessments.length) {
      const { data: assessmentsAfter } = await admin
        .from('assessments')
        .select('id, deleted_at')
        .in('id', created.assessments)
      expect((assessmentsAfter ?? []).map((row) => row.id)).toEqual(created.assessments)
      expect((assessmentsAfter ?? []).every((row) => row.deleted_at == null)).toBe(true)
    }

    if (created.tasks.length) {
      const { data: taskAfter } = await admin
        .from('tasks')
        .select('id, status, workflow_type, completed_at')
        .in('id', created.tasks)
      const ordinary = (taskAfter ?? []).filter((row) =>
        ['review_initial_diagnostic', 'review_digital_identity_lead'].includes(
          String(row.workflow_type),
        ),
      )
      if (ordinary.length) {
        expect(ordinary.every((row) => row.status === 'done' && row.completed_at)).toBe(true)
        expect(result.follow_up_task_completed).toBe(true)
      }
      expect((taskAfter ?? []).some((row) => String(row.workflow_type).includes('duplicate'))).toBe(
        false,
      )
    }

    const { data: activities } = await admin
      .from('activities')
      .select('id, title, activity_type, household_id, lead_id')
      .eq('lead_id', lead.id)
      .eq('title', 'Intake archived')
    expect(activities).toHaveLength(1)
    expect(activities?.[0]?.activity_type).toBe('system')
    expect(activities?.[0]?.household_id).toBe(lead.household_id)
    expect(activities?.[0]?.lead_id).toBe(lead.id)
    if (activities?.[0]?.id) created.activities.push(activities[0].id as string)

    const { data: tasksBeforeRepeat } = created.tasks.length
      ? await admin.from('tasks').select('id, status, completed_at').in('id', created.tasks)
      : { data: [] }

    const repeat = await archiveIntakeLead(owner, {
      leadId: lead.id,
      reason: 'not_a_fit',
    })
    expect(repeat.ok).toBe(false)
    if (!repeat.ok) {
      expect(repeat.code).toBe('already_archived')
      expect(repeat.message).toBe('This Intake has already been archived.')
    }
    const { data: activitiesAfterRepeat } = await admin
      .from('activities')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('title', 'Intake archived')
    expect(activitiesAfterRepeat).toHaveLength(1)
    if (created.tasks.length) {
      const { data: taskRepeat } = await admin
        .from('tasks')
        .select('id, status, completed_at')
        .in('id', created.tasks)
      expect(taskRepeat).toEqual(tasksBeforeRepeat)
    }

    console.log('[m052qa] created', {
      submissionId,
      email: normalizedEmail,
      phone: normalizedPhone,
      ...created,
    })

    const { count: opportunitiesAfter } = await admin
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', lead.household_id)
    expect(opportunitiesAfter ?? 0).toBe(opportunitiesBefore ?? 0)

    const { data: dupsAfter } = await admin
      .from('duplicate_reviews')
      .select('id, status')
      .eq('incoming_lead_id', lead.id)
    expect(dupsAfter ?? []).toEqual(dupsBefore ?? [])
    expect(sheetsWriteCount).toBe(sheetsBeforeArchive)

    await cleanupExactGraph()
    created.activities = []
    created.tasks = []
    created.assessments = []
    created.members = []
    created.leads = []
    created.households = []

    const { data: leadLeft } = await admin.from('leads').select('id').eq('id', lead.id)
    const { data: hhLeft } = await admin.from('households').select('id').eq('id', lead.household_id)
    const { data: emailLeft } = await admin
      .from('leads')
      .select('id')
      .eq('normalized_email', normalizedEmail)
    const { data: phoneLeft } = await admin
      .from('leads')
      .select('id')
      .eq('normalized_phone', normalizedPhone)
    const { data: keyLeft } = await admin
      .from('leads')
      .select('id')
      .eq('public_ingest_idempotency_key', submissionId)
    expect(leadLeft ?? []).toEqual([])
    expect(hhLeft ?? []).toEqual([])
    expect(emailLeft ?? []).toEqual([])
    expect(phoneLeft ?? []).toEqual([])
    expect(keyLeft ?? []).toEqual([])
  }, 90_000)
})
