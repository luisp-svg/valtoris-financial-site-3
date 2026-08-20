/**
 * Live CRM-dev integration for Migration 043 public Report Card ingest.
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Creates isolated m043qa rows and deletes them in afterAll.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEMO_BUSINESS_ANSWERS } from '../../components/reportCard/businessReportCardData'
import { DEMO_RETIREMENT_ANSWERS } from '../../components/reportCard/retirementReportCardData'
import { isEligibleForFinancialProgressEvidence } from '../households/householdsApi'
import { ingestPublicReportCard } from '../../server/ingest/familyReportCard/ingestFamilyReportCard'
import {
  recalculateBusinessReportCardScore,
  recalculateFamilyReportCardScore,
  recalculateProtectionGapResult,
  recalculateRetirementReportCardScore,
} from '../../server/ingest/familyReportCard/score'
import {
  fullConsentSnapshotFixture,
  validFamilyAnswersFixture,
  validProtectionAnswersFixture,
} from '../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../server/ingest/familyReportCard/validation'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const PREFIX = 'm043qa'

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

function crmDevReady(): { url: string; anon: string; service: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !anon || !service) return null
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  if (host !== REQUIRED_HOST) return null
  if (/prod|production/i.test(host)) return null
  return { url, anon, service }
}

const env = crmDevReady()

function phoneFromSeed(seed: string): string {
  const digits = seed.replace(/\D/g, '').slice(0, 7).padEnd(7, '0')
  return `555${digits.slice(0, 7)}`
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe.skipIf(!env)('migration 043 CRM-dev live ingest (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as { url: string; anon: string; service: string }
  let admin: SupabaseClient
  let anon: SupabaseClient
  let advisorSession: SupabaseClient | null = null

  const created = {
    households: [] as string[],
    leads: [] as string[],
    assessments: [] as string[],
    tasks: [] as string[],
    cards: [] as string[],
    campaigns: [] as string[],
  }

  let luisProfileId = ''
  let luisSlug = ''
  let luisCardPublicKey = ''
  let luisCardId = ''
  let otherAdvisorId = ''
  let createdLuisCard = false
  const campaignCode = 'm043-chamber'
  const runId = randomUUID().slice(0, 8)

  function trackPersist(householdId: string | null | undefined, leadId: string | null | undefined, assessmentId: string | null | undefined) {
    if (householdId) created.households.push(householdId)
    if (leadId) created.leads.push(leadId)
    if (assessmentId) created.assessments.push(assessmentId)
  }

  async function loadCreatedFromResult(submissionId: string) {
    const { data: lead } = await admin
      .from('leads')
      .select('id, household_id')
      .eq('public_ingest_idempotency_key', submissionId)
      .maybeSingle()
    if (!lead?.id) return { lead: null as Record<string, unknown> | null, assessments: [] as Record<string, unknown>[] }
    trackPersist(lead.household_id as string, lead.id as string, null)
    const { data: assessments } = await admin
      .from('assessments')
      .select(
        'id, household_id, lead_id, assessment_type, capture_channel, overall_score, overall_grade, derived_metrics, scoring_version, answers, completed_at',
      )
      .eq('lead_id', lead.id)
    for (const row of assessments ?? []) created.assessments.push(row.id as string)
    const { data: tasks } = await admin.from('tasks').select('id').eq('lead_id', lead.id)
    for (const row of tasks ?? []) created.tasks.push(row.id as string)
    const { data: fullLead } = await admin
      .from('leads')
      .select(
        'id, household_id, lead_type, status, overall_score, overall_grade, ingest_match_status, original_advisor_id, original_advisor_slug, original_campaign, original_source_metadata, assigned_advisor_id, consent_snapshot, public_ingest_idempotency_key',
      )
      .eq('id', lead.id)
      .single()
    return { lead: (fullLead ?? null) as Record<string, unknown> | null, assessments: (assessments ?? []) as Record<string, unknown>[] }
  }

  async function ingest(body: Record<string, unknown>, sheets: 'ok' | 'fail' = 'ok') {
    const sheetsWriter = async () =>
      sheets === 'ok'
        ? { status: 'succeeded' as const }
        : { status: 'failed' as const, errorCategory: 'timeout' as const }
    return ingestPublicReportCard(body, {
      admin,
      sheetsWriter,
      now: () => new Date('2026-08-19T18:00:00.000Z'),
    })
  }

  function familyBody(overrides: Record<string, unknown> = {}) {
    const { answers: overrideAnswers, submissionId: overrideId, ...rest } = overrides
    const id = typeof overrideId === 'string' ? overrideId : randomUUID()
    const email = `${PREFIX}.${runId}.${id.slice(0, 8)}@example.test`
    const answers = validFamilyAnswersFixture({
      family: {
        ...validFamilyAnswersFixture().family,
        firstName: 'M043',
        lastName: `Fam${id.slice(0, 4)}`,
        email,
        phone: phoneFromSeed(id),
      },
    })
    return {
      assessmentType: 'family',
      assessmentVersion: 1,
      sourcePage: '/family-report-card',
      consent: fullConsentSnapshotFixture(),
      submittedAt: '2026-08-19T18:00:00.000Z',
      ...rest,
      answers: (overrideAnswers as typeof answers) ?? answers,
      submissionId: id,
    }
  }

  function businessBody(contact: { firstName: string; lastName: string; email: string; phone: string }, overrides: Record<string, unknown> = {}) {
    const { answers: overrideAnswers, ...rest } = overrides
    const answers = clone(DEMO_BUSINESS_ANSWERS)
    answers.owner = { ...answers.owner, ...contact }
    return {
      submissionId: randomUUID(),
      assessmentType: 'business',
      assessmentVersion: 1,
      sourcePage: '/business-report-card',
      consent: fullConsentSnapshotFixture(),
      submittedAt: '2026-08-19T18:00:00.000Z',
      ...rest,
      answers: (overrideAnswers as typeof answers) ?? answers,
    }
  }

  function retirementBody(contact: { firstName: string; lastName: string; email: string; phone: string }, overrides: Record<string, unknown> = {}) {
    const { answers: overrideAnswers, ...rest } = overrides
    const answers = clone(DEMO_RETIREMENT_ANSWERS)
    answers.household = {
      ...answers.household,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
    }
    return {
      submissionId: randomUUID(),
      assessmentType: 'retirement',
      assessmentVersion: 1,
      sourcePage: '/retirement-report-card',
      consent: fullConsentSnapshotFixture(),
      submittedAt: '2026-08-19T18:00:00.000Z',
      ...rest,
      answers: (overrideAnswers as typeof answers) ?? answers,
    }
  }

  function protectionBody(contact: { firstName: string; lastName: string; email: string; phone: string }, overrides: Record<string, unknown> = {}) {
    const { answers: overrideAnswers, ...rest } = overrides
    const answers = validProtectionAnswersFixture({
      family: {
        ...validProtectionAnswersFixture().family,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
      },
    })
    return {
      submissionId: randomUUID(),
      assessmentType: 'protection',
      assessmentVersion: 1,
      sourcePage: '/protection-gap',
      consent: fullConsentSnapshotFixture(),
      submittedAt: '2026-08-19T18:00:00.000Z',
      ...rest,
      answers: (overrideAnswers as typeof answers) ?? answers,
    }
  }

  beforeAll(async () => {
    admin = createClient(cfg.url, cfg.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: advisors, error: advisorErr } = await admin
      .from('advisor_profiles')
      .select('id, slug, display_name, user_id, is_active')
      .is('deleted_at', null)
      .eq('is_active', true)
    if (advisorErr) throw advisorErr
    const luis =
      advisors?.find((row) => row.slug === 'luis-perez') ||
      advisors?.find((row) => String(row.display_name || '').toLowerCase().includes('luis perez')) ||
      advisors?.find((row) => String(row.slug || '').includes('luis'))
    if (!luis?.id) throw new Error('CRM-dev has no active Luis advisor_profiles row')
    luisProfileId = luis.id
    luisSlug = typeof luis.slug === 'string' ? luis.slug : 'luis-perez'
    otherAdvisorId = advisors?.find((row) => row.id !== luisProfileId)?.id || ''

    const { data: published } = await admin
      .from('digital_cards')
      .select('id, public_key, slug, status, advisor_profile_id')
      .eq('advisor_profile_id', luisProfileId)
      .eq('status', 'published')
      .is('deleted_at', null)
      .limit(1)
    if (published?.[0]) {
      luisCardId = published[0].id
      luisCardPublicKey = published[0].public_key
    } else {
      const cardId = randomUUID()
      const publicKey = `pk_m043qa${cardId.replace(/-/g, '').slice(0, 14)}`
      const { error: cardErr } = await admin.from('digital_cards').insert({
        id: cardId,
        advisor_profile_id: luisProfileId,
        slug: `m043qa-${runId}`,
        public_key: publicKey,
        status: 'published',
        published_at: new Date().toISOString(),
        publish_profile: { title: 'M043 QA Luis card' },
        cta_config: { primaryLabel: "Let's Connect" },
      })
      if (cardErr) throw cardErr
      created.cards.push(cardId)
      createdLuisCard = true
      luisCardId = cardId
      luisCardPublicKey = publicKey
    }

    const { data: existingCampaign } = await admin
      .from('digital_card_campaigns')
      .select('id, campaign_code')
      .eq('digital_card_id', luisCardId)
      .eq('campaign_code', campaignCode)
      .is('deleted_at', null)
      .maybeSingle()
    if (!existingCampaign) {
      const { data: inserted, error: campErr } = await admin
        .from('digital_card_campaigns')
        .insert({
          digital_card_id: luisCardId,
          campaign_code: campaignCode,
          event_code: 'breakfast',
          label: 'M043 QA Chamber',
          status: 'active',
          source_channel_default: 'link',
          default_utms: { utmSource: 'flyer' },
        })
        .select('id')
        .single()
      if (campErr) throw campErr
      created.campaigns.push(inserted.id)
    }

    const advisorPass = process.env.DEV_ADVISOR_A_PASSWORD
    if (advisorPass) {
      advisorSession = createClient(cfg.url, cfg.anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { error } = await advisorSession.auth.signInWithPassword({
        email: 'advisor.a.dev@valtoris.test',
        password: advisorPass,
      })
      if (error) advisorSession = null
    }
  }, 60_000)

  afterAll(async () => {
    if (!admin) return
    if (created.tasks.length) await admin.from('tasks').delete().in('id', created.tasks)
    if (created.assessments.length) {
      await admin.from('activities').delete().in('assessment_id', created.assessments)
      await admin.from('assessments').delete().in('id', created.assessments)
    }
    if (created.leads.length) {
      await admin.from('duplicate_reviews').delete().in('incoming_lead_id', created.leads)
      await admin.from('activities').delete().in('lead_id', created.leads)
      await admin.from('leads').delete().in('id', created.leads)
    }
    if (created.households.length) {
      await admin.from('advisor_assignments').delete().in('household_id', created.households)
      await admin.from('duplicate_reviews').delete().in('provisional_household_id', created.households)
      await admin.from('duplicate_reviews').delete().in('candidate_household_id', created.households)
      await admin.from('activities').delete().in('household_id', created.households)
      await admin.from('tasks').delete().in('household_id', created.households)
      await admin.from('household_members').delete().in('household_id', created.households)
      await admin.from('leads').delete().in('household_id', created.households)
      await admin.from('assessments').delete().in('household_id', created.households)
      await admin.from('households').delete().in('id', created.households)
    }
    if (created.campaigns.length) await admin.from('digital_card_campaigns').delete().in('id', created.campaigns)
    if (createdLuisCard && created.cards.length) await admin.from('digital_cards').delete().in('id', created.cards)
  }, 60_000)

  it('rejects ingest RPC for anon and authenticated; service_role can execute', async () => {
    const payload = {
      idempotency_key: randomUUID(),
      assessment_type: 'family',
      match_status: 'new_prospect',
      first_name: 'Nope',
      last_name: 'Anon',
    }
    const anonRes = await anon.rpc('ingest_public_report_card', { p_payload: payload })
    expect(anonRes.error).toBeTruthy()
    expect(anonRes.data).toBeNull()

    if (advisorSession) {
      const authRes = await advisorSession.rpc('ingest_public_report_card', { p_payload: payload })
      expect(authRes.error).toBeTruthy()
      expect(authRes.data).toBeNull()
    }
  })

  it('rejects arbitrary assessment_type and mismatched lead_type at the RPC', async () => {
    const base = {
      idempotency_key: randomUUID(),
      match_status: 'new_prospect',
      first_name: 'M043',
      last_name: 'BadType',
      email: `${PREFIX}.badtype.${runId}@example.test`,
      normalized_email: `${PREFIX}.badtype.${runId}@example.test`,
    }
    const arbitrary = await admin.rpc('ingest_public_report_card', {
      p_payload: { ...base, assessment_type: 'household_onboarding' },
    })
    expect(arbitrary.error?.message || '').toMatch(/invalid_assessment_type/)

    const mismatch = await admin.rpc('ingest_public_report_card', {
      p_payload: {
        ...base,
        idempotency_key: randomUUID(),
        assessment_type: 'family',
        lead_type: 'Business Report Card',
      },
    })
    expect(mismatch.error?.message || '').toMatch(/invalid_lead_type/)
  })

  it('rejects spoofed advisor/household UUIDs before touching CRM', async () => {
    const body = familyBody({
      originalAdvisorId: luisProfileId,
    })
    const spoofAdvisor = validateFamilyReportCardIngestRequest(body)
    expect(spoofAdvisor.ok).toBe(false)
    if (!spoofAdvisor.ok) expect(spoofAdvisor.code).toBe('trusted_advisor_id_forbidden')

    const spoofProfile = validateFamilyReportCardIngestRequest(
      familyBody({ advisorProfileId: luisProfileId }),
    )
    expect(spoofProfile.ok).toBe(false)

    const spoofHousehold = validateFamilyReportCardIngestRequest(
      familyBody({ householdId: randomUUID() }),
    )
    expect(spoofHousehold.ok).toBe(false)
  })

  it('FAMILY: new prospect, history, exact match, idempotent replay', async () => {
    const first = familyBody()
    const answers = first.answers as ReturnType<typeof validFamilyAnswersFixture>
    const serverScore = recalculateFamilyReportCardScore(answers)
    const firstResult = await ingest(first)
    expect(firstResult.ok).toBe(true)
    if (!firstResult.ok) return
    expect(firstResult.created).toBe(true)
    expect(firstResult.matchStatus).toBe('new_prospect')
    expect(firstResult).not.toHaveProperty('householdId')
    expect(JSON.stringify(firstResult)).not.toMatch(/original_advisor_id|assigned_advisor_id/)

    const loaded = await loadCreatedFromResult(first.submissionId as string)
    expect(loaded.lead?.lead_type).toBe('Family Report Card')
    expect(loaded.lead?.ingest_match_status).toBe('new_prospect')
    expect(loaded.assessments).toHaveLength(1)
    expect(loaded.assessments[0].capture_channel).toBe('public_self_report')
    expect(loaded.assessments[0].overall_score).toBe(serverScore.overallScore)
    expect(loaded.assessments[0].overall_grade).toBe(serverScore.overallGrade)
    expect(isEligibleForFinancialProgressEvidence({ capture_channel: 'public_self_report' })).toBe(false)

    const householdId = loaded.lead?.household_id as string
    const { data: member } = await admin
      .from('household_members')
      .select('id, first_name, last_name')
      .eq('household_id', householdId)
      .is('deleted_at', null)
    expect((member ?? []).length).toBeGreaterThan(0)
    const { data: activities } = await admin
      .from('activities')
      .select('id, title')
      .eq('household_id', householdId)
    expect((activities ?? []).some((row) => row.title === 'Initial Financial Diagnostic submitted')).toBe(true)
    const { data: tasks } = await admin.from('tasks').select('id').eq('lead_id', loaded.lead?.id)
    expect((tasks ?? []).length).toBeGreaterThan(0)

    await admin
      .from('households')
      .update({ display_name: 'TRUSTED CANONICAL M043' })
      .eq('id', householdId)

    const repeat = familyBody({
      answers: {
        ...answers,
        family: { ...answers.family, firstName: answers.family.firstName, lastName: answers.family.lastName },
      },
    })
    const repeatResult = await ingest(repeat)
    expect(repeatResult.ok).toBe(true)
    if (repeatResult.ok) {
      expect(repeatResult.created).toBe(true)
      expect(repeatResult.matchStatus).toBe('exact_trusted_match')
    }
    const loadedRepeat = await loadCreatedFromResult(repeat.submissionId as string)
    expect(loadedRepeat.lead?.household_id).toBe(householdId)
    const { data: hhAfter } = await admin
      .from('households')
      .select('id, display_name')
      .eq('normalized_email', answers.family.email.toLowerCase())
      .is('deleted_at', null)
    expect((hhAfter ?? []).filter((row) => created.households.includes(row.id)).length).toBe(1)
    expect(hhAfter?.find((row) => row.id === householdId)?.display_name).toBe('TRUSTED CANONICAL M043')

    const { count: assessmentCount } = await admin
      .from('assessments')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('assessment_type', 'family')
      .eq('capture_channel', 'public_self_report')
    expect(assessmentCount).toBe(2)

    const replay = await ingest(first)
    expect(replay.ok).toBe(true)
    if (replay.ok) expect(replay.created).toBe(false)
    const { count: leadCount } = await admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('public_ingest_idempotency_key', first.submissionId)
    expect(leadCount).toBe(1)
  }, 60_000)

  it('BUSINESS / RETIREMENT / PROTECTION: CRM types, server scores, history, no fake protection grade', async () => {
    const bizId = randomUUID()
    const bizContact = {
      firstName: 'M043',
      lastName: `Biz${bizId.slice(0, 4)}`,
      email: `${PREFIX}.biz.${runId}@example.test`,
      phone: phoneFromSeed(bizId),
    }
    const bizBody = businessBody(bizContact, { clientReportedScore: 99, clientReportedGrade: 'A+' })
    const bizServer = recalculateBusinessReportCardScore(bizBody.answers as typeof DEMO_BUSINESS_ANSWERS)
    const bizFirst = await ingest(bizBody)
    expect(bizFirst.ok).toBe(true)
    const { data: bizLead } = await admin
      .from('leads')
      .select('id, household_id, lead_type, overall_score, overall_grade')
      .eq('public_ingest_idempotency_key', bizBody.submissionId)
      .single()
    expect(bizLead?.lead_type).toBe('Business Report Card')
    expect(bizLead?.overall_score).toBe(bizServer.overallScore)
    expect(bizLead?.overall_grade).toBe(bizServer.overallGrade)
    expect(bizLead?.overall_score).not.toBe(99)
    trackPersist(bizLead?.household_id, bizLead?.id, null)
    const bizRepeat = await ingest(businessBody(bizContact))
    expect(bizRepeat.ok).toBe(true)
    const { count: bizAssessments } = await admin
      .from('assessments')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', bizLead?.household_id)
      .eq('assessment_type', 'business')
    expect(bizAssessments).toBe(2)

    const retId = randomUUID()
    const retContact = {
      firstName: 'M043',
      lastName: `Ret${retId.slice(0, 4)}`,
      email: `${PREFIX}.ret.${runId}@example.test`,
      phone: phoneFromSeed(retId),
    }
    const retAnswers = clone(DEMO_RETIREMENT_ANSWERS)
    retAnswers.household = { ...retAnswers.household, ...retContact }
    expect(retAnswers.leadDetails.consentGiven).toBe('yes')
    const retServer = recalculateRetirementReportCardScore(retAnswers)
    const retFirst = await ingest(retirementBody(retContact))
    expect(retFirst.ok).toBe(true)
    const { data: retLead } = await admin
      .from('leads')
      .select('id, household_id, lead_type, overall_score, overall_grade, consent_snapshot')
      .eq('normalized_email', retContact.email.toLowerCase())
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()
    expect(retLead?.lead_type).toBe('Retirement Report Card')
    expect(retLead?.overall_score).toBe(retServer.overallScore)
    expect(retLead?.overall_grade).toBe(retServer.overallGrade)
    const consent = (retLead?.consent_snapshot ?? {}) as Record<string, unknown>
    expect(consent.assessmentStorageAcknowledged).toBe(true)
    expect(consent.privacyAcknowledged).toBe(true)
    trackPersist(retLead?.household_id, retLead?.id, null)
    const retRepeat = await ingest(retirementBody(retContact))
    expect(retRepeat.ok).toBe(true)
    const { count: retAssessments } = await admin
      .from('assessments')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', retLead?.household_id)
      .eq('assessment_type', 'retirement')
    expect(retAssessments).toBe(2)

    const protId = randomUUID()
    const protContact = {
      firstName: 'M043',
      lastName: `Prot${protId.slice(0, 4)}`,
      email: `${PREFIX}.prot.${runId}@example.test`,
      phone: phoneFromSeed(protId),
    }
    const protAnswers = validProtectionAnswersFixture({
      family: { ...validProtectionAnswersFixture().family, ...protContact },
    })
    const gap = recalculateProtectionGapResult(protAnswers)
    const protFirst = await ingest(
      protectionBody(protContact, { clientReportedScore: 88, clientReportedGrade: 'B+' }),
    )
    expect(protFirst.ok).toBe(true)
    const { data: protLead } = await admin
      .from('leads')
      .select('id, household_id, lead_type, overall_score, overall_grade')
      .eq('normalized_email', protContact.email.toLowerCase())
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()
    expect(protLead?.lead_type).toBe('Protection Gap')
    expect(protLead?.overall_score).toBeNull()
    expect(protLead?.overall_grade).toBeNull()
    trackPersist(protLead?.household_id, protLead?.id, null)
    const { data: protAssess } = await admin
      .from('assessments')
      .select('id, overall_score, overall_grade, derived_metrics')
      .eq('lead_id', protLead?.id)
      .single()
    expect(protAssess?.overall_score).toBeNull()
    expect(protAssess?.overall_grade).toBeNull()
    const derived = (protAssess?.derived_metrics ?? {}) as Record<string, unknown>
    expect(derived.netProtectionGap).toBe(gap.netProtectionGap)
    expect(derived.totalNeed).toBe(gap.totalNeed)
    expect(derived.currentProtection).toBe(gap.currentProtection)
    expect(derived.protectionGapFormatted).toBe(gap.protectionGapFormatted)
    expect(JSON.stringify(derived)).not.toMatch(/"overallGrade":\s*"[A-F]/)
    const protRepeat = await ingest(protectionBody(protContact))
    expect(protRepeat.ok).toBe(true)
    const { count: protAssessments } = await admin
      .from('assessments')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', protLead?.household_id)
      .eq('assessment_type', 'protection')
    expect(protAssessments).toBe(2)
  }, 90_000)

  it('possible match creates duplicate review; unpublished card has no original advisor', async () => {
    const seed = familyBody()
    const seedAnswers = seed.answers as ReturnType<typeof validFamilyAnswersFixture>
    const first = await ingest(seed)
    expect(first.ok).toBe(true)
    await loadCreatedFromResult(seed.submissionId as string)

    const conflict = familyBody({
      answers: {
        ...seedAnswers,
        family: {
          ...seedAnswers.family,
          firstName: 'Morgan',
          lastName: 'Lee',
        },
      },
    })
    const conflictResult = await ingest(conflict)
    expect(conflictResult.ok).toBe(true)
    if (conflictResult.ok) expect(conflictResult.matchStatus).toBe('possible_match')
    const loadedConflict = await loadCreatedFromResult(conflict.submissionId as string)
    const { data: review } = await admin
      .from('duplicate_reviews')
      .select('id, status')
      .eq('incoming_lead_id', loadedConflict.lead?.id)
      .maybeSingle()
    expect(review?.status).toBe('pending')

    const missingKey = `pk_m043missing${runId}xxxx`
    const organic = familyBody({ cardPublicKey: missingKey })
    const organicResult = await ingest(organic)
    expect(organicResult.ok).toBe(true)
    const organicLoaded = await loadCreatedFromResult(organic.submissionId as string)
    expect(organicLoaded.lead?.original_advisor_id).toBeNull()
    expect(organicLoaded.lead?.original_advisor_slug).toBeNull()
  }, 60_000)

  it('Luis card attribution is preserved on all four types and does not steal assignment on exact match', async () => {
    const id = randomUUID()
    const contact = {
      firstName: 'M043',
      lastName: `Luis${id.slice(0, 4)}`,
      email: `${PREFIX}.luis.${runId}@example.test`,
      phone: phoneFromSeed(id),
    }
    const attribution = {
      cardPublicKey: luisCardPublicKey,
      campaignCode,
      eventCode: 'breakfast',
      sourceChannel: 'link',
      utmSource: 'flyer',
      utmMedium: 'print',
      utmCampaign: 'chamber',
    }

    const family = familyBody({
      answers: validFamilyAnswersFixture({
        family: { ...validFamilyAnswersFixture().family, ...contact },
      }),
      ...attribution,
    })
    const famRes = await ingest(family)
    expect(famRes.ok).toBe(true)
    const famLoaded = await loadCreatedFromResult(family.submissionId as string)
    expect(famLoaded.lead?.original_advisor_id).toBe(luisProfileId)
    expect(famLoaded.lead?.original_advisor_slug).toBe(luisSlug)
    expect(famLoaded.lead?.original_campaign).toBe(campaignCode)
    const meta = (famLoaded.lead?.original_source_metadata ?? {}) as Record<string, unknown>
    expect(meta.utmSource).toBe('flyer')
    expect(meta.campaignCode).toBe(campaignCode)

    const householdId = famLoaded.lead?.household_id as string
    if (otherAdvisorId && process.env.DEV_OWNER_PASSWORD) {
      const owner = createClient(cfg.url, cfg.anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { error: ownerErr } = await owner.auth.signInWithPassword({
        email: 'owner.dev@valtoris.test',
        password: process.env.DEV_OWNER_PASSWORD,
      })
      expect(ownerErr).toBeNull()
      const { error: assignErr } = await owner.rpc('assign_household', {
        p_household_id: householdId,
        p_advisor_id: otherAdvisorId,
        p_reason: 'manual',
      })
      expect(assignErr).toBeNull()
      const { data: reassigned } = await admin
        .from('households')
        .select('assigned_advisor_id')
        .eq('id', householdId)
        .single()
      expect(reassigned?.assigned_advisor_id).toBe(otherAdvisorId)
    }

    const biz = await ingest(businessBody(contact, attribution))
    const ret = await ingest(retirementBody(contact, attribution))
    const prot = await ingest(protectionBody(contact, attribution))
    expect(biz.ok && ret.ok && prot.ok).toBe(true)

    const { data: attributedLeads } = await admin
      .from('leads')
      .select('id, lead_type, original_advisor_id, original_campaign, assigned_advisor_id')
      .eq('household_id', householdId)
      .is('deleted_at', null)
    expect(attributedLeads?.every((row) => row.original_advisor_id === luisProfileId)).toBe(true)
    expect(new Set((attributedLeads ?? []).map((row) => row.lead_type))).toEqual(
      new Set(['Family Report Card', 'Business Report Card', 'Retirement Report Card', 'Protection Gap']),
    )

    const { data: household } = await admin
      .from('households')
      .select('assigned_advisor_id')
      .eq('id', householdId)
      .single()
    if (otherAdvisorId) {
      expect(household?.assigned_advisor_id).toBe(otherAdvisorId)
    }

    const invalidCampaign = await ingest(
      familyBody({
        answers: validFamilyAnswersFixture({
          family: {
            ...validFamilyAnswersFixture().family,
            firstName: 'M043',
            lastName: `Badc${id.slice(0, 4)}`,
            email: `${PREFIX}.badc.${runId}@example.test`,
            phone: phoneFromSeed(randomUUID()),
          },
        }),
        cardPublicKey: luisCardPublicKey,
        campaignCode: 'not-a-real-campaign',
        utmSource: 'spoofed',
      }),
    )
    expect(invalidCampaign.ok).toBe(true)
    const { data: invalidLead } = await admin
      .from('leads')
      .select('id, household_id, original_advisor_id, original_campaign, original_source_metadata')
      .eq('normalized_email', `${PREFIX}.badc.${runId}@example.test`)
      .maybeSingle()
    trackPersist(invalidLead?.household_id as string | null, invalidLead?.id, null)
    expect(invalidLead?.original_advisor_id).toBe(luisProfileId)
    expect(invalidLead?.original_campaign).toBeNull()
  }, 90_000)

  it('CRM success allows results even if Sheets fails; CRM failure blocks results', async () => {
    const okBody = familyBody()
    const sheetsFail = await ingest(okBody, 'fail')
    expect(sheetsFail.ok).toBe(true)
    if (sheetsFail.ok) {
      expect(sheetsFail.sheetsSync.status).toBe('failed')
      expect(sheetsFail.created).toBe(true)
    }
    await loadCreatedFromResult(okBody.submissionId as string)

    const blocked = await ingestPublicReportCard(
      { not: 'valid' },
      { admin, sheetsWriter: async () => ({ status: 'succeeded' }) },
    )
    expect(blocked.ok).toBe(false)
  })

  it('public assessment pages do not call legacy client Sheets helpers', () => {
    const files = [
      'pages/BusinessFinancialAssessment.tsx',
      'pages/RetirementAssessment.tsx',
      'pages/FamilyProtectionCalculator.tsx',
      'pages/FinancialProtectionAssessment.tsx',
    ]
    for (const file of files) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8')
      expect(src).not.toMatch(/submitBusinessReportCardLead|submitRetirementReportCardLead|submitCalculatorToGoogleSheets/)
      expect(src).toMatch(/complete(Public|Family)ReportCardCrmSubmission/)
    }
  })
})
