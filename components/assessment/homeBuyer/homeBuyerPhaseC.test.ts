import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WORKSPACE_ASSESSMENT_TYPES } from '../../../crm/households/householdsApi'
import { ingestPublicReportCard } from '../../../server/ingest/familyReportCard/ingestFamilyReportCard'
import { recalculateHomeBuyerReportCardScore } from '../../../server/ingest/familyReportCard/score'
import {
  validBusinessIngestRequestBodyFixture,
  validCreditIngestRequestBodyFixture,
  validFamilyAnswersFixture,
  validHomeBuyerAnswersFixture,
  validHomeBuyerDiagnosticFixture,
  validHomeBuyerIngestRequestBodyFixture,
  validIngestRequestBodyFixture,
  validProtectionIngestRequestBodyFixture,
  validRetirementIngestRequestBodyFixture,
  validStudentLoanIngestRequestBodyFixture,
} from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'
import { scoreHomeBuyerAssessment } from './scoreHomeBuyerAssessment'
import { HOME_BUYER_CRM_INGEST_ENABLED, canSubmitHomeBuyerToCrm } from './ingestBoundary'

const ROOT = process.cwd()

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

describe('Home Buyer Phase C validation', () => {
  it('accepts a valid Home Buyer payload and required contact/consent', () => {
    const result = validateFamilyReportCardIngestRequest(validHomeBuyerIngestRequestBodyFixture())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.assessmentType).toBe('home_buyer')
    expect(result.value.consent.assessmentStorageAcknowledged).toBe(true)
    expect(result.value.consent.privacyAcknowledged).toBe(true)
    if ('contact' in result.value.answers) {
      expect(result.value.answers.contact.firstName).toBe('Jamie')
    }
  })

  it('still requires Home Buyer contact on the ingest request', () => {
    const answers = validHomeBuyerAnswersFixture()
    const missing = validateFamilyReportCardIngestRequest(
      validHomeBuyerIngestRequestBodyFixture({
        answers: { diagnostic: answers.diagnostic },
      }),
    )
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.code).toBe('unknown_home_buyer_field')
  })

  it('rejects a missing required diagnostic field', () => {
    const answers = validHomeBuyerAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validHomeBuyerIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, self_reported_score_range: '' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('incomplete_home_buyer_answers')
  })

  it('rejects unknown diagnostic keys', () => {
    const answers = validHomeBuyerAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validHomeBuyerIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, extra_score: '99' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unknown_home_buyer_field')
  })

  it('rejects invalid canonical values', () => {
    const answers = validHomeBuyerAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validHomeBuyerIngestRequestBodyFixture({
        answers: {
          ...answers,
          diagnostic: { ...answers.diagnostic, self_reported_score_range: 'mortgage_ready' },
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_home_buyer_enum')
  })

  it('rejects malformed multi-select arrays', () => {
    const answers = validHomeBuyerAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validHomeBuyerIngestRequestBodyFixture({
        answers: { ...answers, diagnostic: { ...answers.diagnostic, credit_risk_flags: 'none' } },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('malformed_home_buyer_multi')
  })

  it('rejects exclusive option conflicts', () => {
    const answers = validHomeBuyerAnswersFixture()
    const result = validateFamilyReportCardIngestRequest(
      validHomeBuyerIngestRequestBodyFixture({
        answers: {
          ...answers,
          diagnostic: { ...answers.diagnostic, credit_risk_flags: ['late_or_delinquent', 'none'] },
        },
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('home_buyer_exclusive_conflict')
  })

  it('rejects forbidden credential and identity fields', () => {
    const answers = validHomeBuyerAnswersFixture()
    const ssn = validateFamilyReportCardIngestRequest(
      validHomeBuyerIngestRequestBodyFixture({
        answers: { ...answers, ssn: '111-22-3333' },
      }),
    )
    expect(ssn.ok).toBe(false)
    if (!ssn.ok) expect(['forbidden_home_buyer_field', 'unknown_home_buyer_field']).toContain(ssn.code)

    const lender = validateFamilyReportCardIngestRequest(
      validHomeBuyerIngestRequestBodyFixture({
        answers: { ...answers, lender_login: 'broker_user' },
      }),
    )
    expect(lender.ok).toBe(false)
    if (!lender.ok) expect(['forbidden_home_buyer_field', 'unknown_home_buyer_field']).toContain(lender.code)
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
    expect(validateFamilyReportCardIngestRequest(validCreditIngestRequestBodyFixture()).ok).toBe(true)
  })
})

describe('Home Buyer Phase C server scoring', () => {
  it('reuses scoreHomeBuyerAssessment and ignores a client-reported score', () => {
    const answers = validHomeBuyerAnswersFixture()
    const expected = scoreHomeBuyerAssessment(answers.diagnostic)
    const server = recalculateHomeBuyerReportCardScore(answers)
    expect(server.overallScore).toBe(expected.overallScore)
    expect(server.overallGrade).toBe(expected.grade)
    expect(server.scoringVersion).toBe(1)
    expect(server.categories[0]?.title).toBe('Credit Readiness')
    expect(server.creditDataSource).toBe('public_self_report')
    expect(server.statusLabel).toBe('Strongly prepared')

    const later = scoreHomeBuyerAssessment(validHomeBuyerDiagnosticFixture({ target_timing: '12_plus' }))
    expect(later.overallScore).toBe(expected.overallScore)
  })

  it('keeps client and server results identical for the same canonical answers', () => {
    const diagnostic = validHomeBuyerDiagnosticFixture({ liquid_savings_band: '25_50k' })
    const answers = validHomeBuyerAnswersFixture({ diagnostic })
    const client = scoreHomeBuyerAssessment(diagnostic)
    const server = recalculateHomeBuyerReportCardScore(answers)
    expect(client.scoringVersion).toBe(1)
    expect(server.scoringVersion).toBe(1)
    expect(server.overallScore).toBe(client.overallScore)
    expect(server.overallGrade).toBe(client.grade)
    expect(server.barriers.map((item) => item.id)).toEqual(client.barriers.map((item) => item.id))
    expect(server.priorities).toHaveLength(client.nextActions.length)
  })
})

describe('Home Buyer Phase C ingest', () => {
  it('maps home_buyer through the existing ingest RPC and does not fall through to Protection', async () => {
    const answers = validHomeBuyerAnswersFixture()
    const expected = scoreHomeBuyerAssessment(answers.diagnostic)
    const admin = makeAdminStub(async (fn) => {
      if (fn === 'ingest_public_report_card') {
        return {
          data: {
            created: true,
            lead_id: 'lead-hb-1',
            household_id: 'hh-hb-1',
            member_id: 'member-hb-1',
            assessment_id: 'assess-hb-1',
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
      validHomeBuyerIngestRequestBodyFixture({
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
    expect(payload?.assessment_type).toBe('home_buyer')
    expect(payload?.lead_type).toBe('Home Buyer Report Card')
    expect(payload?.overall_score).toBe(expected.overallScore)
    expect(payload?.overall_grade).toBe(expected.grade)
    expect(payload?.scoring_version).toBe(1)
    expect(payload?.first_name).toBe('Jamie')
    expect(payload?.answers).toEqual({ diagnostic: answers.diagnostic })
    expect(payload?.answers).not.toHaveProperty('contact')
    expect(payload?.overall_score).not.toBe(12)
    expect(payload?.overall_grade).not.toBe('F')
    const derived = payload?.derived_metrics as Record<string, unknown>
    expect(derived.creditDataSource).toBe('public_self_report')
    expect(Array.isArray(derived.categories)).toBe(true)
    expect(Array.isArray(derived.hardRiskFlags)).toBe(true)
    expect(Array.isArray(derived.strengths)).toBe(true)
    expect(Array.isArray(derived.barriers)).toBe(true)
    expect(derived).not.toHaveProperty('totalNeed')
    expect(derived).not.toHaveProperty('netProtectionGap')
    const comparison = derived.scoreComparison as Record<string, unknown>
    expect(comparison.serverCalculatedScore).toBe(expected.overallScore)
    expect(comparison.clientReportedScore).toBe(12)
    expect(comparison.scoreMismatch).toBe(true)
    expect(JSON.stringify(payload)).not.toMatch(/opportunit/i)
    expect((admin.rpc as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0])).not.toContain(
      'create_opportunity',
    )
  })

  it('keeps Home Buyer out of the CRM workspace and does not add Migration 055', () => {
    expect(HOME_BUYER_CRM_INGEST_ENABLED).toBe(true)
    expect(canSubmitHomeBuyerToCrm()).toBe(true)
    expect(source('src/App.tsx')).toContain('HomeBuyerAssessment')
    expect(source('src/App.tsx')).toContain('homeBuyerAssessment')
    expect(WORKSPACE_ASSESSMENT_TYPES).not.toContain('home_buyer')
    const files = readdirSync(join(ROOT, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()
    expect(files.some((name) => name.startsWith('055_'))).toBe(false)
    expect(files.filter((name) => name.startsWith('054_'))).toEqual(['054_home_buyer_report_card_ingest.sql'])
    expect(source('server/ingest/familyReportCard/validation.ts')).not.toContain('home_buyer_answers_unavailable')
    expect(source('server/ingest/familyReportCard/ingestFamilyReportCard.ts')).not.toContain(
      'home_buyer scoring requires Batch 2',
    )
  })
})
