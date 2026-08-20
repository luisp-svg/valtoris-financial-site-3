import { describe, expect, it, vi } from 'vitest'
import {
  extractDiagnosticCategories,
  extractDiagnosticFlags,
  extractDiagnosticPriorities,
  extractSubmittedDiagnosticSnapshot,
  extractTopPriorityTitles,
  mapPublicFamilyDiagnosticDetail,
  mapPublicFamilyDiagnosticListItem,
} from './diagnosticFormatters'
import {
  countPublicFamilyDiagnostics,
  fetchPublicFamilyDiagnosticDetail,
  fetchPublicFamilyDiagnosticHistory,
  formatHouseholdAssessmentError,
} from './householdAssessmentsApi'
import {
  isEligibleForFinancialProgressEvidence,
  isPublicFamilyDiagnostic,
  selectLatestPublicFamilyDiagnostic,
  selectLatestPublicSelfReportAssessment,
  selectLatestWorkspaceAssessments,
} from '../householdsApi'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL } from './types'

function createQuery(result: { data: unknown; error: null | object }) {
  const query: Record<string, unknown> = {}
  const self = new Proxy(query, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self)
      }
      return target[prop as string]
    },
  })
  return self
}

const publicRow = {
  id: 'assess-public-1',
  household_id: 'hh-1',
  lead_id: 'lead-1',
  assessment_type: 'family',
  status: 'completed',
  overall_score: 72,
  overall_grade: 'C',
  completed_at: '2026-07-28T18:00:00.000Z',
  capture_channel: 'public_self_report',
  scoring_version: 1,
  priorities: [{ title: 'Build emergency savings', level: 'high', why: 'Thin reserves', timeline: '90 days' }],
  answers: {
    family: {
      firstName: 'Jamie',
      lastName: 'Rivera',
      email: 'jamie@example.com',
      phone: '555-111-2222',
      maritalStatus: 'Married',
      numberOfChildren: '2',
    },
    financial: { householdIncome: '120000', totalDebt: '25000', emergencyFundMonths: '1' },
    protection: { currentLifeInsurance: '100000', hasWill: 'No' },
    goals: { selected: ['Reduce debt'] },
  },
  derived_metrics: {
    currentLevel: 'Building',
    protectionGapFormatted: '$450,000',
    protectionGapAmount: 450000,
    categories: [
      { id: 'cash_flow', title: 'Cash Flow', score: 70, grade: 'C' },
      { id: 'debt', title: 'Debt', score: 55, grade: 'F' },
      { id: 'emergency', title: 'Emergency Fund', score: 40, grade: 'F' },
      { id: 'protection', title: 'Protection', score: 60, grade: 'D' },
      { id: 'retirement', title: 'Retirement', score: 65, grade: 'D' },
      { id: 'estate', title: 'Estate', score: 50, grade: 'F' },
    ],
    scoreComparison: { scoreMismatch: false },
    internal_secret_key: 'should-be-ignored',
  },
  deleted_at: null,
}

