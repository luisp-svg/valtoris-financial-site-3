import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT,
  LEAD_TYPE_BY_ASSESSMENT,
  PUBLIC_REPORT_CARD_ASSESSMENT_TYPES,
  PUBLIC_REPORT_CARD_LEAD_TYPES,
  crmProductLabelForAssessment,
  crmProductLabelForLeadType,
  isPublicReportCardAssessmentType,
  leadTypeForAssessment,
} from '../../../modules/reportCard/publicIngestCatalog'
import { WORKSPACE_ASSESSMENT_TYPES, isEligibleForFinancialProgressEvidence } from '../../../crm/households/householdsApi'
import {
  extractCreditSubmittedAnswers,
  mapPublicFamilyDiagnosticDetail,
  mapPublicFamilyDiagnosticListItem,
} from '../../../crm/households/assessments/diagnosticFormatters'
import { getModule } from '../../../platform/registry'
import { scoreCreditAssessment } from './scoreCreditAssessment'
import { canSubmitCreditToCrm, CREDIT_CRM_INGEST_ENABLED } from './ingestBoundary'
import { ingestPublicReportCard } from '../../../server/ingest/familyReportCard/ingestFamilyReportCard'
import { recalculateCreditReportCardScore } from '../../../server/ingest/familyReportCard/score'
import {
  validBusinessIngestRequestBodyFixture,
  validCreditAnswersFixture,
  validCreditDiagnosticFixture,
  validCreditIngestRequestBodyFixture,
  validFamilyAnswersFixture,
  validIngestRequestBodyFixture,
  validProtectionIngestRequestBodyFixture,
  validRetirementIngestRequestBodyFixture,
  validStudentLoanIngestRequestBodyFixture,
} from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function makeAdminStub(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return {
    rpc: vi.fn(rpcImpl),
  } as unknown as SupabaseClient
}

function captureIngestPayload(admin: SupabaseClient): Record<string, unknown> | undefined {
  const rpcCall = (admin.rpc as ReturnType<typeof vi.fn>).mock.calls.find(
    (call) => call[0] === 'ingest_public_report_card',
  )
  return rpcCall?.[1]?.p_payload as Record<string, unknown> | undefined
}

describe('Credit Phase C catalog', () => {
  it('accepts credit with exact Migration 050 lead mappings and leaves existing mappings unchanged', () => {
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).toEqual([
      'family',
      'business',
      'retirement',
      'protection',
      'student_loan',
      'credit',
    ])
    expect(isPublicReportCardAssessmentType('credit')).toBe(true)
    expect(LEAD_TYPE_BY_ASSESSMENT.credit).toBe('Credit Report Card')
    expect(HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT.credit).toBe('credit_report_card')
    expect(leadTypeForAssessment('credit')).toBe('Credit Report Card')
    expect(crmProductLabelForAssessment('credit')).toBe('Credit Report Card')
    expect(crmProductLabelForLeadType('Credit Report Card')).toBe('Credit Report Card')
    expect(crmProductLabelForLeadType('Family Report Card')).toBe('Initial Financial Diagnostic')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Family Report Card')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Business Report Card')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Retirement Report Card')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Protection Gap')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Student Loan Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.family).toBe('Family Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.business).toBe('Business Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.retirement).toBe('Retirement Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.protection).toBe('Protection Gap')
    expect(LEAD_TYPE_BY_ASSESSMENT.student_loan).toBe('Student Loan Report Card')
    expect(HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT.student_loan).toBe('student_loan_report_card')
  })
})

