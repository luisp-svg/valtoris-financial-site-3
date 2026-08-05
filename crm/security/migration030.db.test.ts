/**
 * Live local-Supabase integration for Migration 030 final Activity privileges.
 *
 * Final schema expectations (after 001–030):
 *   - authenticated: SELECT only on public.activities (no INSERT/UPDATE/DELETE)
 *   - anon/PUBLIC: no table privileges
 *   - service_role: full operational privileges
 *   - activities_insert policy removed; activities_select retained
 *   - record_crm_activity remains the authenticated write path
 *
 * Skips automatically when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { completeHouseholdOnboardingDraft } from '../households/onboardingApi'
import { createTask } from '../tasks/tasksApi'

const PASS = 'LocalQaPass030!'
const PREFIX = 'm030sec'

type LocalEnv = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string; DB_URL?: string }

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
      DB_URL: env.DB_URL || env.DATABASE_URL,
    }
  } catch {
    return null
  }
}

function errMsg(error: { message?: string } | null | undefined): string {
  return error?.message || ''
}

function sqlQuery(sql: string): string {
  // Local Supabase exposes Postgres in Docker; host may not have psql on PATH.
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  return execSync(
    `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c ${JSON.stringify(oneLine)}`,
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim()
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 030 Activity INSERT revoke (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let anon: SupabaseClient
  let owner: SupabaseClient
  let advisorA: SupabaseClient
  let advisorB: SupabaseClient

  let ownerId = ''
  let advisorAUserId = ''
  let advisorBUserId = ''
  let advisorAProfileId = ''
  let advisorBProfileId = ''
  let verticalId = ''
  let pipelineId = ''
  let openStageId = ''
  let relationshipPipelineId = ''
  let relationshipStageId = ''

  let householdId = ''
  let openOppId = ''
  let leadAId = ''
  let assessmentAId = ''
  let onboardingAssessmentId = ''
  let manualTaskId = ''
  let seedActivityId = ''

  const createdIds = {
    households: [] as string[],
    opportunities: [] as string[],
    leads: [] as string[],
    assessments: [] as string[],
    tasks: [] as string[],
    activities: [] as string[],
    digitalCards: [] as string[],
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

  async function createHousehold(advisorId: string, label: string): Promise<string> {
    const id = randomUUID()
    const { error } = await admin.from('households').insert({
      id,
      display_name: `${PREFIX} ${label}`,
      assigned_advisor_id: advisorId,
      assigned_at: new Date().toISOString(),
      assigned_by_user_id: ownerId,
      assignment_reason: 'manual',
      created_by_user_id: ownerId,
      relationship_pipeline_id: relationshipPipelineId,
      relationship_stage_id: relationshipStageId,
      stage_entered_at: new Date().toISOString(),
    })
    if (error) throw error
    createdIds.households.push(id)
    const { error: assignErr } = await admin.from('advisor_assignments').insert({
      household_id: id,
      advisor_id: advisorId,
      assignment_role: 'primary',
      reason: 'manual',
      is_attribution_source: false,
      assigned_by_user_id: ownerId,
    })
    if (assignErr) throw assignErr
    return id
  }

  async function countHouseholdActivities(household: string): Promise<number> {
    const { count, error } = await admin
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', household)
    if (error) throw error
    return count ?? 0
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    ownerId = await ensureUser(`${PREFIX}.owner@valtoris.test`, 'M030 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}.adv.a@valtoris.test`, 'M030 Advisor A', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}.adv.b@valtoris.test`, 'M030 Advisor B', 'advisor')
    advisorAProfileId = await ensureAdvisorProfile(advisorAUserId, `${PREFIX}-advisor-a`)
    advisorBProfileId = await ensureAdvisorProfile(advisorBUserId, `${PREFIX}-advisor-b`)
    owner = await signIn(`${PREFIX}.owner@valtoris.test`)
    advisorA = await signIn(`${PREFIX}.adv.a@valtoris.test`)
    advisorB = await signIn(`${PREFIX}.adv.b@valtoris.test`)

    const { data: vertical } = await admin
      .from('service_verticals')
      .select('id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()
    verticalId = vertical!.id

    const { data: pipeline } = await admin
      .from('pipelines')
      .select('id')
      .eq('service_vertical_id', verticalId)
      .eq('pipeline_type', 'service')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single()
    pipelineId = pipeline!.id

    const { data: stages } = await admin
      .from('pipeline_stages')
      .select('id, is_won, is_lost')
      .eq('pipeline_id', pipelineId)
      .order('sort_order', { ascending: true })
    openStageId = (stages!.find((s) => !s.is_won && !s.is_lost) || stages![0]).id

    const { data: relPipe } = await admin
      .from('pipelines')
      .select('id')
      .eq('pipeline_type', 'relationship')
      .eq('is_active', true)
      .limit(1)
      .single()
    relationshipPipelineId = relPipe!.id
    const { data: relStage } = await admin
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', relationshipPipelineId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()
    relationshipStageId = relStage!.id

    // Primary HH assigned to advisor B (authorized SELECT + RPC).
    // Advisor A has no assignment → cross-household SELECT/RPC denial coverage.
    householdId = await createHousehold(advisorBProfileId, 'HH-B')

    openOppId = randomUUID()
    const { error: oppErr } = await admin.from('opportunities').insert({
      id: openOppId,
      title: `${PREFIX} open`,
      household_id: householdId,
      service_vertical_id: verticalId,
      pipeline_id: pipelineId,
      stage_id: openStageId,
      status: 'open',
      assigned_advisor_id: advisorBProfileId,
      assigned_at: new Date().toISOString(),
      assigned_by_user_id: ownerId,
      assignment_reason: 'manual',
      stage_entered_at: new Date().toISOString(),
    })
    if (oppErr) throw oppErr
    createdIds.opportunities.push(openOppId)

    leadAId = randomUUID()
    const { error: leadErr } = await admin.from('leads').insert({
      id: leadAId,
      household_id: householdId,
      lead_type: 'family_report_card',
      status: 'assigned',
      assessment_type: 'family',
      assigned_advisor_id: advisorBProfileId,
      normalized_email: `${PREFIX}.leada@example.com`,
    })
    if (leadErr) throw leadErr
    createdIds.leads.push(leadAId)

    assessmentAId = randomUUID()
    onboardingAssessmentId = randomUUID()
    const { error: assessErr } = await admin.from('assessments').insert([
      {
        id: assessmentAId,
        household_id: householdId,
        lead_id: leadAId,
        assessment_type: 'family',
        status: 'completed',
        completed_at: new Date().toISOString(),
        answers: {},
        priorities: [],
        derived_metrics: {},
      },
      {
        id: onboardingAssessmentId,
        household_id: householdId,
        assessment_type: 'household_onboarding',
        status: 'completed',
        completed_at: new Date().toISOString(),
        answers: {},
        priorities: [],
        derived_metrics: {},
      },
    ])
    if (assessErr) throw assessErr
    createdIds.assessments.push(assessmentAId, onboardingAssessmentId)

    manualTaskId = randomUUID()
    const { error: taskErr } = await admin.from('tasks').insert({
      id: manualTaskId,
      household_id: householdId,
      opportunity_id: openOppId,
      lead_id: leadAId,
      assessment_id: assessmentAId,
      title: `${PREFIX} manual task`,
      source_type: 'manual',
      workflow_type: null,
      created_by_user_id: advisorBUserId,
    })
    if (taskErr) throw taskErr
    createdIds.tasks.push(manualTaskId)

    const seed = await admin
      .from('activities')
      .insert({
        household_id: householdId,
        activity_type: 'system',
        title: `${PREFIX} seed`,
        metadata: { eventKey: 'system.seed' },
        actor_user_id: advisorBUserId,
      })
      .select('id')
      .single()
    if (seed.error) throw seed.error
    seedActivityId = seed.data!.id
    createdIds.activities.push(seedActivityId)
  }, 120_000)

  afterAll(async () => {
    if (!admin) return
    if (createdIds.activities.length) {
      await admin.from('activities').delete().in('id', createdIds.activities)
    }
    if (createdIds.tasks.length) await admin.from('tasks').delete().in('id', createdIds.tasks)
    if (createdIds.assessments.length) {
      await admin.from('assessments').delete().in('id', createdIds.assessments)
    }
    if (createdIds.opportunities.length) {
      await admin.from('opportunities').delete().in('id', createdIds.opportunities)
    }
    if (createdIds.leads.length) await admin.from('leads').delete().in('id', createdIds.leads)
    if (createdIds.digitalCards.length) {
      await admin.from('digital_cards').delete().in('id', createdIds.digitalCards)
    }
    if (createdIds.households.length) {
      await admin.from('advisor_assignments').delete().in('household_id', createdIds.households)
      if (createdIds.leads.length) {
        await admin.from('duplicate_reviews').delete().in('incoming_lead_id', createdIds.leads)
      }
      await admin
        .from('duplicate_reviews')
        .delete()
        .in('provisional_household_id', createdIds.households)
      await admin
        .from('duplicate_reviews')
        .delete()
        .in('candidate_household_id', createdIds.households)
      await admin.from('activities').delete().in('household_id', createdIds.households)
      await admin.from('household_members').delete().in('household_id', createdIds.households)
      await admin.from('leads').delete().in('household_id', createdIds.households)
      await admin.from('assessments').delete().in('household_id', createdIds.households)
      await admin.from('tasks').delete().in('household_id', createdIds.households)
      await admin.from('households').delete().in('id', createdIds.households)
    }
  })

  it('catalog privileges and policies match Migration 030 final surface', () => {
    let dockerReady = false
    try {
      execSync('docker inspect -f {{.State.Running}} supabase_db_valtoris-financial-site_3', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      dockerReady = true
    } catch {
      dockerReady = false
    }
    if (!dockerReady) {
      // Behavioral matrix below still covers privilege outcomes via PostgREST.
      return
    }

    const authPrivs = sqlQuery(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='activities' AND grantee='authenticated'
       ORDER BY 1`,
    )
    expect(authPrivs.split('\n').filter(Boolean)).toEqual(['SELECT'])

    const anonPrivs = sqlQuery(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='activities' AND grantee='anon'`,
    )
    expect(anonPrivs).toBe('')

    const publicPrivs = sqlQuery(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='activities' AND grantee='PUBLIC'`,
    )
    expect(publicPrivs).toBe('')

    const serviceHasInsert = sqlQuery(
      `SELECT has_table_privilege('service_role', 'public.activities', 'INSERT')
         AND has_table_privilege('service_role', 'public.activities', 'SELECT')
         AND has_table_privilege('service_role', 'public.activities', 'UPDATE')
         AND has_table_privilege('service_role', 'public.activities', 'DELETE')`,
    )
    expect(serviceHasInsert).toBe('t')

    const policies = sqlQuery(
      `SELECT pol.polname FROM pg_policy pol
       JOIN pg_class c ON c.oid = pol.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relname='activities'
       ORDER BY 1`,
    )
    const policyNames = policies.split('\n').filter(Boolean)
    expect(policyNames).toContain('activities_select')
    expect(policyNames).not.toContain('activities_insert')

    const rpcAuth = sqlQuery(
      `SELECT has_function_privilege(
         'authenticated',
         'public.record_crm_activity(uuid,text,jsonb,uuid,uuid,uuid)',
         'EXECUTE'
       )`,
    )
    expect(rpcAuth).toBe('t')

    const rpcAnon = sqlQuery(
      `SELECT has_function_privilege(
         'anon',
         'public.record_crm_activity(uuid,text,jsonb,uuid,uuid,uuid)',
         'EXECUTE'
       )`,
    )
    expect(rpcAnon).toBe('f')
  })

  it('denies authenticated direct INSERT/UPDATE/DELETE; retains authorized SELECT', async () => {
    const deniedInsert = await advisorB
      .from('activities')
      .insert({
        household_id: householdId,
        activity_type: 'task_created',
        title: `${PREFIX} auth insert denied`,
        metadata: { eventKey: 'tasks.manual.created' },
      })
      .select('id')
      .single()
    expect(deniedInsert.error).toBeTruthy()
    expect(deniedInsert.data).toBeNull()

    const deniedUpdate = await advisorB
      .from('activities')
      .update({ title: `${PREFIX} auth update denied` })
      .eq('id', seedActivityId)
      .select('id')
    expect(deniedUpdate.error).toBeTruthy()

    const deniedDelete = await advisorB
      .from('activities')
      .delete()
      .eq('id', seedActivityId)
      .select('id')
    expect(deniedDelete.error).toBeTruthy()

    const okSelect = await advisorB
      .from('activities')
      .select('id, title')
      .eq('id', seedActivityId)
      .maybeSingle()
    expect(okSelect.error).toBeNull()
    expect(okSelect.data?.id).toBe(seedActivityId)
  })

  it('denies cross-household SELECT and anon table access', async () => {
    const cross = await advisorA
      .from('activities')
      .select('id')
      .eq('id', seedActivityId)
      .maybeSingle()
    expect(cross.error).toBeNull()
    expect(cross.data).toBeNull()

    const anonSelect = await anon.from('activities').select('id').limit(1)
    expect(anonSelect.error).toBeTruthy()

    const anonInsert = await anon
      .from('activities')
      .insert({
        household_id: householdId,
        activity_type: 'system',
        title: `${PREFIX} anon insert`,
        metadata: {},
      })
      .select('id')
      .single()
    expect(anonInsert.error).toBeTruthy()
  })

  it('tasks.manual.created and onboarding.completed succeed via record_crm_activity (+1 each)', async () => {
    const before = await countHouseholdActivities(householdId)

    const taskRpc = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'tasks.manual.created',
      p_metadata: {
        taskId: manualTaskId,
        sourceType: 'manual',
        workflowType: null,
        idempotencyKey: `task_created:${manualTaskId}:m030`,
      },
      p_opportunity_id: openOppId,
      p_lead_id: leadAId,
      p_assessment_id: assessmentAId,
    })
    expect(taskRpc.error).toBeNull()
    createdIds.activities.push(taskRpc.data as string)

    const mid = await countHouseholdActivities(householdId)
    expect(mid).toBe(before + 1)

    const onboardingRpc = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'onboarding.completed',
      p_metadata: {
        assessmentType: 'household_onboarding',
        idempotencyKey: `onboarding.completed:${onboardingAssessmentId}:m030`,
      },
      p_assessment_id: onboardingAssessmentId,
    })
    expect(onboardingRpc.error).toBeNull()
    createdIds.activities.push(onboardingRpc.data as string)

    const after = await countHouseholdActivities(householdId)
    expect(after).toBe(before + 2)

    const { data: taskRow } = await admin
      .from('activities')
      .select('actor_user_id, metadata')
      .eq('id', taskRpc.data as string)
      .single()
    expect(taskRow?.actor_user_id).toBe(advisorBUserId)
    expect((taskRow?.metadata as { eventKey?: string }).eventKey).toBe('tasks.manual.created')
  })

  it('denies unknown RPC event, cross-household RPC, and actor spoofing', async () => {
    const unknown = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'notes.added',
      p_metadata: {},
    })
    expect(errMsg(unknown.error)).toMatch(/CRM029:event_key_not_allowed/)

    const crossHh = await advisorA.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'tasks.manual.created',
      p_metadata: { taskId: manualTaskId, sourceType: 'manual' },
    })
    expect(errMsg(crossHh.error)).toMatch(/CRM029:not_authorized/)

    const spoofMeta = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'tasks.manual.created',
      p_metadata: {
        taskId: manualTaskId,
        sourceType: 'manual',
        actorUserId: ownerId,
        actor_user_id: ownerId,
      },
    })
    expect(errMsg(spoofMeta.error)).toMatch(/CRM029:metadata_key_not_allowed/)

    const anonRpc = await anon.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'tasks.manual.created',
      p_metadata: { taskId: manualTaskId, sourceType: 'manual' },
    })
    expect(anonRpc.error).toBeTruthy()
  })

  it('service_role direct Activity INSERT still succeeds (+1, no duplicate side effects)', async () => {
    const before = await countHouseholdActivities(householdId)
    const inserted = await admin
      .from('activities')
      .insert({
        household_id: householdId,
        activity_type: 'system',
        title: `${PREFIX} service insert`,
        metadata: { eventKey: 'system.service_role', module: 'security' },
        actor_user_id: null,
      })
      .select('id')
      .single()
    expect(inserted.error).toBeNull()
    createdIds.activities.push(inserted.data!.id)
    const after = await countHouseholdActivities(householdId)
    expect(after).toBe(before + 1)
  })

  it('SECURITY DEFINER database writer (assign_household → crm_write_activity) still succeeds', async () => {
    const before = await countHouseholdActivities(householdId)
    const { error } = await owner.rpc('assign_household', {
      p_household_id: householdId,
      p_advisor_id: advisorAProfileId,
      p_reason: 'manual',
      p_notes: `${PREFIX} reassign for activity writer`,
    })
    expect(error).toBeNull()

    // Reassign back to B so advisorB keeps SELECT/RPC access for remaining assertions.
    const { error: reassignErr } = await owner.rpc('assign_household', {
      p_household_id: householdId,
      p_advisor_id: advisorBProfileId,
      p_reason: 'manual',
      p_notes: `${PREFIX} restore B`,
    })
    expect(reassignErr).toBeNull()

    const after = await countHouseholdActivities(householdId)
    expect(after).toBeGreaterThanOrEqual(before + 2)

    const { data: rows } = await admin
      .from('activities')
      .select('id, title')
      .eq('household_id', householdId)
      .eq('title', 'Household assigned')
      .order('occurred_at', { ascending: false })
      .limit(5)
    expect((rows || []).length).toBeGreaterThanOrEqual(2)
    for (const row of rows || []) {
      if (!createdIds.activities.includes(row.id)) {
        createdIds.activities.push(row.id)
      }
    }
  })

  describe('local browser/API QA matrix', () => {
    it('manual task creation records activity through app createTask → RPC', async () => {
      const before = await countHouseholdActivities(householdId)
      const task = await createTask(
        advisorB,
        {
          title: `${PREFIX} app createTask`,
          description: 'Migration 030 local QA',
          due_date: null,
          priority: 'medium',
          assigned_user_id: advisorBUserId,
          household_id: householdId,
          opportunity_id: openOppId,
          lead_id: leadAId,
          assessment_id: assessmentAId,
          source_type: 'manual',
        },
        advisorBUserId,
      )
      createdIds.tasks.push(task.id)

      const after = await countHouseholdActivities(householdId)
      expect(after).toBe(before + 1)

      const { data: acts } = await admin
        .from('activities')
        .select('id, metadata, actor_user_id')
        .eq('household_id', householdId)
        .contains('metadata', { eventKey: 'tasks.manual.created', taskId: task.id })
      expect((acts || []).length).toBe(1)
      expect(acts![0].actor_user_id).toBe(advisorBUserId)
      createdIds.activities.push(acts![0].id)

      // Timeline/Activity reads still work for authorized advisor.
      const timeline = await advisorB
        .from('activities')
        .select('id, title, activity_type, occurred_at, metadata')
        .eq('household_id', householdId)
        .order('occurred_at', { ascending: false })
        .limit(20)
      expect(timeline.error).toBeNull()
      expect((timeline.data || []).some((r) => r.id === acts![0].id)).toBe(true)
    })

    it('onboarding completion records activity through app completeHouseholdOnboardingDraft → RPC', async () => {
      const draftId = randomUUID()
      const { error: draftErr } = await admin.from('assessments').insert({
        id: draftId,
        household_id: householdId,
        assessment_type: 'household_onboarding',
        status: 'draft',
        completed_at: null,
        answers: {},
        priorities: [],
        derived_metrics: {},
      })
      expect(draftErr).toBeNull()
      createdIds.assessments.push(draftId)

      const before = await countHouseholdActivities(householdId)
      const completed = await completeHouseholdOnboardingDraft(advisorB, draftId, householdId)
      expect(completed.status).toBe('completed')

      const after = await countHouseholdActivities(householdId)
      expect(after).toBe(before + 1)

      const { data: acts } = await admin
        .from('activities')
        .select('id, metadata, actor_user_id, title')
        .eq('household_id', householdId)
        .contains('metadata', {
          eventKey: 'onboarding.completed',
          entityId: draftId,
        })
      expect((acts || []).length).toBe(1)
      expect(acts![0].title).toBe('Household Onboarding completed')
      expect(acts![0].actor_user_id).toBe(advisorBUserId)
      createdIds.activities.push(acts![0].id)
    })

    it('authenticated PostgREST Activity INSERT fails (browser direct path closed)', async () => {
      const res = await advisorB
        .from('activities')
        .insert({
          household_id: householdId,
          activity_type: 'task_created',
          title: `${PREFIX} postgrest insert blocked`,
          metadata: { eventKey: 'tasks.manual.created' },
        })
        .select('id')
        .single()
      expect(res.error).toBeTruthy()
      expect(res.data).toBeNull()
    })

    it('Family Report Card ingest still records activities (SECURITY DEFINER)', async () => {
      const idem = randomUUID()
      const email = `${PREFIX}.family.${idem.slice(0, 8)}@example.test`
      const beforeGlobal = await admin
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('title', 'Initial Financial Diagnostic submitted')

      const { data, error } = await admin.rpc('ingest_public_family_report_card', {
        p_payload: {
          idempotency_key: idem,
          match_status: 'new_prospect',
          display_name: `${PREFIX} Family QA`,
          first_name: 'M030',
          last_name: 'Family',
          email,
          normalized_email: email.toLowerCase(),
          phone: '555-010-0300',
          normalized_phone: '+15550100300',
          submitted_at: new Date().toISOString(),
          source_page: '/family-report-card',
          overall_score: 72,
          overall_grade: 'B',
          scoring_version: 1,
          consent_snapshot: {
            assessmentStorageAcknowledged: true,
            contactPermission: true,
            privacyAcknowledged: true,
          },
          answers: {},
          raw_payload: { source: PREFIX },
        },
      })
      expect(error).toBeNull()
      expect(data?.household_id).toBeTruthy()
      createdIds.households.push(data.household_id)
      if (data.lead_id) createdIds.leads.push(data.lead_id)
      if (data.assessment_id) createdIds.assessments.push(data.assessment_id)

      const { data: acts } = await admin
        .from('activities')
        .select('id, title')
        .eq('household_id', data.household_id)
        .in('title', [
          'Initial Financial Diagnostic submitted',
          'Family Report Card assessment completed',
        ])
      expect((acts || []).length).toBe(2)
      for (const row of acts || []) createdIds.activities.push(row.id)

      const afterGlobal = await admin
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('title', 'Initial Financial Diagnostic submitted')
      expect((afterGlobal.count ?? 0) - (beforeGlobal.count ?? 0)).toBe(1)
    })

    it('Digital Identity connect ingest still records activities (service_role SQL writer)', async () => {
      const cardId = randomUUID()
      const publicKey = `pk_m030_${cardId.replace(/-/g, '').slice(0, 16)}`
      const { error: cardErr } = await admin.from('digital_cards').insert({
        id: cardId,
        advisor_profile_id: advisorBProfileId,
        slug: `m030-${cardId.slice(0, 8)}`,
        public_key: publicKey,
        status: 'published',
        published_at: new Date().toISOString(),
        publish_profile: { title: 'M030 Advisor' },
        cta_config: { primaryLabel: "Let's Connect" },
      })
      expect(cardErr).toBeNull()
      createdIds.digitalCards.push(cardId)

      const idem = randomUUID()
      const email = `${PREFIX}.di.${idem.slice(0, 8)}@example.test`
      const { data, error } = await admin.rpc('ingest_digital_identity_connect', {
        p_payload: {
          idempotency_key: idem,
          match_status: 'new_prospect',
          first_name: 'M030',
          last_name: 'Connect',
          display_name: `${PREFIX} DI QA`,
          email,
          normalized_email: email.toLowerCase(),
          phone: '555-010-0301',
          normalized_phone: '+15550100301',
          submitted_at: new Date().toISOString(),
          source_page: '/c/connect',
          advisor_profile_id: advisorBProfileId,
          card_public_key: publicKey,
          consent_snapshot: {
            contactPermission: true,
            privacyAcknowledged: true,
          },
          original_source_metadata: { cardPublicKey: publicKey },
          raw_payload: { source: PREFIX },
        },
      })
      expect(error).toBeNull()
      expect(data?.household_id).toBeTruthy()
      createdIds.households.push(data.household_id)
      if (data.lead_id) createdIds.leads.push(data.lead_id)

      const { data: acts } = await admin
        .from('activities')
        .select('id, title, metadata')
        .eq('household_id', data.household_id)
      expect((acts || []).length).toBeGreaterThanOrEqual(1)
      for (const row of acts || []) createdIds.activities.push(row.id)
    })

    it('no Cases table / workflows introduced by Migration 030', async () => {
      const casesExists = sqlQuery(
        `SELECT to_regclass('public.cases') IS NOT NULL`,
      )
      expect(casesExists).toBe('f')

      const { count: workflowTaskCount } = await admin
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .like('title', `${PREFIX}%`)
        .not('workflow_type', 'is', null)
      expect(workflowTaskCount ?? 0).toBe(0)
    })
  })
})
