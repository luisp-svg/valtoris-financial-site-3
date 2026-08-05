/**
 * Live local-Supabase integration for Migration 029 security hardening.
 *
 * Runs against the final local schema (migrations through 030). Migration 029
 * Phase A historically kept authenticated Activity INSERT; Migration 030
 * revokes it. Activity write assertions below therefore use:
 *   - service_role for direct table INSERT (integrity / metadata triggers)
 *   - record_crm_activity for authenticated browser-equivalent publish
 *
 * Skips automatically when local Supabase is unavailable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PASS = 'LocalQaPass029!'
const PREFIX = 'm029sec'
const SUBJECT_ERR = /CRM029:subject_relationship_invalid/

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
    }
  } catch {
    return null
  }
}

const localEnv = tryLoadLocalEnv()

function errMsg(error: { message?: string } | null | undefined): string {
  return error?.message || ''
}

describe.skipIf(!localEnv)('migration 029 security hardening (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
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
  let wonStageId = ''
  let relationshipPipelineId = ''
  let relationshipStageId = ''

  let householdId = ''
  let householdBId = ''
  let openOppId = ''
  let onHoldOppId = ''
  let wonOppId = ''
  let leadAId = ''
  let leadBId = ''
  let assessmentAId = ''
  let assessmentBId = ''
  let onboardingAssessmentId = ''
  let manualTaskId = ''

  const createdIds = {
    households: [] as string[],
    opportunities: [] as string[],
    leads: [] as string[],
    assessments: [] as string[],
    notes: [] as string[],
    documents: [] as string[],
    tasks: [] as string[],
    activities: [] as string[],
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

  async function createOpportunity(input: {
    householdId: string
    advisorId: string
    title: string
    status: 'open' | 'on_hold' | 'won' | 'lost'
    stageId: string
  }): Promise<string> {
    const id = randomUUID()
    const { error } = await admin.from('opportunities').insert({
      id,
      title: `${PREFIX} ${input.title}`,
      household_id: input.householdId,
      service_vertical_id: verticalId,
      pipeline_id: pipelineId,
      stage_id: input.stageId,
      status: input.status,
      assigned_advisor_id: input.advisorId,
      assigned_at: new Date().toISOString(),
      assigned_by_user_id: ownerId,
      assignment_reason: 'manual',
      stage_entered_at: new Date().toISOString(),
      closed_at:
        input.status === 'won' || input.status === 'lost' ? new Date().toISOString() : null,
    })
    if (error) throw error
    createdIds.opportunities.push(id)
    return id
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    ownerId = await ensureUser(`${PREFIX}.owner@valtoris.test`, 'M029 Owner', 'owner')
    advisorAUserId = await ensureUser(`${PREFIX}.adv.a@valtoris.test`, 'M029 Advisor A', 'advisor')
    advisorBUserId = await ensureUser(`${PREFIX}.adv.b@valtoris.test`, 'M029 Advisor B', 'advisor')
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
    wonStageId = (stages!.find((s) => s.is_won) || stages![stages!.length - 1]).id

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

    householdId = await createHousehold(advisorAProfileId, 'HH-A')
    householdBId = await createHousehold(advisorBProfileId, 'HH-B')

    openOppId = await createOpportunity({
      householdId,
      advisorId: advisorAProfileId,
      title: 'open',
      status: 'open',
      stageId: openStageId,
    })
    onHoldOppId = await createOpportunity({
      householdId,
      advisorId: advisorAProfileId,
      title: 'on-hold',
      status: 'on_hold',
      stageId: openStageId,
    })
    wonOppId = await createOpportunity({
      householdId,
      advisorId: advisorAProfileId,
      title: 'won',
      status: 'won',
      stageId: wonStageId,
    })

    leadAId = randomUUID()
    leadBId = randomUUID()
    const { error: leadErr } = await admin.from('leads').insert([
      {
        id: leadAId,
        household_id: householdId,
        lead_type: 'family_report_card',
        status: 'assigned',
        assessment_type: 'family',
        assigned_advisor_id: advisorAProfileId,
        normalized_email: `${PREFIX}.leada@example.com`,
      },
      {
        id: leadBId,
        household_id: householdBId,
        lead_type: 'family_report_card',
        status: 'assigned',
        assessment_type: 'family',
        assigned_advisor_id: advisorBProfileId,
        normalized_email: `${PREFIX}.leadb@example.com`,
      },
    ])
    if (leadErr) throw leadErr
    createdIds.leads.push(leadAId, leadBId)

    assessmentAId = randomUUID()
    assessmentBId = randomUUID()
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
        id: assessmentBId,
        household_id: householdBId,
        lead_id: leadBId,
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
    createdIds.assessments.push(assessmentAId, assessmentBId, onboardingAssessmentId)

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
      created_by_user_id: advisorAUserId,
    })
    if (taskErr) throw taskErr
    createdIds.tasks.push(manualTaskId)
  }, 120_000)

  afterAll(async () => {
    if (!admin) return
    if (createdIds.activities.length) {
      await admin.from('activities').delete().in('id', createdIds.activities)
    }
    if (createdIds.tasks.length) await admin.from('tasks').delete().in('id', createdIds.tasks)
    if (createdIds.notes.length) await admin.from('notes').delete().in('id', createdIds.notes)
    if (createdIds.documents.length) {
      await admin.from('documents').delete().in('id', createdIds.documents)
    }
    if (createdIds.assessments.length) {
      await admin.from('assessments').delete().in('id', createdIds.assessments)
    }
    if (createdIds.opportunities.length) {
      await admin.from('opportunities').delete().in('id', createdIds.opportunities)
    }
    if (createdIds.leads.length) await admin.from('leads').delete().in('id', createdIds.leads)
    if (createdIds.households.length) {
      await admin.from('advisor_assignments').delete().in('household_id', createdIds.households)
      await admin.from('activities').delete().in('household_id', createdIds.households)
      await admin.from('households').delete().in('id', createdIds.households)
    }
  })

  it('H1 + opportunity assignment history on assign_household', async () => {
    const { error: assignErr } = await owner.rpc('assign_household', {
      p_household_id: householdId,
      p_advisor_id: advisorBProfileId,
      p_reason: 'manual',
      p_notes: `${PREFIX} reassign to B`,
    })
    expect(assignErr).toBeNull()

    const { data: openAfter } = await admin
      .from('opportunities')
      .select('assigned_advisor_id')
      .eq('id', openOppId)
      .single()
    const { data: holdAfter } = await admin
      .from('opportunities')
      .select('assigned_advisor_id')
      .eq('id', onHoldOppId)
      .single()
    const { data: wonAfter } = await admin
      .from('opportunities')
      .select('assigned_advisor_id')
      .eq('id', wonOppId)
      .single()
    expect(openAfter?.assigned_advisor_id).toBe(advisorBProfileId)
    expect(holdAfter?.assigned_advisor_id).toBe(advisorBProfileId)
    expect(wonAfter?.assigned_advisor_id).toBe(advisorAProfileId)

    const { data: oppHistory } = await admin
      .from('advisor_assignments')
      .select('id, opportunity_id, advisor_id, effective_to')
      .eq('household_id', householdId)
      .eq('opportunity_id', openOppId)
      .is('effective_to', null)
    expect(oppHistory?.length).toBe(1)
    expect(oppHistory?.[0]?.advisor_id).toBe(advisorBProfileId)

    const aSelect = await advisorA.from('opportunities').select('id').eq('id', openOppId).maybeSingle()
    expect(aSelect.data).toBeNull()
    const bSelect = await advisorB.from('opportunities').select('id').eq('id', openOppId).maybeSingle()
    expect(bSelect.data?.id).toBe(openOppId)
    const aWon = await advisorA.from('opportunities').select('id').eq('id', wonOppId).maybeSingle()
    expect(aWon.data).toBeNull()

    const direct = await owner
      .from('opportunities')
      .update({ assigned_advisor_id: advisorAProfileId })
      .eq('id', openOppId)
      .select('id')
    expect(direct.error).toBeTruthy()
  })

  describe('H2 documents INSERT/UPDATE', () => {
    it('allows same-household opportunity/lead and NULL refs on INSERT', async () => {
      const ok = await admin
        .from('documents')
        .insert({
          household_id: householdId,
          opportunity_id: openOppId,
          lead_id: leadAId,
          doc_type: 'other',
          file_name: 'ok.txt',
          storage_path: `${PREFIX}/${randomUUID()}.txt`,
          uploaded_by_user_id: ownerId,
        })
        .select('id')
        .single()
      expect(ok.error).toBeNull()
      createdIds.documents.push(ok.data!.id)

      const nul = await admin
        .from('documents')
        .insert({
          household_id: householdId,
          opportunity_id: null,
          lead_id: null,
          doc_type: 'other',
          file_name: 'null.txt',
          storage_path: `${PREFIX}/${randomUUID()}-null.txt`,
          uploaded_by_user_id: ownerId,
        })
        .select('id')
        .single()
      expect(nul.error).toBeNull()
      createdIds.documents.push(nul.data!.id)
    })

    it('rejects foreign opportunity/lead on INSERT with generic error', async () => {
      const foreignOpp = await admin
        .from('documents')
        .insert({
          household_id: householdBId,
          opportunity_id: openOppId,
          doc_type: 'other',
          file_name: 'bad-opp.txt',
          storage_path: `${PREFIX}/${randomUUID()}-fo.txt`,
        })
        .select('id')
        .single()
      expect(errMsg(foreignOpp.error)).toMatch(SUBJECT_ERR)

      const foreignLead = await admin
        .from('documents')
        .insert({
          household_id: householdId,
          lead_id: leadBId,
          doc_type: 'other',
          file_name: 'bad-lead.txt',
          storage_path: `${PREFIX}/${randomUUID()}-fl.txt`,
        })
        .select('id')
        .single()
      expect(errMsg(foreignLead.error)).toMatch(SUBJECT_ERR)

      const missing = await admin
        .from('documents')
        .insert({
          household_id: householdId,
          opportunity_id: randomUUID(),
          doc_type: 'other',
          file_name: 'missing.txt',
          storage_path: `${PREFIX}/${randomUUID()}-miss.txt`,
        })
        .select('id')
        .single()
      expect(errMsg(missing.error)).toMatch(SUBJECT_ERR)
    })

    it('rejects UPDATE that introduces foreign refs or household move with retained refs', async () => {
      const base = await admin
        .from('documents')
        .insert({
          household_id: householdId,
          opportunity_id: openOppId,
          lead_id: leadAId,
          doc_type: 'other',
          file_name: 'upd.txt',
          storage_path: `${PREFIX}/${randomUUID()}-upd.txt`,
        })
        .select('id')
        .single()
      createdIds.documents.push(base.data!.id)

      const updOpp = await admin
        .from('documents')
        .update({ opportunity_id: randomUUID() })
        .eq('id', base.data!.id)
        .select('id')
        .single()
      expect(errMsg(updOpp.error)).toMatch(SUBJECT_ERR)

      const updLead = await admin
        .from('documents')
        .update({ lead_id: leadBId })
        .eq('id', base.data!.id)
        .select('id')
        .single()
      expect(errMsg(updLead.error)).toMatch(SUBJECT_ERR)

      const moveHh = await admin
        .from('documents')
        .update({ household_id: householdBId })
        .eq('id', base.data!.id)
        .select('id')
        .single()
      expect(errMsg(moveHh.error)).toMatch(SUBJECT_ERR)
    })
  })

  describe('H2 notes INSERT/UPDATE', () => {
    it('allows same-household and NULL opportunity; rejects foreign on INSERT/UPDATE', async () => {
      const ok = await advisorB
        .from('notes')
        .insert({
          household_id: householdId,
          opportunity_id: openOppId,
          author_user_id: advisorBUserId,
          body: `${PREFIX} note ok`,
        })
        .select('id')
        .single()
      expect(ok.error).toBeNull()
      createdIds.notes.push(ok.data!.id)

      const nul = await advisorB
        .from('notes')
        .insert({
          household_id: householdId,
          opportunity_id: null,
          author_user_id: advisorBUserId,
          body: `${PREFIX} note null`,
        })
        .select('id')
        .single()
      expect(nul.error).toBeNull()
      createdIds.notes.push(nul.data!.id)

      const badIns = await owner
        .from('notes')
        .insert({
          household_id: householdBId,
          opportunity_id: openOppId,
          author_user_id: ownerId,
          body: `${PREFIX} note bad`,
        })
        .select('id')
        .single()
      expect(errMsg(badIns.error)).toMatch(SUBJECT_ERR)

      const badUpd = await owner
        .from('notes')
        .update({ opportunity_id: openOppId })
        .eq('id', nul.data!.id)
        // first move note to B then attach open opp
        .select('id')
      // same-hh update to openOpp from null should succeed
      expect(badUpd.error).toBeNull()

      const noteB = await owner
        .from('notes')
        .insert({
          household_id: householdBId,
          author_user_id: ownerId,
          body: `${PREFIX} note B`,
        })
        .select('id')
        .single()
      createdIds.notes.push(noteB.data!.id)
      const crossUpd = await owner
        .from('notes')
        .update({ opportunity_id: openOppId })
        .eq('id', noteB.data!.id)
        .select('id')
        .single()
      expect(errMsg(crossUpd.error)).toMatch(SUBJECT_ERR)

      const moveHh = await owner
        .from('notes')
        .update({ household_id: householdBId })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(moveHh.error)).toMatch(SUBJECT_ERR)
    })
  })

  describe('H2 activities INSERT/UPDATE', () => {
    it('covers opportunity/lead/assessment same/foreign/NULL INSERT and UPDATE', async () => {
      // Authenticated direct INSERT revoked by Migration 030 — exercise integrity
      // triggers via service_role (same BEFORE INSERT/UPDATE functions).
      const ok = await admin
        .from('activities')
        .insert({
          household_id: householdId,
          opportunity_id: openOppId,
          lead_id: leadAId,
          assessment_id: assessmentAId,
          activity_type: 'task_created',
          title: `${PREFIX} act ok`,
          metadata: { eventKey: 'tasks.manual.created' },
        })
        .select('id')
        .single()
      expect(ok.error).toBeNull()
      createdIds.activities.push(ok.data!.id)

      const nul = await admin
        .from('activities')
        .insert({
          household_id: householdId,
          activity_type: 'note_added',
          title: `${PREFIX} act null`,
          metadata: {},
        })
        .select('id')
        .single()
      expect(nul.error).toBeNull()
      createdIds.activities.push(nul.data!.id)

      for (const [label, row] of [
        ['opp', { opportunity_id: openOppId, household_id: householdBId }],
        ['lead', { lead_id: leadBId, household_id: householdId }],
        ['assessment', { assessment_id: assessmentBId, household_id: householdId }],
        ['missing', { opportunity_id: randomUUID(), household_id: householdId }],
      ] as const) {
        const res = await admin
          .from('activities')
          .insert({
            ...row,
            activity_type: 'system',
            title: `${PREFIX} act bad ${label}`,
            metadata: {},
          })
          .select('id')
          .single()
        expect(errMsg(res.error), label).toMatch(SUBJECT_ERR)
      }

      // UPDATE via service role (authenticated UPDATE denied)
      const updOpp = await admin
        .from('activities')
        .update({ opportunity_id: randomUUID() })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(updOpp.error)).toMatch(SUBJECT_ERR)

      const updLead = await admin
        .from('activities')
        .update({ lead_id: leadBId })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(updLead.error)).toMatch(SUBJECT_ERR)

      const updAssess = await admin
        .from('activities')
        .update({ assessment_id: assessmentBId })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(updAssess.error)).toMatch(SUBJECT_ERR)

      const moveHh = await admin
        .from('activities')
        .update({ household_id: householdBId })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(moveHh.error)).toMatch(SUBJECT_ERR)
    })
  })

  describe('H2 tasks INSERT/UPDATE', () => {
    it('covers opportunity/lead/assessment same/foreign/NULL INSERT and UPDATE', async () => {
      const ok = await advisorB
        .from('tasks')
        .insert({
          household_id: householdId,
          opportunity_id: openOppId,
          lead_id: leadAId,
          assessment_id: assessmentAId,
          title: `${PREFIX} task ok`,
          created_by_user_id: advisorBUserId,
        })
        .select('id')
        .single()
      expect(ok.error).toBeNull()
      createdIds.tasks.push(ok.data!.id)

      const nul = await advisorB
        .from('tasks')
        .insert({
          household_id: householdId,
          title: `${PREFIX} task null`,
          created_by_user_id: advisorBUserId,
        })
        .select('id')
        .single()
      expect(nul.error).toBeNull()
      createdIds.tasks.push(nul.data!.id)

      for (const [label, row] of [
        [
          'opp',
          {
            household_id: householdBId,
            opportunity_id: openOppId,
            title: `${PREFIX} task bad opp`,
            created_by_user_id: advisorBUserId,
          },
        ],
        [
          'lead',
          {
            household_id: householdId,
            lead_id: leadBId,
            title: `${PREFIX} task bad lead`,
            created_by_user_id: advisorBUserId,
          },
        ],
        [
          'assessment',
          {
            household_id: householdId,
            assessment_id: assessmentBId,
            title: `${PREFIX} task bad assessment`,
            created_by_user_id: advisorBUserId,
          },
        ],
        [
          'missing',
          {
            household_id: householdId,
            lead_id: randomUUID(),
            title: `${PREFIX} task bad missing`,
            created_by_user_id: advisorBUserId,
          },
        ],
      ] as const) {
        const res = await advisorB.from('tasks').insert(row).select('id').single()
        expect(errMsg(res.error), label).toMatch(SUBJECT_ERR)
      }

      const updLead = await advisorB
        .from('tasks')
        .update({ lead_id: leadBId })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(updLead.error)).toMatch(SUBJECT_ERR)

      const updAssess = await advisorB
        .from('tasks')
        .update({ assessment_id: assessmentBId })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(updAssess.error)).toMatch(SUBJECT_ERR)

      const updOpp = await advisorB
        .from('tasks')
        .update({ opportunity_id: randomUUID() })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(updOpp.error)).toMatch(SUBJECT_ERR)

      const moveHh = await advisorB
        .from('tasks')
        .update({ household_id: householdBId })
        .eq('id', ok.data!.id)
        .select('id')
        .single()
      expect(errMsg(moveHh.error)).toMatch(SUBJECT_ERR)
    })
  })

  it('Migration 030 final grants: authenticated Activity INSERT denied; SELECT/RPC remain', async () => {
    // Phase A (029) temporarily kept authenticated INSERT. Final schema (030)
    // revokes it — browser writers must use record_crm_activity only.
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

    const serviceInsert = await admin
      .from('activities')
      .insert({
        household_id: householdId,
        opportunity_id: openOppId,
        lead_id: leadAId,
        assessment_id: assessmentAId,
        activity_type: 'task_created',
        title: `${PREFIX} manual task`,
        body: null,
        metadata: {
          eventKey: 'tasks.manual.created',
          module: 'tasks',
          entityType: 'task',
          entityId: manualTaskId,
          visibility: 'internal',
          pinned: false,
          actorKind: 'user',
          taskId: manualTaskId,
          workflowType: null,
          sourceType: 'manual',
          idempotencyKey: `task_created:${manualTaskId}`,
        },
      })
      .select('id')
      .single()
    expect(serviceInsert.error).toBeNull()
    createdIds.activities.push(serviceInsert.data!.id)

    const badMeta = await admin
      .from('activities')
      .insert({
        household_id: householdId,
        activity_type: 'system',
        title: 'array meta',
        metadata: [],
      })
      .select('id')
      .single()
    expect(errMsg(badMeta.error)).toMatch(/CRM029:activity_metadata_must_be_object/)

    const updDenied = await advisorB
      .from('activities')
      .update({ title: 'nope' })
      .eq('id', serviceInsert.data!.id)
      .select('id')
    expect(updDenied.error).toBeTruthy()

    const delDenied = await advisorB
      .from('activities')
      .delete()
      .eq('id', serviceInsert.data!.id)
      .select('id')
    expect(delDenied.error).toBeTruthy()

    const sel = await advisorB
      .from('activities')
      .select('id')
      .eq('id', serviceInsert.data!.id)
      .maybeSingle()
    expect(sel.error).toBeNull()
    expect(sel.data?.id).toBe(serviceInsert.data!.id)
  })

  it('record_crm_activity: event-key contract, subjects, and rejects', async () => {
    const taskRpc = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'tasks.manual.created',
      p_metadata: {
        taskId: manualTaskId,
        sourceType: 'manual',
        workflowType: null,
        idempotencyKey: `task_created:${manualTaskId}`,
      },
      p_opportunity_id: openOppId,
      p_lead_id: leadAId,
      p_assessment_id: assessmentAId,
    })
    expect(taskRpc.error).toBeNull()
    createdIds.activities.push(taskRpc.data as string)

    const { data: taskRow } = await admin
      .from('activities')
      .select('activity_type, title, body, occurred_at, metadata, actor_user_id')
      .eq('id', taskRpc.data as string)
      .single()
    expect(taskRow?.activity_type).toBe('task_created')
    expect(taskRow?.title).toBe(`${PREFIX} manual task`)
    expect(taskRow?.body).toBeNull()
    expect(taskRow?.actor_user_id).toBe(advisorBUserId)
    expect((taskRow?.metadata as { visibility?: string }).visibility).toBe('internal')
    expect((taskRow?.metadata as { eventKey?: string }).eventKey).toBe('tasks.manual.created')

    const onboardingRpc = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'onboarding.completed',
      p_metadata: {
        assessmentType: 'household_onboarding',
        idempotencyKey: `onboarding.completed:${onboardingAssessmentId}`,
      },
      p_assessment_id: onboardingAssessmentId,
    })
    expect(onboardingRpc.error).toBeNull()
    createdIds.activities.push(onboardingRpc.data as string)

    const badEvent = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'notes.added',
      p_metadata: {},
    })
    expect(errMsg(badEvent.error)).toMatch(/CRM029:event_key_not_allowed/)

    const badTask = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'tasks.manual.created',
      p_metadata: { taskId: randomUUID(), sourceType: 'manual' },
    })
    expect(errMsg(badTask.error)).toMatch(SUBJECT_ERR)

    const badMetaKey = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'tasks.manual.created',
      p_metadata: { taskId: manualTaskId, aiSummaryRef: 'x' },
    })
    expect(errMsg(badMetaKey.error)).toMatch(/CRM029:metadata_key_not_allowed/)

    const deniedA = await advisorA.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'tasks.manual.created',
      p_metadata: { taskId: manualTaskId },
    })
    expect(errMsg(deniedA.error)).toMatch(/CRM029:not_authorized/)

    const onboardingWithOpp = await advisorB.rpc('record_crm_activity', {
      p_household_id: householdId,
      p_event_key: 'onboarding.completed',
      p_metadata: { assessmentType: 'household_onboarding' },
      p_assessment_id: onboardingAssessmentId,
      p_opportunity_id: openOppId,
    })
    expect(errMsg(onboardingWithOpp.error)).toMatch(/CRM029:subject_parameter_not_allowed/)
  })
})