describe('diagnostic formatters', () => {
  it('extracts six category results without inventing extras', () => {
    const categories = extractDiagnosticCategories(publicRow.derived_metrics)
    expect(categories).toHaveLength(6)
    expect(categories.map((c) => c.title)).toEqual([
      'Cash Flow',
      'Debt',
      'Emergency Fund',
      'Protection',
      'Retirement',
      'Estate',
    ])
  })

  it('separates diagnostic priorities from submitted goals', () => {
    const priorities = extractDiagnosticPriorities(publicRow.priorities, publicRow.answers)
    expect(priorities.some((p) => p.source === 'diagnostic' && p.title === 'Build emergency savings')).toBe(
      true,
    )
    expect(priorities.some((p) => p.source === 'submitted_goal' && p.title === 'Reduce debt')).toBe(true)
    expect(extractTopPriorityTitles(publicRow.priorities, publicRow.answers, 3)).toEqual([
      'Build emergency savings',
    ])
  })

  it('allow-lists diagnostic flags and ignores unknown keys', () => {
    const flags = extractDiagnosticFlags(publicRow.derived_metrics)
    expect(flags.map((f) => f.id)).toEqual(['current_level', 'protection_gap'])
    expect(flags.map((f) => f.label).join(' ')).not.toMatch(/internal_secret/i)
  })

  it('maps submitted snapshot fields with clear values only', () => {
    const snapshot = extractSubmittedDiagnosticSnapshot(publicRow.answers)
    expect(snapshot.firstName).toBe('Jamie')
    expect(snapshot.email).toBe('jamie@example.com')
    expect(snapshot.totalDebt).toBe('25000')
    expect(snapshot.submittedGoals).toEqual(['Reduce debt'])
  })

  it('maps list and detail without exposing raw capture_channel text', () => {
    const list = mapPublicFamilyDiagnosticListItem(publicRow, {
      householdId: 'hh-1',
      isLatest: true,
      lead: {
        id: 'lead-1',
        status: 'unassigned',
        ingest_match_status: 'new_prospect',
        sheets_sync_status: 'succeeded',
        consent_snapshot: { contactPermission: false },
      },
    })
    expect(list?.productLabel).toBe(PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL)
    expect(list?.contactPermission).toBe(false)
    expect(JSON.stringify(list)).not.toMatch(/public_self_report|capture_channel/)

    const detail = mapPublicFamilyDiagnosticDetail(publicRow, 'hh-1', {
      id: 'lead-1',
      status: 'unassigned',
      ingest_match_status: 'exact_trusted_match',
      sheets_sync_status: 'failed',
      consent_snapshot: {
        assessmentStorageAcknowledged: true,
        contactPermission: true,
        emailMarketingConsent: false,
        smsMarketingConsent: false,
        privacyAcknowledged: true,
      },
      source_page: '/family-assessment',
      original_source_metadata: { utmSource: 'newsletter' },
    })
    expect(detail?.categories).toHaveLength(6)
    expect(detail?.consent?.emailMarketingConsent).toBe(false)
    expect(detail?.lead?.ingestMatchStatus).toBe('exact_trusted_match')
    expect(JSON.stringify(detail)).not.toMatch(/Apps Script|internal_secret/)
  })
})

describe('public family diagnostic selection coexistence with FP', () => {
  it('keeps IFD and FP selections separate for mixed rows', () => {
    const rows = [
      { ...publicRow, id: 'public-new', completed_at: '2026-07-20T00:00:00.000Z' },
      {
        ...publicRow,
        id: 'trusted',
        capture_channel: 'advisor_reviewed',
        overall_score: 90,
        overall_grade: 'A',
        completed_at: '2026-06-01T00:00:00.000Z',
      },
      {
        ...publicRow,
        id: 'draft',
        status: 'draft',
        completed_at: null,
      },
      {
        ...publicRow,
        id: 'deleted',
        deleted_at: '2026-07-01T00:00:00.000Z',
      },
      {
        ...publicRow,
        id: 'onboarding-ish',
        assessment_type: 'household_onboarding',
      },
    ]

    const ifd = selectLatestPublicFamilyDiagnostic(rows)
    const fp = selectLatestWorkspaceAssessments(rows)
    expect(ifd?.id).toBe('public-new')
    expect(ifd?.overall_score).toBe(72)
    expect(fp.familyAssessment?.id).toBe('trusted')
    expect(fp.familyAssessment?.overall_score).toBe(90)
    expect(isEligibleForFinancialProgressEvidence(ifd!)).toBe(false)
    expect(isPublicFamilyDiagnostic(ifd!)).toBe(true)
    expect(countPublicFamilyDiagnostics(rows)).toBe(1)
  })

  it('uses stable newest-first tie-breaking by completed_at then caller order', () => {
    const rows = [
      { ...publicRow, id: 'a', completed_at: '2026-07-28T18:00:00.000Z' },
      { ...publicRow, id: 'b', completed_at: '2026-07-28T18:00:00.000Z' },
    ]
    expect(selectLatestPublicFamilyDiagnostic(rows)?.id).toBe('a')
  })
})

