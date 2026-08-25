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
  extractStudentLoanSubmittedAnswers,
  mapPublicFamilyDiagnosticDetail,
  mapPublicFamilyDiagnosticListItem,
} from '../../../crm/households/assessments/diagnosticFormatters'
import { scoreStudentLoanAssessment } from './scoreStudentLoanAssessment'
import { canSubmitStudentLoanToCrm } from './ingestBoundary'
import { STUDENT_LOAN_SERVICER_MAX_LENGTH } from './constants'
import { ingestPublicReportCard } from '../../../server/ingest/familyReportCard/ingestFamilyReportCard'
import { recalculateStudentLoanReportCardScore } from '../../../server/ingest/familyReportCard/score'
import {
  validBusinessIngestRequestBodyFixture,
  validFamilyAnswersFixture,
  validIngestRequestBodyFixture,
  validProtectionIngestRequestBodyFixture,
  validRetirementIngestRequestBodyFixture,
  validStudentLoanAnswersFixture,
  validStudentLoanDiagnosticFixture,
  validStudentLoanIngestRequestBodyFixture,
} from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'

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

describe('Student Loan Phase C catalog', () => {
  it('accepts student_loan with exact Migration 048 lead mappings', () => {
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).toEqual([
      'family',
      'business',
      'retirement',
      'protection',
      'student_loan',
      'credit',
    ])
    expect(isPublicReportCardAssessmentType('student_loan')).toBe(true)
    expect(LEAD_TYPE_BY_ASSESSMENT.student_loan).toBe('Student Loan Report Card')
    expect(HOUSEHOLD_LEAD_SOURCE_BY_ASSESSMENT.student_loan).toBe('student_loan_report_card')
    expect(leadTypeForAssessment('student_loan')).toBe('Student Loan Report Card')
    expect(crmProductLabelForAssessment('student_loan')).toBe('Student Loan Report Card')
    expect(crmProductLabelForLeadType('Student Loan Report Card')).toBe('Student Loan Report Card')
    expect(crmProductLabelForLeadType('Family Report Card')).toBe('Initial Financial Diagnostic')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Family Report Card')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Business Report Card')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Retirement Report Card')
    expect(PUBLIC_REPORT_CARD_LEAD_TYPES).toContain('Protection Gap')
    expect(LEAD_TYPE_BY_ASSESSMENT.family).toBe('Family Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.business).toBe('Business Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.retirement).toBe('Retirement Report Card')
    expect(LEAD_TYPE_BY_ASSESSMENT.protection).toBe('Protection Gap')
  })
})

