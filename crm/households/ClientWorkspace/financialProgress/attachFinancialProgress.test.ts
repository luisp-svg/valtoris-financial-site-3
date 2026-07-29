import { describe, expect, it, vi } from 'vitest'
import { FINANCIAL_PROGRESS_CATEGORY_IDS, FINANCIAL_PROGRESS_METHODOLOGY_VERSION } from '../../../financial-progress'
import type { CrmHouseholdWorkspace, HouseholdAssessmentSummary } from '../../types'
import {
  attachFinancialProgress,
  parseValidIsoTimestamp,
  resolveFinancialProgressAsOf,
  toFinancialProgressInput,
} from './attachFinancialProgress'

function makeAssessment(
  overrides: Partial<HouseholdAssessmentSummary> &
    Pick<HouseholdAssessmentSummary, 'id' | 'assessment_type' | 'completed_at'>,
): HouseholdAssessmentSummary {
  return {
    overall_score: null,
    overall_grade: null,
    answers: null,
    derived_metrics: null,
    ...overrides,
  }
}

function makeWorkspace(
  overrides: Partial<CrmHouseholdWorkspace> = {},
): CrmHouseholdWorkspace {
  return {
    household: {
      id: 'hh-ui-1',
      display_name: 'UI Household',
      status: 'client',
      primary_email: null,
      primary_phone: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      assigned_advisor_id: null,
      relationship_stage_id: 'stage-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
      assigned_advisor: null,
      relationship_stage: null,
      members: [],
    },
    openTasks: [],
    openOpportunities: [],
    familyAssessment: null,
    businessAssessment: null,
    protectionAssessment: null,
    retirementAssessment: null,
    annualReview: null,
    recentActivities: [],
    notes: { ok: true, value: [] },
    activities: { ok: true, value: [] },
    timeline: [],
    timelineComplete: true,
    openCasesCount: 0,
    activePolicies: [],
    financialProgressPolicies: [],
    financialProgressOpenTasks: [],
    recentDocuments: [],
    ...overrides,
  }
}

describe('parseValidIsoTimestamp', () => {
  it('normalizes valid timestamps to ISO', () => {
    expect(parseValidIsoTimestamp('2026-06-15T12:30:00.000Z')).toBe(
      '2026-06-15T12:30:00.000Z',
    )
  })

  it('ignores invalid, empty, and missing values', () => {
    expect(parseValidIsoTimestamp(null)).toBeNull()
    expect(parseValidIsoTimestamp(undefined)).toBeNull()
    expect(parseValidIsoTimestamp('')).toBeNull()
    expect(parseValidIsoTimestamp('   ')).toBeNull()
    expect(parseValidIsoTimestamp('not-a-date')).toBeNull()
  })
})

describe('resolveFinancialProgressAsOf', () => {
  it('uses the most recent valid assessment completed_at', () => {
    const workspace = makeWorkspace({
      familyAssessment: makeAssessment({
        id: 'a-family',
        assessment_type: 'family',
        completed_at: '2026-03-01T00:00:00.000Z',
      }),
      protectionAssessment: makeAssessment({
        id: 'a-protection',
        assessment_type: 'protection',
        completed_at: '2026-06-15T18:00:00.000Z',
      }),
      retirementAssessment: makeAssessment({
        id: 'a-retirement',
        assessment_type: 'retirement',
        completed_at: '2026-05-01T00:00:00.000Z',
      }),
      annualReview: {
        id: 'review-1',
        scheduled_for: '2026-07-01',
        completed_at: '2026-07-20T00:00:00.000Z',
        summary: null,
      },
    })

    expect(resolveFinancialProgressAsOf(workspace)).toBe('2026-06-15T18:00:00.000Z')
  })

  it('ignores invalid assessment dates and falls through to annual review', () => {
    const workspace = makeWorkspace({
      familyAssessment: makeAssessment({
        id: 'a-family',
        assessment_type: 'family',
        completed_at: 'not-a-date',
      }),
      businessAssessment: makeAssessment({
        id: 'a-business',
        assessment_type: 'business',
        completed_at: '   ',
      }),
      annualReview: {
        id: 'review-1',
        scheduled_for: '2026-04-01',
        completed_at: '2026-04-10T09:00:00.000Z',
        summary: null,
      },
    })

    expect(resolveFinancialProgressAsOf(workspace)).toBe('2026-04-10T09:00:00.000Z')
  })

  it('falls back to current timestamp when no valid evaluation dates exist', () => {
    const now = () => new Date('2026-07-28T17:00:00.000Z')
    const workspace = makeWorkspace({
      annualReview: {
        id: 'review-1',
        scheduled_for: '2026-08-01',
        completed_at: null,
        summary: null,
      },
    })

    expect(resolveFinancialProgressAsOf(workspace, now)).toBe(
      '2026-07-28T17:00:00.000Z',
    )
  })

  it('does not use household created_at or updated_at as evaluation dates', () => {
    const now = () => new Date('2026-07-28T17:00:00.000Z')
    const workspace = makeWorkspace()

    expect(resolveFinancialProgressAsOf(workspace, now)).toBe(
      '2026-07-28T17:00:00.000Z',
    )
    expect(resolveFinancialProgressAsOf(workspace, now)).not.toBe(
      workspace.household.created_at,
    )
    expect(resolveFinancialProgressAsOf(workspace, now)).not.toBe(
      workspace.household.updated_at,
    )
  })
})