describe('Credit Phase C validation', () => {
  it('accepts a valid Credit payload and required contact/consent', () => {
    const result = validateFamilyReportCardIngestRequest(validCreditIngestRequestBodyFixture())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.assessmentType).toBe('credit')
    expect(result.value.consent.assessmentStorageAcknowledged).toBe(true)
    expect(result.value.consent.privacyAcknowledged).toBe(true)
    if ('contact' in result.value.answers) {
      expect(result.value.answers.contact.firstName).toBe('Jamie')
    }
  })

  it('still requires Credit contact on the ingest request', () => {
    const answers = validCreditAnswersFixture()
    const missing = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: { diagnostic: answers.diagnostic },
      }),
    )
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.code).toBe('unknown_credit_field')
  })

  it('rejects a missing required diagnostic field', () => {
    const answers = validCreditAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, credit_goal: '' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('incomplete_credit_answers')
  })

  it('rejects unknown diagnostic keys', () => {
    const answers = validCreditAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, extra_score: '99' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unknown_credit_field')
  })

  it('rejects invalid canonical values', () => {
    const answers = validCreditAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, credit_goal: 'mortgage_approval' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_credit_enum')
  })

  it('rejects malformed multi-select arrays', () => {
    const answers = validCreditAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, negative_items: 'none' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('malformed_credit_multi')
  })

  it('rejects exclusive option conflicts', () => {
    const answers = validCreditAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, negative_items: ['collections', 'none'] } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('credit_exclusive_conflict')
  })

  it('rejects hidden follow-up values instead of normalizing them', () => {
    const answers = validCreditAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: {
          ...answers,
          diagnostic: { ...answers.diagnostic, last_reviewed: 'never', inaccuracy_belief: 'yes' },
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('credit_hidden_follow_up')
  })

  it('rejects forbidden credential and identity fields', () => {
    const answers = validCreditAnswersFixture()
    const ssn = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: { ...answers, ssn: '111-22-3333' },
      }),
    )
    expect(ssn.ok).toBe(false)
    if (!ssn.ok) expect(['forbidden_credit_field', 'unknown_credit_field']).toContain(ssn.code)

    const bureau = validateFamilyReportCardIngestRequest(
      validCreditIngestRequestBodyFixture({
        answers: { ...answers, bureau_username: 'equifax_user' },
      }),
    )
    expect(bureau.ok).toBe(false)
    if (!bureau.ok) expect(['forbidden_credit_field', 'unknown_credit_field']).toContain(bureau.code)
  })

  it('still requires Family contact completeness and does not weaken other types', () => {
    const family = validFamilyAnswersFixture()
    const incompleteFamily = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({
        answers: { ...family, family: { ...family.family, firstName: '' } },
      }),
    )
    expect(incompleteFamily.ok).toBe(false)
    expect(validateFamilyReportCardIngestRequest(validBusinessIngestRequestBodyFixture()).ok).toBe(true)
    expect(validateFamilyReportCardIngestRequest(validRetirementIngestRequestBodyFixture()).ok).toBe(true)
    expect(validateFamilyReportCardIngestRequest(validProtectionIngestRequestBodyFixture()).ok).toBe(true)
    expect(validateFamilyReportCardIngestRequest(validStudentLoanIngestRequestBodyFixture()).ok).toBe(true)
  })
})

describe('Credit Phase C server scoring', () => {
  it('reuses scoreCreditAssessment and ignores a client-reported score', () => {
    const answers = validCreditAnswersFixture()
    const expected = scoreCreditAssessment(answers.diagnostic)
    const server = recalculateCreditReportCardScore(answers)
    expect(server.overallScore).toBe(expected.overallScore)
    expect(server.overallGrade).toBe(expected.grade)
    expect(server.scoringVersion).toBe(1)
    expect(server.categories[0]?.title).toBe('Payment History')

    const urgent = scoreCreditAssessment(validCreditDiagnosticFixture({ urgency: 'asap' }))
    expect(urgent.overallScore).toBe(expected.overallScore)
  })

  it('keeps Phase B client and server results identical for the same canonical answers', () => {
    const diagnostic = validCreditDiagnosticFixture({
      utilization: '10_30',
      oldest_account: '5_10',
      self_reported_score: '700_739',
    })
    const answers = validCreditAnswersFixture({ diagnostic })
    const client = scoreCreditAssessment(diagnostic)
    const server = recalculateCreditReportCardScore(answers)
    expect(client.scoringVersion).toBe(1)
    expect(server.scoringVersion).toBe(1)
    expect(server.overallScore).toBe(client.overallScore)
    expect(server.overallGrade).toBe(client.grade)
    expect(server.reviewAreas.map((area) => area.id)).toEqual(client.reviewAreas.map((area) => area.id))
    expect(server.priorities).toHaveLength(client.reviewAreas.length)
    expect(server.priorities.length).toBeLessThanOrEqual(3)
  })

  it('preserves 0–3 meaningful review areas and does not manufacture perfect-category filler', () => {
    const perfect = recalculateCreditReportCardScore(validCreditAnswersFixture())
    expect(perfect.reviewAreas).toEqual([])
    expect(perfect.priorities).toEqual([])

    const one = recalculateCreditReportCardScore(
      validCreditAnswersFixture({
        diagnostic: validCreditDiagnosticFixture({ utilization: '10_30' }),
      }),
    )
    expect(one.reviewAreas).toHaveLength(1)
    expect(one.priorities).toHaveLength(1)
  })
})

