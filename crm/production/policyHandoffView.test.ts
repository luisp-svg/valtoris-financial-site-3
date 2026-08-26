import { describe, expect, it } from 'vitest'
import { crmHouseholdPoliciesPath, crmProductionPath } from '../../constants/routes'
import { formatProductionStageLabel } from './labels'
import {
  CASE_POLICY_STATUS_SEPARATE_NOTE,
  linkedPolicyHandoffModel,
} from './policyHandoffView'
import type { ProductionApplicationListItem } from './types'

function item(
  over: Partial<ProductionApplicationListItem> = {},
): ProductionApplicationListItem {
  return {
    id: 'app-1',
    household_id: 'hh-1',
    carrier_id: 'c-1',
    product_id: 'p-1',
    product_line: 'life_term',
    state: 'TX',
    application_number: 'APP-1',
    policy_number: 'LN-100',
    production_stage: 'issued',
    underwriting_disposition: 'pending',
    delivery_status: 'not_started',
    submission_date: '2026-01-15',
    next_follow_up_date: null,
    updated_at: '2026-01-15T00:00:00Z',
    deleted_at: null,
    household: { id: 'hh-1', display_name: 'Rivera' },
    carrier: { id: 'c-1', name: 'National Life Group', code: 'NLG' },
    product: { id: 'p-1', name: 'LSW Term 20', product_line: 'life_term' },
    participants: [],
    allocations: [],
    stage_history: [],
    linked_policies: [
      { id: 'pol-1', policy_number: 'LN-100', status: 'issued', deleted_at: null },
    ],
    writing_receivable_expected: true,
    expected_compensations: [],
    opportunity_id: null,
    submitted_premium_cents: 120000,
    annuity_deposit_cents: null,
    face_amount_cents: 50000000,
    premium_mode: 'annual',
    issue_date: '2026-04-01',
    in_force_date: null,
    overdue_requirement_count: 0,
    ...over,
  }
}

describe('Case → Policy handoff', () => {
  it('is visible when a linked policy exists and routes to Household Policies', () => {
    const model = linkedPolicyHandoffModel(item())
    expect(model.visible).toBe(true)
    expect(model.policyNumber).toBe('LN-100')
    expect(model.policyStatusLabel).toBe('Issued')
    expect(model.effectiveDateLabel).toBeTruthy()
    expect(model.householdPoliciesHref).toBe(crmHouseholdPoliciesPath('hh-1'))
    expect(model.householdPoliciesHref).toContain('?tab=policies')
    expect(model.householdPoliciesHref).not.toContain('/crm/policies/')
  })

  it('hides the handoff when no linked policy row exists', () => {
    const model = linkedPolicyHandoffModel(item({ linked_policies: [] }))
    expect(model.visible).toBe(false)
    expect(model.householdPoliciesHref).toBeNull()
  })

  it('freezes issued Policy vs not_taken Case without reconciling statuses', () => {
    const model = linkedPolicyHandoffModel(
      item({
        production_stage: 'not_taken',
        linked_policies: [
          { id: 'pol-1', policy_number: 'LN-100', status: 'issued', deleted_at: null },
        ],
      }),
    )
    expect(model.visible).toBe(true)
    expect(model.policyStatusLabel).toBe('Issued')
    expect(model.policyStatusRaw).toBe('issued')
    expect(model.caseStageLabel).toBe(formatProductionStageLabel('not_taken'))
    expect(model.showDivergentNotTakenIssuedNote).toBe(true)
    expect(CASE_POLICY_STATUS_SEPARATE_NOTE).toMatch(/separately/)
    expect(crmProductionPath('app-1')).toBe('/crm/production/app-1')
  })
})
