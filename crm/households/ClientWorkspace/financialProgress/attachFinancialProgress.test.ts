import { describe, expect, it } from 'vitest'
import { FINANCIAL_PROGRESS_CATEGORY_IDS, FINANCIAL_PROGRESS_METHODOLOGY_VERSION } from '../../../financial-progress'
import type { CrmHouseholdWorkspace } from '../../types'
import { attachFinancialProgress, toFinancialProgressInput } from './attachFinancialProgress'

function makeWorkspace(): CrmHouseholdWorkspace {
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
    recentDocuments: [],
  }
}

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
    const workspace = makeWorkspace()
    const input = toFinancialProgressInput(workspace)
    expect(input.household).toBe(workspace.household)
    expect(input.policies).toBe(workspace.activePolicies)
    expect(input.openTasks).toBe(workspace.openTasks)
    expect(input.assessments?.retirement).toBe(workspace.retirementAssessment)
  })
})