describe('Credit Phase C ingest', () => {
  it('maps credit through the existing ingest RPC without creating an Opportunity', async () => {
    const answers = validCreditAnswersFixture()
    const expected = scoreCreditAssessment(answers.diagnostic)
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') {
        return {
          data: {
            created: true,
            lead_id: 'lead-cr-1',
            household_id: 'hh-cr-1',
            member_id: 'member-cr-1',
            assessment_id: 'assess-cr-1',
            match_status: 'new_prospect',
            sheets_sync_status: 'pending',
            duplicate_review_id: null,
          },
          error: null,
        }
      }
      return { data: null, error: null }
    })

    const result = await ingestPublicReportCard(
      validCreditIngestRequestBodyFixture({
        clientReportedScore: 12,
        clientReportedGrade: 'F',
      }),
      {
        admin,
        findCandidates: async () => [],
        sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' as const }),
      },
    )

    expect(result.ok).toBe(true)
    const payload = captureIngestPayload(admin)
    expect(payload?.assessment_type).toBe('credit')
    expect(payload?.lead_type).toBe('Credit Report Card')
    expect(payload?.overall_score).toBe(expected.overallScore)
    expect(payload?.overall_grade).toBe(expected.grade)
    expect(payload?.scoring_version).toBe(1)
    expect(payload?.first_name).toBe('Jamie')
    expect(payload?.last_name).toBe('Rivera')
    expect(payload?.email).toBe('jamie.rivera@example.com')
    expect(payload?.phone).toBe('555-201-4488')
    expect(payload?.answers).toEqual({ diagnostic: answers.diagnostic })
    expect(payload?.answers).not.toHaveProperty('contact')
    expect(JSON.stringify(payload?.answers)).not.toContain('firstName')
    expect(JSON.stringify(payload?.answers)).not.toContain('lastName')
    expect(JSON.stringify(payload?.answers)).not.toContain('jamie.rivera@example.com')
    expect(JSON.stringify(payload?.answers)).not.toContain('555-201-4488')
    expect(payload?.overall_score).not.toBe(12)
    expect(payload?.overall_grade).not.toBe('F')
    const derived = payload?.derived_metrics as Record<string, unknown>
    expect(Array.isArray(derived.categories)).toBe(true)
    expect(Array.isArray(derived.criticalFlags)).toBe(true)
    expect(Array.isArray(derived.topReviewAreas)).toBe(true)
    expect(Array.isArray(payload?.top_priorities)).toBe(true)
    expect((payload?.top_priorities as unknown[]).length).toBe(0)
    const comparison = derived.scoreComparison as Record<string, unknown>
    expect(comparison.serverCalculatedScore).toBe(expected.overallScore)
    expect(comparison.clientReportedScore).toBe(12)
    expect(comparison.scoreMismatch).toBe(true)
    expect(JSON.stringify(payload)).not.toMatch(/opportunit/i)
    expect(JSON.stringify(payload)).not.toMatch(/recommendation/i)
    expect(JSON.stringify(payload)).not.toMatch(/policy_application/i)
    expect(JSON.stringify(payload)).not.toMatch(/commission/i)
    expect((admin.rpc as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0])).not.toContain(
      'create_opportunity',
    )
  })

  it('does not add a new public endpoint or Opportunity write in the public path', () => {
    expect(CREDIT_CRM_INGEST_ENABLED).toBe(true)
    expect(canSubmitCreditToCrm()).toBe(true)
    expect(source('pages/CreditAssessment.tsx')).toContain('completePublicReportCardCrmSubmission')
    expect(source('pages/CreditAssessment.tsx')).not.toContain('/api/ingest-credit')
    expect(source('pages/CreditAssessment.tsx').toLowerCase()).not.toContain('create opportunity')
    expect(source('server/ingest/familyReportCard/persist.ts')).not.toMatch(/opportunit/i)
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).not.toMatch(/insert.*opportunit/i)
    expect(source('components/assessment/credit/ingestBoundary.ts')).not.toContain('opportunity')
  })
})