describe('Student Loan Phase C validation', () => {
  it('accepts a valid Student Loan payload and required contact/consent', () => {
    const result = validateFamilyReportCardIngestRequest(validStudentLoanIngestRequestBodyFixture())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.assessmentType).toBe('student_loan')
    expect(result.value.consent.assessmentStorageAcknowledged).toBe(true)
    expect(result.value.consent.privacyAcknowledged).toBe(true)
    if ('contact' in result.value.answers) {
      expect(result.value.answers.contact.firstName).toBe('Jamie')
    }
  })

  it('still requires Student Loan contact on the ingest request', () => {
    const answers = validStudentLoanAnswersFixture()
    const missing = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: { diagnostic: answers.diagnostic },
      }),
    )
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.code).toBe('unknown_student_loan_field')
  })

  it('rejects unknown diagnostic keys', () => {
    const answers = validStudentLoanAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, extra_score: '99' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unknown_student_loan_field')
  })

  it('accepts RAP and Tiered Standard as current-plan values', () => {
    const answers = validStudentLoanAnswersFixture()
    const rap = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, current_plan: 'rap' } },
      }),
    )
    const tiered = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, current_plan: 'tiered_standard' } },
      }),
    )
    expect(rap.ok).toBe(true)
    expect(tiered.ok).toBe(true)
  })

  it('rejects invalid enum values', () => {
    const answers = validStudentLoanAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, loan_status: 'in_good_standing' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_student_loan_enum')
  })

  it('rejects servicer names longer than 80 characters', () => {
    const answers = validStudentLoanAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: {
          ...answers,
          diagnostic: { ...answers.diagnostic, servicer_name: 'x'.repeat(STUDENT_LOAN_SERVICER_MAX_LENGTH + 1) },
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('student_loan_servicer_too_long')
  })

  it('rejects malformed multi-select arrays', () => {
    const answers = validStudentLoanAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, loan_types: 'direct' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('malformed_student_loan_multi')
  })

  it('rejects exclusive option conflicts', () => {
    const answers = validStudentLoanAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, previous_actions: ['idr', 'none'] } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('student_loan_exclusive_conflict')
  })

  it('rejects hidden follow-up values', () => {
    const answers = validStudentLoanAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: {
          ...answers,
          diagnostic: { ...answers.diagnostic, knows_plan: 'no', current_plan: 'ibr' },
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('student_loan_hidden_follow_up')
  })

  it('rejects forbidden credential and identity fields', () => {
    const answers = validStudentLoanAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validStudentLoanIngestRequestBodyFixture({
        answers: { ...answers, ssn: '111-22-3333' },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(['forbidden_student_loan_field', 'unknown_student_loan_field']).toContain(result.code)
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
  })
})

describe('Student Loan Phase C server scoring', () => {
  it('reuses the Phase B scorer and ignores a client-reported score', () => {
    const answers = validStudentLoanAnswersFixture()
    const expected = scoreStudentLoanAssessment(answers.diagnostic)
    const server = recalculateStudentLoanReportCardScore(answers)
    expect(server.overallScore).toBe(expected.overallScore)
    expect(server.overallGrade).toBe(expected.grade)
    expect(server.scoringVersion).toBe(1)
    expect(server.categories[0]?.title).toBe('Loan Status & Payment Stability')

    const large = scoreStudentLoanAssessment(validStudentLoanDiagnosticFixture({ total_balance: 'over_100k' }))
    const small = scoreStudentLoanAssessment(validStudentLoanDiagnosticFixture({ total_balance: 'under_25k' }))
    expect(large.overallScore).toBe(small.overallScore)

    const named = scoreStudentLoanAssessment(
      validStudentLoanDiagnosticFixture({ servicer_mode: 'named', servicer_name: 'MOHELA' }),
    )
    const unknown = scoreStudentLoanAssessment(
      validStudentLoanDiagnosticFixture({ servicer_mode: 'not_sure', servicer_name: '' }),
    )
    expect(named.overallScore).toBe(unknown.overallScore)
  })

  it('uses the same corrected review areas as the shared scorer', () => {
    const diagnostic = validStudentLoanDiagnosticFixture({
      loan_types: ['direct'],
      total_balance: '50k_100k',
      loan_status: 'repayment',
      servicer_mode: 'named',
      servicer_name: 'QA Phase D Servicer',
      knows_plan: 'yes',
      current_plan: 'ibr',
      income: '75k_125k',
      household_size: '2',
      employment_type: 'government',
      employment_tenure: '5_10',
      payment_recent: 'consistent',
      payment_paused: 'no',
      previous_actions: ['idr'],
      primary_goal: 'forgiveness_review',
      urgency: 'within_30_days',
    })
    const answers = validStudentLoanAnswersFixture({ diagnostic })
    const client = scoreStudentLoanAssessment(diagnostic)
    const server = recalculateStudentLoanReportCardScore(answers)
    expect(client.overallScore).toBe(96)
    expect(client.grade).toBe('A')
    expect(client.scoringVersion).toBe(1)
    expect(server.scoringVersion).toBe(1)
    expect(server.overallScore).toBe(client.overallScore)
    expect(server.overallGrade).toBe(client.grade)
    expect(server.reviewAreas.map((area) => area.id)).toEqual(['review_flag_pslf_unreviewed'])
    expect(client.reviewAreas.map((area) => area.id)).toEqual(['review_flag_pslf_unreviewed'])
    expect(server.priorities).toHaveLength(1)
  })

  it('persists default, delinquent, difficult-payment, and missing-PSLF flags', () => {
    expect(
      scoreStudentLoanAssessment(validStudentLoanDiagnosticFixture({ loan_status: 'default' })).flags.map(
        (flag) => flag.id,
      ),
    ).toContain('flag_default')
    expect(
      scoreStudentLoanAssessment(validStudentLoanDiagnosticFixture({ loan_status: 'delinquent' })).flags.map(
        (flag) => flag.id,
      ),
    ).toContain('flag_delinquent')
    expect(
      scoreStudentLoanAssessment(
        validStudentLoanDiagnosticFixture({ payment_recent: 'difficult_to_afford' }),
      ).flags.map((flag) => flag.id),
    ).toContain('flag_difficult_payments')
    expect(
      scoreStudentLoanAssessment(
        validStudentLoanDiagnosticFixture({ employment_type: 'government', previous_actions: ['idr'] }),
      ).flags.map((flag) => flag.id),
    ).toContain('flag_pslf_unreviewed')
  })
})

describe('Student Loan Phase C ingest', () => {
  it('maps student_loan through the existing ingest RPC without creating an Opportunity', async () => {
    const answers = validStudentLoanAnswersFixture()
    const expected = scoreStudentLoanAssessment(answers.diagnostic)
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') {
        return {
          data: {
            created: true,
            lead_id: 'lead-sl-1',
            household_id: 'hh-sl-1',
            member_id: 'member-sl-1',
            assessment_id: 'assess-sl-1',
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
      validStudentLoanIngestRequestBodyFixture({
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
    expect(payload?.assessment_type).toBe('student_loan')
    expect(payload?.lead_type).toBe('Student Loan Report Card')
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
    expect(Array.isArray(payload?.top_priorities)).toBe(true)
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
    expect(canSubmitStudentLoanToCrm()).toBe(true)
    expect(source('pages/StudentLoanAssessment.tsx')).toContain('completePublicReportCardCrmSubmission')
    expect(source('pages/StudentLoanAssessment.tsx')).not.toContain('/api/ingest-student-loan')
    expect(source('pages/StudentLoanAssessment.tsx').toLowerCase()).not.toContain('create opportunity')
    expect(source('server/ingest/familyReportCard/persist.ts')).not.toMatch(/opportunit/i)
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).not.toMatch(/insert.*opportunit/i)
    expect(source('components/assessment/studentLoan/ingestBoundary.ts')).not.toContain('opportunity')
  })
})

describe('Student Loan Phase C CRM display and boundaries', () => {
  it('labels Student Loan distinctly and keeps public rows out of Financial Progress', () => {
    expect(WORKSPACE_ASSESSMENT_TYPES).toContain('student_loan')
    const persistedAnswers = { diagnostic: validStudentLoanAnswersFixture().diagnostic }
    const list = mapPublicFamilyDiagnosticListItem(
      {
        id: 'assess-sl-1',
        household_id: 'hh-1',
        lead_id: 'lead-1',
        assessment_type: 'student_loan',
        status: 'completed',
        overall_score: 88,
        overall_grade: 'B',
        completed_at: '2026-08-22T18:00:00.000Z',
        capture_channel: 'public_self_report',
        scoring_version: 1,
        priorities: [{ title: 'Default status needs immediate review' }],
        answers: persistedAnswers,
        derived_metrics: {
          categories: [{ id: 'status_stability', title: 'Loan Status & Payment Stability', score: 30 }],
          criticalFlags: [{ id: 'flag_default', label: 'Immediate Review' }],
        },
        deleted_at: null,
      },
      { householdId: 'hh-1', isLatest: true },
    )
    expect(list?.productLabel).toBe('Student Loan Report Card')
    expect(list?.assessmentType).toBe('student_loan')
    expect(list?.productLabel).not.toBe('Initial Financial Diagnostic')
    expect(
      isEligibleForFinancialProgressEvidence({ capture_channel: 'public_self_report' }),
    ).toBe(false)

    const detail = mapPublicFamilyDiagnosticDetail(
      {
        id: 'assess-sl-1',
        household_id: 'hh-1',
        lead_id: 'lead-1',
        assessment_type: 'student_loan',
        status: 'completed',
        overall_score: 88,
        overall_grade: 'B',
        completed_at: '2026-08-22T18:00:00.000Z',
        capture_channel: 'public_self_report',
        scoring_version: 1,
        priorities: [{ title: 'Default status needs immediate review' }],
        answers: persistedAnswers,
        derived_metrics: {
          categories: [{ id: 'status_stability', title: 'Loan Status & Payment Stability', score: 30 }],
          criticalFlags: [{ id: 'flag_default', label: 'Immediate Review' }],
        },
        deleted_at: null,
      },
      'hh-1',
      null,
    )
    expect(detail?.submittedSnapshot.firstName).toBeNull()
    expect(detail?.submittedSnapshot.email).toBeNull()
    expect(detail?.submittedAnswers.some((item) => item.id === 'primary_goal')).toBe(true)
    expect(extractStudentLoanSubmittedAnswers(persistedAnswers).map((item) => item.id)).toContain(
      'urgency',
    )
    expect(JSON.stringify(detail?.submittedAnswers)).not.toMatch(/firstName|lastName|email|phone/)
  })

  it('leaves 047–049 byte-identical and does not add Migration 051', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(52)
    expect(files[48]).toBe('049_specialize_public_report_card_follow_up_copy.sql')
    expect(files[49]).toBe('050_credit_report_card_ingest.sql')
    expect(files.some((name) => name.startsWith('051_'))).toBe(true)
    expect(files.some((name) => name.startsWith('052_'))).toBe(true)
    expect(files.some((name) => name.startsWith('053_'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
  })
})