describe('householdAssessmentsApi', () => {
  it('fetches newest-first history and scopes detail to household', async () => {
    const older = {
      ...publicRow,
      id: 'assess-old',
      completed_at: '2026-06-01T00:00:00.000Z',
    }
    const from = vi.fn((table: string) => {
      if (table === 'assessments') {
        return createQuery({ data: [publicRow, older], error: null })
      }
      if (table === 'leads') {
        return createQuery({
          data: [
            {
              id: 'lead-1',
              status: 'unassigned',
              sheets_sync_status: 'succeeded',
              consent_snapshot: { contactPermission: true },
              ingest_match_status: 'new_prospect',
              duplicate_review_status: 'none',
            },
          ],
          error: null,
        })
      }
      return createQuery({ data: [], error: null })
    })

    const history = await fetchPublicFamilyDiagnosticHistory(
      { from } as unknown as SupabaseClient,
      'hh-1',
    )
    expect(history.map((item) => item.assessmentId)).toEqual(['assess-public-1', 'assess-old'])
    expect(history[0].isLatest).toBe(true)
    expect(history[0].productLabel).toBe(PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL)

    const detailFrom = vi.fn((table: string) => {
      if (table === 'assessments') return createQuery({ data: publicRow, error: null })
      if (table === 'leads') {
        return createQuery({
          data: [{ id: 'lead-1', status: 'new', consent_snapshot: {}, sheets_sync_status: 'pending' }],
          error: null,
        })
      }
      return createQuery({ data: null, error: null })
    })
    const detail = await fetchPublicFamilyDiagnosticDetail(
      { from: detailFrom } as unknown as SupabaseClient,
      'hh-1',
      'assess-public-1',
    )
    expect(detail?.assessmentId).toBe('assess-public-1')
    expect(detail?.categories).toHaveLength(6)
  })

  it('converts errors safely without raw PostgREST leakage in user helper', () => {
    expect(formatHouseholdAssessmentError('history', { message: 'JWT expired', code: 'PGRST301' })).toContain(
      'history failed',
    )
  })
})

describe('public report-card history mapping for all four types', () => {
  it('distinguishes Business, Retirement, and Protection Gap snapshots', () => {
    const business = mapPublicFamilyDiagnosticListItem(
      { ...publicRow, id: 'biz-1', assessment_type: 'business', overall_score: 81, overall_grade: 'B' },
      { householdId: 'hh-1', isLatest: true },
    )
    const retirement = mapPublicFamilyDiagnosticListItem(
      { ...publicRow, id: 'ret-1', assessment_type: 'retirement', overall_score: 74, overall_grade: 'C' },
      { householdId: 'hh-1', isLatest: false },
    )
    const protection = mapPublicFamilyDiagnosticListItem(
      {
        ...publicRow,
        id: 'prot-1',
        assessment_type: 'protection',
        overall_score: null,
        overall_grade: null,
        derived_metrics: {
          protectionGapFormatted: '$1,200,000',
          netProtectionGap: 1200000,
        },
      },
      { householdId: 'hh-1', isLatest: false },
    )

    expect(business?.productLabel).toBe('Business Report Card')
    expect(business?.assessmentType).toBe('business')
    expect(retirement?.productLabel).toBe('Retirement Report Card')
    expect(protection?.productLabel).toBe('Protection Gap')
    expect(protection?.overallScore).toBeNull()
    expect(protection?.overallGrade).toBeNull()
    expect(protection?.protectionGapFormatted).toBe('$1,200,000')
  })

  it('selects the latest public self-report of any type and still excludes it from Financial Progress', () => {
    const rows = [
      {
        ...publicRow,
        id: 'prot-newer',
        assessment_type: 'protection',
        overall_score: null,
        overall_grade: null,
        completed_at: '2026-08-01T00:00:00.000Z',
        derived_metrics: { protectionGapFormatted: '$900,000', netProtectionGap: 900000 },
      },
      { ...publicRow, id: 'family-older', completed_at: '2026-07-01T00:00:00.000Z' },
      {
        ...publicRow,
        id: 'trusted-family',
        capture_channel: 'advisor_reviewed',
        completed_at: '2026-08-15T00:00:00.000Z',
      },
    ]
    const latestPublic = selectLatestPublicSelfReportAssessment(rows)
    expect(latestPublic?.id).toBe('prot-newer')
    expect(isEligibleForFinancialProgressEvidence(latestPublic!)).toBe(false)
    expect(selectLatestWorkspaceAssessments(rows).familyAssessment?.id).toBe('trusted-family')
  })
})