describe('Credit Phase C CRM display and boundaries', () => {
  it('labels Credit distinctly and keeps public rows out of Financial Progress', () => {
    expect(WORKSPACE_ASSESSMENT_TYPES).toContain('credit')
    const persistedAnswers = { diagnostic: validCreditAnswersFixture().diagnostic }
    const list = mapPublicFamilyDiagnosticListItem(
      {
        id: 'assess-cr-1',
        household_id: 'hh-1',
        lead_id: 'lead-1',
        assessment_type: 'credit',
        status: 'completed',
        overall_score: 74,
        overall_grade: 'C',
        completed_at: '2026-08-24T18:00:00.000Z',
        capture_channel: 'public_self_report',
        scoring_version: 1,
        priorities: [{ title: 'An account may currently be past due' }],
        answers: persistedAnswers,
        derived_metrics: {
          categories: [{ id: 'payment_history', title: 'Payment History', score: 18 }],
          criticalFlags: [{ id: 'flag_past_due', label: 'Immediate Review' }],
        },
        deleted_at: null,
      },
      { householdId: 'hh-1', isLatest: true },
    )
    expect(list?.productLabel).toBe('Credit Report Card')
    expect(list?.assessmentType).toBe('credit')
    expect(list?.productLabel).not.toBe('Initial Financial Diagnostic')
    expect(
      isEligibleForFinancialProgressEvidence({ capture_channel: 'public_self_report' }),
    ).toBe(false)

    const detail = mapPublicFamilyDiagnosticDetail(
      {
        id: 'assess-cr-1',
        household_id: 'hh-1',
        lead_id: 'lead-1',
        assessment_type: 'credit',
        status: 'completed',
        overall_score: 74,
        overall_grade: 'C',
        completed_at: '2026-08-24T18:00:00.000Z',
        capture_channel: 'public_self_report',
        scoring_version: 1,
        priorities: [{ title: 'An account may currently be past due' }],
        answers: persistedAnswers,
        derived_metrics: {
          categories: [{ id: 'payment_history', title: 'Payment History', score: 18 }],
          criticalFlags: [{ id: 'flag_past_due', label: 'Immediate Review' }],
        },
        deleted_at: null,
      },
      'hh-1',
      null,
    )
    expect(detail?.submittedSnapshot.firstName).toBeNull()
    expect(detail?.submittedSnapshot.email).toBeNull()
    expect(detail?.submittedAnswers.some((item) => item.id === 'credit_goal')).toBe(true)
    expect(extractCreditSubmittedAnswers(persistedAnswers).map((item) => item.id)).toContain('urgency')
    expect(JSON.stringify(detail?.submittedAnswers)).not.toMatch(/firstName|lastName|email|phone/)
  })

  it('leaves 047–050 byte-identical, does not add Migration 051, and keeps credit_repair disabled', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(52)
    expect(files[49]).toBe('050_credit_report_card_ingest.sql')
    expect(files.some((name) => name.startsWith('051_'))).toBe(true)
    expect(files.some((name) => name.startsWith('052_'))).toBe(true)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(fileSha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source('platform/registry/catalog.ts')).toContain("key: 'credit_repair'")
    expect(source('platform/registry/catalog.ts')).toContain('featureFlag: { enabled: false }')
    expect(source('supabase/migrations/050_credit_report_card_ingest.sql')).toContain(
      "WHEN 'credit' THEN 'Credit Report Card'",
    )
    expect(source('supabase/migrations/050_credit_report_card_ingest.sql')).toContain(
      "v_title := 'Review ' || v_product || ' and follow up'",
    )
    expect(source('supabase/migrations/050_credit_report_card_ingest.sql')).toContain(
      "v_title := 'Review ' || v_product || ' — no contact permission'",
    )
    expect(source('supabase/migrations/050_credit_report_card_ingest.sql')).toContain(
      "'Follow-up review task created for public ' || v_product || '.'",
    )
    expect(source('supabase/migrations/050_credit_report_card_ingest.sql')).toContain(
      "'review_initial_diagnostic'",
    )
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).not.toContain(
      'create_public_credit_follow_up',
    )
  })
})
