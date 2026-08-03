import { describe, expect, it } from 'vitest'
import {
  isEligibleForFinancialProgressEvidence,
  isPublicFamilyDiagnostic,
  normalizeAssessmentCaptureChannel,
  normalizeWorkspaceAssessment,
  selectLatestPublicFamilyDiagnostic,
  selectLatestWorkspaceAssessments,
} from './householdsApi'

/**
 * Financial Progress evidence-gating helpers (migration 020).
 * Public Family Report Card self-reports must never silently become trusted
 * Household Financial Progress evidence.
 */
describe('normalizeAssessmentCaptureChannel', () => {
  it('passes through known channel values', () => {
    expect(normalizeAssessmentCaptureChannel('public_self_report')).toBe('public_self_report')
    expect(normalizeAssessmentCaptureChannel('advisor_onboarding')).toBe('advisor_onboarding')
    expect(normalizeAssessmentCaptureChannel('advisor_reviewed')).toBe('advisor_reviewed')
    expect(normalizeAssessmentCaptureChannel('imported')).toBe('imported')
    expect(normalizeAssessmentCaptureChannel('unknown')).toBe('unknown')
  })

  it('defaults unrecognized/missing values to unknown (never advisor_reviewed by accident)', () => {
    expect(normalizeAssessmentCaptureChannel(undefined)).toBe('unknown')
    expect(normalizeAssessmentCaptureChannel(null)).toBe('unknown')
    expect(normalizeAssessmentCaptureChannel('')).toBe('unknown')
    expect(normalizeAssessmentCaptureChannel('bogus_channel')).toBe('unknown')
    expect(normalizeAssessmentCaptureChannel(42)).toBe('unknown')
  })
})

describe('isEligibleForFinancialProgressEvidence', () => {
  it('excludes public_self_report', () => {
    expect(isEligibleForFinancialProgressEvidence({ capture_channel: 'public_self_report' })).toBe(false)
  })

  it('includes every other capture channel', () => {
    expect(isEligibleForFinancialProgressEvidence({ capture_channel: 'advisor_onboarding' })).toBe(true)
    expect(isEligibleForFinancialProgressEvidence({ capture_channel: 'advisor_reviewed' })).toBe(true)
    expect(isEligibleForFinancialProgressEvidence({ capture_channel: 'imported' })).toBe(true)
    expect(isEligibleForFinancialProgressEvidence({ capture_channel: 'unknown' })).toBe(true)
  })
})

describe('isPublicFamilyDiagnostic', () => {
  it('is true only for family + public_self_report', () => {
    expect(
      isPublicFamilyDiagnostic({ assessment_type: 'family', capture_channel: 'public_self_report' }),
    ).toBe(true)
  })

  it('is false for other assessment types even with public_self_report', () => {
    expect(
      isPublicFamilyDiagnostic({ assessment_type: 'business', capture_channel: 'public_self_report' }),
    ).toBe(false)
  })

  it('is false for family assessments captured through any trusted channel', () => {
    expect(isPublicFamilyDiagnostic({ assessment_type: 'family', capture_channel: 'advisor_onboarding' })).toBe(
      false,
    )
    expect(isPublicFamilyDiagnostic({ assessment_type: 'family', capture_channel: 'advisor_reviewed' })).toBe(
      false,
    )
    expect(isPublicFamilyDiagnostic({ assessment_type: 'family', capture_channel: 'unknown' })).toBe(false)
  })
})

function completedFamilyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assess-1',
    assessment_type: 'family',
    status: 'completed',
    completed_at: '2026-06-01T00:00:00.000Z',
    overall_score: 72,
    overall_grade: 'C',
    capture_channel: 'public_self_report',
    answers: {},
    derived_metrics: {},
    deleted_at: null,
    ...overrides,
  }
}

describe('selectLatestWorkspaceAssessments excludes public_self_report evidence', () => {
  it('does not select a public self-report family assessment as Financial Progress evidence', () => {
    const selected = selectLatestWorkspaceAssessments([completedFamilyRow()])
    expect(selected.familyAssessment).toBeNull()
  })

  it('selects a trusted advisor-reviewed family assessment as evidence', () => {
    const selected = selectLatestWorkspaceAssessments([
      completedFamilyRow({ id: 'assess-2', capture_channel: 'advisor_reviewed' }),
    ])
    expect(selected.familyAssessment?.id).toBe('assess-2')
    expect(selected.familyAssessment?.capture_channel).toBe('advisor_reviewed')
  })

  it('falls back to the next eligible row when the latest is a public self-report', () => {
    const selected = selectLatestWorkspaceAssessments([
      completedFamilyRow({
        id: 'newer-public',
        completed_at: '2026-07-01T00:00:00.000Z',
        capture_channel: 'public_self_report',
      }),
      completedFamilyRow({
        id: 'older-trusted',
        completed_at: '2026-05-01T00:00:00.000Z',
        capture_channel: 'advisor_onboarding',
      }),
    ])
    expect(selected.familyAssessment?.id).toBe('older-trusted')
  })
})

describe('selectLatestPublicFamilyDiagnostic', () => {
  it('returns the latest public self-report family row for CRM diagnostic history', () => {
    const diagnostic = selectLatestPublicFamilyDiagnostic([completedFamilyRow()])
    expect(diagnostic?.id).toBe('assess-1')
  })

  it('returns null when there is no public self-report family row', () => {
    const diagnostic = selectLatestPublicFamilyDiagnostic([
      completedFamilyRow({ capture_channel: 'advisor_reviewed' }),
    ])
    expect(diagnostic).toBeNull()
  })

  it('legacy rows without capture_channel normalize to unknown and are not treated as public diagnostics', () => {
    const legacyRow = completedFamilyRow({ capture_channel: undefined })
    delete (legacyRow as Record<string, unknown>).capture_channel
    const normalized = normalizeWorkspaceAssessment(legacyRow)
    expect(normalized?.capture_channel).toBe('unknown')
    expect(selectLatestPublicFamilyDiagnostic([legacyRow])).toBeNull()
  })

  it('excludes drafts, deleted rows, and onboarding types from public diagnostic selection', () => {
    expect(
      selectLatestPublicFamilyDiagnostic([
        completedFamilyRow({ id: 'draft', status: 'draft', completed_at: null }),
        completedFamilyRow({ id: 'deleted', deleted_at: '2026-07-01T00:00:00.000Z' }),
        completedFamilyRow({ id: 'onboarding', assessment_type: 'household_onboarding' }),
        completedFamilyRow({ id: 'ok' }),
      ])?.id,
    ).toBe('ok')
  })

  it('does not let a newer public diagnostic replace FP-eligible trusted family evidence', () => {
    const rows = [
      completedFamilyRow({
        id: 'public-new',
        completed_at: '2026-07-01T00:00:00.000Z',
        overall_score: 50,
      }),
      completedFamilyRow({
        id: 'trusted-old',
        capture_channel: 'advisor_onboarding',
        completed_at: '2026-05-01T00:00:00.000Z',
        overall_score: 88,
      }),
    ]
    expect(selectLatestPublicFamilyDiagnostic(rows)?.overall_score).toBe(50)
    expect(selectLatestWorkspaceAssessments(rows).familyAssessment?.overall_score).toBe(88)
  })
})