describe('attachFinancialProgress', () => {
  it('computes Household Financial Progress once from workspace household data', () => {
    const workspace = makeWorkspace()
    const model = attachFinancialProgress(workspace)

    expect(model.household.id).toBe('hh-ui-1')
    expect(model.financialProgress.householdId).toBe('hh-ui-1')
    expect(model.financialProgress.methodologyVersion).toBe(
      FINANCIAL_PROGRESS_METHODOLOGY_VERSION,
    )
    expect(model.financialProgress.isPlaceholder).toBe(false)
    expect(model.financialProgress.categories.map((c) => c.categoryId)).toEqual([
      ...FINANCIAL_PROGRESS_CATEGORY_IDS,
    ])
    const protection = model.financialProgress.categories.find(
      (category) => category.categoryId === 'protection_insurance',
    )
    expect(protection?.status).not.toBe('placeholder')
    expect(model.financialProgress.totalCategoryCount).toBe(8)
    expect(model.financialProgress.overall.score).toBeNull()
    expect(model.financialProgress.overall.grade).toBeNull()
    expect(['partial', 'insufficient_data']).toContain(model.financialProgress.overall.status)
    expect(model.financialProgress.recommendations.length).toBeGreaterThan(0)
  })

  it('maps workspace fields into engine input without inventing household models', () => {
    const now = () => new Date('2026-07-28T17:00:00.000Z')
    const openTasks = [
      {
        id: 'task-1',
        title: 'Review budget',
        due_date: null,
        priority: 'medium',
        status: 'open',
      },
    ]
    const activePolicies = [
      {
        id: 'pol-1',
        carrier: 'Acme',
        policy_type: 'Life',
        status: 'active',
        coverage_amount: 100000,
        renewal_or_review_date: null,
        beneficiary: 'Sam',
      },
    ]
    const openOpportunities = [
      {
        id: 'opp-1',
        title: 'Disability gap',
        status: 'open',
        next_action: null,
        stage: null,
      },
    ]
    const retirementAssessment = makeAssessment({
      id: 'a-retirement',
      assessment_type: 'retirement',
      completed_at: '2026-05-01T00:00:00.000Z',
    })
    const workspace = makeWorkspace({
      openTasks,
      activePolicies,
      openOpportunities,
      retirementAssessment,
      financialProgressPolicies: activePolicies,
      financialProgressOpenTasks: openTasks,
    })

    const input = toFinancialProgressInput(workspace, { now })
    expect(input.household).toBe(workspace.household)
    expect(input.policies).toBe(workspace.financialProgressPolicies)
    expect(input.openTasks).toBe(workspace.financialProgressOpenTasks)
    expect(input.openOpportunities).toBe(workspace.openOpportunities)
    expect(input.assessments?.retirement).toBe(workspace.retirementAssessment)
    expect(input.assessments?.family).toBe(workspace.familyAssessment)
    expect(input.assessments?.business).toBe(workspace.businessAssessment)
    expect(input.assessments?.protection).toBe(workspace.protectionAssessment)
    expect(input.asOf).toBe('2026-05-01T00:00:00.000Z')
  })

  it('prefers complete scoring collections over preview-limited UI lists', () => {
    const previewTasks = [
      {
        id: 'task-preview',
        title: 'Preview task',
        due_date: null,
        priority: 'low',
        status: 'open',
      },
    ]
    const scoringTasks = [
      {
        id: 'task-score',
        title: 'Debt snowball',
        due_date: null,
        priority: 'high',
        status: 'open',
      },
    ]
    const previewPolicies = [
      {
        id: 'pol-preview',
        carrier: 'Preview',
        policy_type: 'Auto',
        status: 'active',
        coverage_amount: 1,
        renewal_or_review_date: null,
        beneficiary: null,
      },
    ]
    const scoringPolicies = [
      {
        id: 'pol-score',
        carrier: 'Score',
        policy_type: 'Life',
        status: 'active',
        coverage_amount: 500000,
        renewal_or_review_date: null,
        beneficiary: 'Alex',
      },
    ]
    const workspace = makeWorkspace({
      openTasks: previewTasks,
      activePolicies: previewPolicies,
      financialProgressOpenTasks: scoringTasks,
      financialProgressPolicies: scoringPolicies,
    })

    const input = toFinancialProgressInput(workspace, {
      now: () => new Date('2026-07-28T17:00:00.000Z'),
    })
    expect(input.openTasks).toBe(scoringTasks)
    expect(input.policies).toBe(scoringPolicies)
  })

  it('passes a stable asOf through to the engine snapshot', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-28T20:00:00.000Z'))
    try {
      const workspace = makeWorkspace({
        familyAssessment: makeAssessment({
          id: 'a-family',
          assessment_type: 'family',
          completed_at: '2026-02-10T08:00:00.000Z',
        }),
      })
      const model = attachFinancialProgress(workspace)
      expect(model.financialProgress.snapshot.computedAt).toBe(
        '2026-02-10T08:00:00.000Z',
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
